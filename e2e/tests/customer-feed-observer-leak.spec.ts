import { test, expect, type Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  نشتِ IntersectionObserver در فیدِ کشف
//
//  یافته (دسته‌ی «چند نشتِ observer/timer» در OPEN-FINDINGS §۲):
//  `renderFeed` در **هر** رندر یک IntersectionObserverِ تازه می‌ساخت و هرگز
//  `disconnect()` نمی‌کرد. کارت‌های رندرِ قبلی با جایگزینیِ `innerHTML` از DOM
//  جدا می‌شوند ولی observerِ قبلی هنوز رویشان observation دارد.
//
//  ⚠️ این تست تعدادِ observerها را **می‌شمارد**، نه اینکه فرض کند: سازنده‌ی
//  IntersectionObserver قبل از لودِ اپ wrap می‌شود و ساخت/disconnect شمرده
//  می‌شود. بدونِ شمارش، «رفع کردم» یک ادعای اثبات‌نشده بود.
// ═══════════════════════════════════════════════════════════════════════

const CUSTOMER = 'http://localhost:8080/';

async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __ioMade: number; __ioDisc: number };
    w.__ioMade = 0; w.__ioDisc = 0;
    const Orig = window.IntersectionObserver;
    // @ts-expect-error — جایگزینیِ عمدیِ سازنده برای شمارش
    window.IntersectionObserver = class extends Orig {
      constructor(cb: IntersectionObserverCallback, o?: IntersectionObserverInit) {
        super(cb, o); w.__ioMade++;
      }
      disconnect() { w.__ioDisc++; super.disconnect(); }
    };
  });
}

/** فید را از **رابطِ واقعی** دوباره رندر می‌کند — جست‌وجو، همان کاری که کاربر
 *  می‌کند. عمداً `renderFeed` مستقیم صدا زده نمی‌شود: اپِ مشتری ESM خالص است و
 *  چیزی رویِ `window` نمی‌گذارد، پس تستی که به global تکیه کند فقط skip می‌شود
 *  و هیچ چیزی ثابت نمی‌کند. */
async function searchTimes(page: Page, terms: string[]) {
  for (const t of terms) {
    await page.locator('#sQ').fill(t);
    await page.locator('#sQ').press('Enter');
    await page.waitForTimeout(420); // setTimeout(...,280) داخلِ renderFeed + حاشیه
  }
}

test('فیدِ کشف با هر رندر observerِ تازه انباشته نمی‌کند', async ({ page }) => {
  await instrument(page);
  await page.goto(CUSTOMER);
  await page.locator('#sQ').waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(1200); // رندرِ اولِ فید

  const baseline = await page.evaluate(() => (window as unknown as { __ioMade: number }).__ioMade);
  // کنترلِ مثبتِ روش: اگر ابزارگذاری کار نکند یا فید اصلاً رندر نشود، عدد صفر
  // می‌ماند و تست بی‌معنا سبز می‌شود. پس صریحاً می‌سنجیم که چیزی ساخته شده.
  expect(baseline, 'هیچ IntersectionObserverی ساخته نشد — ابزارگذاری یا رندر کار نکرده').toBeGreaterThan(0);

  await searchTimes(page, ['کباب', 'پیتزا', 'سنتی', 'کافه', 'ایتالیایی']);

  const { made, disc } = await page.evaluate(() => {
    const w = window as unknown as { __ioMade: number; __ioDisc: number };
    return { made: w.__ioMade, disc: w.__ioDisc };
  });

  // هر رندر یکی می‌سازد و قبلی را می‌بندد ⇒ زنده‌ها باید ≤ ۱ بمانند.
  // (observerِ جداگانه‌ی theme-pwa singleton است و یک‌بار ساخته می‌شود؛ سقفِ ۲
  //  همان یکی + فیدِ جاری را پوشش می‌دهد.)
  const alive = made - disc;
  expect(alive, `observerهای زنده: ساخته=${made} بسته=${disc} (پایه=${baseline})`)
    .toBeLessThanOrEqual(2);
});
