import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from './helpers/actions';

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

/** وضعیتِ قابلِ‌مشاهده‌ی رندر — هر دو شمارنده. */
function counters(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __ioMade: number; __ioDisc: number };
    return { made: w.__ioMade, disc: w.__ioDisc };
  });
}

/** حالتِ دیداریِ #feed در همین لحظه — همان چیزی که کاربر می‌بیند. */
function feedState(page: Page) {
  return page.evaluate(() => {
    const f = document.getElementById('feed');
    if (!f) return 'no-feed';
    if (f.querySelector('.sk')) return 'skeleton';      // اسکلتِ همگام، رندر هنوز تمام نشده
    if (f.querySelector('.empty')) return 'empty';      // حالتِ خالیِ صادق
    if (f.querySelector('article.rc[data-rid]')) return 'cards'; // کارت‌های واقعی
    return 'unknown';
  });
}

/** ⚠️ به‌جای خوابِ ثابت، منتظرِ **حالتِ دیداریِ قطعی** می‌ماند (بازبینیِ ۲۰۲۶-۰۸-۲۷).
 *
 *  چرا خوابِ ثابت بد بود: `waitForTimeout(420)` برای تایمرِ ۲۸۰ms فقط ۱۴۰ms
 *  حاشیه داشت و روی رانرِ شلوغِ CI می‌توانست پیش از پایانِ رندر بسنجد.
 *
 *  ⚠️ و چرا «منتظرِ ساخته‌شدنِ observerِ تازه» هم غلط بود (نسخه‌ی دومِ همین
 *  تابع، که در **اجرای کاملِ سوئیت** افتاد و درست هم افتاد): `renderFeed` با
 *  ژتونِ FEED_TOKEN رندرِ کهنه را لغو می‌کند، پس رندری که رندرِ تازه‌تری از راه
 *  رسیده باشد **هیچ observerی نمی‌سازد** — شمارنده منتظرِ چیزی می‌ماند که قرار
 *  نبود بیاید.
 *
 *  علامتِ درست، خودِ DOM است: `doSearch` **همگام** عنوان و اسکلت (`.sk`) را
 *  می‌نویسد و فقط رندری که تا آخر می‌رسد اسکلت را با کارت جایگزین می‌کند. */
async function renderSettled(page: Page) {
  await expect
    .poll(() => feedState(page), {
      message: 'فید بعد از جست‌وجو به حالتِ نهایی نرسید (اسکلت پاک نشد)',
      timeout: 15_000,
    })
    .toMatch(/^(empty|cards)$/);
  return feedState(page);
}

/** فید را از **رابطِ واقعی** دوباره رندر می‌کند — جست‌وجو، همان کاری که کاربر
 *  می‌کند. عمداً `renderFeed` مستقیم صدا زده نمی‌شود: اپِ مشتری ESM است و فقط
 *  چند نقطه‌ی ورودیِ UI را رویِ `window` می‌گذارد (`doSearch`، `clearSearch`،
 *  … — رجوع کن به انتهای data/discover.js)؛ خودِ `renderFeed` بینشان نیست.
 *  پس تستی که بخواهد رندر را از global صدا بزند فقط skip می‌شود و چیزی ثابت
 *  نمی‌کند.
 *
 *  ⚠️ عبارت‌ها از خودِ فید خوانده می‌شوند، نه دستی نوشته می‌شوند. نسخه‌ی قبل پنج
 *  عبارتِ ثابت (کباب/پیتزا/…) داشت و در اجرای کاملِ سوئیت دیده شد که هیچ‌کدام
 *  با دادهٔ لحظه‌ی اجرا مچ نمی‌کنند: هر پنج جست‌وجو «چیزی پیدا نشد» می‌داد و
 *  فید اصلاً با کارت رندر نمی‌شد — یعنی تستِ نشت هیچ رندری را نمی‌سنجید.
 *  جست‌وجویِ نامِ یک رستورانِ **موجود در همین فید** همیشه دستِ‌کم خودش را
 *  برمی‌گرداند، پس نتیجه به دادهٔ محیط وابسته نیست. */
async function searchByCardNames(page: Page, names: string[]) {
  for (const n of names) {
    await page.locator('#sQ').fill(n);
    await page.locator('#sQ').press('Enter');
    // اول: مطمئن شو doSearch برایِ **همین** عبارت اجرا شده (عنوان همگام نوشته
    // می‌شود). بدونِ این، حالتِ قبلی می‌توانست به‌اشتباه «نهایی» خوانده شود.
    await expect(page.locator('#feedTitle')).toHaveText(`نتایج «${n}»`, { timeout: 15_000 });
    const state = await renderSettled(page);
    expect(state, `جست‌وجویِ نامِ «${n}» باید دستِ‌کم خودِ همان رستوران را بیاورد`)
      .toBe('cards');
  }
}

test('فیدِ کشف با هر رندر observerِ تازه انباشته نمی‌کند', async ({ page }) => {
  await instrument(page);
  // ⚠️ `gotoApp` به‌جای `page.goto` — و این یک تمیزکاری نیست، رفعِ علتِ ریشه‌ایِ
  // ناپایداریِ همین تست است (۲۰۲۶-۰۸-۲۷، با ابزارگذاری اثبات شد نه حدس):
  // ویزاردِ onboarding بارِ اول ۵۰۰ms بعد از بوت باز می‌شود، `lockAppSurfaces()`
  // می‌زند و فوکوس را به دکمه‌ی «بعدی» می‌برد. `press('Enter')` روی `#sQ` بعد از
  // آن لحظه به overlay می‌رسید، نه به جست‌وجو — یعنی `doSearch` اصلاً اجرا
  // نمی‌شد و فید هرگز دوباره رندر نمی‌شد (عنوان روی «🔥 محبوب امشب»ِ اولیه
  // می‌ماند). `gotoApp` همان `rz_onboarded` را ست می‌کند که بقیه‌ی اسپک‌ها
  // می‌کنند و baseURL را هم رعایت می‌کند (به‌جای hardcodeِ localhost:8080).
  await gotoApp(page);
  await page.locator('#sQ').waitFor({ state: 'visible', timeout: 15_000 });

  // ⚠️ بگذار بوت تمام شود. `syncRestaurants` بعد از پاسخِ `/restaurants` فید را
  // **دوباره** می‌سازد؛ اگر وسطِ حلقه‌ی جست‌وجو برسد، رندرِ ما را بازنویسی
  // می‌کند و تست چیزی را می‌سنجد که کاربر نساخته.
  await page.waitForLoadState('networkidle');

  // کنترلِ مثبتِ روش، به‌جای خوابِ ثابتِ ۱۲۰۰ms. شرط عمداً «کارتِ واقعی» است نه
  // «شمارنده > ۰»: یک IntersectionObserverِ دیگر (singletonِ theme-pwa) همیشه
  // ساخته می‌شود، پس شمارنده حتی وقتی فید هنوز خالی است هم مثبت می‌شود.
  await expect
    .poll(() => feedState(page), {
      message: 'فیدِ اول هرگز به کارتِ واقعی نرسید — دادهٔ رستوران‌ها لود نشد یا رندر شکست',
      timeout: 25_000,
    })
    .toBe('cards');

  const baseline = (await counters(page)).made;

  // ⚠️ `:not(.demo-chip)` لازم است: کنارِ نامِ رستوران یک چیپِ «نمونه» هم داخلِ
  // همان `.rc-name` است و بدونِ این فیلتر، «نمونه» به‌عنوانِ نامِ رستوران
  // جست‌وجو می‌شد و هیچ نتیجه‌ای نمی‌داد.
  const names = (await page.locator('#feed article.rc .rc-name > span:not(.demo-chip)').allTextContents())
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4);
  expect(names.length, 'برای سنجشِ انباشت، دستِ‌کم سه رندرِ پیاپی لازم است')
    .toBeGreaterThanOrEqual(3);

  await searchByCardNames(page, names);

  const { made, disc } = await counters(page);

  // هر رندر یکی می‌سازد و قبلی را می‌بندد ⇒ زنده‌ها باید ≤ ۱ بمانند.
  // (observerِ جداگانه‌ی theme-pwa singleton است و یک‌بار ساخته می‌شود؛ سقفِ ۲
  //  همان یکی + فیدِ جاری را پوشش می‌دهد.)
  const alive = made - disc;
  expect(alive, `observerهای زنده: ساخته=${made} بسته=${disc} (پایه=${baseline})`)
    .toBeLessThanOrEqual(2);
});
