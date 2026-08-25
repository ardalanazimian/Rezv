import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ P0 — شناسه‌ی رستوران با شکلِ **واقعیِ تولید** (فازِ ۲، Batch 17)
//
//  باگ: قالب‌هایِ اپ شناسه را بدونِ کوتیشن داخلِ onclick تزریق می‌کردند:
//      onclick="openRest(${r.id})"
//  با دادهٔ نمونه id عددی است (۱..۸) و درست کار می‌کند. ولی
//  `Restaurant.id` در بک‌اند یک **UUID** است
//  (api/prisma/schema.prisma:98 — `String @id @default(uuid()) @db.Uuid`)،
//  که `mapApiRestaurant` دست‌نخورده کپی می‌کند و `init.js` داخلِ R می‌نشاند.
//  نتیجه با بک‌اندِ واقعی:
//      onclick="openRest(f47ac10b-58cc-4372-a567-0e02b2c3d479)"
//  → SyntaxError (تأییدشده با `new Function`). یعنی کارتِ رستوران، دکمه‌ی
//  علاقه‌مندی، چیپِ ساعت، «رزرو میز»، «تأیید رزرو» و «پیوستن به لیست انتظار»
//  همگی با دادهٔ واقعی مرده بودند. اپ فقط رویِ دادهٔ نمونه کار می‌کرد.
//
//  ⚠️ چرا هیچ‌کدام از ۲۱۱ تستِ موجود این را نگرفت: mockِ مشترک
//  (tests/helpers/mock-api.ts) شناسه‌هایِ **عددیِ** ۱/۲/۳ می‌دهد — شکلی که
//  APIِ واقعی هرگز برنمی‌گرداند. یک هارنسِ تست که واقعیت را بازتاب ندهد،
//  باگ را پنهان می‌کند، نه اینکه پیدایش کند. این فایل عمداً شکلِ تولید را
//  سرو می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const UUIDS = [
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  '1a2b3c4d-5e6f-7890-abcd-ef1234567890', // عمداً با رقم شروع می‌شود
  '9c858901-8a57-4791-81fe-4c455b099bc9',
];

const RESTAURANTS = UUIDS.map((id, i) => ({
  id,
  slug: `demo-uuid-${i + 1}`,
  name: `[DEMO] رستورانِ ${i + 1}`,
  cuisine: 'ایرانی',
  rating: 4.5,
  price: '$$',
  cashback: 10,
  cover_emoji: '🍽️',
  available_slots: ['19:00', '20:00'],
  booking_policy: { deposit_required: false, free_cancel_hours: 24, auto_confirm: true },
}));

async function mockUuidApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/restaurants') return json({ restaurants: RESTAURANTS, next_cursor: null });
    if (/^\/restaurants\/[^/]+$/.test(path)) {
      const slug = path.split('/').pop();
      return json({ restaurant: RESTAURANTS.find(r => r.slug === slug) || RESTAURANTS[0] });
    }
    if (/^\/restaurants\/[^/]+\/availability/.test(path)) {
      return json({
        date: '2026-07-10', party: 2,
        slots: [
          { time: '19:00', free_tables: ['T1'], status: 'open' },
          { time: '20:00', free_tables: ['T2'], status: 'open' },
        ],
      });
    }
    if (path === '/me/reservations') return json([]);   // قرارداد: آرایه‌ی خام
    return json({ ok: true });
  });
}

/** هر خطای JS در صفحه جمع می‌شود — SyntaxErrorِ inline handler هم اینجا می‌افتد. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test.beforeEach(() => test.slow());

test('کارتِ رستوران با شناسه‌ی UUID باز می‌شود (نه SyntaxError)', async ({ page }) => {
  const errors = collectErrors(page);
  await mockUuidApi(page);
  await gotoApp(page);

  const card = page.locator('.rc .rc-open').first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  await expect(page.locator('#page-rest'), 'صفحه‌ی جزئیات باید باز شود').toBeVisible();
  expect(
    errors.filter(e => /SyntaxError|is not defined/.test(e)),
    'هیچ خطای نحوی/شناسه‌ی نامعلوم نباید رخ دهد',
  ).toEqual([]);
});

test('دکمه‌ی علاقه‌مندی با شناسه‌ی UUID کار می‌کند', async ({ page }) => {
  const errors = collectErrors(page);
  await mockUuidApi(page);
  await gotoApp(page);

  const fav = page.locator('.rc .rc-fav').first();
  await expect(fav).toBeVisible({ timeout: 15_000 });
  await expect(fav).toHaveAttribute('aria-pressed', 'false');
  await fav.click();
  await expect(fav, 'وضعیتِ علاقه‌مندی باید عوض شود').toHaveAttribute('aria-pressed', 'true');

  expect(errors.filter(e => /SyntaxError|is not defined/.test(e))).toEqual([]);
});

test('چیپِ ساعت با شناسه‌ی UUID شیتِ رزرو را باز می‌کند', async ({ page }) => {
  const errors = collectErrors(page);
  await mockUuidApi(page);
  await gotoApp(page);

  const slot = page.locator('.rc .rc-slot').first();
  await expect(slot).toBeVisible({ timeout: 15_000 });
  await slot.click();

  await expect(page.locator('#sheet'), 'شیتِ رزرو باید باز شود').toBeVisible();
  expect(errors.filter(e => /SyntaxError|is not defined/.test(e))).toEqual([]);
});

test('علاقه‌مندی‌هایِ ذخیره‌شده‌ی عددیِ قدیمی با UUID تداخل نمی‌کنند', async ({ page }) => {
  // مهاجرتِ seed.js: مقادیرِ عددیِ ذخیره‌شده به رشته تبدیل می‌شوند، پس نه
  // خطا می‌دهند و نه به‌اشتباه رویِ رستورانِ UUIDدار «علاقه‌مند» می‌نشینند.
  await page.addInitScript(() => {
    try { localStorage.setItem('rz_favs', JSON.stringify([1, 2, 3])); } catch { /* */ }
  });
  const errors = collectErrors(page);
  await mockUuidApi(page);
  await gotoApp(page);

  const fav = page.locator('.rc .rc-fav').first();
  await expect(fav).toBeVisible({ timeout: 15_000 });
  await expect(fav, 'رستورانِ UUIDدار نباید از روی idِ عددیِ قدیمی علاقه‌مند شمرده شود')
    .toHaveAttribute('aria-pressed', 'false');
  expect(errors.filter(e => /SyntaxError|is not defined/.test(e))).toEqual([]);
});
