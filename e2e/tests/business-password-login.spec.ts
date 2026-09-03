import { test, expect, type Page } from '@playwright/test';

/**
 * ورودِ پنلِ بیزنس با نام کاربری و رمز — مسیرِ اصلیِ تولید (OTP در پنل‌ها خاموش است).
 * تا ۲۰۲۶-۰۹-۰۳ هیچ specی این مسیر را نمی‌زد و سه فراخوانیِ `enterStaffPanel` (تعریف‌نشده)
 * از ۰۸-۲۶ با ReferenceError می‌مرد؛ e2eها همه از دکمه‌ی «ورود با پیامک» می‌رفتند (A2-001).
 * ادعا: بعد از پاسخِ موفقِ POST /auth/staff/login، overlay ی ورود پنهان می‌شود.
 */
const BIZ = 'http://localhost:8081/';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function mockBizApi(page: Page, calls: string[]) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    if (path === '/auth/staff/login' && method === 'POST') {
      calls.push(path);
      return route.fulfill(json({
        access: 'demo-access', refresh: 'demo-refresh',
        staff: { role: 'owner', restaurant_name: 'کافه‌رستوران ویستا [DEMO]', permissions: null },
      }));
    }
    return route.fulfill(json({ ok: true }));
  });
}

test('ورود با نام کاربری و رمز، overlay را می‌بندد (نه ReferenceError)', async ({ page }) => {
  const calls: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await mockBizApi(page, calls);
  await page.goto(BIZ);
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await page.locator('#staffUser').fill('owner_demo');
  await page.locator('#staffPass').fill('Passw0rd!123');
  await page.locator('#staffLoginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  expect(calls).toContain('/auth/staff/login');
  expect(pageErrors.filter((e) => /ReferenceError/.test(e))).toEqual([]);
});
