import { test, expect, type Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  دسترسیِ کیبورد در پنل‌ها — راستی‌آزماییِ یافته‌های a11yِ معلق
//
//  زمینه: `docs/recovery/OPEN-FINDINGS.md §۴` هشت یافته‌ی a11y دارد که
//  «رد نشدند — راستی‌آزمایی نشدند» (عاملِ راستی‌آزما وسطِ اجرا مُرد).
//  این فایل یکی از آن‌ها را — `branch-switcher-not-keyboard-reachable` —
//  از حدس به گاردِ اجراشونده تبدیل می‌کند.
//
//  یافته واقعی بود: `.sb-switch` یک <div> با onclick بود، بدونِ tabindex،
//  بدونِ role و بدونِ هندلرِ کیبورد ⇒ کاربرِ کیبورد نه می‌توانست به سوییچرِ
//  شعبه برسد و نه فعالش کند.
//
//  ⚠️ چرا ممیزیِ موجود نگرفته بود: `panel-authed-audit.spec.ts` فقط اندازه‌ی
//  هدفِ لمسی و کنتراست را می‌سنجد، و سلکتورش
//  `button, a[href], input, select, textarea, [role="button"], [role="tab"],
//   [tabindex]:not([tabindex="-1"])` است — یک divِ خالی هیچ‌کدام نبود، پس
//  عنصر اصلاً وارد ممیزی نمی‌شد. نامرئی برایِ ابزار ≠ سالم.
//
//  اپِ مشتری این مشکل را ندارد: `js/features/a11y.js` divهای کلیک‌پذیر را به
//  role=button + tabindex ارتقا می‌دهد و Enter/Space را به click نگاشت می‌کند.
//  پنل‌ها چنین لایه‌ای ندارند، برای همین رفع اینجا نقطه‌ای است.
// ═══════════════════════════════════════════════════════════════════════

const BIZ = 'http://localhost:8081/';

async function loginByPassword(page: Page) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const json = (b: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (path === '/auth/staff/login') {
      return json({ staff: { role: 'owner', restaurant_name: 'کافه‌رستوران ویستا [DEMO]', permissions: {} },
        access: 'demo-access-token', refresh: 'demo-refresh-token' });
    }
    // ⚠️ دو شعبه لازم است، نه صفر: `openBranchSwitcher` وقتی
    // `BRANCHES.length <= 1` باشد عمداً toast می‌دهد و مودال باز نمی‌کند —
    // رفتارِ درستِ محصول است. نسخه‌ی اولِ این تست با لیستِ خالی mock می‌کرد و
    // به دلیلِ **غلط** قرمز می‌شد (نه به‌خاطرِ نقصِ کیبورد).
    if (path === '/restaurant/branches') {
      return json({ branches: [
        { id: 'b1', name: '[DEMO] شعبه‌ی اصلی', is_open: true },
        { id: 'b2', name: '[DEMO] شعبه‌ی دوم', is_open: false },
      ] });
    }
    return json({ data: [], items: [], total: 0 });
  });
  await page.goto(BIZ);
  await page.locator('#staffUser').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#staffUser').fill('ardalan');
  await page.locator('#staffPass').fill('secret');
  await page.locator('#staffLoginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/, { timeout: 15_000 });
}

/** رویِ ۳۹۰px نوارِ کناری یک کشویِ **بسته** است و `.sb-switch` داخلش پنهان
 *  می‌ماند — رفتارِ درستِ محصول، نه نقص. کاربرِ واقعی هم اول منو را باز می‌کند.
 *  ⚠️ بدونِ این، تست فقط رویِ desktop سبز می‌شد و رویِ mobile قرمز — همان
 *  «تستی که فقط دسکتاپ پاس شود» که CLAUDE.md بندِ ۴ ردش می‌کند. */
async function openDrawerIfCollapsed(page: Page) {
  const burger = page.locator('.tb-burger');
  if (await burger.isVisible()) {
    await burger.click();
    await expect(page.locator('.sb-switch')).toBeVisible({ timeout: 10_000 });
  }
}

test.describe('پنلِ کسب‌وکار — دسترسیِ کیبورد', () => {
  test('سوییچرِ شعبه با کیبورد قابلِ رسیدن است (role + tabindex)', async ({ page }) => {
    await loginByPassword(page);
    await openDrawerIfCollapsed(page);
    const sw = page.locator('.sb-switch');
    await expect(sw).toHaveAttribute('role', 'button');
    await expect(sw).toHaveAttribute('tabindex', '0');
    // aria-label جداست چون متنِ دیداری نامِ شعبه‌ی فعلی است، نه خودِ کنش.
    await expect(sw).toHaveAttribute('aria-label', /.+/);
  });

  test('🔴 focus + Enter واقعاً سوییچرِ شعبه را باز می‌کند', async ({ page }) => {
    // ادعایِ اصلی: نه فقط «صفتش را دارد»، بلکه کاربرِ کیبورد واقعاً می‌تواند
    // فعالش کند. بدونِ این، افزودنِ tabindex به‌تنهایی هم سبز می‌شد در حالی
    // که Enter هیچ‌کاری نمی‌کرد.
    await loginByPassword(page);
    await openDrawerIfCollapsed(page);
    await page.locator('.sb-switch').focus();
    await expect(page.locator('.sb-switch')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#modalBg')).toBeVisible({ timeout: 10_000 });
  });

  test('کنترلِ مثبتِ روش: بدونِ فشردنِ کلید، مودال بسته است', async ({ page }) => {
    // وگرنه تستِ بالا روی پنلی که مودالش از اول باز است هم سبز می‌شد.
    await loginByPassword(page);
    await openDrawerIfCollapsed(page);
    await page.locator('.sb-switch').focus();
    await expect(page.locator('#modalBg')).toBeHidden();
  });

  test('Space هم مثلِ Enter کار می‌کند (رفتارِ استانداردِ دکمه)', async ({ page }) => {
    await loginByPassword(page);
    await openDrawerIfCollapsed(page);
    await page.locator('.sb-switch').focus();
    await page.keyboard.press(' ');
    await expect(page.locator('#modalBg')).toBeVisible({ timeout: 10_000 });
  });
});
