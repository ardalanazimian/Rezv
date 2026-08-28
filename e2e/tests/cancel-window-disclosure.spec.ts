import { expect, test } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, login, navTo } from './helpers/actions';

/**
 * پنجره‌ی لغوِ رایگان — افشا و دو مسیرِ لغو.
 *
 * چرا این تست وجود دارد (ممیزیِ پیش از لانچ، ۲۰۲۶-۰۸-۲۸): `lib/economy.ts:111`
 * لغوِ دیرتر از پنجره را با امتیازِ ۳۵ به‌جایِ ۸۵ **و یک strike** ثبت می‌کند و
 * strike جلویِ سطحِ platinum را می‌گیرد — نشانی که به رستوران‌ها هم نمایش داده
 * می‌شود. ولی هیچ‌جای اپ این پنجره را به مهمان نمی‌گفت: قاعده‌ای که اجرا می‌شد
 * ولی اعلام نشده بود، یعنی جریمه‌ی پنهان.
 *
 * این تست هر دو مسیر را پین می‌کند:
 *   • داخلِ پنجره → `undoSnack`ِ بی‌اصطکاکِ فعلی، **بدونِ** دیالوگ
 *   • دیرتر از پنجره → دیالوگِ تأیید با پیامدِ صریح
 * و اینکه اصطکاک فقط جایی اضافه شود که پیامدِ واقعی دارد (لغوِ آسان no-show را
 * کم می‌کند — به همین دلیل مسیرِ داخلِ پنجره عمداً دست‌نخورده ماند).
 */

/** رزروِ پیش‌روِ ساختگی با فاصله‌ی دلخواه تا زمانِ رزرو. */
function upcoming(hoursFromNow: number, freeCancelHours: number) {
  return [{
    id: '11111111-1111-1111-1111-111111111111',
    code: 'RZ-CANCEL-1',
    status: 'confirmed',
    partySize: 2,
    slotStart: new Date(Date.now() + hoursFromNow * 3600_000).toISOString(),
    restaurantId: '22222222-2222-2222-2222-222222222222',
    restaurant: { name: 'کافه آزمون', slug: 'cafe-azmoon', freeCancelHours },
    items: [],
  }];
}

async function openTrips(page: import('@playwright/test').Page, rows: unknown) {
  await mockApi(page, { loggedIn: true });
  // بعد از mockApi ثبت می‌شود تا رویِ پاسخِ پیش‌فرضِ `[]` بنشیند.
  await page.route('**/api/v1/me/reservations', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
  await gotoApp(page);
  await login(page);            // renderTrips فقط برایِ کاربرِ واردشده fetch می‌کند
  await navTo(page, 'trips');
  await expect(page.locator('.trip-card').first()).toBeVisible({ timeout: 15_000 });
}

test.describe('افشایِ پنجره‌ی لغو', () => {
  test.slow();

  test('رزروِ داخلِ پنجره: اطلاعِ خنثی نشان داده می‌شود، نه هشدار', async ({ page }) => {
    await openTrips(page, upcoming(72, 24));   // ۷۲ ساعت مانده، پنجره ۲۴ ساعت
    const note = page.locator('.trip-cancel-note').first();
    await expect(note).toBeVisible();
    await expect(note).toContainText('لغوِ رایگان تا');
    await expect(note).not.toHaveClass(/late/);
  });

  test('رزروِ داخلِ پنجره‌ی جریمه: هشدارِ فعال نشان داده می‌شود', async ({ page }) => {
    await openTrips(page, upcoming(3, 24));    // فقط ۳ ساعت مانده
    const note = page.locator('.trip-cancel-note.late').first();
    await expect(note).toBeVisible();
    await expect(note).toContainText('تخلف');
  });

  test('پنجره‌ی نامعلوم: هیچ ادعایی نمی‌شود (سکوت، نه حدس)', async ({ page }) => {
    const rows = upcoming(3, 24) as any[];
    delete rows[0].restaurant.freeCancelHours;   // سرور پنجره را نداد
    await openTrips(page, rows);
    await expect(page.locator('.trip-cancel-note')).toHaveCount(0);
  });
});

test.describe('دو مسیرِ لغو', () => {
  test.slow();

  test('داخلِ پنجره: بدونِ دیالوگ — همان undoSnackِ فعلی', async ({ page }) => {
    await openTrips(page, upcoming(72, 24));
    await page.locator('.trip-card .btn', { hasText: 'لغو' }).first().click();
    // دیالوگِ تأیید نباید باز شود.
    await expect(page.locator('#lateCancelGo')).toHaveCount(0);
    // مسیرِ فعلی یک اسنکِ undo نشان می‌دهد.
    await expect(page.locator('body')).toContainText('رزرو لغو شد', { timeout: 8_000 });
  });

  test('دیرهنگام: دیالوگِ تأیید با پیامدِ صریحِ strike باز می‌شود', async ({ page }) => {
    await openTrips(page, upcoming(3, 24));
    await page.locator('.trip-card .btn', { hasText: 'لغو' }).first().click();

    const dialog = page.locator('#sheet');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-label', 'تأیید لغو رزرو');
    await expect(page.locator('#lateCancelGo')).toBeVisible();
    // پیامد باید صریح باشد، نه مبهم.
    await expect(dialog).toContainText('تخلف');
    await expect(dialog).toContainText('نشانِ اعتبارت');
  });

  test('دیالوگِ دیرهنگام با Esc بسته می‌شود و رزرو لغو نمی‌شود', async ({ page }) => {
    let cancelCalls = 0;
    await openTrips(page, upcoming(3, 24));
    await page.route('**/api/v1/reservations/*/cancel', (route) => {
      cancelCalls++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.locator('.trip-card .btn', { hasText: 'لغو' }).first().click();
    await expect(page.locator('#lateCancelGo')).toBeVisible();
    await page.keyboard.press('Escape');
    // `closeSheet` کلاسِ `show` را برمی‌دارد و محتوا در DOM می‌ماند (رفتارِ
    // واقعیِ auth.js:277) — پس معیارِ بسته‌شدن پنهان‌شدنِ شیت است، نه حذفِ گره.
    await expect(page.locator('#sheet')).not.toHaveClass(/show/);
    await expect(page.locator('#lateCancelGo')).toBeHidden();
    // و برچسبِ دسترس‌پذیر باید به حالتِ اولش برگردد، وگرنه شیتِ بعدی نامِ دروغ می‌گیرد.
    await expect(page.locator('#sheet')).toHaveAttribute('aria-label', 'جزئیات رزرو');
    expect(cancelCalls).toBe(0);   // انصراف یعنی هیچ درخواستی نرفته
  });

  test('دیرهنگام: تأیید یک POSTِ واقعیِ لغو می‌فرستد', async ({ page }) => {
    const hits: string[] = [];
    await openTrips(page, upcoming(3, 24));
    await page.route('**/api/v1/reservations/*/cancel', (route) => {
      hits.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.locator('.trip-card .btn', { hasText: 'لغو' }).first().click();
    await page.locator('#lateCancelGo').click();
    await expect.poll(() => hits.length, { timeout: 10_000 }).toBe(1);
    expect(hits[0]).toContain('RZ-CANCEL-1');
  });

  test('دیرهنگام: شکستِ سرور داخلِ دیالوگ نشان داده می‌شود، نه موفقیتِ جعلی', async ({ page }) => {
    await openTrips(page, upcoming(3, 24));
    await page.route('**/api/v1/reservations/*/cancel', (route) =>
      route.fulfill({
        status: 409, contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'CONFLICT', message: 'این رزرو قابلِ لغو نیست' } }),
      }));

    await page.locator('.trip-card .btn', { hasText: 'لغو' }).first().click();
    await page.locator('#lateCancelGo').click();
    // دیالوگ باز می‌ماند و پیامِ سرور را می‌گوید.
    await expect(page.locator('#lateCancelErr')).toContainText('این رزرو قابلِ لغو نیست', { timeout: 10_000 });
    await expect(page.locator('#lateCancelGo')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('رزرو لغو شد');
  });
});
