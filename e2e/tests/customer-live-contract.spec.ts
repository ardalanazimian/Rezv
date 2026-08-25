import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  قراردادِ کلاینت↔سرور با **شکلِ واقعیِ پاسخِ بک‌اند** (فازِ ۲، Batch 17)
//
//  دو باگ که هر دو ریشه‌ی یکسانی داشتند: کلاینت فیلدی می‌خواند که سرور
//  نمی‌فرستد، و به‌جایِ «نمی‌دانم» به دادهٔ **نمونه** می‌افتاد.
//
//   F1 — کلاینت `apiR.price_range` می‌خواند؛ بک‌اند `priceBand` (عددِ ۱..۴،
//        schema.prisma:105) می‌فرستد. مقدار همیشه undefined می‌شد و بازه‌ی
//        قیمتِ یک رستورانِ **نمونه‌ی بی‌ربط** نمایش داده می‌شد.
//
//   F2 — بک‌اند عمداً `rating: null` می‌فرستد وقتی هیچ نظری نیست؛ کامنتِ خودِ
//        route می‌گوید «null یعنی هنوز نمی‌دانیم، نه صفر و نه عددِ ساختگی».
//        ولی `apiR.rating ?? sampleFallback?.rt` همان عددِ ساختگی را
//        می‌گذاشت: رستورانی با صفر نظر، **۴.۸ ستاره** نشان می‌داد.
//        این جعلِ اعتبارِ اجتماعی است — مستقیماً §۳.
//
//  ⚠️ mockِ مشترک هیچ‌کدام را نمی‌گرفت چون شکلِ نمونه را سرو می‌کند
//  (`price` و `rating` عددی)، نه شکلی که APIِ واقعی برمی‌گرداند.
// ═══════════════════════════════════════════════════════════════════════

/** دقیقاً شکلی که api/src/app/api/v1/restaurants/route.ts برمی‌گرداند. */
const LIVE = [
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    slug: 'live-no-reviews',
    name: '[DEMO] رستورانِ بدونِ نظر',
    cuisine: 'ایرانی',
    priceBand: 3,                 // ← نامِ واقعیِ فیلد
    rating: null,                 // ← هیچ نظری ثبت نشده
    reviews_count: 0,
    recommend_pct: null,
    visits_7d: 0,
    booking_policy: { deposit_required: false, free_cancel_hours: 24, auto_confirm: true },
  },
  {
    id: 'a1b2c3d4-0000-4000-8000-000000000002',
    slug: 'live-with-reviews',
    name: '[DEMO] رستورانِ دارایِ نظر',
    cuisine: 'ژاپنی',
    priceBand: 1,
    rating: 4.2,
    reviews_count: 37,
    recommend_pct: 88,
    visits_7d: 12,
    booking_policy: { deposit_required: false, free_cancel_hours: 24, auto_confirm: true },
  },
];

async function mockLiveApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const json = (b: unknown, s = 200) =>
      route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (path === '/restaurants') return json({ restaurants: LIVE, next_cursor: null });
    if (/^\/restaurants\/[^/]+$/.test(path)) {
      const slug = path.split('/').pop();
      return json({ restaurant: LIVE.find(r => r.slug === slug) || LIVE[0] });
    }
    if (path === '/me/reservations') return json([]);   // قرارداد: آرایه‌ی خام
    return json({ ok: true });
  });
}

test.beforeEach(() => test.slow());

test('رستورانِ بدونِ نظر امتیازِ ساختگی نشان نمی‌دهد (§۳)', async ({ page }) => {
  await mockLiveApi(page);
  await gotoApp(page);

  const card = page.locator('.rc').filter({ hasText: 'رستورانِ بدونِ نظر' }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });

  // هیچ عددِ امتیازی نباید کنارِ ستاره باشد — به‌جایش حالتِ صادقانه.
  await expect(card.locator('.rc-rating')).toHaveText('تازه‌وارد');
  await expect(card, 'امتیازِ رستورانِ نمونه نباید نشت کند').not.toHaveText(/۴٫۸|4\.8|۴٫۷|4\.7/);
});

test('رستورانِ دارایِ نظر همان عددِ سرور را نشان می‌دهد', async ({ page }) => {
  await mockLiveApi(page);
  await gotoApp(page);

  const card = page.locator('.rc').filter({ hasText: 'رستورانِ دارایِ نظر' }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.locator('.rc-rating')).toContainText('۴٫۲');
});

test('بازه‌ی قیمت از priceBandِ سرور می‌آید، نه از رستورانِ نمونه', async ({ page }) => {
  await mockLiveApi(page);
  await gotoApp(page);

  const noReviews = page.locator('.rc').filter({ hasText: 'رستورانِ بدونِ نظر' }).first();
  const withReviews = page.locator('.rc').filter({ hasText: 'رستورانِ دارایِ نظر' }).first();
  await expect(noReviews).toBeVisible({ timeout: 15_000 });

  // priceBand:3 → '$$$'، priceBand:1 → '$'. اگر قرارداد شکسته بود هر دو
  // مقدارِ یکسانِ نمونه ('$$') می‌گرفتند.
  await expect(noReviews.locator('.rc-meta')).toContainText('$$$');
  await expect(withReviews.locator('.rc-meta')).toContainText('$');
  await expect(withReviews.locator('.rc-meta'), 'نباید بازه‌ی نمونه را بگیرد').not.toContainText('$$');
});
