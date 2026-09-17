import { test, expect, type Page } from '@playwright/test';

/**
 * پنلِ کسب‌وکار: «نیومد» پیش از مهلتِ مهمان ممکن نیست، و مهلت/تمدید قابلِ تنظیم است
 * (STATE M-17 و M-13 · F001 · حکم‌های CEO D-18/D-20).
 *
 * چرا (Feature Verification، ۲۰۲۶-۰۹-۱۷): پنل «نیومد» را روی **هر** ردیفِ پیش‌رو نشان می‌داد و
 * `PATCH …/status` هیچ شرطِ زمانی نداشت — یعنی می‌شد رزرو را پیش از ساعتش غایب ثبت کرد (strike،
 * برگشتِ کش‌بک). مهلتِ صبر هم در هیچ‌جای پنل تنظیم‌شدنی نبود (صفر نویسنده برای lateGraceMinutes).
 *
 * ⚠️ API mock است → فقط **UI**. گیتِ واقعیِ ۴۰۹ و بازه‌های D-18 در
 * api/tests/late-arrival-no-show-gate.integration.test.mts پین شده‌اند.
 */

// پیش‌فرضِ CI همان پورتِ webServerِ پنلِ کسب‌وکار است؛ برای اجرای ایزوله قابلِ override است.
const BIZ = process.env.RZ_BUSINESS_URL ?? 'http://localhost:8081/';
const MIN = 60_000;
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Calls = { patches: string[]; policyPut: Array<Record<string, unknown>> };

async function openPanel(page: Page, calls: Calls) {
  const now = Date.now();
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    if (path === '/auth/staff/login' && method === 'POST') {
      return route.fulfill(json({ access: 'demo-access', refresh: 'demo-refresh',
        staff: { role: 'owner', restaurant_name: 'کافه‌رستوران ویستا [DEMO]', permissions: null } }));
    }
    if (path === '/restaurant/reservations' && method === 'GET') {
      return route.fulfill(json({ reservations: [
        { code: 'RZEARLY23', status: 'running_late', name: 'Early Guest', party_size: 2, table_number: 3, phone: '09121111111',
          slot_start: new Date(now - 5 * MIN).toISOString(), no_show_allowed_at: new Date(now + 20 * MIN).toISOString(),
          late_eta_signaled_at: new Date(now - 2 * MIN).toISOString(), late_eta_minutes: 10 },
        { code: 'RZPASSED2', status: 'running_late', name: 'Past Guest', party_size: 4, table_number: 5, phone: '09122222222',
          slot_start: new Date(now - 40 * MIN).toISOString(), no_show_allowed_at: new Date(now - 25 * MIN).toISOString(),
          late_eta_signaled_at: null, late_eta_minutes: null },
      ], next_cursor: null }));
    }
    if (/^\/restaurant\/reservations\/[^/]+\/status$/.test(path) && method === 'PATCH') {
      calls.patches.push(path);
      return route.fulfill(json({ ok: true }));
    }
    if (path === '/restaurant/cancellation-policy' && method === 'GET') {
      return route.fulfill(json({ free_cancel_hours: 24, partial_penalty_hours: 2, partial_penalty_pct: 50,
        deposit_required: false, auto_confirm: true, is_customized: true, late_grace_minutes: 15, max_late_extension_minutes: 15 }));
    }
    if (path === '/restaurant/cancellation-policy' && method === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.policyPut.push(body);
      return route.fulfill(json({ ...body, is_customized: true }));
    }
    return route.fulfill(json({ ok: true }));
  });
  await page.goto(BIZ);
  await page.locator('#staffUser').fill('owner_demo');
  await page.locator('#staffPass').fill('Passw0rd!123');
  await page.locator('#staffLoginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
}

const card = (page: Page, name: string) => page.locator('#resTL .tl-item').filter({ hasText: name });

test.describe('«نیومد» و مهلتِ مهمان', () => {
  test.slow();

  test('پیش از مهلت: دکمه غیرفعال با ساعت؛ پس از مهلت: فعال و PATCH می‌زند', async ({ page }) => {
    const calls: Calls = { patches: [], policyPut: [] };
    await openPanel(page, calls);
    await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('reservations'));
    const early = card(page, 'Early Guest');
    await expect(early).toBeVisible();
    const earlyBtn = early.getByRole('button', { name: /نیومد/ });
    await expect(earlyBtn).toBeDisabled();
    await expect(earlyBtn).toContainText('از ');
    await expect(early).toContainText('مهمان خبر داد: حدودِ ۱۰ دقیقه دیرتر می‌رسد');

    const past = card(page, 'Past Guest');
    const pastBtn = past.getByRole('button', { name: /نیومد/ });
    await expect(pastBtn).toBeEnabled();
    await expect(past).not.toContainText('مهمان خبر داد');
    page.on('dialog', (d) => d.accept());
    await pastBtn.click();
    await expect.poll(() => calls.patches.length).toBe(1);
    expect(calls.patches[0]).toBe('/restaurant/reservations/RZPASSED2/status');
  });

  test('منوی وضعیت هم همان گیت را دارد', async ({ page }) => {
    const calls: Calls = { patches: [], policyPut: [] };
    await openPanel(page, calls);
    await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('reservations'));
    await card(page, 'Early Guest').getByRole('button', { name: /وضعیت/ }).click();
    const opt = page.locator('.status-opt', { hasText: 'نیومد' });
    await expect(opt).toBeDisabled();
    expect(calls.patches).toHaveLength(0);
  });
});

test.describe('تبِ سیاستِ کنسلی — مهلت و تمدید (D-18)', () => {
  test.slow();

  test('دو فیلد با نشانِ «اعمال می‌شود» و در بدنه‌ی PUT', async ({ page }) => {
    const calls: Calls = { patches: [], policyPut: [] };
    await openPanel(page, calls);
    await page.evaluate(() => {
      const w = window as unknown as { nav: (v: string) => void; setProfTab: (t: string) => void };
      w.nav('profile'); w.setProfTab('cancellation');
    });
    const grace = page.locator('#cpLateGrace');
    const ext = page.locator('#cpLateExt');
    await expect(grace).toHaveValue('15');
    await expect(ext).toHaveValue('15');
    await expect(grace.locator('xpath=..')).toContainText('اعمال می‌شود');
    await grace.fill('30'); await grace.dispatchEvent('change');
    await ext.fill('0'); await ext.dispatchEvent('change');
    await page.locator('#pt-cancellation').getByRole('button', { name: 'ذخیره' }).click();
    await expect.poll(() => calls.policyPut.length).toBe(1);
    expect(calls.policyPut[0]).toMatchObject({ late_grace_minutes: 30, max_late_extension_minutes: 0 });
  });

  test('بیرون از بازه در کلاینت رد می‌شود و درخواستی نمی‌رود', async ({ page }) => {
    const calls: Calls = { patches: [], policyPut: [] };
    await openPanel(page, calls);
    await page.evaluate(() => {
      const w = window as unknown as { nav: (v: string) => void; setProfTab: (t: string) => void };
      w.nav('profile'); w.setProfTab('cancellation');
    });
    const grace = page.locator('#cpLateGrace');
    await expect(grace).toHaveValue('15');
    await grace.fill('5'); await grace.dispatchEvent('change');
    await page.locator('#pt-cancellation').getByRole('button', { name: 'ذخیره' }).click();
    await expect(page.locator('body')).toContainText('مهلتِ صبر باید بینِ ۱۰ و ۶۰ دقیقه باشه');
    expect(calls.policyPut).toHaveLength(0);
  });
});
