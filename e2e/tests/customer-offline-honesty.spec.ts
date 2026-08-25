import { test, expect, type Page } from '@playwright/test';
import { DEMO_RESTAURANTS, mockApi } from './helpers/mock-api';
import { gotoApp, login } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ موجِ دومِ §۳ در اپِ مشتری (فازِ ۲، Batch 17)
//
//  زمینه: `apps/customer` تنها سطحی بود که در Batch 14 بازبینیِ سیستماتیک
//  نشد (عاملِ کشفش سه بار مُرد). بازبینیِ دستی پنج مسیرِ «موفقیتِ جعلی» پیدا
//  کرد که از Batch 2 جان سالم برده بودند — یعنی رفعِ آن batch کامل نبوده.
//
//  آنچه این فایل پین می‌کند:
//   ۱. خریدِ کارتِ هدیه، آفلاین → کدِ ساختگی با Math.random + شیتِ «کارت هدیه
//      ساخته شد!» + جمله‌ی «کد برای گیرنده پیامک شد». هیچ کارتی، هیچ پیامکی.
//   ۲. «کد برای گیرنده پیامک شد» حتی آنلاین هم بی‌قید ادعا می‌شد، در حالی که
//      بک‌اند فقط وقتی شماره داده شده باشد پیامک می‌فرستد.
//   ۳. دعوتِ دوستان → «دعوت ارسال شد» هم در آفلاین و هم وقتی کاربر اصلاً
//      لاگین نبود (که هیچ درخواستی هم نمی‌رفت).
//   ۴. لغوِ رزرو، آفلاین → **هیچ چیز**: نه خطا، نه برگرداندنِ ردیف. اسنکِ
//      «رزرو لغو شد» می‌ماند و مهمان باور می‌کند لغو کرده. جدی‌ترین مورد:
//      نتیجه‌اش no-showِ واقعی است.
//   ۵. ذخیره‌ی پروفایل، آفلاین → تیکِ سبزِ «پروفایل به‌روزرسانی شد».
//
//  روش: درخواست‌ها **abort** می‌شوند (نه mockِ ۵۰۰) تا دقیقاً مسیرِ
//  `res.offline` فعال شود — همان مسیری که باگ در آن بود.
// ═══════════════════════════════════════════════════════════════════════

/** ادعاهایی که در قطعیِ شبکه هرگز نباید دیده شوند. */
const FAKE_SUCCESS = /کارت هدیه ساخته شد|دعوت ارسال شد|پروفایل به‌روزرسانی شد/;
/** الگویِ کدِ کارتِ هدیه‌ی ساختگی که کلاینت قبلاً می‌ساخت. */
const FAKE_GIFT_CODE = /\bGIFT[A-Z0-9]{4,10}\b/;

async function goOffline(page: Page) {
  await page.route('**/api/v1/**', (route) => route.abort('failed'));
}

test.beforeEach(async ({ page }) => {
  test.slow();
  await mockApi(page);
});

test('کارت هدیه: قطعیِ شبکه کدِ ساختگی نمی‌سازد (§۳)', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  await goOffline(page);

  await page.evaluate(() => (window as unknown as { openGiftCards: () => void }).openGiftCards());
  await expect(page.locator('#sheet')).toBeVisible();

  // مبلغِ معتبر (بالایِ حداقلِ ۵۰٬۰۰۰) و بعد خرید.
  await page.evaluate(() => (window as unknown as { selectCustomAmt: (v: string) => void }).selectCustomAmt('100000'));
  await page.evaluate(() => (window as unknown as { buyGiftCard: () => Promise<void> }).buyGiftCard());

  const body = page.locator('body');
  await expect(body, 'هیچ کدِ کارتِ هدیه‌ای نباید ساخته شود').not.toHaveText(FAKE_GIFT_CODE);
  await expect(body, 'نباید ادعایِ ساخته‌شدنِ کارت بشود').not.toHaveText(/کارت هدیه ساخته شد/);
  await expect(body, 'نباید ادعایِ پیامک بشود').not.toHaveText(/کد برای گیرنده پیامک شد/);
});

test('کارت هدیه: بدونِ شماره‌ی گیرنده ادعایِ پیامک نمی‌شود', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  // پاسخِ موفقِ سرور، ولی کاربر شماره‌ای وارد نکرده.
  await page.route('**/api/v1/gift-cards', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ code: 'GIFTREAL123', amount_toman: 100000, expires_at: null }),
      });
    }
    return route.fallback();
  });

  await page.evaluate(() => (window as unknown as { openGiftCards: () => void }).openGiftCards());
  await expect(page.locator('#sheet')).toBeVisible();
  await page.evaluate(() => (window as unknown as { selectCustomAmt: (v: string) => void }).selectCustomAmt('100000'));
  await page.evaluate(() => (window as unknown as { buyGiftCard: () => Promise<void> }).buyGiftCard());

  // کدِ واقعیِ سرور باید دیده شود…
  await expect(page.locator('#sheet')).toContainText('GIFTREAL123');
  // …ولی چون شماره‌ای نبود، بک‌اند پیامکی نفرستاده.
  await expect(
    page.locator('#sheet'),
    'بک‌اند فقط با شماره‌ی گیرنده پیامک می‌فرستد',
  ).not.toContainText('کد برای گیرنده پیامک شد');
  await expect(page.locator('#sheet')).toContainText('کد را خودت به گیرنده برسان');
});

test('دعوتِ دوستان: قطعیِ شبکه «ارسال شد» ادعا نمی‌کند (§۳)', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  await goOffline(page);

  await page.evaluate(() => {
    const w = window as unknown as { openSheet: (h: string) => void };
    // ورودیِ شماره‌ای که sendInvite می‌خواند را مستقیم می‌سازیم تا وابسته به
    // چیدمانِ شیتِ دعوت نباشیم — رفتارِ خودِ تابع موضوعِ تست است.
    w.openSheet('<input id="refPhone" value="09121234567">');
  });
  await page.evaluate(() => (window as unknown as { sendInvite: () => Promise<void> }).sendInvite());

  await expect(page.locator('body'), 'هیچ ادعایِ ارسالِ دعوت نباید بشود').not.toHaveText(/دعوت ارسال شد|دعوت با پیامک ارسال شد/);
});

test('لغوِ رزرو: قطعیِ شبکه رزرو را «لغو‌شده» جا نمی‌زند (§۳)', async ({ page }) => {
  // ⚠️ نسخه‌ی اولِ این تست همیشه skip می‌شد چون mockِ مشترک هیچ رزروِ پیشِ‌رویی
  // برنمی‌گرداند — یعنی عملاً هیچ‌وقت اجرا نمی‌شد. تستی که همیشه skip شود دقیقاً
  // همان «شکافِ پنهان»ی است که این فاز درباره‌اش سخت‌گیر است، پس رزرو را
  // صریح تزریق می‌کنیم و دکمه‌ی واقعیِ UI را می‌زنیم.
  const tomorrow = new Date(Date.now() + 86_400_000);
  await page.route('**/api/v1/me/reservations*', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200, contentType: 'application/json',
      // ⚠️ قرارداد: آرایه‌ی خام، نه {reservations:[…]} — رجوع کن به
      // api/src/app/api/v1/me/reservations/route.ts (`NextResponse.json(list)`).
      // با شکلِ غلطِ قبلی، کلاینت این رزرو را نادیده می‌گرفت و تست ناخواسته
      // رویِ رزروِ seed اجرا می‌شد؛ یعنی چیزی را که ادعا می‌کرد نمی‌سنجید.
      body: JSON.stringify([{
        code: 'RZTEST01', status: 'confirmed', partySize: 2,
        slotStart: tomorrow.toISOString(),
        restaurantId: DEMO_RESTAURANTS[0].id,
        restaurant: { name: '[DEMO] رستورانِ تست', slug: 'demo-test' },
      }]),
    });
  });

  await gotoApp(page);
  await login(page);
  await page.evaluate(() => (window as unknown as { go: (p: string) => void }).go('trips'));

  const cancelBtn = page.locator('#page-trips').getByRole('button', { name: 'لغو', exact: true }).first();
  await expect(cancelBtn, 'دکمه‌ی لغوِ رزروِ پیشِ‌رو باید رندر شود').toBeVisible({ timeout: 15_000 });

  await goOffline(page);
  await cancelBtn.click();

  // undoSnack تأخیرِ commit دارد؛ بعد از آن باید صریح بگوید لغو نشد.
  await expect(
    page.locator('body'),
    'باید صریح بگوید لغو نشد — نه سکوت',
  ).toContainText(/لغو نشد|اتصال برقرار نیست/, { timeout: 20_000 });
});

test('ذخیره‌ی پروفایل: قطعیِ شبکه تیکِ سبزِ «به‌روزرسانی شد» نمی‌دهد (§۳)', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  await goOffline(page);

  await page.evaluate(() => {
    const w = window as unknown as { openSheet: (h: string) => void };
    w.openSheet('<div id="profEditItem"><input id="peFirst" value="نام"><input id="peLast" value="خانوادگی"><button class="btn btn-primary">ذخیره</button></div>');
  });
  await page.evaluate(() => (window as unknown as { saveProfileInline: (b?: unknown) => Promise<void> }).saveProfileInline());

  await expect(page.locator('body'), 'نباید ادعایِ ثبت روی حساب بشود').not.toHaveText(/پروفایل به‌روزرسانی شد/);
  await expect(page.locator('body')).toContainText(/هنوز ثبت نشده/);
});

test('هیچ‌کدام از این مسیرها متنِ موفقیتِ جعلی نمی‌سازند (پوششِ سراسری)', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  await goOffline(page);

  await page.evaluate(async () => {
    const w = window as unknown as Record<string, (...a: unknown[]) => unknown>;
    // هر کدام که موجود باشد صدا زده می‌شود؛ هیچ‌کدام نباید موفقیت ادعا کند.
    try { w.openGiftCards?.(); w.selectCustomAmt?.('100000'); await w.buyGiftCard?.(); } catch { /* */ }
  });

  await expect(page.locator('body')).not.toHaveText(FAKE_SUCCESS);
});
