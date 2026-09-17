import { expect, test, type Page } from '@playwright/test';
import { sampleRestaurantNames } from './helpers/sample-names';

// ═══════════════════════════════════════════════════════════════════════
//  «سرور خطا داد» ≠ «دمو» — دادهٔ نمونه فقط در دموی صریحِ آفلاین (file://)
//
//  یافتهٔ B-1 ممیزیِ فول‌استک (۲۰۲۶-۰۹-۱۶، در runtime اثبات شد): پاسخِ ۵۰۰ِ
//  `GET /restaurants` در اپِ مشتری شش رستورانِ `[DEMO]` را با سرآیندِ
//  «۶ رستوران فعال» رندر می‌کرد. `loadRestaurants` روی `!res.ok` به `R_SAMPLE`
//  برمی‌گشت، در حالی که `api-core.js` خطای HTTP را **بدونِ** `offline`
//  برمی‌گرداند — سرور زنده بود و کاربر رستورانِ جعلی می‌دید.
//
//  و برادرش در همان جریان: `init.js` مقدارِ اولیهٔ `R` را `R_SAMPLE` می‌گذاشت و
//  `boot()` پیش از رسیدنِ پاسخِ سرور آن را رنگ می‌زد. روی شبکهٔ موبایلی که
//  پاسخ بیش از ۲۸۰ms طول بکشد، کاربرِ واقعی هر بار شش کارتِ نمونه می‌دید.
//
//  قاعده (همان گیتی که notifications.js و reservation.js و auth.js از قبل
//  دارند): دادهٔ نمونه فقط وقتی `isOfflineDemo()` — بستهٔ آفلاینِ `file://`.
//  روی http(s) هر شکست، حالتِ خطا با «تلاشِ دوباره» است؛ پاسخِ خالیِ موفق،
//  حالتِ خالی؛ و انتظار، اسکلت.
// ═══════════════════════════════════════════════════════════════════════

const SAMPLE_NAMES = sampleRestaurantNames();

const REAL = [{
  id: 'b1c2d3e4-0000-4000-8000-000000000001', slug: 'rest-vaghei',
  name: 'رستورانِ واقعیِ تست', cuisine: 'ایرانی', rating: 4.4, price: '$$', cover_emoji: '🍽️',
}];

type ListResponse = { status: number; body: unknown } | 'abort';

/** فقط `GET /restaurants` کنترل می‌شود؛ بقیهٔ APIها ۲۰۰ِ خالی می‌گیرند. */
async function mockCatalog(page: Page, list: ListResponse, delayMs = 0) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/v1/restaurants') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (list === 'abort') return route.abort('failed');
    return route.fulfill({ status: list.status, contentType: 'application/json', body: JSON.stringify(list.body) });
  });
}

/** تا فید به یک حالتِ نهایی برسد (کارت، خالی، یا خطا) و ۲۸۰msِ اسکلت گذشته باشد.
 *  بدونِ این، «نمونه دیده نشد» می‌توانست فقط به این دلیل سبز شود که هنوز چیزی رنگ نخورده بود. */
async function settleFeed(page: Page) {
  await expect(page.locator('#feed .rc, #feed .empty, #feed .feed-error').first()).toBeVisible();
  await page.waitForTimeout(400);
}

async function expectNoSampleData(page: Page, why: string) {
  const text = await page.locator('#page-discover').innerText();
  expect(text, `${why}: برچسبِ [DEMO] دیده شد`).not.toContain('[DEMO]');
  for (const name of SAMPLE_NAMES) {
    expect(text, `${why}: نامِ نمونهٔ «${name}» به کاربر نشان داده شد`).not.toContain(name);
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('rz_onboarded', '1'); } catch { /* ignore */ } });
});

test('کنترلِ مثبتِ فهرستِ نام‌ها: هر شش نامِ نمونه از seed.js خوانده شد', () => {
  // بدونِ این، استخراجِ خالی همهٔ «not.toContain»های پایین را بی‌معنا سبز می‌کرد.
  expect(SAMPLE_NAMES.length).toBeGreaterThanOrEqual(6);
});

for (const status of [500, 503]) {
  test(`🔴 پاسخِ ${status}: هیچ رستورانِ نمونه‌ای، و حالتِ خطا با «تلاشِ دوباره»`, async ({ page }) => {
    await mockCatalog(page, { status, body: { error: { code: 'INTERNAL', message: 'خطا' } } });
    await page.goto('/index.html');
    await settleFeed(page);
    await expectNoSampleData(page, `پاسخِ ${status}`);
    await expect(page.locator('#page-discover')).not.toContainText(/[۰-۹]+ رستوران فعال/);
    await expect(page.locator('#feed .rc')).toHaveCount(0);
    await expect(page.locator('#feed .feed-error')).toBeVisible();
    await expect(page.locator('#feed .feed-error button')).toContainText('تلاشِ دوباره');
  });
}

test('🔴 قطعیِ شبکه روی http(s): دمو نیست — حالتِ خطا، نه رستورانِ نمونه', async ({ page }) => {
  await mockCatalog(page, 'abort');
  await page.goto('/index.html');
  await settleFeed(page);
  await expectNoSampleData(page, 'قطعیِ شبکه');
  await expect(page.locator('#feed .rc')).toHaveCount(0);
  await expect(page.locator('#feed .feed-error')).toBeVisible();
});

test('🔴 قطعیِ کاملِ شبکه روی http(s): رویدادِ نمونه هم نه — «بارگذاری نشد»', async ({ page }) => {
  // برادرِ همان کلاس در renderEvents: گیتش `res.offline` بود، پس فقط قطعیِ **کاملِ**
  // شبکه (نه ۵۰۰ِ /restaurants) آن را فعال می‌کند — به همین دلیل همه‌چیز abort می‌شود.
  await page.route('**/api/v1/**', route => route.abort('failed'));
  await page.goto('/index.html');
  await settleFeed(page);
  await expect(page.locator('#eventsList .empty-state-title')).toContainText('رویدادها بارگذاری نشد');
  await expect(page.locator('#eventsList .demo-chip')).toHaveCount(0);
  await expect(page.locator('#eventsList .event-card')).toHaveCount(0);
  await expectNoSampleData(page, 'قطعیِ کاملِ شبکه');
});

test('🔴 پیش از رسیدنِ پاسخ: اسکلت، نه کارتِ نمونه (شبکهٔ کند)', async ({ page }) => {
  await mockCatalog(page, { status: 200, body: { items: REAL, next_cursor: null, has_more: false } }, 2500);
  await page.goto('/index.html');
  // ۲۸۰msِ اسکلتِ renderFeed گذشته، پاسخ هنوز نرسیده.
  await page.waitForTimeout(1000);
  await expectNoSampleData(page, 'در حینِ انتظار برای سرور');
  await expect(page.locator('#feed .rc')).toHaveCount(0);
  // و وقتی رسید، دادهٔ واقعی.
  await expect(page.locator('#feed .rc')).toHaveCount(1);
  await expect(page.locator('#feed')).toContainText('رستورانِ واقعیِ تست');
});

test('کنترل: ۲۰۰ِ خالی حالتِ خالیِ صادق است، نه حالتِ خطا', async ({ page }) => {
  await mockCatalog(page, { status: 200, body: { items: [], next_cursor: null, has_more: false } });
  await page.goto('/index.html');
  await expect(page.locator('#feed .empty-title')).toContainText('رستورانِ فعالی');
  await expect(page.locator('#feed .feed-error')).toHaveCount(0);
  await expectNoSampleData(page, 'پاسخِ خالی');
});

test('کنترل: ۲۰۰ با رستورانِ واقعی همان را نشان می‌دهد، بی خطا و بی نمونه', async ({ page }) => {
  await mockCatalog(page, { status: 200, body: { items: REAL, next_cursor: null, has_more: false } });
  await page.goto('/index.html');
  await expect(page.locator('#feed .rc')).toHaveCount(1);
  await expect(page.locator('#feed')).toContainText('رستورانِ واقعیِ تست');
  await expect(page.locator('#feed .feed-error')).toHaveCount(0);
  await expectNoSampleData(page, 'پاسخِ واقعی');
});

test('جست‌وجو پس از شکستِ فهرست: «چیزی پیدا نشد» نمی‌گوید — خطا را می‌گوید', async ({ page }) => {
  await mockCatalog(page, { status: 500, body: { error: { code: 'INTERNAL' } } });
  await page.goto('/index.html');
  await settleFeed(page);
  await expectNoSampleData(page, 'پیش از جست‌وجو');
  await expect(page.locator('#feed .feed-error')).toBeVisible();
  await page.evaluate(() => (window as unknown as { doSearch: (q: string) => void }).doSearch('پیتزا'));
  await expect(page.locator('#feed .feed-error')).toBeVisible();
  await expect(page.locator('#feed')).not.toContainText('پیدا نشد');
  await expect(page.locator('#page-discover')).not.toContainText('چیزی پیدا نشد');
});
