import { test, expect, type Page } from '@playwright/test';

/**
 * پنلِ رستوران — بدنه‌هایی که به API می‌رود (ممیزیِ قراردادِ فرانت↔بک، ۲۰۲۶-۰۹-۱۳)
 *
 * هر تست یک ناسازگاریِ واقعی را قفل می‌کند که با خواندنِ هر دو طرف پیدا شد و
 * روی کدِ پیش از رفع قرمز است:
 *
 *  ۱) رزروِ دستی: گزینه‌های «نفر» value نداشتند و `[^\d]` ارقامِ فارسی را پاک
 *     می‌کرد ⇒ party_size همیشه ۲. تلفنِ خالی `''` می‌رفت (zPhone ⇒ ۴۲۲) و
 *     نبودنِ میزِ آزاد بی‌صدا «میزِ ۱» می‌شد. کدِ پاسخ از `reservation.code`
 *     خوانده می‌شد که وجود ندارد.
 *  ۲) کمپینِ سگمنت: `limit=500` در حالی که سرور حداکثر ۵۰ می‌پذیرد ⇒ ۴۲۲ و
 *     هیچ پیامکی. حالا صفحه‌به‌صفحه با next_cursor.
 *  ۳) «ثبت ورود»ِ داشبورد با اندیسِ `RES` صدا می‌زد ولی ردیف از `RES_VIEW`
 *     (فهرستِ تبِ رزروها) برداشته می‌شد ⇒ وضعیتِ مهمانِ دیگری عوض می‌شد.
 */
const BIZ = 'http://localhost:8081/';
const RESTAURANT_UUID = '3f1a7c2e-9b44-4d1e-8a6f-2c5b7e9d0a11';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Seen = { method: string; path: string; search: string; body: unknown };

async function mockBizApi(page: Page, seen: Seen[]) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    let body: unknown = null;
    try { body = route.request().postDataJSON(); } catch { body = null; }
    seen.push({ method, path, search: url.search, body });
    if (path === '/auth/staff/login' && method === 'POST') {
      return route.fulfill(json({
        access: 'a', refresh: 'r',
        staff: { role: 'owner', restaurant_name: 'ویستا [DEMO]', restaurant_id: RESTAURANT_UUID, permissions: null },
      }));
    }
    if (path === '/reservations' && method === 'POST') {
      // شکلِ واقعیِ پاسخ: lib/reservations.ts → `{ code, status, table_number, … }` در سطحِ بالا
      return route.fulfill(json({ code: 'RZMAN42X', status: 'confirmed', table_number: null }, 201));
    }
    if (path === '/restaurant/customers' && method === 'GET') {
      const cursor = url.searchParams.get('cursor');
      if (!cursor) return route.fulfill(json({ items: [{ phone: '09120000001' }, { phone: '09120000002' }], next_cursor: 'u2' }));
      return route.fulfill(json({ items: [{ phone: '09120000003' }], next_cursor: null }));
    }
    if (path === '/restaurant/sms' && method === 'POST') return route.fulfill(json({ queued: 3 }));
    if (path === '/restaurant/reservations' && method === 'GET') return route.fulfill(json({ reservations: [], next_cursor: null }));
    if (path === '/restaurant/tables') return route.fulfill(json({ items: [] }));
    if (path === '/restaurant/members') return route.fulfill(json({ members: [] }));
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

test('رزروِ دستی: party_size از انتخاب، تلفن و میزِ خالی فرستاده نمی‌شوند، کدِ پاسخ روی ردیف می‌نشیند', async ({ page }) => {
  const seen: Seen[] = [];
  await mockBizApi(page, seen);
  await login(page);
  await page.evaluate(() => (window as unknown as { openManual: () => void }).openManual());
  await expect(page.locator('#mParty')).toBeVisible();

  await page.locator('#mName').fill('مهمانِ بدون‌شماره');
  await page.locator('#mParty').selectOption({ label: '۴' });
  await page.locator('#mSave').click();

  await expect.poll(() => seen.filter((s) => s.path === '/reservations' && s.method === 'POST').length, { timeout: 10_000 }).toBe(1);
  const b = seen.find((s) => s.path === '/reservations')!.body as {
    party_size?: number; notify_sms?: boolean; restaurant_id?: string; guest?: Record<string, unknown>;
  };
  expect(b.party_size, 'پیش از رفع همیشه ۲ بود').toBe(4);
  expect(b.restaurant_id).toBe(RESTAURANT_UUID);
  expect(b.guest && 'phone' in b.guest, 'تلفنِ خالی نباید فرستاده شود (zPhone روی `\'\'` ۴۲۲ می‌دهد)').toBe(false);
  expect(b.guest && 'table_number' in b.guest, 'میزِ آزادی نبود — «میزِ ۱»ِ ساختگی نباید برود').toBe(false);
  expect(b.notify_sms).toBe(false);

  // `RES` یک `let`ِ سطحِ‌بالای اسکریپتِ کلاسیک است، نه propertyِ window؛ عبارتِ رشته‌ای
  // در scopeِ سراسریِ صفحه ارزیابی می‌شود و به همان binding می‌رسد.
  // ردیف پس از رسیدنِ پاسخ درج می‌شود، نه همزمان با دیدنِ درخواست — پس poll.
  await expect.poll(
    () => page.evaluate("(RES.find((r) => r.name === 'مهمانِ بدون‌شماره') || {}).code || null"),
    { timeout: 5_000, message: 'کد از `res.data.code` خوانده شود؛ ردیفِ بی‌کد تغییرِ وضعیت را بدونِ سرور «موفق» می‌کند' },
  ).toBe('RZMAN42X');
});

test('کمپینِ سگمنت: limit=50 و دنبال‌کردنِ next_cursor، همه‌ی شماره‌ها در یک ارسال', async ({ page }) => {
  const seen: Seen[] = [];
  await mockBizApi(page, seen);
  await login(page);
  await page.evaluate(async () => {
    const w = window as unknown as { _campAudience: unknown; _campMessage: string; doSendCampaign: () => Promise<void> };
    w._campAudience = { kind: 'segment', value: 'at_risk', label: 'در خطر ریزش' };
    w._campMessage = 'سلام {نام}';
    await w.doSendCampaign();
  });

  // داشبوردِ پس از ورود هم `/restaurant/customers?sort=visits&limit=5` می‌زند؛ فقط فراخوانی‌های سگمنت شمرده می‌شوند.
  const custCalls = seen.filter((s) => s.path === '/restaurant/customers' && new URLSearchParams(s.search).has('segment'));
  expect(custCalls.length, 'دو صفحه باید خوانده شود').toBe(2);
  for (const c of custCalls) {
    const q = new URLSearchParams(c.search);
    expect(q.get('limit'), 'سرور limit را حداکثر ۵۰ می‌پذیرد').toBe('50');
    expect(q.get('segment')).toBe('at_risk');
  }
  expect(new URLSearchParams(custCalls[1].search).get('cursor')).toBe('u2');

  const sms = seen.filter((s) => s.path === '/restaurant/sms' && s.method === 'POST');
  expect(sms.length).toBe(1);
  expect((sms[0].body as { phones?: string[] }).phones).toEqual(['09120000001', '09120000002', '09120000003']);
});

test('«ثبت ورود»ِ داشبورد همان ردیفِ داشبورد را تغییر می‌دهد، نه ردیفِ هم‌اندیسِ تبِ رزروها', async ({ page }) => {
  const seen: Seen[] = [];
  await mockBizApi(page, seen);
  await login(page);
  // تبِ رزروها قبلاً «فردا» را نشان داده: RES_VIEW فهرستِ دیگری است. (هر دو `let`ِ
  // سراسری‌اند، پس با عبارتِ رشته‌ای مقداردهی می‌شوند نه با window.)
  await page.evaluate(`
    RES = [{ code: 'TONIGHT1', status: 'confirmed', date: 'today', t: '۲۰:۰۰', name: 'مهمانِ امشب', party: 2 }];
    RES_VIEW = [{ code: 'TOMORROW9', status: 'confirmed', date: 'tomorrow', t: '۲۱:۰۰', name: 'مهمانِ فردا', party: 4 }];
    dashCheckIn(0);
  `);
  await expect.poll(() => seen.filter((s) => s.method === 'PATCH').length, { timeout: 10_000 }).toBe(1);
  const patch = seen.find((s) => s.method === 'PATCH')!;
  expect(patch.path, 'پیش از رفع مهمانِ فردا «رسید» می‌شد').toBe('/restaurant/reservations/TONIGHT1/status');
  expect((patch.body as { status?: string }).status).toBe('checked_in');
});
