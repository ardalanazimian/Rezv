import { test, expect, Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  صفحه‌ی دعوتِ اولین‌ورودِ owner — apps/business/invite.html (SPEC-B §۶-۱
//  + اصلاحِ scopeِ مالک ۲۰۲۶-۰۸-۲۶: ورودِ owner فقط OTP، هیچ گزینه‌ی رمزی)
//
//  قفل می‌کند: چهار حالتِ loading/empty/error/success (سه زیرحالتِ
//  valid/used/expired از پاسخِ claim)، retry بعد از خطای شبکه، XSS-امن بودنِ
//  نامِ رستوران، نبودِ توکن=empty بدونِ حتی یک درخواست، و نبودِ هر ردی از
//  «رمز» در UI.
// ═══════════════════════════════════════════════════════════════════════

const PAGE = 'http://localhost:8081/invite.html';
const TOKEN = 'a'.repeat(64);

function claimBody(state: 'valid' | 'used' | 'expired', name = '[DEMO] کافه آزمون') {
  return {
    state,
    restaurant: { name, slug: 'test-cafe' },
    phone_mask: '0912***4567',
    expires_at: '2026-09-01T00:00:00.000Z',
  };
}

/** mockِ endpointِ claim؛ شمارنده‌ی call برمی‌گرداند. */
async function mockClaim(page: Page, opts: { status?: number; body?: unknown; delayMs?: number } = {}) {
  const counter = { calls: 0 };
  await page.route('**/api/v1/auth/invite/**', async (route) => {
    counter.calls++;
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    return route.fulfill({
      status: opts.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(opts.body ?? claimBody('valid')),
    });
  });
  return counter;
}

test('valid → success: نامِ رستوران + ماسکِ شماره + فقط دکمه‌ی OTP (هیچ ردی از رمز)', async ({ page }) => {
  await mockClaim(page);
  await page.goto(PAGE + '#token=' + TOKEN);
  await expect(page.locator('#st-valid')).toBeVisible();
  await expect(page.locator('#vName')).toHaveText('[DEMO] کافه آزمون');
  await expect(page.locator('#vPhone')).toHaveText('0912***4567');
  const go = page.locator('#vGo');
  await expect(go).toBeVisible();
  await expect(go).toHaveAttribute('href', './');
  // اصلاحِ scope: ورودِ owner فقط OTP — هیچ فیلد/متن/لینکِ رمزی وجود ندارد
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('رمز');
});

test('used → «قبلاً استفاده شده» + لینکِ ورود', async ({ page }) => {
  await mockClaim(page, { body: claimBody('used') });
  await page.goto(PAGE + '#token=' + TOKEN);
  await expect(page.locator('#st-used')).toBeVisible();
  await expect(page.locator('#uName')).toHaveText('[DEMO] کافه آزمون');
  await expect(page.locator('#st-valid')).toBeHidden();
});

test('expired → راهنمای دعوتِ مجدد', async ({ page }) => {
  await mockClaim(page, { body: claimBody('expired') });
  await page.goto(PAGE + '#token=' + TOKEN);
  await expect(page.locator('#st-expired')).toBeVisible();
  await expect(page.locator('#st-expired')).toContainText('منقضی');
});

test('توکنِ ناشناخته (۴۰۴) → empty', async ({ page }) => {
  await mockClaim(page, { status: 404, body: { error: { code: 'NOT_FOUND' } } });
  await page.goto(PAGE + '#token=' + TOKEN);
  await expect(page.locator('#st-empty')).toBeVisible();
});

test('سازگاری: فرمِ query روی مسیرِ extensionless هم کار می‌کند', async ({ page }) => {
  // زیرِ cleanUrls، /invite.html?token=x به /invite بدونِ query ری‌دایرکت می‌شود
  // (علتِ انتخابِ fragment)؛ فرمِ query فقط روی مسیرِ بدونِ پسوند بی‌ریسک است.
  await mockClaim(page);
  await page.goto('http://localhost:8081/invite?token=' + TOKEN);
  await expect(page.locator('#st-valid')).toBeVisible();
});

test('بدونِ توکن → empty، بدونِ حتی یک درخواست', async ({ page }) => {
  const counter = await mockClaim(page);
  await page.goto(PAGE);
  await expect(page.locator('#st-empty')).toBeVisible();
  expect(counter.calls, 'بدونِ توکن نباید API صدا شود').toBe(0);
});

test('حالتِ loading قبل از پاسخ دیده می‌شود', async ({ page }) => {
  await mockClaim(page, { delayMs: 1500 });
  await page.goto(PAGE + '#token=' + TOKEN);
  await expect(page.locator('#st-loading')).toBeVisible();
  await expect(page.locator('#st-valid')).toBeVisible({ timeout: 10_000 });
});

test('خطای شبکه → error («نمی‌دانیم نه نیست») و retry به success می‌رسد', async ({ page }) => {
  let fail = true;
  await page.route('**/api/v1/auth/invite/**', async (route) => {
    if (fail) return route.abort('failed');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(claimBody('valid')) });
  });
  await page.goto(PAGE + '#token=' + TOKEN);
  await expect(page.locator('#st-error')).toBeVisible();
  await expect(page.locator('#st-error')).toContainText('نمی‌دانیم');
  fail = false;
  await page.locator('#retryBtn').click();
  await expect(page.locator('#st-valid')).toBeVisible();
});

test('XSS: نامِ رستورانِ خصمانه به‌صورتِ متن رندر می‌شود، نه HTML', async ({ page }) => {
  await mockClaim(page, { body: claimBody('valid', '<img src=x onerror="window.__xss=1">') });
  await page.goto(PAGE + '#token=' + TOKEN);
  await expect(page.locator('#st-valid')).toBeVisible();
  await expect(page.locator('#vName img')).toHaveCount(0);
  await expect(page.locator('#vName')).toContainText('<img');
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});
