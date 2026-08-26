import { expect, test, type Page } from '@playwright/test';
import { openSmsLogin } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  تبِ «کارکنان» با **نقش** گیت می‌شود، نه با کلیدِ مجوز
//
//  ⚠️ بن‌بستی که این spec از آن زاده شد:
//  apps/business/js/routing.js تا امروز `staff: 'canManageStaff'` داشت. ولی
//  شمارشِ واقعی روی api/src/app/api نشان می‌دهد `canManageStaff` **صفر
//  اجراکننده** دارد؛ تنها ظهورش یک فیلدِ schema است. مدیریتِ کارکنان در
//  api/src/app/api/v1/restaurant/staff/route.ts:79 با `assertManagerOrOwner`
//  محافظت می‌شود که **نقش** می‌خواهد.
//  نتیجه: کارمندی که کلیدِ `canManageStaff` را گرفته بود تب را می‌دید و هر
//  کلیک ۴۰۳ می‌گرفت.
//
//  ⚠️ و چرا کلید عمداً اجرا نمی‌شود (نه اینکه یادشان رفته باشد): گاردِ PATCH
//  همان فایل فقط `target.role === 'owner'` را می‌گیرد، پس دارنده‌ی کلید
//  می‌توانست `staff_id: <خودش>` با `permissions: {همه true}` بفرستد و هم‌ترازِ
//  owner شود. کامنتِ خطوطِ ۴۹–۵۴ همان فایل از قبل همین را می‌گوید.
//
//  پس رفعِ درست UI را با سرور هم‌راستا می‌کند، نه برعکس.
// ═══════════════════════════════════════════════════════════════════════

const BUSINESS = 'http://localhost:8081/';

async function loginAs(page: Page, role: 'owner' | 'manager' | 'staff', permissions: unknown) {
  await page.route('**/auth/*/request', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, dev_code: '1234' }) }));
  await page.route('**/auth/*/verify', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      access: 'demo-access', refresh: 'demo-refresh',
      staff: { role, restaurant_name: 'کافه‌رستوران ویستا [DEMO]', permissions },
    }) }));
  await page.route('**/api/v1/**', r =>
    /\/auth\//.test(r.request().url())
      ? r.fallback()
      : r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[],"items":[],"total":0}' }));

  await page.goto(BUSINESS);
  await page.locator('#staffPhone').waitFor({ timeout: 15_000 });
  await openSmsLogin(page, 'staff');
  await page.locator('#staffPhone').fill('09123456789');
  await page.locator('#staffSendBtn').click();
  await page.locator('#staffCode').waitFor({ timeout: 15_000 });
  await page.locator('#staffCode').fill('1234');
  await page.locator('#staffVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toBeHidden({ timeout: 15_000 });
}

/** وضعیتِ واقعی‌ای که applyPermissionsToNav می‌نویسد — نه دیده‌شدن در viewport.
 *  ⚠️ عمداً روی `hidden`/`aria-hidden`/`tabIndex` است، نه toBeVisible():
 *  روی موبایل نوارِ کناری در یک کشویِ جمع‌شده است، پس toBeVisible() برایِ
 *  ownerِ کاملاً مجاز هم false می‌شد و تست به دلیلِ **غلط** قرمز می‌شد.
 *  این سه ویژگی دقیقاً همان قراردادی‌اند که routing.js:55-57 تعیین می‌کند. */
async function staffTabState(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.sb-item[data-v="staff"]') as HTMLElement | null;
    if (!el) return null;
    return { hidden: el.hidden, ariaHidden: el.getAttribute('aria-hidden'), tabIndex: el.tabIndex };
  });
}

test('⚠️ کارمندِ عادی حتی با canManageStaff تبِ «کارکنان» را نمی‌بیند', async ({ page }) => {
  // دقیقاً همان حالتی که بن‌بست می‌ساخت: کلید داده شده، ولی سرور نقش می‌خواهد.
  await loginAs(page, 'staff', {
    canManageStaff: true,
    canManageReservations: false, canManageTables: false, canManageWaitlist: false,
    canViewAnalytics: false, canViewRevenue: false, canManageCampaigns: false,
    canManageCoupons: false, canManageSettings: false,
  });
  expect(await staffTabState(page)).toEqual({ hidden: true, ariaHidden: 'true', tabIndex: -1 });
});

test('کنترلِ منفی: owner تب را دارد', async ({ page }) => {
  // بدونِ این، «همیشه پنهان کن» هم سبز می‌شد و قابلیت کاملاً می‌مرد.
  await loginAs(page, 'owner', null);
  expect(await staffTabState(page)).toEqual({ hidden: false, ariaHidden: 'false', tabIndex: 0 });
});

test('کنترلِ منفی: manager هم تب را دارد (سرور هم می‌پذیرد)', async ({ page }) => {
  await loginAs(page, 'manager', null);
  expect(await staffTabState(page)).toEqual({ hidden: false, ariaHidden: 'false', tabIndex: 0 });
});
