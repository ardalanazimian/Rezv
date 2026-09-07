import { test, expect, type Page } from '@playwright/test';

/**
 * Blocker (۲۰۲۶-۰۹-۰۷): داشبوردِ پنلِ کسب‌وکار مهمانانِ **ساختگی** را با نشانِ
 * «زنده» نشان می‌دهد.
 *
 *   waitlist.js:10        `let WAITLIST = WL_DEMO_QUEUE.slice()` — از لحظه‌ی بوت
 *                          سه نامِ ساختگی داخلش است.
 *   overview.js:118-131   `renderDashWaitlist()` مستقیم از همان متغیرِ سراسری
 *                          می‌خواند.
 *   overview.js:214       با `<span class="live-dot">` و شمارنده رندر می‌شود.
 *   overview.js:470       `dashboardUsingDemoData()` فقط `_resLoaded` و
 *                          `_tablesLoaded` را می‌بیند — `_wlLoaded` **غایب است**.
 *   loadWaitlist          هیچ‌جا از مسیرِ داشبورد صدا زده نمی‌شود؛ فقط از
 *                          `rWaitlist` (waitlist.js:25) یعنی وقتی کارمند خودش
 *                          تبِ صف را باز کند.
 *
 * یعنی تا وقتی کارمند تبِ لیستِ انتظار را باز نکند، روی داشبورد سه مهمانِ جعلی
 * با بجِ «زنده» و دکمه‌ی «آفر میز» می‌بیند و بر اساسِ صفی تصمیم می‌گیرد که وجود
 * ندارد. این از «دادهٔ دمو» بدتر است چون UI هم‌زمان ادعای زنده‌بودن می‌کند.
 *
 * ادعا: با توکنِ معتبر و صفِ واقعیِ **خالی**، داشبورد نباید هیچ‌کدام از نام‌های
 * نمونه را نشان دهد و نباید شمارنده‌ی ساختگی داشته باشد.
 */
const BIZ = 'http://localhost:8081/';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const DEMO_NAMES = ['سارا محمدی', 'علی رضایی', 'مریم کریمی'];

async function mockBizApi(page: Page, waitlistCalls: string[]) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    if (path === '/auth/staff/login' && method === 'POST') {
      return route.fulfill(json({
        access: 'demo-access', refresh: 'demo-refresh',
        staff: { role: 'owner', restaurant_name: 'کافه‌رستوران ویستا [DEMO]', restaurant_id: 'r-1', permissions: null },
      }));
    }
    if (path.startsWith('/restaurant/waitlist')) {
      waitlistCalls.push(path);
      // صفِ واقعی **خالی** است — هیچ مهمانی منتظر نیست.
      if (path.includes('analytics')) {
        return route.fulfill(json({ total_entries: 0, seated: 0, abandoned: 0, conversion_rate: 0, avg_wait_minutes: 0, current_queue_size: 0, vip_entries: 0 }));
      }
      return route.fulfill(json({ queue: [] }));
    }
    if (path === '/restaurant/reservations' && method === 'GET') {
      return route.fulfill(json({ reservations: [], next_cursor: null }));
    }
    if (path === '/restaurant/tables') {
      return route.fulfill(json({ tables: [] }));
    }
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

test('داشبورد بدونِ بازکردنِ تبِ صف، مهمانِ ساختگی نشان نمی‌دهد', async ({ page }) => {
  const waitlistCalls: string[] = [];
  await mockBizApi(page, waitlistCalls);
  await login(page);

  // عمداً `nav('waitlist')` صدا زده نمی‌شود — همان مسیری که کارمند هر روز
  // اول از همه می‌بیند.
  const panel = page.locator('#dashWaitlist');
  await expect(panel, 'پنلِ صفِ داشبورد باید وجود داشته باشد — نبودش خطاست، نه عبور').toBeVisible();

  // قلبِ ادعا: هیچ نامِ نمونه‌ای روی داشبورد نباشد.
  for (const name of DEMO_NAMES) {
    await expect(panel, `نامِ ساختگیِ «${name}» روی داشبورد دیده می‌شود`).not.toContainText(name);
  }

  // و شمارنده‌ی کنارِ بجِ «زنده» نباید عددِ ساختگیِ صف را بگوید.
  const pill = page.locator('.ops-panel', { has: page.locator('#dashWaitlist') }).locator('.count-pill');
  await expect(pill, 'شمارنده‌ی صف با صفِ واقعیِ خالی نمی‌خواند').not.toContainText('۳');
});

/**
 * نیمه‌ی دومِ باگ، که تست‌های بالا **نمی‌توانند** بگیرند چون همه‌شان صفِ موفق
 * mock می‌کنند: `loadWaitlist` قبلاً `_wlLoaded=true` را **بی‌قیدوشرط** ست
 * می‌کرد، حتی وقتی fetch می‌افتاد. اثرش این بود که `isDemo` بعدش false می‌شد و
 * نوتِ «این داده نمونه است» ناپدید می‌شد در حالی که `WAITLIST` هنوز صفِ ساختگی
 * بود — یک قطعیِ گذرا، دادهٔ جعلی را برای بقیه‌ی نشست «واقعی» قفل می‌کرد.
 */
test('قطعیِ صف، دادهٔ نمونه را «واقعی» علامت نمی‌زند', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    if (path === '/auth/staff/login' && method === 'POST') {
      return route.fulfill(json({
        access: 'a', refresh: 'r',
        staff: { role: 'owner', restaurant_name: 'ویستا [DEMO]', restaurant_id: 'r-1', permissions: null },
      }));
    }
    // صف از سرور نمی‌آید — قطعیِ گذرا.
    if (path.startsWith('/restaurant/waitlist')) return route.fulfill(json({ error: 'boom' }, 500));
    if (path === '/restaurant/reservations' && method === 'GET') return route.fulfill(json({ reservations: [], next_cursor: null }));
    if (path === '/restaurant/tables') return route.fulfill(json({ tables: [] }));
    return route.fulfill(json({ ok: true }));
  });
  await login(page);
  await expect(page.locator('#dashWaitlist')).toBeVisible();
  await page.waitForTimeout(1500); // فرصت به تلاشِ ناموفق که تمام شود

  // حتی پس از شکست، نامِ ساختگی نباید به‌عنوانِ صفِ زنده رندر شود.
  for (const name of DEMO_NAMES) {
    await expect(page.locator('#dashWaitlist'), `پس از قطعی، «${name}» به‌عنوانِ صفِ زنده نشان داده شد`)
      .not.toContainText(name);
  }

  // و پرچمِ «دمو» نباید پایین آمده باشد — این دقیقاً همان چیزی است که
  // `_wlLoaded=true`ِ بی‌قیدوشرط خرابش می‌کرد.
  const stillDemo = await page.evaluate(() => (window as unknown as { dashboardUsingDemoData: () => boolean }).dashboardUsingDemoData());
  expect(stillDemo, 'پس از شکستِ صف، داشبورد نباید خود را «زنده» اعلام کند').toBe(true);
});

/**
 * محورِ چهارم — بجِ «زنده».
 *
 * ⚠️ چرا تستِ بالا این را **نمی‌گیرد**: `dashboardUsingDemoData()` یک OR است و
 * روی داشبوردِ تازه‌بازشده `_tablesLoaded` از قبل false است (میزها فقط از تبِ
 * رزروها/سالن لود می‌شوند). پس بج در آن سناریو **صرف‌نظر از `_wlLoaded`** روی
 * «داده‌ی نمونه» می‌ماند، و assertِ آن هیچ‌چیز دربارهٔ صف اثبات نمی‌کند.
 * اندازه‌گیری‌شده: حذفِ `|| !_wlLoaded` از آن شرط، سه تستِ قبلی را سبز می‌گذارد.
 *
 * برای ایزوله‌کردنِ محور، اول تبِ رزروها باز می‌شود (میزها و رزروها لود
 * می‌شوند) و بعد برمی‌گردیم به داشبورد — یک مسیرِ واقعیِ کارمند. آن‌وقت تنها
 * پرچمِ false همان `_wlLoaded` است و بج **فقط** به آن وابسته می‌شود.
 */
test('در قطعیِ صف، بج «داده‌ی نمونه» می‌گوید نه «زنده»', async ({ page }) => {
  const tableCalls: string[] = [];
  const resvCalls: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const m = route.request().method();
    if (p === '/auth/staff/login' && m === 'POST') {
      return route.fulfill(json({ access: 'a', refresh: 'r', staff: { role: 'owner', restaurant_name: 'ویستا [DEMO]', restaurant_id: 'r-1', permissions: null } }));
    }
    if (p.startsWith('/restaurant/waitlist')) return route.fulfill(json({ error: 'boom' }, 500)); // فقط صف می‌افتد
    if (p === '/restaurant/reservations' && m === 'GET') { resvCalls.push(p); return route.fulfill(json({ reservations: [], next_cursor: null })); }
    // شکلِ واقعیِ پاسخ: `items` (data.js:mapApiTable) — نه `tables`.
    if (p === '/restaurant/tables') { tableCalls.push(p); return route.fulfill(json({ items: [{ id: 't1', number: 1, capacity: 4, state: 'free' }] })); }
    return route.fulfill(json({ ok: true }));
  });
  await login(page);

  // میزها و رزروها را واقعاً لود کن تا تنها پرچمِ باقی‌مانده `_wlLoaded` باشد.
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('reservations'));
  // ⚠️ `waitForTimeout` ثابت اینجا **کافی نیست** و تست را با تأخیرِ کوتاه بی‌صدا
  // سبز می‌کند: اگر میزها هنوز نرسیده باشند، `_tablesLoaded` هنوز false است و
  // بج صرف‌نظر از `_wlLoaded` روی «داده‌ی نمونه» می‌ماند — یعنی assert چیزی
  // دربارهٔ صف اثبات نمی‌کند. اندازه‌گیری‌شده: با ۱۲۰۰ms جهش رد می‌شد، با
  // انتظارِ قطعی نه. پس منتظرِ **رسیدنِ واقعیِ** هر دو درخواست می‌مانیم.
  await expect.poll(() => tableCalls.length, { timeout: 10_000, message: 'میزها هرگز درخواست نشدند' }).toBeGreaterThan(0);
  await expect.poll(() => resvCalls.length, { timeout: 10_000, message: 'رزروها هرگز درخواست نشدند' }).toBeGreaterThan(0);
  await page.waitForTimeout(400); // فرصت به then/رندر پس از رسیدنِ پاسخ‌ها
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('overview'));
  await page.waitForTimeout(600);

  // گاردِ ایزوله‌بودنِ محور: اگر این دو پرچم بالا نیامده باشند، تست دیگر
  // دربارهٔ `_wlLoaded` چیزی نمی‌گوید و باید **خطا** بدهد، نه عبور.
  const isolated = await page.evaluate(() => {
    const w = window as unknown as { dashboardUsingDemoData: () => boolean };
    return typeof w.dashboardUsingDemoData === 'function';
  });
  expect(isolated, 'dashboardUsingDemoData در دسترس نیست — محور سنجیده نشد').toBe(true);

  const badge = page.locator('#liveInd');
  await expect(badge, 'بجِ وضعیت باید وجود داشته باشد — نبودش خطاست، نه عبور').toBeVisible();
  await expect(badge, 'صف از سرور نیامده ولی داشبورد خودش را «زنده» اعلام کرد').not.toContainText('زنده');
  await expect(badge, 'در قطعیِ صف بج باید «داده‌ی نمونه» باشد').toContainText('داده‌ی نمونه');
});

test('داشبورد صفِ واقعی را می‌گیرد، نه اینکه فقط دمو را پنهان کند', async ({ page }) => {
  const waitlistCalls: string[] = [];
  await mockBizApi(page, waitlistCalls);
  await login(page);
  await expect(page.locator('#dashWaitlist')).toBeVisible();

  // ادعای مکمل: رفعِ درست باید داده‌ی واقعی را **بخواهد**. اگر کسی صرفاً
  // آرایه را خالی کند تا تستِ بالا سبز شود، این می‌افتد.
  await expect.poll(() => waitlistCalls.length, {
    timeout: 10_000,
    message: 'داشبورد هرگز صفِ واقعی را از سرور نخواست',
  }).toBeGreaterThan(0);
});
