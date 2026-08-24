import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, navTo } from './helpers/actions';

// ═══ تستِ smoke — اپ اصلاً بالا می‌آید و پایه‌ها کار می‌کنند؟ ═══
// این‌ها اولین خطِ دفاع‌اند: اگر اینها بشکنند، هیچ چیزِ دیگری کار نمی‌کند.

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('اپ لود می‌شود و صفحه‌ی کشف نمایش داده می‌شود', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('#page-discover')).toBeVisible();
  // حداقل یک کارتِ رستوران باید دیده شود
  await expect(page.locator('.rc').first()).toBeVisible();
});

test('ناوبریِ پایین بین تب‌ها جابه‌جا می‌شود', async ({ page }) => {
  await gotoApp(page);

  await navTo(page, 'trips');
  await expect(page.locator('#page-trips')).toBeVisible();

  await navTo(page, 'loyalty');
  await expect(page.locator('#page-loyalty')).toBeVisible();

  await navTo(page, 'favorites');
  await expect(page.locator('#page-favorites')).toBeVisible();

  await navTo(page, 'discover');
  await expect(page.locator('#page-discover')).toBeVisible();
});

test('زبان و جهتِ صفحه درست است (فارسی، راست‌به‌چپ)', async ({ page }) => {
  await gotoApp(page);
  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'fa');
  await expect(html).toHaveAttribute('dir', 'rtl');
});

test('landmark اصلی (main) برای دسترسی‌پذیری وجود دارد', async ({ page }) => {
  await gotoApp(page);
  await expect(page.locator('main#app-main')).toBeAttached();
});
