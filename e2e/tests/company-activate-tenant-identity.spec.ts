import { test, expect, type Page } from '@playwright/test';

/**
 * پنلِ شرکت — تأییدیه‌ی فعال‌سازیِ اشتراک باید **نامِ مقصد** را نشان دهد.
 *
 * ⚠️ چرا این spec وجود دارد (blockerِ ۲۰۲۶-۰۹-۰۷):
 * `activateSalesOrder` وقتی سفارش `tenant_id` نداشت، شناسه را با یک
 * `window.prompt` خام از مدیر می‌گرفت — و بعد تأییدیه را با عبارتِ عمومیِ
 * «این کسب‌وکار» نشان می‌داد، چون `who` فقط از `o.suggested_tenant` ساخته
 * می‌شد و آن در همین مسیر طبقِ تعریف null است. یعنی مدیر روی یک UUIDِ
 * تایپی/پیستیِ **تأییدنشده** تأیید می‌زد و یک رقمِ اشتباه اشتراکِ پولی را
 * روی رستورانِ دیگری فعال می‌کرد، بدونِ هیچ راهی برای تشخیص پیش از کلیک.
 *
 * ادعای این تست رفتاری است، نه ظاهری: متنِ همان دیالوگی که مدیر واقعاً
 * می‌بیند باید نامِ رستورانِ مقصد را داشته باشد. اگر روزی `who` دوباره به
 * رشته‌ی عمومی برگردد، اینجا قرمز می‌شود.
 */

const CO = 'http://localhost:8082/';

const TARGET_TENANT = 't-777';
const TARGET_NAME = '[DEMO] رستورانِ هدف';

/** سفارشِ خرید **بدونِ** tenant_id و **بدونِ** suggested_tenant — همان حالتِ خطرناک. */
const ORPHAN_ORDER = {
  id: 'o-1', code: 'ORD-1', kind: 'purchase', status: 'pending',
  business_name: 'کسب‌وکارِ بی‌حساب', contact_name: 'علی', phone: '09120000000',
  plan_name: 'حرفه‌ای', months: 12, amount_toman: 12_000_000,
  created_at: new Date('2026-09-01').toISOString(),
  tenant_id: null, suggested_tenant: null,
};

async function mockCo(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    // ⚠️ بدونِ این، فرمِ ورود اصلاً رندر نمی‌شود: پنلِ شرکت اول از سرور
    // می‌پرسد آیا ورودِ OTP فعال است (منشور: OTP از پنل‌ها حذف شده و پشتِ
    // فلگ است). اولین اجرا با mockِ catch-all روی `#adminPhone` تایم‌اوت شد —
    // نه باگِ رفع، باگِ خودِ تست.
    if (path === '/auth/admin/login' && route.request().method() === 'GET') {
      return json({ totp_required: false, otp_login_enabled: true });
    }
    if (path === '/auth/admin/request') return json({ devCode: '1234' });
    if (path === '/auth/admin/verify') {
      return json({ access: 'a', refresh: 'r', admin: { id: 'a1', tenant_name: 'شرکت رزرونو' } });
    }
    // فهرستی که شناسه از آن به نام تبدیل می‌شود
    if (path === '/admin/restaurants') {
      return json({ restaurants: [{
        id: 'r-1', name: TARGET_NAME, slug: 'target', tenant_id: TARGET_TENANT, plan: 'pro',
        is_open: true, members: 0, reservations: 0, sms_balance: 0, sms_total_sent: 0,
        joined_at: new Date('2026-08-01').toISOString(), subscription_status: 'active', days_left: 30,
        plan_expires_at: null, trial_ends_at: null,
      }] });
    }
    if (path === '/admin/site/orders') return json({ items: [ORPHAN_ORDER] });
    return json({ ok: true, items: [], data: [] });
  });
}

async function loginCo(page: Page) {
  await mockCo(page);
  await page.goto(CO);
  { const t = page.locator('button:has-text("ورود با پیامک")'); if (await t.isVisible().catch(() => false)) await t.click(); }
  await page.locator('#adminPhone').fill('09120000000');
  await page.locator('#adminSendBtn').click();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
}

/**
 * `prompt` را با شناسه‌ی داده‌شده پاسخ می‌دهد و **متنِ هر `confirm`** را
 * جمع می‌کند. `confirm` را `false` برمی‌گردانیم تا هیچ PATCHی شلیک نشود —
 * موضوعِ این تست متنِ تأییدیه است، نه اثرِ سرور.
 */
async function captureDialogs(page: Page, promptAnswer: string) {
  await page.evaluate((answer) => {
    const w = window as unknown as { __confirms: string[]; confirm: (m?: string) => boolean; prompt: (m?: string) => string | null };
    w.__confirms = [];
    w.prompt = () => answer;
    w.confirm = (m?: string) => { w.__confirms.push(String(m ?? '')); return false; };
  }, promptAnswer);
}

const confirmsOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { __confirms: string[] }).__confirms);

test('تأییدیه‌ی فعال‌سازی نامِ رستورانِ مقصد را نشان می‌دهد، نه «این کسب‌وکار»', async ({ page }) => {
  await loginCo(page);
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('sales'));
  await expect(page.locator('#v-sales')).toContainText('ORD-1');

  await captureDialogs(page, TARGET_TENANT);
  await page.locator('#v-sales button:has-text("فعال‌سازی")').first().click();

  const msgs = await confirmsOf(page);
  expect(msgs.length, 'باید دقیقاً یک تأییدیه بیاید — شناسه شناخته شد، پس هشدارِ «پیدا نشد» نباید بیاید').toBe(1);

  // ادعای اصلی: نامِ واقعی در متنِ تأییدیه هست.
  expect(msgs[0]).toContain(TARGET_NAME);
  // و شناسه هم برای بازبینیِ چشمی می‌آید.
  expect(msgs[0]).toContain(TARGET_TENANT);
  // و دیگر عبارتِ عمومی به‌تنهایی جای نام را نمی‌گیرد.
  expect(msgs[0]).not.toContain('اشتراکِ این کسب‌وکار');
});

test('شناسه‌ی ناشناخته صریح اعلام می‌شود، نه اینکه بی‌صدا رد شود', async ({ page }) => {
  await loginCo(page);
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('sales'));
  await expect(page.locator('#v-sales')).toContainText('ORD-1');

  await captureDialogs(page, 't-does-not-exist');
  await page.locator('#v-sales button:has-text("فعال‌سازی")').first().click();

  const msgs = await confirmsOf(page);
  // کنترلِ منفیِ ضروری: بدونِ این، رفعی که همیشه نام را «نامعلوم» بگذارد هم سبز می‌شد.
  expect(msgs.length, 'شناسه‌ی ناشناخته باید هشدارِ جداگانه بگیرد').toBeGreaterThanOrEqual(1);
  expect(msgs[0]).toContain('پیدا نشد');
  expect(msgs[0]).toContain('t-does-not-exist');
});
