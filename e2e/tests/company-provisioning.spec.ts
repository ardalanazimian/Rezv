import { test, expect, Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  SPEC-B — مودالِ «رستورانِ جدید» در پنلِ شرکت (§۹)
//
//  قفل می‌کند: چهار حالتِ الزامی (loading/error/success/empty در لیست)،
//  پیامِ فارسیِ مبتنی بر details.reason، و اینکه دابل‌کلیک فقط **یک** درخواست
//  با **یک** Idempotency-Key می‌فرستد (شمارشِ callها در mock).
// ═══════════════════════════════════════════════════════════════════════

const CO = 'http://localhost:8082/';

type Opts = { createStatus?: number; createBody?: unknown; delayMs?: number };
const calls: { create: { key: string | null }[] } = { create: [] };

async function mockCo(page: Page, opts: Opts = {}) {
  calls.create = [];
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/admin/request') return json({ devCode: '1234' });
    if (path === '/auth/admin/verify') {
      return json({ access: 'demo-access', refresh: 'demo-refresh', admin: { id: 'a1', tenant_name: 'شرکت رزرونو' } });
    }
    if (path === '/admin/restaurants' && route.request().method() === 'POST') {
      calls.create.push({ key: route.request().headers()['idempotency-key'] ?? null });
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.createStatus && opts.createStatus >= 400) return json(opts.createBody ?? { error: { message: 'خطا' } }, opts.createStatus);
      return json(opts.createBody ?? {
        tenant_id: 't-1', restaurant: { id: 'r-1', slug: 'sardin', name: 'ساردین' },
        owner: { staff_id: 's-1', phone: '+989121234567', username: null },
        provision_status: 'PENDING_ACTIVATION', trial_ends_at: null,
        invite_sent_to: '0912***4567', login: { app: 'business', method: 'otp' },
      }, 201);
    }
    if (path === '/admin/restaurants') {
      return json({ restaurants: [{
        id: 'r-9', name: '[DEMO] در انتظار', slug: 'pending-x', tenant_id: 't-9', plan: 'free',
        is_open: true, members: 0, reservations: 0, sms_balance: 50, sms_total_sent: 0,
        joined_at: new Date('2026-08-01').toISOString(), subscription_status: 'trial', days_left: 10,
        plan_expires_at: null, trial_ends_at: new Date('2026-09-05').toISOString(),
        provision_status: 'PENDING_ACTIVATION',
      }] });
    }
    return json({ ok: true, items: [], data: [] });
  });
}


/** fill + تضمینِ commitِ مقدار در DOM — رویِ WebKitِ زیرِ بار، click گاهی
 *  قبل از نشستنِ value شلیک می‌شد و اعتبارسنجیِ کلاینت مسیرِ اشتباه می‌رفت
 *  (همان کلاسِ اشباعِ serve که config مستند کرده). assertionهای اصلی دست‌نخورده‌اند. */
async function fillCommitted(page: Page, sel: string, value: string) {
  const loc = page.locator(sel);
  await loc.fill(value);
  await expect(loc).toHaveValue(value);
}
async function loginCo(page: Page) {
  await page.goto(CO);
  { const t = page.locator('button:has-text("ورود با پیامک")'); if (await t.isVisible().catch(() => false)) await t.click(); }
  await page.locator('#adminPhone').fill('09120000000');
  await page.locator('#adminSendBtn').click();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('restaurants'));
}

test('happy path: ساخت → حالتِ success با slug و ماسکِ شماره', async ({ page }) => {
  await mockCo(page);
  await loginCo(page);
  await page.locator('button:has-text("رستوران جدید")').click();
  await fillCommitted(page, '#pvName', 'رستوران ساردین');
  await fillCommitted(page, '#pvPhone', '09121234567');
  await page.locator('#pvSubmit').click();
  await expect(page.locator('#modalBody')).toContainText('رستوران ساخته شد');
  await expect(page.locator('#modalBody')).toContainText('0912***4567');
  await expect(page.locator('#modalBody')).toContainText('sardin');
  expect(calls.create.length).toBe(1);
  expect(calls.create[0].key).toBeTruthy();
});

test('دابل‌کلیک روی «بساز» = فقط یک درخواست (loading دکمه را قفل می‌کند)', async ({ page }) => {
  await mockCo(page, { delayMs: 400 });
  await loginCo(page);
  await page.locator('button:has-text("رستوران جدید")').click();
  await fillCommitted(page, '#pvName', 'رستوران دوکلیک');
  await fillCommitted(page, '#pvPhone', '09121234568');
  const btn = page.locator('#pvSubmit');
  await btn.click();
  await btn.click({ force: true }).catch(() => {});   // تلاشِ دوم — دکمه باید disabled باشد
  await expect(page.locator('#modalBody')).toContainText('رستوران ساخته شد');
  expect(calls.create.length, 'دابل‌کلیک نباید دو POST بفرستد').toBe(1);
});

test('error با details.reason → پیامِ فارسیِ مشخص، نه «خطای ناشناخته»', async ({ page }) => {
  await mockCo(page, {
    createStatus: 409,
    createBody: { error: { code: 'CONFLICT', message: 'x', details: { reason: 'duplicate_owner_phone' } } },
  });
  await loginCo(page);
  await page.locator('button:has-text("رستوران جدید")').click();
  await fillCommitted(page, '#pvName', 'تکراری');
  await fillCommitted(page, '#pvPhone', '09121234569');
  await page.locator('#pvSubmit').click();
  await expect(page.locator('#pvErr')).toBeVisible();
  await expect(page.locator('#pvErr')).toContainText('قبلاً مالکِ یک رستوران');
  // فرم باز مانده تا اصلاح ممکن باشد؛ دکمه دوباره فعال است
  await expect(page.locator('#pvSubmit')).toBeEnabled();
});

test('اعتبارسنجیِ کلاینت: شماره‌ی بد اصلاً درخواست نمی‌فرستد', async ({ page }) => {
  await mockCo(page);
  await loginCo(page);
  await page.locator('button:has-text("رستوران جدید")').click();
  await fillCommitted(page, '#pvName', 'نامِ خوب');
  await fillCommitted(page, '#pvPhone', '123');
  await page.locator('#pvSubmit').click();
  await expect(page.locator('#pvErr')).toContainText('شماره‌ی موبایلِ معتبر');
  expect(calls.create.length).toBe(0);
});

test('badgeِ «در انتظارِ فعال‌سازی» در جزئیاتِ رستورانِ PENDING دیده می‌شود', async ({ page }) => {
  await mockCo(page);
  await loginCo(page);
  // سطرِ واقعی .rest-row است (overview.js:133) و رندرش async از loadAdminRestaurants
  // می‌آید — اول انتظارِ خودِ سطر، بعد کلیک؛ selectorِ حدسیِ قبلی روی موبایل flake می‌داد.
  // قفل روی سطرِ *سروری* (متنِ mock)، نه first(): بینِ رندرِ SAMPLE و رندرِ
  // پاسخِ سرور، renderRestList نودها را جایگزین می‌کند و کلیک روی نودِ جداشده
  // بی‌اثر می‌شد (v-detail خالی می‌ماند — امضای دقیقِ flake).
  // refreshِ سروری در بعضی نشست‌ها خودکار fire نمی‌شود و لیست SAMPLE می‌ماند؛
  // همان مسیرِ رسمیِ اپ (که دکمه‌ی success هم صدا می‌زند) صریح رانده می‌شود.
  await page.evaluate(() => (window as unknown as { loadAdminRestaurants: () => Promise<unknown>; rRestaurants: () => void })
    .loadAdminRestaurants().then(() => (window as unknown as { rRestaurants: () => void }).rRestaurants()));
  const row = page.locator('#restList .rest-row', { hasText: 'در انتظار' });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator('#v-detail')).toContainText('در انتظارِ فعال‌سازی', { timeout: 10_000 });
  await expect(page.locator('button:has-text("ارسالِ مجددِ دعوت")')).toBeVisible();
});
