import { Page, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
//  Helperهای مشترکِ E2E — کارهای تکراری در یک جا
//  (اگر UI عوض شود، فقط اینجا به‌روزرسانی می‌شود — نه در هر تست)
// ═══════════════════════════════════════════════════════════

/** باز کردنِ اپ و صبر تا آماده شدنِ صفحه‌ی کشف. */
export async function gotoApp(page: Page) {
  // onboardingِ بارِ اول را در تست‌ها رد کن (تنظیمِ حالتِ تست، نه تغییرِ رفتار)
  await page.addInitScript(() => { try { localStorage.setItem('rz_onboarded', '1'); } catch { /* ignore */ } });
  await page.goto('/');
  // صفحه‌ی کشف باید فعال باشد
  await expect(page.locator('#page-discover')).toBeVisible();
}

/** بازکردنِ اولین رستوران از فید. */
export async function openFirstRestaurant(page: Page) {
  // ⚠️ مقاوم‌سازی در برابرِ ری‌رندرِ فید (۲۰۲۶-۰۸-۲۵): فید اول اسکلت می‌سازد و
  // بعد (۲۸۰ms) با کارت جایگزین می‌کند و دوباره پس از رسیدنِ دادهٔ API
  // (syncRestaurants) رندر می‌شود — پس یک .rc-openِ ظاهراً پایدار می‌تواند دقیقاً
  // حینِ کلیک detach شود و کلیک گم شود (زیرِ بارِ چند-worker فلیک می‌داد، در
  // ایزوله همیشه سبز). حالا اگر صفحه باز نشد، کلیک را روی کارتِ نشسته تکرار می‌کنیم.
  const firstCard = page.locator('.rc .rc-open').first();
  await expect(firstCard).toBeVisible();
  await expect(async () => {
    await firstCard.click({ timeout: 3000 });
    await expect(page.locator('#page-rest')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

/** ورود مستقل از UI و موتورِ مرورگر.
 *  به‌جای درایوِ فلوی OTP (که روی webkit مرحله‌ی کد را قابل‌اتکا رندر نمی‌کرد)، از
 *  مسیرِ «بازیابیِ نشست» اپ استفاده می‌کنیم: init.js اگر توکنِ ذخیره‌شده ببیند،
 *  /me را می‌خواند و کاربر را set می‌کند. پس توکنِ دمو در localStorage می‌گذاریم،
 *  پاسخِ /me را به کاربرِ دمو override می‌کنیم و صفحه را reload می‌کنیم. */
export async function login(page: Page, phone = '09123456789') {
  type W = { isLoggedIn?: () => boolean };
  // این override بعد از mockِ beforeEach ثبت می‌شود، پس برای GET /me اولویت دارد.
  await page.route('**/api/v1/me', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-demo', phone: '+989123456789', first_name: 'کاربر', last_name: 'دمو' },
        }),
      });
    }
    return route.fallback();
  });
  await page.evaluate(() => {
    try {
      localStorage.setItem('rz_access', 'demo-access-token');
      localStorage.setItem('rz_refresh', 'demo-refresh-token');
    } catch { /* ignore */ }
  });
  await page.reload();
  await expect(page.locator('#page-discover')).toBeVisible();
  await page.waitForFunction(
    () => (window as unknown as W).isLoggedIn?.() === true,
    undefined,
    { timeout: 8000 },
  );
  void phone;
}

/** رفتن به یک تبِ ناوبری.
 *  نکته: data-nav هم روی navِ پایین (موبایل) و هم navِ بالا (دسکتاپ) هست و فقط یکی
 *  در هر ویوپورت دیده می‌شود؛ با :visible همان قابل‌مشاهده را می‌زنیم تا strict-mode
 *  نشکند و روی هر دو ویوپورت کار کند. */
export async function navTo(page: Page, tab: 'discover' | 'favorites' | 'trips' | 'loyalty') {
  await page.locator(`[data-nav="${tab}"]:visible`).first().click();
  await expect(page.locator(`#page-${tab}`)).toBeVisible();
}

/** انتظار برای نمایشِ toast با متنِ مشخص. */
export async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.locator('#toast');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(text);
}
