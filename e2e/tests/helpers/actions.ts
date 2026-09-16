import { Locator, Page, expect } from '@playwright/test';

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

/** نمای تمام‌صفحه را روی تایلِ nاُمِ فید باز می‌کند و همان آیتم را برمی‌گرداند.
 *
 * ⚠️ مسیر از DS-011 (۲۰۲۶-۰۹-۱۲) دو گامی شد. فید دیگر کارتِ ۲۷۰pxِ دارای دکمه‌ی
 * `.rc-open` نیست؛ موزاییکِ Explore است و هر تایل یک دکمه‌ی کشیده (`.xt-tap`)
 * دارد که نمای تمام‌صفحه را باز می‌کند. چیپ‌های ساعت هم به همین نما رفتند —
 * تایلِ ۱۲۸px جای کنترلِ ۴۴px ندارد.
 *
 * ⚠️ مقاوم‌سازی در برابرِ ری‌رندرِ فید (۲۰۲۶-۰۸-۲۵، هنوز برقرار): فید اول اسکلت
 * می‌سازد، بعد (۲۸۰ms) تایل، و دوباره پس از رسیدنِ دادهٔ API (syncRestaurants)
 * رندر می‌شود — پس یک تایلِ ظاهراً پایدار می‌تواند دقیقاً حینِ کلیک detach شود
 * و کلیک گم شود (زیرِ بارِ چند-worker فلیک می‌داد، در ایزوله همیشه سبز).
 */
export async function openImmersiveTile(page: Page, index = 0): Promise<Locator> {
  const tap = page.locator('#feed .rc .xt-tap').nth(index);
  await expect(tap).toBeVisible();
  await expect(async () => {
    await tap.click({ timeout: 3000 });
    await expect(page.locator('#page-immersive')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  // ترتیبِ آیتم‌های نما همان ترتیبِ فید است (imBuild از همان فهرست می‌سازد).
  return page.locator('#imFeed .im-item').nth(index);
}

/** از نمای تمام‌صفحه به صفحه‌ی رستوران («صفحه‌ی رستوران» داخلِ همان آیتم). */
export async function openRestFromImmersive(page: Page, item: Locator) {
  const open = item.locator('.im-open');
  await expect(async () => {
    await open.click({ timeout: 3000 });
    await expect(page.locator('#page-rest')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

/** بازکردنِ رستورانِ nاُمِ فید تا صفحه‌ی رستوران (تایل → تمام‌صفحه → صفحه). */
export async function openRestaurantTile(page: Page, index = 0) {
  const item = await openImmersiveTile(page, index);
  await openRestFromImmersive(page, item);
}

/** بازکردنِ اولین رستوران از فید — قراردادش دست‌نخورده: بعد از صدا زدنش
 *  `#page-rest` باز است. (۹ اسپکِ مصرف‌کننده به همین تکیه دارند.) */
export async function openFirstRestaurant(page: Page) {
  await openRestaurantTile(page, 0);
}

/** بازکردنِ رستوران با نامش — تایلِ متناظر، بعد صفحه‌ی رستوران. */
export async function openRestaurantByName(page: Page, name: string) {
  const tile = page.locator('#feed .rc').filter({ hasText: name }).first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  const rid = await tile.getAttribute('data-rid');
  await expect(async () => {
    await tile.locator('.xt-tap').click({ timeout: 3000 });
    await expect(page.locator('#page-immersive')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  // با rid آدرس می‌دهیم نه با ترتیب — فیلترِ نام ممکن است تایلِ nاُم نباشد.
  await openRestFromImmersive(page, page.locator(`#imFeed .im-item[data-rid="${rid}"]`));
}

/** شیتِ «کِی و چند نفر؟» را باز می‌کند.
 *  ⚠️ [DS-007 §۶ · ۲۰۲۶-۰۹-۱۰] دو selectِ هیرو (`#sWhen`/`#sParty`) با خودِ هیرو
 *  رفتند و جایشان این شیت نشست (`#ctxWhen`/`#ctxParty`)، که از چیپِ زیرِ فید باز
 *  می‌شود. تست‌هایی که هنوز idهای هیرو را می‌خواندند از آن روز بی‌صدا قرمز بودند. */
export async function openSearchCtxSheet(page: Page) {
  await page.locator('#page-discover .section-sub .ctx-pill').click();
  await expect(page.locator('#ctxWhen')).toBeVisible();
}

/** بستنِ شیتِ «کِی و چند نفر؟». */
export async function closeSearchCtxSheet(page: Page) {
  await page.getByRole('button', { name: /^باشه$/ }).click();
  await expect(page.locator('#sheet')).not.toHaveClass(/show/);
}

/** تاریخ/تعدادِ نفرِ زمینه را تنظیم می‌کند و شیت را می‌بندد. */
export async function setSearchCtx(page: Page, opts: { date?: string; party?: string }) {
  await openSearchCtxSheet(page);
  if (opts.date) await page.selectOption('#ctxWhen', opts.date);
  if (opts.party) await page.selectOption('#ctxParty', opts.party);
  await closeSearchCtxSheet(page);
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
