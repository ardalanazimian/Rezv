import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, openFirstRestaurant } from './helpers/actions';

// ═══ دسترسی‌پذیری (Accessibility) ═══
// تأییدِ خودکارِ کارهایی که در ممیزیِ a11y انجام شد.
// (تستِ کاملِ screen reader باید روی دستگاهِ واقعی انجام شود؛ این‌ها
//  حداقل‌های ساختاری را در هر build چک می‌کنند تا رگرسیون نگیریم.)

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('دکمه‌های ناوبری برچسبِ دسترسی‌پذیری (aria-label) دارند', async ({ page }) => {
  await gotoApp(page);
  const navButtons = page.locator('.botnav-item');
  const count = await navButtons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(navButtons.nth(i)).toHaveAttribute('aria-label', /.+/);
  }
});

test('کلیدِ Escape شیت را می‌بندد', async ({ page }) => {
  await gotoApp(page);
  await openFirstRestaurant(page);
  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await expect(page.locator('#sheet')).toHaveClass(/show/);

  // Escape باید شیت را ببندد
  await page.keyboard.press('Escape');
  await expect(page.locator('#sheet')).not.toHaveClass(/show/);
});

test('شیت و مودال نقشِ dialog دارند', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('#sheet')).toHaveAttribute('role', 'dialog');
  await expect(page.locator('#dnaOverlay')).toHaveAttribute('role', 'dialog');
});

test('toast ناحیه‌ی زنده (aria-live) برای screen reader دارد', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('#toast')).toHaveAttribute('aria-live', /polite|assertive/);
});

// این تست پیش از این روی «.rc[role=button]» بود که هرگز وجود نداشت، پس شرطِ
// isVisible همیشه رد می‌شد و تست بی‌صدا سبز می‌ماند. اندازه‌گیریِ واقعی نشان داد
// کارت و چیپ‌های ساعت اصلاً فوکوس‌پذیر نیستند — یعنی رزرو با کیبورد ناممکن بود.
test('کارت رستوران و چیپ‌های ساعت با کیبورد قابلِ استفاده‌اند', async ({ page }) => {
  await gotoApp(page);

  const open = page.locator('.rc .rc-open').first();
  await expect(open).toBeVisible();
  // ⚠️ مقاوم در برابرِ ری‌رندرِ فید (۲۰۲۶-۰۸-۲۵): فید پس از رسیدنِ دادهٔ API
  // دوباره رندر می‌شود و می‌تواند عنصرِ فوکوس‌شده را جایگزین کند (فوکوس می‌پرد)؛
  // زیرِ بارِ چند-worker فلیک می‌داد. اگر پرید، دوباره فوکوس می‌کنیم.
  await expect(async () => {
    await open.focus();
    await expect(open).toBeFocused({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  // نامِ رستوران باید در نامِ دسترس‌پذیر باشد، وگرنه صفحه‌خوان فقط «دکمه» می‌گوید
  await expect(open).toHaveAttribute('aria-label', /\S/);

  // چیپِ ساعت باید دکمه‌ی واقعی باشد (نه span با onclick) و نامش ساعت را بگوید
  const slot = page.locator('.rc .rc-slot').first();
  await expect(slot).toBeVisible();
  expect(await slot.evaluate((n) => n.tagName)).toBe('BUTTON');
  await expect(slot).toHaveAttribute('aria-label', /\d|[۰-۹]/);

  // Enter روی کارت باید صفحه‌ی رستوران را باز کند
  await open.press('Enter');
  await expect(page.locator('#page-rest')).toBeVisible();
});
