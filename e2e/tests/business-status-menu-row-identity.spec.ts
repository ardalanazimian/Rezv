import { test, expect, type Page } from '@playwright/test';

/**
 * A2-002-B (۲۰۲۶-۰۹-۰۷): رفعِ A2-002 روی ۵ هندلر از ۷ اعمال شد و دو تا جا ماند.
 *
 * `RES_VIEW` (data.js:652) تاریخِ **انتخاب‌شده**ی تبِ رزروها را نگه می‌دارد، ولی
 * `openStatusMenu` (data.js:42) و `viewHistory` (data.js:106) هنوز `RES[i]` می‌خوانند —
 * و `RES` فقط از `loadTodayReservationsForDashboard()` (data.js:665، همیشه `date=today`)
 * پر می‌شود، یا اگر داشبورد لود نشده باشد اصلاً `RES_DEMO.slice()` است.
 * شاخصِ دکمه‌ها طبقِ reservations.js:66 شاخصِ داخلِ `source` (=`RES_VIEW`) است، پس
 * خواندن از `RES` با همان شاخص به‌تعریف غلط است.
 *
 * چرا specِ موجود این را نمی‌گیرد: `business-reservations-row-identity.spec.ts` فقط
 * `markArrived` را می‌زند — یکی از همان ۵ تایی که درست شده‌اند. سبز است و نسبت به این
 * دو هندلر کور.
 *
 * ادعا: مودالِ «وضعیت» و مودالِ «تاریخچه» باید هویتِ **همان ردیفی** را نشان دهند که
 * کاربر دید — نام، وضعیتِ فعلی، و مجموعه‌ی گذارهای مجازِ همان وضعیت.
 *
 * چرا فقط نام را assert نمی‌کنیم: آسیبِ واقعی از نام نمی‌آید، از این می‌آید که
 * `STATUS_TRANSITIONS[r.status]` روی رزروِ اشتباه حساب می‌شود (data.js:43) و بعد
 * `changeStatus` گذار را روی رزروِ درست اعمال می‌کند (data.js:56) ⇒ گذارِ نامعتبر روی
 * رزروِ واقعی. جهشی که `:42` را درست کند ولی برچسبِ `:47` را نه، از assertِ نام رد می‌شود.
 */
const BIZ = 'http://localhost:8081/';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

function isoDaysFromNow(days: number, hour = 20) {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.toISOString();
}

// امروز (که `RES` را پر می‌کند) عمداً وضعیتِ `confirmed` دارد و آینده `checked_in`:
// دو مجموعه‌ی گذارِ کاملاً متفاوت (۵ در برابر ۲) تا خواندن از آرایه‌ی اشتباه دیده شود.
const TODAY = { code: 'TODAY1', status: 'confirmed', name: 'Today Guest', party_size: 2, table_number: 3, slot_start: isoDaysFromNow(0), phone: '09122222222' };
const UPCOMING_CHECKED_IN = { code: 'UPC1', status: 'checked_in', name: 'Upcoming Guest', party_size: 4, table_number: 7, slot_start: isoDaysFromNow(3), phone: '09121111111' };
const UPCOMING_DONE = { code: 'DONE1', status: 'completed', name: 'Done Guest', party_size: 3, table_number: 9, slot_start: isoDaysFromNow(2), phone: '09123333333' };

async function mockBizApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    if (path === '/auth/staff/login' && method === 'POST') {
      return route.fulfill(json({
        access: 'demo-access', refresh: 'demo-refresh',
        staff: { role: 'owner', restaurant_name: 'کافه‌رستوران ویستا [DEMO]', permissions: null },
      }));
    }
    if (path === '/restaurant/reservations' && method === 'GET') {
      const date = url.searchParams.get('date');
      if (date === 'upcoming') {
        return route.fulfill(json({ reservations: [UPCOMING_CHECKED_IN, UPCOMING_DONE], next_cursor: null }));
      }
      return route.fulfill(json({ reservations: [TODAY], next_cursor: null }));
    }
    return route.fulfill(json({ ok: true }));
  });
}

async function loginAndOpenUpcoming(page: Page) {
  await mockBizApi(page);
  await page.goto(BIZ);
  await page.locator('#staffUser').fill('owner_demo');
  await page.locator('#staffPass').fill('Passw0rd!123');
  await page.locator('#staffLoginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('reservations'));
  await page.locator('button:has-text("روزهای آینده")').click();
}

test('مودالِ «وضعیت» هویتِ ردیفِ دیده‌شده را نشان می‌دهد، نه RES[i] ی امروز', async ({ page }) => {
  await loginAndOpenUpcoming(page);

  // موضوعِ تست باید واقعاً حاضر باشد — نبودش خطاست، نه عبور (منشور §۴).
  const row = page.locator('#resTL .tl-card', { has: page.locator('.tl-name', { hasText: 'Upcoming Guest' }) });
  await expect(row).toBeVisible();

  await row.locator('[onclick^="openStatusMenu("]').click();

  const modal = page.locator('.status-opts').locator('xpath=ancestor::*[contains(@class,"modal") or contains(@class,"sheet")][1]');
  await expect(page.locator('.status-opts')).toBeVisible();

  // ۱) هویت: نامِ همان ردیف
  await expect(page.locator('.bs-rest')).toContainText('Upcoming Guest');

  // ۲) وضعیتِ فعلی: برچسبِ checked_in است («حاضر شد»)، نه confirmed («تأییدشده»)
  await expect(modal).toContainText('حاضر شد');
  await expect(modal).not.toContainText('تأییدشده');

  // ۳) مجموعه‌ی گذارها: STATUS_TRANSITIONS['checked_in'] = ['seated','cancelled'] ⇒ دقیقاً ۲
  //    (اگر از confirmed خوانده شود ۵ گزینه می‌شود)
  await expect(page.locator('.status-opt')).toHaveCount(2);
  await expect(page.locator('.status-opt')).toHaveText([/سر میز/, /لغو/]);
});

test('مودالِ «تاریخچه» هویتِ ردیفِ دیده‌شده را نشان می‌دهد، نه RES[i] ی امروز', async ({ page }) => {
  await loginAndOpenUpcoming(page);

  // ردیفِ completed ⇒ isPast=true (reservations.js:142) ⇒ دکمه‌ی مستقیمِ «تاریخچه» (‎:169)
  const row = page.locator('#resTL .tl-card', { has: page.locator('.tl-name', { hasText: 'Done Guest' }) });
  await expect(row).toBeVisible();

  await row.locator('[onclick^="viewHistory("]').click();

  // مودالِ تاریخچه (data.js:119) نام و **کد** را می‌آورد — کد هویتِ قطعیِ رزرو است.
  const head = page.locator('.bs-rest');
  await expect(head).toBeVisible();
  await expect(head).toContainText('Done Guest');
  await expect(head).toContainText('DONE1');
  await expect(head).not.toContainText('TODAY1');
});
