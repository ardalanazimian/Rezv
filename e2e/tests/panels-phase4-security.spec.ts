import { test, expect, type Page } from '@playwright/test';
import { openSmsLogin } from './helpers/actions';

// ═══════════════════════════════════════════════════════════
//  e2e رفتاریِ پنل‌هایِ فازِ ۴ (پنلِ شرکت → تبِ امنیت):
//   ۴.۱ IPهایِ بن‌شده (لیست + لغوِ بن)
//   ۴.۲ صفِ یکپارچه‌ی نظارت (ردیفِ شمارنده‌هایِ کلیک‌پذیر)
//   ۴.۳ ویرایشگرِ قواعدِ اقتصاد (XP/سکه‌یِ رزروِ انجام‌شده)
//
//  قبلاً این سه پنل فقط با curl سطحِ API تست شده بودند، نه با مرورگرِ واقعی —
//  این فایل همون یافته‌ی «ریسکِ باقی‌مانده» را می‌بندد. الگو از panels-flow.spec.ts
//  پیروی می‌کند: کلِ /api/v1/** mock می‌شود چون پنل استاتیک /api ندارد؛ mockِ
//  بنِ IP و قواعدِ اقتصاد stateful است تا رفتارِ واقعیِ رفت‌وبرگشت (GET بعد از
//  POST/PATCH مقدارِ تازه را نشون بده) هم تست بشه، نه فقط رندرِ اولیه.
// ═══════════════════════════════════════════════════════════

const CO = 'http://localhost:8082/';

function mockPhase4SecurityApi(page: Page) {
  // state داخلِ closure — بینِ درخواست‌هایِ همین تست زنده می‌مونه (شبیه‌سازیِ سرور)
  let bannedIps = [{ ip: '203.0.113.199', ttlSeconds: 1800 }];
  let ecoRules = { completed_xp: 100, completed_coins: 20 };

  return page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/admin/request') return json({ devCode: '1234' });
    if (path === '/auth/admin/verify') {
      return json({
        admin: { phone: '09123456789', role: 'platform_admin' },
        access: 'demo-access-token',
        refresh: 'demo-refresh-token',
      });
    }

    if (path === '/admin/security' && req.method() === 'GET') {
      return json({
        coupon_abuse_signals: [], high_no_show_customers: [],
        recent_failed_actions: [], sensitive_actions: [], flagged_abuse_users: [],
        economy_overview: { tier_distribution: [], total_xp_granted: 0, total_wallet_balance: 0, active_abuse_flags: 0, total_economy_profiles: 0 },
      });
    }
    if (path === '/admin/feature-flags' && req.method() === 'GET') return json({ flags: {} });

    if (path === '/admin/moderation-queue' && req.method() === 'GET') {
      return json({
        banned_users_count: 2, flagged_abuse_users_count: 0,
        banned_ips_count: bannedIps.length, pending_photos_count: 3,
      });
    }

    if (path === '/admin/security/banned-ips' && req.method() === 'GET') {
      return json({ items: bannedIps });
    }
    if (path === '/admin/security/banned-ips' && req.method() === 'POST') {
      const body = req.postDataJSON() as { ip: string };
      const before = bannedIps.length;
      bannedIps = bannedIps.filter((x) => x.ip !== body.ip);
      return json({ ok: true, removed: bannedIps.length < before });
    }

    if (path === '/admin/economy-rules' && req.method() === 'GET') return json({ rules: ecoRules });
    if (path === '/admin/economy-rules' && req.method() === 'PATCH') {
      const body = req.postDataJSON() as Partial<typeof ecoRules>;
      ecoRules = { ...ecoRules, ...body };
      return json({ ok: true, rules: ecoRules });
    }

    // پیش‌فرض: پاسخِ خالیِ موفق تا viewهای دیگه نشکنند
    return json({ ok: true });
  });
}

async function loginAsAdmin(page: Page) {
  await page.goto(CO);
  await openSmsLogin(page, 'admin');
  await page.locator('#adminPhone').fill('09123456789');
  await page.locator('#adminSendBtn').click();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#v-overview')).toHaveClass(/active/);
}

test('پنلِ شرکت / امنیت: صفِ یکپارچه‌ی نظارت شمارنده‌های واقعی رو نشون می‌ده', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockPhase4SecurityApi(page);
  await loginAsAdmin(page);

  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('security'));
  await expect(page.locator('#v-security')).toHaveClass(/active/);

  // ردیفِ صفِ نظارت: چهار شمارنده با مقدارهای mock شده
  const queueRows = page.locator('#v-security .mini-list').first().locator('.mini-row');
  await expect(queueRows).toHaveCount(4);
  await expect(queueRows.nth(0)).toContainText('کاربرِ بن‌شده');
  await expect(queueRows.nth(2)).toContainText('IPِ بن‌شده');

  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});

test('پنلِ شرکت / امنیت: لیستِ IPهایِ بن‌شده رندر می‌شه و لغوِ بن واقعاً حذف می‌کنه', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockPhase4SecurityApi(page);
  await loginAsAdmin(page);

  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('security'));

  const panel = page.locator('#bannedIpsPanel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('203.0.113.199');

  // کلیکِ «لغوِ بن» یک confirm() مرورگری باز می‌کنه — قبولش کن
  page.once('dialog', (d) => d.accept());
  await panel.getByRole('button', { name: 'لغوِ بن' }).click();

  // بعدِ لغو، rSecurity() دوباره صدا زده می‌شه و پنل خالی می‌مونه
  await expect(panel).toContainText('هیچ IPِ بن‌شده‌ای نیست');
  await expect(page.locator('#toastMsg')).toHaveText('بن لغو شد');

  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});

test('پنلِ شرکت / امنیت: ویرایشگرِ قواعدِ اقتصاد مقدارِ فعلی رو نشون می‌ده و ذخیره‌ی مقدارِ جدید کار می‌کنه', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockPhase4SecurityApi(page);
  await loginAsAdmin(page);

  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('security'));

  const xpInput = page.locator('#ecoXp');
  const coinsInput = page.locator('#ecoCoins');
  await expect(xpInput).toHaveValue('100');
  await expect(coinsInput).toHaveValue('20');

  await xpInput.fill('250');
  await coinsInput.fill('50');
  await page.getByRole('button', { name: 'ذخیره' }).click();

  await expect(page.locator('#toastMsg')).toHaveText('قواعدِ اقتصاد به‌روزرسانی شد');

  // اثباتِ round-trip واقعی: رفتن به یک تبِ دیگه و برگشتن به امنیت باید مقدارِ
  // تازه رو از GET بعدی نشون بده (نه فقط مقدارِ محلیِ input که تغییرش ندادیم)
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('overview'));
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('security'));
  await expect(page.locator('#ecoXp')).toHaveValue('250');
  await expect(page.locator('#ecoCoins')).toHaveValue('50');

  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});
