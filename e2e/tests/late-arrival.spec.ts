import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, login, navTo, openFirstRestaurant, openRestaurantByName } from './helpers/actions';

/**
 * «دیرتر می‌رسم» در اپِ مشتری (STATE M-13 · F001 · حکمِ CEO D-20).
 *
 * چرا (Feature Verification، ۲۰۲۶-۰۹-۱۶، اندازه‌گیری‌شده): مهمانِ ۱۷ دقیقه دیرکرده در یک تیکِ cron هم
 * running_late شد هم no_show، و اپ هیچ راهی نداشت که به رستوران بگوید در راه است — نه دکمه، نه
 * شماره‌ی رستوران. کارتِ رزرو هم «پیش‌رو» نشان می‌داد در حالی که ساعت گذشته بود.
 *
 * ⚠️ API mock است → فقط **UI**. قواعدِ واقعی (یک‌بار، مهلت، سقف، نوعِ توکن) در
 * api/tests/late-arrival-no-show-gate.integration.test.mts روی routeِ واقعی پین شده‌اند.
 */

const HOUR = 3600_000;
const MIN = 60_000;

function trip(over: Record<string, unknown>) {
  const slot = Date.now() - 5 * MIN;
  return {
    id: '61111111-1111-1111-1111-111111111111', code: 'RZLATE234', status: 'running_late', partySize: 2,
    slotStart: new Date(slot).toISOString(),
    restaurantId: '22222222-2222-2222-2222-222222222222',
    restaurant: { name: 'کافه آزمون', slug: 'cafe-azmoon', freeCancelHours: 24 },
    depositStatus: 'none', items: [], noShow: null,
    lateEtaSignaledAt: null, lateExtensionMinutes: 0,
    late: { graceMinutes: 15, maxExtensionMinutes: 15, deadline: new Date(slot + 15 * MIN).toISOString() },
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

const card = (page: Page, code: string) => page.locator('.trip-card').filter({ hasText: code });

test.describe('«دیرتر می‌رسم»', () => {
  test.slow();

  test('رزروِ دیرکرده: برچسبِ «دیرکرده · تا …» (نه «پیش‌رو»)، هشدار، و دکمه', async ({ page }) => {
    await openTrips(page, [trip({})]);
    const c = card(page, 'RZLATE234');
    await expect(c.locator('.trip-card-status')).toContainText('دیرکرده');
    await expect(c.locator('.trip-card-status')).not.toContainText('پیش‌رو');
    await expect(c.locator('.trip-late-note.late')).toContainText('رستوران تا');
    await expect(c.getByRole('button', { name: 'دیرتر می‌رسم' })).toBeVisible();
  });

  test('برگه: گزینه‌ها به سقفِ رستوران محدودند و POST همان دقیقه را می‌فرستد', async ({ page }) => {
    await openTrips(page, [trip({})]);
    let sent: { minutes?: number } | null = null;
    await page.route('**/api/v1/reservations/RZLATE234/eta', (route) => {
      sent = route.request().postDataJSON() as { minutes?: number };
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ code: 'RZLATE234', extension_minutes: 10, capped: false, deadline: new Date(Date.now() + 20 * MIN).toISOString() }) });
    });
    await card(page, 'RZLATE234').getByRole('button', { name: 'دیرتر می‌رسم' }).click();
    const sheet = page.locator('#sheet');
    await expect(sheet.getByRole('button', { name: 'حدودِ ۱۰ دقیقه دیرتر' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'حدودِ ۱۵ دقیقه دیرتر' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /حدودِ ۲۰ دقیقه/ })).toHaveCount(0);
    await expect(sheet).not.toContainText('نگه داشته می‌شود');   // وعده‌ای که سیستم تضمین نمی‌کند
    await sheet.getByRole('button', { name: 'حدودِ ۱۰ دقیقه دیرتر' }).click();
    await expect.poll(() => sent?.minutes).toBe(10);
    await expect(page.locator('#toastMsg')).toContainText('«عدم حضور» برایت ثبت نمی‌شود');
  });

  test('سقفِ صفر: گزینه‌ی دقیقه نیست، ولی «خبر بده در راهم» هست', async ({ page }) => {
    await openTrips(page, [trip({ late: { graceMinutes: 15, maxExtensionMinutes: 0, deadline: new Date(Date.now() + 10 * MIN).toISOString() } })]);
    await card(page, 'RZLATE234').getByRole('button', { name: 'دیرتر می‌رسم' }).click();
    const sheet = page.locator('#sheet');
    await expect(sheet).toContainText('بیشتر از این صبر نمی‌کند');
    await expect(sheet.getByRole('button', { name: 'خبر بده در راهم' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: /دقیقه دیرتر/ })).toHaveCount(0);
  });

  test('خطای سرور: پیامِ خودِ سرور، و دکمه دوباره فعال', async ({ page }) => {
    await openTrips(page, [trip({})]);
    await page.route('**/api/v1/reservations/RZLATE234/eta', (route) => route.fulfill({
      status: 409, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'LATE_SIGNAL_CLOSED', message: 'مهلتِ این رزرو تمام شده', details: { reason: 'deadline_passed' } } }),
    }));
    await card(page, 'RZLATE234').getByRole('button', { name: 'دیرتر می‌رسم' }).click();
    await page.locator('#sheet').getByRole('button', { name: 'حدودِ ۱۰ دقیقه دیرتر' }).click();
    await expect(page.locator('#lateErr [role="alert"]')).toContainText('مهلتِ این رزرو تمام شده');
    await expect(page.locator('#sheet').getByRole('button', { name: 'حدودِ ۱۰ دقیقه دیرتر' })).toBeEnabled();
  });

  test('پنجره: سه ساعت مانده → دکمه نیست؛ بعد از خبر دادن → دکمه نیست و خطِ وضعیت هست', async ({ page }) => {
    const far = Date.now() + 3 * HOUR;
    await openTrips(page, [
      trip({ code: 'RZFARAWAY', id: '71111111-1111-1111-1111-111111111111', status: 'confirmed', slotStart: new Date(far).toISOString(),
        late: { graceMinutes: 15, maxExtensionMinutes: 15, deadline: new Date(far + 15 * MIN).toISOString() } }),
      trip({ code: 'RZSIGNALD', id: '81111111-1111-1111-1111-111111111111', lateEtaSignaledAt: new Date().toISOString(), lateExtensionMinutes: 10,
        late: { graceMinutes: 15, maxExtensionMinutes: 15, deadline: new Date(Date.now() + 20 * MIN).toISOString() } }),
    ]);
    await expect(card(page, 'RZFARAWAY').getByRole('button', { name: 'دیرتر می‌رسم' })).toHaveCount(0);
    await expect(card(page, 'RZSIGNALD').getByRole('button', { name: 'دیرتر می‌رسم' })).toHaveCount(0);
    await expect(card(page, 'RZSIGNALD').locator('.trip-late-note.signaled')).toContainText('حدودِ ۱۰ دقیقه دیرتر می‌رسی');
  });

  test('بدونِ دادهٔ مهلت از سرور: نه دکمه، نه ادعا', async ({ page }) => {
    await openTrips(page, [trip({ late: null })]);
    const c = card(page, 'RZLATE234');
    await expect(c.getByRole('button', { name: 'دیرتر می‌رسم' })).toHaveCount(0);
    await expect(c.locator('.trip-late-note')).toHaveCount(0);
  });
});

test.describe('برگه‌ی تأییدِ رزرو — مهلتِ صبر پیش از دکمه‌ی تأیید', () => {
  test.slow();

  async function advanceToStep3(page: Page) {
    await page.getByRole('button', { name: /رزرو میز/ }).click();
    await expect(page.locator('#sheet')).toBeVisible();
    await page.waitForFunction(() => {
      const s = document.getElementById('bwTime') as HTMLSelectElement | null;
      return !!s && [...s.options].some((o) => o.value && o.value !== '');
    }, undefined, { timeout: 5000 });
    await page.getByRole('button', { name: /بررسی میزهای موجود/ }).click();
    // مرحله‌ی پیش‌سفارش («ادامه») فقط برای رستورانِ منو‌دار است (در mock فقط رستورانِ ۱) — بقیه مستقیم به تأیید می‌روند.
    const next = page.getByRole('button', { name: 'ادامه', exact: true });
    const confirm = page.locator('#sheet').getByRole('button', { name: 'تأیید رزرو' });
    await expect(next.or(confirm)).toBeVisible({ timeout: 15_000 });
    if (await next.isVisible()) await next.click();
  }

  test('رستورانی که مهلت را اعلام کرده: خطِ «۱۵ دقیقه» کنارِ دکمه‌ی تأیید', async ({ page }) => {
    await mockApi(page);
    await gotoApp(page);
    await openFirstRestaurant(page);
    await advanceToStep3(page);
    await expect(page.locator('#sheet .late-grace-note')).toContainText('۱۵ دقیقه بعد از ساعتِ رزرو');
    await expect(page.locator('#sheet').getByRole('button', { name: 'تأیید رزرو' })).toBeVisible();
  });

  test('رستورانِ بدونِ سیاست: سکوت، نه عددِ حدسی', async ({ page }) => {
    await mockApi(page);
    await gotoApp(page);
    await openRestaurantByName(page, '[DEMO] برگر لب');
    await advanceToStep3(page);
    await expect(page.locator('#sheet').getByRole('button', { name: 'تأیید رزرو' })).toBeVisible();
    await expect(page.locator('#sheet .late-grace-note')).toHaveCount(0);
  });
});
