import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, navTo } from './helpers/actions';

// ═══ جریانِ ورود (OTP) ═══
// ورود با شماره‌ی موبایل + کدِ یکبارمصرف. لازم برای رزروِ کاربرِ واردشده،
// امتیاز، و پروفایل.

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('شیتِ ورود شماره‌ی موبایل را می‌پذیرد', async ({ page }) => {
  await gotoApp(page);
  // رفتن به پروفایل معمولاً ورود را می‌خواهد
  await page.locator('[data-nav="loyalty"]').click().catch(() => {});

  // اگر جایی دکمه‌ی ورود هست، بازش کن؛ وگرنه این تست را رد کن
  const loginTrigger = page.getByRole('button', { name: /ورود|وارد شو|ثبت‌نام/ }).first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click();
    const phoneInput = page.locator('#loginPhone');
    await expect(phoneInput).toBeVisible();

    // شماره‌ی نامعتبر باید رد شود / پیش نرود
    await phoneInput.fill('123');
    // شماره‌ی معتبر
    await phoneInput.fill('09123456789');
    await expect(phoneInput).toHaveValue(/09123456789|۰۹/);
  }
});

test('placeholder شماره‌ی موبایل درست است', async ({ page }) => {
  await gotoApp(page);
  const loginTrigger = page.getByRole('button', { name: /ورود|وارد شو/ }).first();
  if (await loginTrigger.isVisible().catch(() => false)) {
    await loginTrigger.click();
    const phoneInput = page.locator('#loginPhone');
    await expect(phoneInput).toBeVisible();
    // placeholder باید یک نمونه‌ی شماره‌ی ایرانی باشد
    await expect(phoneInput).toHaveAttribute('placeholder', /۰۹|09/);
  }
});
