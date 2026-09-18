// ═══════════════════════════════════════════════════════════════════════
//  لینکِ مستقیمِ رستوران — D-31 (m-24 · سفرِ طلاییِ ۴)
//
//  چرا این فایل هست: تا ۲۰۲۶-۰۹-۱۷ این اپ deep-link به‌ازای هر رستوران نداشت
//  (SPA بدونِ روتینگِ URL)، پس QRِ میز / فاکتور / اینستاگرامِ رستوران — یعنی
//  هر سه مسیرِ ورودِ مهمانِ لانچ — هیچ لینکی نداشتند که «همان رستوران» را باز
//  کند، و `shareRestaurant` آدرسِ کلیِ اپ را می‌داد.
//
//  این تست سه چیز را قفل می‌کند:
//   ۱. بازِ سرد با لینک: همان رستوران باز می‌شود و تاریخ/نفرِ لینک از قبل نشسته‌اند
//   ۲. slugِ ناشناس: یک **حالتِ واقعیِ «پیدا نشد»**، نه بازگشتِ خاموش به فید
//   ۳. ورودیِ خصمانه: نه اجرای اسکریپت، نه ناوبری به مبدأِ دیگر
// ═══════════════════════════════════════════════════════════════════════
import { expect, test, type Page, type Route } from '@playwright/test';
import { DEMO_RESTAURANTS, mockApi } from './helpers/mock-api';

const SLUG = 'demo-sushi-bar';
const NAME = 'سوشی بار';

/** فردا به‌صورتِ YYYY-MM-DD — تاریخِ گذشته عمداً نادیده گرفته می‌شود. */
function tomorrowISO(): string {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function openLink(page: Page, query: string) {
  await page.addInitScript(() => { try { localStorage.setItem('rz_onboarded', '1'); } catch { /* ignore */ } });
  await page.goto(`/${query}`);
}

/** هر دو شکلِ درخواستِ *فهرست* را می‌گیرد (با و بدونِ query) — نه روتِ جزئیات. */
async function routeList(page: Page, handler: (r: Route) => Promise<void> | void) {
  await page.route('**/api/v1/restaurants?**', handler);
  await page.route('**/api/v1/restaurants', handler);
}

test.describe('لینکِ مستقیمِ رستوران (D-31)', () => {
  test.slow();

  test('بازِ سرد با لینک: همان رستوران باز می‌شود و تاریخ/نفر از قبل نشسته‌اند', async ({ page }) => {
    await mockApi(page);
    const d = tomorrowISO();
    await openLink(page, `?r=${SLUG}&d=${d}&p=4`);

    // صفحه‌ی رستوران — نه فید
    await expect(page.locator('#page-rest')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#page-rest')).toContainText(NAME);

    // تاریخ و نفرِ لینک باید **پیش از** بازشدن نشسته باشند، نه بعدش
    const ctx = await page.evaluate(() => {
      try { return JSON.parse(sessionStorage.getItem('rz_booking_ctx') || 'null'); } catch { return null; }
    });
    expect(ctx?.party).toBe(4);
    expect(ctx?.date).toBe(d);
  });

  test('تاریخِ گذشته نادیده گرفته می‌شود ولی خودِ لینک باطل نمی‌شود', async ({ page }) => {
    await mockApi(page);
    await openLink(page, `?r=${SLUG}&d=2020-01-01&p=3`);
    await expect(page.locator('#page-rest')).toContainText(NAME, { timeout: 15_000 });
    const ctx = await page.evaluate(() => {
      try { return JSON.parse(sessionStorage.getItem('rz_booking_ctx') || 'null'); } catch { return null; }
    });
    expect(ctx?.party).toBe(3);              // نفر پذیرفته شد
    expect(ctx?.date).not.toBe('2020-01-01'); // تاریخِ گذشته نه
  });

  test('slugِ ناشناس: حالتِ «پیدا نشد» — نه بازگشتِ خاموش به فید', async ({ page }) => {
    await mockApi(page);
    // mockِ پیش‌فرض برای slugِ ناشناس اولین رستورانِ نمونه را می‌دهد؛ این‌جا
    // رفتارِ واقعیِ سرور (۴۰۴) لازم است.
    await page.route('**/api/v1/restaurants/no-such-place*', (r) =>
      r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND' } }) }));

    await openLink(page, '?r=no-such-place');
    const rest = page.locator('#page-rest');
    await expect(rest).toContainText('این رستوران پیدا نشد', { timeout: 15_000 });
    // و مهم: فید جایگزینش نشده
    await expect(page.locator('#page-discover')).not.toBeVisible();
  });

  // ⚠️ این دو تست از یک اندازه‌گیری آمدند، نه از حدس. نسخه‌ی اولِ
  // `openDeepLinkIfAny` منتظرِ اولین sync می‌ماند؛ probe نشان داد آن انتظار
  // خودش همان دروغ را می‌سازد (زیر) و نبودش یک خرابیِ دومِ بی‌صدا دارد (پایین‌تر).
  test('فهرست ۵۰۰ می‌دهد ولی خودِ رستوران سالم است — لینک باید باز شود', async ({ page }) => {
    await mockApi(page);
    // فقط `GET /restaurants` می‌شکند؛ `GET /restaurants/<slug>` دست‌نخورده است.
    // این حالتِ واقعیِ «فهرست خراب، رستوران سالم» است: مهمانی که QRِ میز را
    // اسکن کرده نباید به‌خاطرِ خرابیِ یک روتِ دیگر «پیدا نشد» ببیند.
    await routeList(page, (r) =>
      r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'BOOM' } }) }));

    await openLink(page, `?r=${SLUG}`);
    await expect(page.locator('#page-rest')).toContainText(NAME, { timeout: 15_000 });
    await expect(page.locator('#page-rest')).not.toContainText('این رستوران پیدا نشد');
  });

  test('رستورانِ لینک در فهرست نیست — «رزرو میز» بعد از رسیدنِ فهرست هم کار می‌کند', async ({ page }) => {
    await mockApi(page);
    // فید صفحه‌بندی‌شده است، پس رستورانِ لینک می‌تواند در صفحه‌ی اول نباشد.
    // فهرست عمداً کُند است تا **بعد از** بازشدنِ صفحه برسد و `R` را جایگزین کند.
    const without = DEMO_RESTAURANTS.filter((r) => r.slug !== SLUG);
    await routeList(page, async (r) => {
      await new Promise((res) => setTimeout(res, 1200));
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ restaurants: without, next_cursor: null }) });
    });

    await openLink(page, `?r=${SLUG}`);
    await expect(page.locator('#page-rest')).toContainText(NAME, { timeout: 15_000 });
    await page.waitForTimeout(2500);              // فهرست رسید و R را عوض کرد

    // `openBookSheet` از `findR(id)` می‌خواند؛ اگر رکورد با جایگزینیِ R گم شده
    // باشد، این دکمه بی‌صدا هیچ‌کاری نمی‌کند — همان مسیرِ QRِ میز که می‌شکند.
    await page.locator('.rp-bookbar-btn').click();
    await expect(page.locator('#sheet')).toHaveClass(/show/, { timeout: 5_000 });
    await expect(page.locator('#sheet')).toContainText(NAME);
  });

  test('ورودیِ خصمانه: نه اجرای اسکریپت، نه خروج از مبدأ', async ({ page }) => {
    await mockApi(page);
    let dialogs = 0;
    page.on('dialog', async (d) => { dialogs++; await d.dismiss(); });

    // مبدأِ مرجع را از یک بازِ سالم می‌گیریم، نه از خودِ صفحه در همان لحظه —
    // مقایسه با خودش یک اینهمانی است و هیچ‌چیز اثبات نمی‌کند.
    await openLink(page, '');
    const origin = new URL(page.url()).origin;

    for (const bad of [
      '?r=%3Cscript%3Ealert(1)%3C%2Fscript%3E',
      '?r=%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E',
      '?r=//evil.example.com',
      '?r=https%3A%2F%2Fevil.example.com',
    ]) {
      await openLink(page, bad);
      await page.waitForTimeout(800);
      // هیچ اسکریپتی اجرا نشده
      expect(dialogs).toBe(0);
      // هنوز روی همان مبدأ هستیم (بدونِ open redirect)
      expect(new URL(page.url()).origin).toBe(origin);
      // و چون slug معتبر نیست، اصلاً صفحه‌ی رستوران باز نشده
      await expect(page.locator('#page-discover')).toBeVisible();
    }
  });
});
