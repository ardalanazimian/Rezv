import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, login, navTo } from './helpers/actions';

/**
 * کارتِ رزروِ بسته‌شده همان چیزی را می‌گوید که پیامک گفت (STATE M-15 · F002).
 *
 * چرا (Feature Verification، ۲۰۲۶-۰۹-۱۷): `reservation.js` سه وضعیتِ متفاوت را در
 * یک سطلِ «لغوشده» می‌ریخت. پیامکِ `booking_noshow` می‌گفت «عدم حضور ثبت شد» و
 * `booking_rejected` «رزرو شما تأیید نشد»، ولی کارتِ اپ برای هر دو «لغوشده» بود —
 * و برای عدم‌حضور سرور همان لحظه کش‌بک را برگردانده و strike ثبت کرده بود.
 *
 * ⚠️ این تست API را mock می‌کند، پس فقط **UI** را می‌سنجد، نه قرارداد را. شکلِ
 * واقعیِ `noShow` در `api/tests/me-reservations-no-show-outcome.integration.test.mts`
 * پین شده است.
 *
 * ⚠️ قیدِ CEO: هیچ وعده‌ی برگشتی داده نمی‌شود. رستوران امروز هیچ راهی برای اصلاحِ
 * عدم‌حضور ندارد، پس «پیام به رستوران» فقط پیام است.
 */

const RID = '22222222-2222-2222-2222-222222222222';

function row(over: Record<string, unknown>) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'RZ-OUT-1',
    status: 'no_show',
    partySize: 2,
    slotStart: new Date(Date.now() - 26 * 3600_000).toISOString(),
    restaurantId: RID,
    restaurant: { name: 'کافه آزمون', slug: 'cafe-azmoon', freeCancelHours: 24 },
    depositStatus: 'none',
    items: [],
    noShow: null,
    ...over,
  };
}

async function openTrips(page: Page, rows: unknown[]) {
  await mockApi(page, { loggedIn: true });
  await page.route('**/api/v1/me/reservations', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) }));
  await gotoApp(page);
  await login(page);
  await navTo(page, 'trips');
  await expect(page.locator('.trip-card').first()).toBeVisible({ timeout: 15_000 });
}

const card = (page: Page, code: string) =>
  page.locator('.trip-card').filter({ hasText: code });

test.describe('صداقتِ کارتِ رزروِ بسته‌شده', () => {
  test.slow();

  test('عدم‌حضور: برچسب با پیامک یکی است، نه «لغوشده»', async ({ page }) => {
    await openTrips(page, [row({
      noShow: { recordedAt: new Date(Date.now() - 25 * 3600_000).toISOString(), byRestaurant: false,
        cashbackReversedPoints: 40, strikeRecorded: true, strikeDecayDays: 90 },
    })]);
    const c = card(page, 'RZ-OUT-1');
    await expect(c.locator('.trip-card-status')).toContainText('عدم حضور ثبت شد');
    await expect(c.locator('.trip-card-status')).not.toContainText('لغوشده');
    await expect(c.locator('.tl')).toContainText('عدم حضور');
  });

  test('«چرا؟» فقط واقعیت‌های ثبت‌شده را می‌گوید — بدونِ وعده‌ی برگشت', async ({ page }) => {
    await openTrips(page, [row({
      noShow: { recordedAt: new Date(Date.now() - 25 * 3600_000).toISOString(), byRestaurant: false,
        cashbackReversedPoints: 40, strikeRecorded: true, strikeDecayDays: 90 },
    })]);
    await card(page, 'RZ-OUT-1').getByRole('button', { name: 'چرا؟' }).click();
    const sheet = page.locator('#sheet');
    await expect(sheet).toContainText('به‌صورتِ خودکار');
    await expect(sheet).toContainText('کش‌بکِ این رزرو (۴۰ امتیاز) برگشت');
    await expect(sheet).toContainText('۹۰ روز');
    await expect(sheet).toContainText('هیچ پولی');
    await expect(sheet).not.toContainText(/برمی‌گردانیم|اصلاح می‌شود|جبران می‌شود|پس می‌گیری/);
  });

  test('وقتی سرور چیزی ثبت نکرده، «چرا؟» چیزی ادعا نمی‌کند', async ({ page }) => {
    await openTrips(page, [row({
      depositStatus: 'paid',
      noShow: { recordedAt: null, byRestaurant: false, cashbackReversedPoints: 0,
        strikeRecorded: false, strikeDecayDays: 90 },
    })]);
    await card(page, 'RZ-OUT-1').getByRole('button', { name: 'چرا؟' }).click();
    const sheet = page.locator('#sheet');
    await expect(sheet).toContainText('عدم حضور');
    await expect(sheet).not.toContainText('کش‌بک');
    await expect(sheet).not.toContainText('سابقه');
    await expect(sheet).not.toContainText('هیچ پولی');   // بیعانه‌ی پرداخت‌شده: سکوت، نه حدس
  });

  test('ثبت توسطِ رستوران گفته می‌شود', async ({ page }) => {
    await openTrips(page, [row({
      noShow: { recordedAt: new Date(Date.now() - 25 * 3600_000).toISOString(), byRestaurant: true,
        cashbackReversedPoints: 0, strikeRecorded: true, strikeDecayDays: 90 },
    })]);
    await card(page, 'RZ-OUT-1').getByRole('button', { name: 'چرا؟' }).click();
    await expect(page.locator('#sheet')).toContainText('توسطِ رستوران');
  });

  test('«پیام به رستوران» گفتگو را با خودِ همین رزرو باز می‌کند', async ({ page }) => {
    await openTrips(page, [row({
      noShow: { recordedAt: null, byRestaurant: false, cashbackReversedPoints: 0,
        strikeRecorded: true, strikeDecayDays: 90 },
    })]);
    await page.route('**/api/v1/restaurants/cafe-azmoon/chat', (route) =>
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ thread_id: 't-1' }) }));
    const req = page.waitForRequest((r) => r.url().includes('/restaurants/cafe-azmoon/chat') && r.method() === 'POST');
    await card(page, 'RZ-OUT-1').getByRole('button', { name: 'پیام به رستوران' }).click();
    const body = (await req).postDataJSON() as { reservation_id?: string };
    expect(body.reservation_id).toBe('11111111-1111-1111-1111-111111111111');
  });

  test('ردشده، منقضی و لغوشده هر کدام برچسبِ خودشان را دارند و «چرا؟» ندارند', async ({ page }) => {
    await openTrips(page, [
      row({ id: '31111111-1111-1111-1111-111111111111', code: 'RZ-REJ-1', status: 'rejected' }),
      row({ id: '41111111-1111-1111-1111-111111111111', code: 'RZ-EXP-1', status: 'expired' }),
      row({ id: '51111111-1111-1111-1111-111111111111', code: 'RZ-CAN-1', status: 'cancelled' }),
    ]);
    await expect(card(page, 'RZ-REJ-1').locator('.trip-card-status')).toContainText('تأیید نشد');
    await expect(card(page, 'RZ-EXP-1').locator('.trip-card-status')).toContainText('منقضی شد');
    await expect(card(page, 'RZ-CAN-1').locator('.trip-card-status')).toContainText('لغوشده');
    for (const code of ['RZ-REJ-1', 'RZ-EXP-1', 'RZ-CAN-1']) {
      await expect(card(page, code).getByRole('button', { name: 'چرا؟' })).toHaveCount(0);
    }
  });
});
