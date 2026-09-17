import { test, expect, type Page } from '@playwright/test';
import { mockAdminOtpFlag } from './helpers/mock-api';

/**
 * پنلِ شرکت: بن بدونِ «دلیلی که کاربر می‌بیند» ثبت نمی‌شود (STATE M-14 · F003).
 *
 * چرا (Feature Verification، ۲۰۲۶-۰۹-۱۷): مودالِ بن فقط یک متنِ آزاد داشت با placeholderِ «شکایتِ
 * رسمیِ رستوران» — و سرور همان متن را به خودِ کاربرِ بن‌شده تحویل می‌داد. حالا دو فیلد، دو مخاطب:
 * کلیدِ عمومی (اجباری، یکی از enumِ `BanReasonKey`) و یادداشتِ داخلی (هرگز به کاربر نمی‌رسد).
 *
 * ⚠️ API mock است → فقط **UI** سنجیده می‌شود. اجباری‌بودنِ `reason_key` سمتِ سرور و نرسیدنِ
 * یادداشت به کاربر در `api/tests/user-ban-public-reason.integration.test.mts` پین شده است.
 * مودال مستقیم با `openBanModal` باز می‌شود: موضوعِ این تست خودِ مودال است، نه جست‌وجوی ۳۶۰.
 */

// پیش‌فرضِ CI همان پورتِ webServerِ پنلِ شرکت است؛ برای اجرای ایزوله قابلِ override است.
const CO = process.env.RZ_COMPANY_URL ?? 'http://localhost:8082/';
const USER_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

async function openModal(page: Page, bans: Array<Record<string, unknown>>) {
  // ترتیب مهم است: routeی که دیرتر ثبت شود اولویت دارد. catch-all اول، پرچمِ «ورود با پیامک» بعد
  // (همان ترتیبِ company-provisioning.spec) — وگرنه catch-all پرچم را می‌پوشاند و فرمِ ورود نمی‌آید.
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/admin/request') return json({ devCode: '1234' });
    if (path === '/auth/admin/verify') {
      return json({ access: 'demo-access', refresh: 'demo-refresh', admin: { id: 'a1', tenant_name: 'شرکت رزرونو' } });
    }
    if (path === `/admin/users/${USER_ID}/ban` && route.request().method() === 'POST') {
      bans.push(route.request().postDataJSON() as Record<string, unknown>);
      return json({ ok: true, user_id: USER_ID, already_banned: false });
    }
    return json({ ok: true, items: [], data: [] });
  });
  await mockAdminOtpFlag(page);
  await page.goto(CO);
  { const t = page.locator('button:has-text("ورود با پیامک")'); if (await t.isVisible().catch(() => false)) await t.click(); }
  await page.locator('#adminPhone').fill('09120000000');
  await page.locator('#adminSendBtn').click();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await page.evaluate((id) => (window as unknown as { openBanModal: (a: string, b: string) => void }).openBanModal(id, 'سارا'), USER_ID);
  await expect(page.locator('#banReasonKey')).toBeVisible();
}

test.describe('مودالِ بن — کلیدِ عمومی اجباری است', () => {
  test.slow();

  test('بدونِ انتخابِ کلید چیزی ارسال نمی‌شود', async ({ page }) => {
    const bans: Array<Record<string, unknown>> = [];
    await openModal(page, bans);
    await page.locator('#banReason').fill('یادداشتِ داخلیِ آزمون');
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'تأییدِ بن' }).click();
    await expect(page.locator('body')).toContainText('دلیلی که کاربر می‌بیند رو انتخاب کن');
    expect(bans).toHaveLength(0);
  });

  test('کلید و یادداشت هر دو، هرکدام در فیلدِ خودش، ارسال می‌شوند', async ({ page }) => {
    const bans: Array<Record<string, unknown>> = [];
    await openModal(page, bans);
    // گزینه‌ها همان جمله‌هایی‌اند که کاربر می‌خواند (اتصال در api/tests/ban-reason-copy-binding.test.mts).
    await expect(page.locator('#banReasonKey option[value="user_request"]')).toHaveText('به درخواستِ خودت.');
    await page.locator('#banReasonKey').selectOption('promo_abuse');
    await page.locator('#banReason').fill('یادداشتِ داخلیِ آزمون');
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'تأییدِ بن' }).click();
    await expect.poll(() => bans.length).toBe(1);
    expect(bans[0]).toEqual({ reason_key: 'promo_abuse', reason: 'یادداشتِ داخلیِ آزمون' });
  });
});
