import { test, expect, type Page } from '@playwright/test';

/**
 * B-03 (major): رزروِ دستیِ صف‌شده در حالتِ آفلاین **هرگز** نمی‌تواند sync شود.
 *
 * مسیرِ آنلاین (reservations.js) بدنه‌ی معتبر می‌فرستد:
 *     restaurant_id: STAFF_INFO.restaurant_id   ·  date: dt.date  ·  time: dt.time
 * ولی بدنه‌ی Outbox این است:
 *     restaurant_id: 'self'  ·  date: dateKey  ·  time: timeVal
 *
 * و شِیمِ سرور (api/src/app/api/v1/reservations/route.ts:22-24) می‌خواهد:
 *     restaurant_id: zUuid  ·  date: zDateStr  ·  time: zTimeStr
 *
 * پس هر سه فیلد رد می‌شوند: `'self'` یو‌یو‌آی‌دی نیست، `dateKey` یکی از
 * `today|tomorrow|upcoming` است نه `YYYY-MM-DD`، و `timeVal` ارقامِ **فارسی**
 * دارد. به‌علاوه `notify_sms`، `table_number` و `note` اصلاً فرستاده نمی‌شوند.
 *
 * چرا این «fake success» است و نه یک ناسازگاریِ ساده: پرسنل توستِ «رزرو محلی
 * ثبت شد — با برگشت اینترنت همگام می‌شود» را می‌بیند، ولی `Outbox.sync`
 * (data.js:513) پاسخِ ردِ سرور را «تضاد» می‌شمارد، عملیات را از صف **بیرون
 * می‌اندازد** و به پرسنل می‌گوید «احتمالاً میز یا زمان قبلاً پر شده» — توضیحی
 * که غلط است. رزروِ مهمان گم می‌شود و دلیلِ اعلام‌شده هم گمراه‌کننده است.
 *
 * ادعا: بدنه‌ی صف‌شده باید همان قراردادی را داشته باشد که مسیرِ آنلاین دارد.
 */
const BIZ = 'http://localhost:8081/';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const RESTAURANT_UUID = '3f1a7c2e-9b44-4d1e-8a6f-2c5b7e9d0a11';

type Queued = { path: string; body: { restaurant_id?: string; date?: string; time?: string; party_size?: number; guest?: Record<string, unknown> } };

async function mockBizApi(page: Page, opts: { failReservationPost: boolean }, seen: unknown[]) {
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const m = route.request().method();
    if (p === '/auth/staff/login' && m === 'POST') {
      return route.fulfill(json({
        access: 'a', refresh: 'r',
        staff: { role: 'owner', restaurant_name: 'ویستا [DEMO]', restaurant_id: RESTAURANT_UUID, permissions: null },
      }));
    }
    if (p === '/reservations' && m === 'POST') {
      if (opts.failReservationPost) return route.abort('internetdisconnected'); // خطای شبکه ⇒ مسیرِ Outbox
      seen.push(route.request().postDataJSON());
      return route.fulfill(json({ reservation: { code: 'OFF1' } }));
    }
    if (p === '/restaurant/reservations' && m === 'GET') return route.fulfill(json({ reservations: [], next_cursor: null }));
    if (p === '/restaurant/tables') return route.fulfill(json({ items: [] }));
    return route.fulfill(json({ ok: true }));
  });
}

async function login(page: Page) {
  await page.goto(BIZ);
  await page.locator('#staffUser').fill('owner_demo');
  await page.locator('#staffPass').fill('Passw0rd!123');
  await page.locator('#staffLoginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
}

async function queueOneOfflineReservation(page: Page) {
  // ⚠️ فقط abort کردنِ درخواست کافی **نیست**: مسیرِ صف‌شدن پشتِ
  // `if(isOffline() && API.getToken())` است و `isOffline()` برابرِ `!Net.online`
  // است که از رویدادهای `online`/`offline`ِ مرورگر می‌آید (data.js:556-560).
  // نسخه‌ی اولِ این تست بدونِ این خط قرمز می‌شد ولی **به دلیلِ غلط** — هیچ
  // عملیاتی صف نمی‌شد و assertهای واقعی اصلاً اجرا نمی‌شدند.
  await page.context().setOffline(true);
  await page.evaluate(() => (window as unknown as { openManual: () => void }).openManual());
  await expect(page.locator('#mDate')).toBeVisible();
  await page.locator('#mDate').selectOption('d3');
  await page.locator('#mName').fill('مهمانِ آفلاین');
  await page.locator('#mPhone').fill('۰۹۱۲۰۰۰۰۰۰۰');
  await page.locator('button.btn-primary.btn-lg.btn-block').click();
  // صفِ Outbox باید دقیقاً یک عملیات بگیرد — نبودش خطاست، نه عبور.
  await expect.poll(async () => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('rz_biz_outbox') || '[]').length; } catch { return -1; }
  }), { timeout: 10_000, message: 'هیچ عملیاتی در Outbox صف نشد' }).toBe(1);
}

test('B-03: بدنه‌ی صف‌شده‌ی آفلاین همان قراردادِ مسیرِ آنلاین را دارد', async ({ page }) => {
  await mockBizApi(page, { failReservationPost: true }, []);
  await login(page);
  await queueOneOfflineReservation(page);

  const queued = (await page.evaluate(() => JSON.parse(localStorage.getItem('rz_biz_outbox') || '[]')))[0] as Queued;
  const b = queued.body;

  expect(b.restaurant_id, 'restaurant_id باید UUIDِ واقعیِ رستوران باشد، نه رشته‌ی «self»')
    .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  expect(b.date, 'date باید YYYY-MM-DD باشد، نه کلیدِ تبِ تاریخ').toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(b.time, 'time باید ارقامِ لاتین باشد، نه فارسی').toMatch(/^\d{2}:\d{2}$/);
  // فیلدهایی که مسیرِ آنلاین می‌فرستد و مسیرِ آفلاین جا می‌انداخت:
  expect(b.guest?.table_number, 'شماره‌ی میز در بدنه‌ی آفلاین جا افتاده بود').toBeDefined();
  expect(b.notify_sms, 'notify_sms در بدنه‌ی آفلاین جا افتاده بود').toBeDefined();
});

test('B-03: صفِ آفلاین با برگشتِ اینترنت واقعاً روی سرور می‌نشیند', async ({ page }) => {
  const seen: unknown[] = [];
  await mockBizApi(page, { failReservationPost: true }, seen);
  await login(page);
  await queueOneOfflineReservation(page);

  // routeها **اول** آماده شوند، بعد اینترنت برگردد — وگرنه sync به هندلرِ
  // قدیمی می‌خورد. sync را دستی صدا نمی‌زنیم: `Outbox` یک `const`ِ سطحِ ماژول
  // است و روی `window` نیست، و مهم‌تر اینکه مسیرِ واقعی همین است —
  // `Net._set(true)` (data.js:566-570) با رویدادِ `online` خودش `Outbox.sync()`
  // را صدا می‌زند.
  await page.unroute('**/api/v1/**');
  await mockBizApi(page, { failReservationPost: false }, seen);
  await page.context().setOffline(false);

  await expect.poll(() => seen.length, { timeout: 10_000, message: 'sync هیچ درخواستی نفرستاد' }).toBe(1);
  const sent = seen[0] as Queued['body'];
  expect(sent.restaurant_id, 'سرور «self» را رد می‌کند (zUuid)').not.toBe('self');
  expect(sent.date, 'سرور کلیدِ تب را رد می‌کند (zDateStr)').toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(sent.time, 'سرور ارقامِ فارسی را رد می‌کند (zTimeStr)').toMatch(/^\d{2}:\d{2}$/);

  // و صف باید خالی شده باشد، نه اینکه به‌عنوانِ «تضاد» دور ریخته شود.
  //
  // ⚠️ اینجا خواندنِ **یک‌باره** غلط بود و روی mobile-safari می‌افتاد: پُلِ بالا
  // وقتی شلیک می‌شود که درخواست به mock **می‌رسد**، ولی `Outbox.sync` صف را
  // بعد از پردازشِ **پاسخ** shift و persist می‌کند (data.js:510). پس خواندنِ
  // فوری یک ریس بود، نه یک باگِ محصول. انتظارِ قطعی روی خودِ صف.
  await expect.poll(
    () => page.evaluate(() => JSON.parse(localStorage.getItem('rz_biz_outbox') || '[]').length),
    { timeout: 10_000, message: 'عملیات پس از sync باید از صف رفته باشد' },
  ).toBe(0);
});
