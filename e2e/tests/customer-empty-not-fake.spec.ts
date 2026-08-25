import { expect, test } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  «فهرستِ خالی» با «سرور در دسترس نیست» یکی نیست
//
//  ⚠️ باگی که این فایل از آن زاده شد (اثباتِ مرورگرِ واقعی، ۲۰۲۶-۰۸-۲۵):
//  apps/customer/js/api.js تنها شرطش `if (list && list.length)` بود و در غیر
//  این صورت مستقیم `R_SAMPLE` برمی‌گرداند. یعنی پاسخِ کاملاً موفقِ
//  `200 {"items":[],"has_more":false}` — که هر وقت heartbeatِ همه‌ی
//  رستوران‌ها از ۹۰ ثانیه بگذرد رخ می‌دهد
//  (api/src/app/api/v1/restaurants/route.ts:44-49) — به کاربرِ **واقعی** روی
//  سایتِ **واقعی** شش رستورانِ `[DEMO]` را با امتیازِ ۴٫۸، کش‌بکِ ۸٪ و
//  ساعتِ ۱۹:۰۰ نشان می‌داد. حتی پیامِ کنسول هم نمی‌آمد، چون `res.offline` در
//  این حالت false است.
//
//  اندازه‌گیریِ قبل/بعد با Chromium واقعی روی همان سناریو:
//     قبل: ۶ کارتِ رستوران، شاملِ «[DEMO] کافه‌رستوران ویستا»
//     بعد: ۰ کارت + حالتِ خالیِ صریح
//
//  این spec همان مرز را قفل می‌کند — و عمداً هر دو طرفش را تست می‌کند، چون
//  «همیشه خالی نشان بده» هم به‌اندازه‌ی «همیشه دمو نشان بده» غلط است.
// ═══════════════════════════════════════════════════════════════════════

const EMPTY_LIST = { items: [], next_cursor: null, has_more: false };

/** فقط لیستِ رستوران‌ها را خالی می‌کند؛ بقیه‌ی APIها ۲۰۰ می‌دهند تا اپ «آفلاین» تشخیص ندهد. */
async function mockEmptyCatalog(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/restaurants', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_LIST) }));
  await page.route('**/api/v1/**', r =>
    r.request().url().includes('/api/v1/restaurants')
      ? r.fallback()
      : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

test('⚠️ پاسخِ موفقِ خالی هیچ رستورانِ [DEMO]ای نمی‌سازد', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await mockEmptyCatalog(page);
  await page.goto('/index.html');
  await page.waitForTimeout(1200);

  const feed = page.locator('#feed');
  await expect(feed.locator('.rc')).toHaveCount(0);

  const text = await feed.innerText();
  // نه برچسبِ [DEMO]، نه هیچ‌کدام از نام‌های دادهٔ نمونه‌ی apps/customer/js/data/seed.js
  expect(text).not.toContain('[DEMO]');
  for (const name of ['ویستا', 'باغِ ایرانی', 'کافه نورا', 'سنتوری', 'لاویا', 'ترمه']) {
    expect(text, `نامِ نمونه‌ی «${name}» به کاربرِ واقعی نشان داده شد`).not.toContain(name);
  }
  expect(pageErrors, 'حالتِ خالی نباید خطای صفحه بدهد').toEqual([]);
});

test('حالتِ خالی به کاربر می‌گوید چرا خالی است (نه صفحه‌ی سفید)', async ({ page }) => {
  // ⚠️ کنترلِ مثبتِ لازم: بدونِ این، «۰ کارت» را یک صفحه‌ی کاملاً سفید هم پاس
  // می‌کرد — یعنی دروغ برداشته می‌شد ولی حقیقت هم گفته نمی‌شد.
  await mockEmptyCatalog(page);
  await page.goto('/index.html');
  await expect(page.locator('#feed .empty')).toBeVisible();
  await expect(page.locator('#feed .empty-title')).toContainText('رستورانِ فعالی');
});

test('کنترلِ منفی: وقتی سرور واقعاً رستوران دارد، همان‌ها نشان داده می‌شوند', async ({ page }) => {
  // بدونِ این تست، «همیشه حالتِ خالی نشان بده» هم سبز می‌شد و کلِ فید می‌مرد.
  const REAL = [{
    id: 'b1c2d3e4-0000-4000-8000-000000000001', slug: 'rest-vaghei',
    name: 'رستورانِ واقعیِ تست', cuisine: 'ایرانی', rating: 4.4, price: '$$', cover_emoji: '🍽️',
  }];
  await page.route('**/api/v1/restaurants', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
                body: JSON.stringify({ items: REAL, next_cursor: null, has_more: false }) }));
  await page.route('**/api/v1/**', r =>
    r.request().url().includes('/api/v1/restaurants')
      ? r.fallback()
      : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto('/index.html');
  await expect(page.locator('#feed .rc')).toHaveCount(1);
  await expect(page.locator('#feed')).toContainText('رستورانِ واقعیِ تست');
  await expect(page.locator('#feed .empty')).toHaveCount(0);
});
