import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, openFirstRestaurant } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  اثباتِ اجتماعی باید اندازه‌گیری باشد، نه تخمین
//
//  سه ادعا در فرانت ساخته می‌شدند و هیچ‌کدام دادهٔ واقعی نبودند:
//    «۱۶ نفر این هفته اومدن»          ← Math.round(کلِ نظرها / ۸)
//    «۹۸٪ مهمان‌ها پیشنهاد می‌کنن»     ← Math.min(98, امتیاز/۵×۱۰۰ + ۶)
//    «۰٫۷ کیلومتر» در «نزدیک تو»       ← (i+1)*0.4+0.3 روی ترتیبِ تصادفی
//
//  این تست قفل می‌کند که بدونِ دادهٔ واقعی، هیچ ادعایی نمایش داده نشود.
//  رقیبِ اصلیِ این حوزه (OpenTable) دقیقاً روی «فقط مشتریِ واقعی می‌تواند
//  نظر بدهد» ساخته شده؛ عددِ ساختگی همان مزیت را از بین می‌برد.
// ═══════════════════════════════════════════════════════════════════════

test('بدونِ دادهٔ واقعی، هیچ ادعای آماری نمایش داده نمی‌شود', async ({ page }) => {
  // mock فیلدهای visits_7d و recommend_pct را نمی‌دهد — یعنی «نمی‌دانیم»
  await mockApi(page);
  await gotoApp(page);

  const feed = page.locator('#feed');
  await expect(feed.locator('.rc').first()).toBeVisible();

  // هیچ‌جا نباید عددِ ساختگیِ «این هفته» یا درصدِ پیشنهاد ساخته شود
  await expect(feed).not.toContainText('این هفته');
  await expect(feed).not.toContainText('پیشنهاد می‌کنن');

  await openFirstRestaurant(page);
  await expect(page.locator('#page-rest')).not.toContainText('پیشنهاد می‌کنن');
});

test('با دادهٔ واقعی، همان عددِ سرور نمایش داده می‌شود', async ({ page }) => {
  await mockApi(page);
  // پاسخِ لیست را با سیگنال‌های واقعی جایگزین کن (بعد از mockApi ثبت می‌شود،
  // پس اولویت دارد)
  await page.route('**/api/v1/restaurants', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 1, slug: 'demo-cafe-golha', name: '[DEMO] کافه گل‌ها', cuisine: 'ایرانی',
          rating: 4.7, reviews_count: 40, price_range: '$$', cbBasePct: 10, cover_emoji: '🌸',
          visits_7d: 23, recommend_pct: 82,
        }],
        next_cursor: null, has_more: false,
      }),
    });
  });
  await gotoApp(page);

  const feed = page.locator('#feed');
  await expect(feed.locator('.rc').first()).toBeVisible();
  await expect(feed).toContainText('۲۳ رزرو');       // عددِ سرور، نه محاسبه‌ی فرانت
  await expect(feed).toContainText('هفته‌ی گذشته');

  await openFirstRestaurant(page);
  await expect(page.locator('#page-rest')).toContainText('۸۲٪');
  // ادعا باید دقیق باشد: «۴ ستاره یا بالاتر»، نه «مهمان‌ها پیشنهاد می‌کنن»
  await expect(page.locator('#page-rest')).toContainText('۴ ستاره یا بالاتر');
});

test('جست‌وجوی بی‌نتیجه، حالتِ خالی نشان می‌دهد نه همه‌ی رستوران‌ها', async ({ page }) => {
  await mockApi(page);
  await gotoApp(page);

  await page.fill('#sQ', 'یک‌چیزی‌که‌قطعاً‌نیست');
  await page.getByRole('button', { name: 'جستجو' }).click();

  const feed = page.locator('#feed');
  await expect(feed).toContainText('پیدا نشد');
  // رگرسیونِ واقعی: نسخه‌ی قبل کلِ فهرست را نشان می‌داد و فقط toast می‌داد،
  // پس کاربر کارت‌ها را نتیجه‌ی جست‌وجو فرض می‌کرد.
  await expect(feed.locator('.rc')).toHaveCount(0);
  await expect(feed.getByRole('button', { name: /دیدنِ همه/ })).toBeVisible();
});

test('«نزدیک تو» بدونِ اجازه‌ی موقعیت، فاصله ادعا نمی‌کند', async ({ page }) => {
  await mockApi(page);
  await gotoApp(page);

  const nearby = page.locator('#nearbyScroll');
  await expect(nearby.locator('.hcard').first()).toBeVisible();
  // نه برچسبِ فاصله، نه عنوانِ «نزدیک تو»
  await expect(nearby).not.toContainText('کیلومتر');
  await expect(nearby).not.toContainText('متر');
  await expect(page.locator('#nearbyTitle')).toHaveText('پیشنهاد برای تو');
});
