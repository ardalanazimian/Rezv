import { test, expect, Page } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, openFirstRestaurant, login } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ P0-3 — «NETWORK FAILURE ≠ SUCCESS» (فازِ ۲، پروتکل §۳)
//
//  این فایل دقیقاً همان الزامِ صریحِ پروتکل را پین می‌کند:
//    «A customer must NEVER see: fake reservation confirmation,
//     fake reservation code, fake points, fake availability … when the
//     real backend did not confirm the transaction.»
//
//  چهار مسیرِ جعل که رفع شدند و اینجا قفل می‌شوند:
//    ۱. booking.confirmBook  → کدِ `RZ…`ِ تصادفی + تیکِ سبزِ «رزرو تأیید شد»
//    ۲. waitlist.joinWaitlist → جایگاهِ تصادفیِ صف
//    ۳. waitlist.refreshWL    → «میزت آماده شد!»ِ ساختگی
//    ۴. waitlist.acceptWL     → کدِ `RZWL…`ِ ساختگی + «رزروت ثبت شد!»
//
//  روش: به‌جایِ mock کردنِ پاسخ، درخواست را **abort** می‌کنیم — یعنی دقیقاً
//  همان چیزی که در قطعیِ واقعیِ اینترنت رخ می‌دهد و مسیرِ `res.offline` را
//  فعال می‌کند. (mock کردنِ ۵۰۰ کافی نیست: آن مسیرِ «خطایِ سرور» است، نه
//  مسیرِ آفلاین که باگ در آن بود.)
// ═══════════════════════════════════════════════════════════════════════

/** الگویِ کدِ رزروِ جعلی که کلاینت قبلاً می‌ساخت: RZxxxxx / RZWLxxxx */
const FAKE_CODE = /\bRZ(WL)?[A-Z0-9]{4,7}\b/;

/** ادعاهایِ موفقیتِ کسب‌وکار که در قطعیِ شبکه هرگز نباید دیده شوند. */
const FAKE_SUCCESS_TEXT = /رزرو تأیید شد|رزروت ثبت شد|رزرو محلی ثبت شد|میزت آماده شد/;

/** قطعِ کاملِ شبکه برایِ همه‌ی فراخوان‌هایِ API (شبیه‌سازیِ آفلاینِ واقعی). */
async function goOffline(page: Page) {
  await page.route('**/api/v1/**', (route) => route.abort('failed'));
}

/** پیش‌رفتن در شیتِ رزرو تا کلیکِ «تأیید رزرو». */
async function advanceToConfirm(page: Page) {
  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await expect(page.locator('#sheet')).toBeVisible();
  await page.waitForFunction(() => {
    const s = document.getElementById('bwTime') as HTMLSelectElement | null;
    return !!s && [...s.options].some((o) => o.value && o.value !== '');
  }, undefined, { timeout: 5000 });
  await page.getByRole('button', { name: /بررسی میزهای موجود/ }).click();
  await page.getByRole('button', { name: 'ادامه', exact: true }).click();
}

test.describe('P0-3 — قطعیِ شبکه هرگز به موفقیتِ جعلی تبدیل نمی‌شود', () => {
  // این تست‌ها یک جریانِ کاملِ چندمرحله‌ای را طی می‌کنند (ورود → انتخابِ رستوران →
  // انتخابِ سانس → تأیید → قطعِ شبکه). روی WebKitِ موبایل و زیرِ بارِ موازیِ CI،
  // همین جریان از مهلتِ پیش‌فرضِ ۳۰ ثانیه رد می‌شود — یک بار به‌صورتِ واقعی
  // مشاهده شد (mobile-safari با ۴ ورکر شکست، با ۱ ورکر پاس).
  //
  // ⚠️ این تنها تغییرِ مجاز است: مهلت بیشتر می‌شود، **هیچ assertionی ضعیف نمی‌شود**.
  // مسئله سرعتِ محیط بود، نه درستیِ ادعا.
  test.slow();

  test('تأییدِ رزرو در آفلاین: نه کدِ رزرو، نه ادعایِ تأیید', async ({ page }) => {
    // اول با mockِ سالم تا مرحله‌ی تأیید می‌رویم (اسلات‌ها باید لود شوند)…
    await mockApi(page);
    await gotoApp(page);
    await login(page);
    await openFirstRestaurant(page);
    await advanceToConfirm(page);

    // …سپس دقیقاً پیش از submit، شبکه را قطع می‌کنیم.
    await goOffline(page);
    await page.getByRole('button', { name: /تأیید رزرو|تایید رزرو/ }).click();

    const body = page.locator('#sheetBody');
    await expect(body).toContainText(/رزرو ثبت نشد/, { timeout: 8000 });

    const text = (await body.innerText()) || '';
    expect(text, 'نباید کدِ رزروِ ساختگی نشان داده شود').not.toMatch(FAKE_CODE);
    expect(text, 'نباید ادعایِ تأییدِ رزرو بشود').not.toMatch(FAKE_SUCCESS_TEXT);
    // جعبه‌ی «کد رزرو» اصلاً نباید رندر شود
    await expect(page.locator('#sheetBody .code-box')).toHaveCount(0);
    // تیکِ سبزِ موفقیت هم نباید باشد
    await expect(page.locator('#sheetBody .success-check')).toHaveCount(0);
  });

  test('تأییدِ رزرو در آفلاین: هیچ سفرِ جعلی به «رزروهای من» اضافه نمی‌شود', async ({ page }) => {
    await mockApi(page);
    await gotoApp(page);
    await login(page);
    await openFirstRestaurant(page);
    await advanceToConfirm(page);

    const before = await page.evaluate(
      () => (window as unknown as { TRIPS?: unknown[] }).TRIPS?.length ?? -1
    );

    await goOffline(page);
    await page.getByRole('button', { name: /تأیید رزرو|تایید رزرو/ }).click();
    await expect(page.locator('#sheetBody')).toContainText(/رزرو ثبت نشد/, { timeout: 8000 });

    const after = await page.evaluate(
      () => (window as unknown as { TRIPS?: unknown[] }).TRIPS?.length ?? -1
    );
    // اگر TRIPS در دسترس نبود (‎-1‎) این ادعا بی‌معنی است؛ فقط وقتی معنادار است که خوانده شود.
    if (before >= 0 && after >= 0) {
      expect(after, 'رزروِ ثبت‌نشده نباید در فهرستِ سفرها ظاهر شود').toBe(before);
    }
  });

  test('پیوستن به لیست انتظار در آفلاین: نه جایگاهِ صف، نه ادعایِ عضویت', async ({ page }) => {
    await mockApi(page);
    await gotoApp(page);
    await login(page);
    await openFirstRestaurant(page);

    await goOffline(page);
    await page.evaluate(() =>
      (window as unknown as { joinWaitlist: (id: number) => Promise<void> }).joinWaitlist(1)
    );

    const body = page.locator('#sheetBody');
    await expect(body).toContainText(/اتصال به سرور برقرار نشد/, { timeout: 8000 });
    const text = (await body.innerText()) || '';
    expect(text, 'نباید ادعایِ موفقیت بشود').not.toMatch(FAKE_SUCCESS_TEXT);
    // «نفر ۲ در صف» و «۲۵ دقیقه» هر دو ساختگی بودند
    expect(text, 'نباید تخمینِ انتظارِ ساختگی نشان داده شود').not.toMatch(/دقیقه تا نوبتت/);
  });

  test('قبولِ آفرِ صف در آفلاین: نه کدِ رزرو، نه «رزروت ثبت شد»', async ({ page }) => {
    await mockApi(page);
    await gotoApp(page);
    await login(page);
    await openFirstRestaurant(page);

    // اول با شبکه‌ی سالم واقعاً به صف بپیوند (تا WL مقدارِ واقعی بگیرد)…
    await page.evaluate(() =>
      (window as unknown as { joinWaitlist: (id: number) => Promise<void> }).joinWaitlist(1)
    );
    await expect(page.locator('#sheetBody')).toContainText(/صف|انتظار|نوبت/, { timeout: 8000 });

    // …سپس شبکه را قطع کن و آفر را «قبول» کن.
    await goOffline(page);
    await page.evaluate(() =>
      (window as unknown as { acceptWL: () => Promise<void> }).acceptWL()
    );

    const body = page.locator('#sheetBody');
    await expect(body).toContainText(/اتصال به سرور برقرار نشد/, { timeout: 8000 });
    const text = (await body.innerText()) || '';
    expect(text, 'نباید کدِ رزروِ ساختگی بسازد').not.toMatch(FAKE_CODE);
    expect(text, 'نباید بگوید رزرو ثبت شد').not.toMatch(FAKE_SUCCESS_TEXT);
  });

  test('به‌روزرسانیِ صف در آفلاین: صف جلو نمی‌رود و آفرِ ساختگی نمی‌سازد', async ({ page }) => {
    await mockApi(page);
    await gotoApp(page);
    await login(page);
    await openFirstRestaurant(page);

    await page.evaluate(() =>
      (window as unknown as { joinWaitlist: (id: number) => Promise<void> }).joinWaitlist(1)
    );
    await expect(page.locator('#sheetBody')).toContainText(/صف|انتظار|نوبت/, { timeout: 8000 });

    // جایگاهِ واقعیِ فعلی (از mock: position=2)
    const posBefore = await page.evaluate(
      () => (window as unknown as { WL?: { position?: number } }).WL?.position ?? -1
    );

    await goOffline(page);
    // چند بار refresh — نسخه‌ی معیوب هر بار صف را یکی جلو می‌برد تا «آماده شد»
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() =>
        (window as unknown as { refreshWL: () => Promise<void> }).refreshWL()
      );
    }

    const posAfter = await page.evaluate(
      () => (window as unknown as { WL?: { position?: number } }).WL?.position ?? -1
    );
    const status = await page.evaluate(
      () => (window as unknown as { WL?: { status?: string } }).WL?.status ?? ''
    );

    if (posBefore >= 0 && posAfter >= 0) {
      expect(posAfter, 'جایگاهِ صف بدونِ تأییدِ سرور نباید تغییر کند').toBe(posBefore);
    }
    expect(status, 'آفرِ ساختگی نباید ساخته شود').not.toBe('offered');
    const text = (await page.locator('#sheetBody').innerText()) || '';
    expect(text).not.toMatch(/میزت آماده شد/);
  });
});
