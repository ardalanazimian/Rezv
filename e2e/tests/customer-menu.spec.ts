import { test, expect } from '@playwright/test';
import { mockApi, captured, DEMO_MENU } from './helpers/mock-api';
import { gotoApp, login } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  SPEC-A فاز ۱ — بخشِ منو در صفحه‌ی رستورانِ اپِ مشتری
//
//  تا امروز منو در E2E صفر تست داشت. قفل می‌کند: سکشن‌بندیِ دسته، نمایشِ
//  توضیح، برچسبِ «ناموجود» (آیتم مخفی نمی‌شود)، و حالتِ خالیِ صادق برای
//  رستورانی که منو ثبت نکرده.
// ═══════════════════════════════════════════════════════════════════════

test('منویِ دسته‌دار: سکشن‌ها + توضیح + برچسبِ «ناموجود» (آیتم حذف نمی‌شود)', async ({ page }) => {
  await mockApi(page);
  await gotoApp(page);

  await page.locator('.rc', { hasText: 'کافه گل‌ها' }).first().click();
  const rest = page.locator('#page-rest');
  await expect(rest).toBeVisible();

  // سکشن‌های دسته با نامِ خودِ رستوران‌دار
  await expect(rest).toContainText('پیش‌غذا');
  await expect(rest).toContainText('غذای اصلی');
  // توضیحِ آیتم — که پیش از این در نگاشت دور ریخته می‌شد
  await expect(rest).toContainText('با سسِ مخصوص');
  // آیتمِ ناموجود دیده می‌شود، با برچسب — نه اینکه غیب شود
  await expect(rest).toContainText('کبابِ کوبیده');
  await expect(rest).toContainText('ناموجود');
});

test('رستورانِ بدونِ منو → حالتِ خالیِ صادق، نه منویِ نمونه', async ({ page }) => {
  await mockApi(page);
  await gotoApp(page);

  await page.locator('.rc', { hasText: 'برگر لب' }).first().click();
  const rest = page.locator('#page-rest');
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('این رستوران هنوز منویی ثبت نکرده');
  // هیچ آیتمی از رستورانِ نمونه/دیگری نشت نکرده
  await expect(rest).not.toContainText('سالاد سزار');
});

test('برچسب‌های فارسی روی کارتِ آیتم دیده می‌شوند (۰۷۸)', async ({ page }) => {
  await mockApi(page);
  await gotoApp(page);
  await page.locator('.rc', { hasText: 'کافه گل‌ها' }).first().click();
  const rest = page.locator('#page-rest');
  await expect(rest).toContainText('پرفروش');   // POPULAR → label فارسی
  await expect(rest).toContainText('تند');      // SPICY (روی آیتمِ ناموجود — دیده می‌شود، حذف نه)
});

test('سیم‌کشیِ pre-order: انتخابِ چیپ → payloadِ رزرو شاملِ menu_item_id؛ آیتمِ ناموجود چیپ ندارد', async ({ page }) => {
  await mockApi(page);
  await gotoApp(page);
  await login(page);
  await page.locator('.rc', { hasText: 'کافه گل‌ها' }).first().click();

  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await expect(page.locator('#sheet')).toBeVisible();
  await page.waitForFunction(() => {
    const s = document.getElementById('bwTime') as HTMLSelectElement | null;
    return !!s && [...s.options].some((o) => o.value && o.value !== '');
  }, undefined, { timeout: 5000 });
  await page.getByRole('button', { name: /بررسی میزهای موجود/ }).click();

  // مرحله‌ی ۲: چیپِ سالاد هست، چیپِ کبابِ «ناموجود» نیست
  const salad = page.locator('.opt[data-mid]', { hasText: 'سالاد سزار' });
  await expect(salad).toBeVisible();
  await expect(page.locator('.opt', { hasText: 'کبابِ کوبیده' })).toHaveCount(0);

  await salad.click();
  await expect(salad).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'ادامه', exact: true }).click();
  await page.getByRole('button', { name: /تأیید رزرو|تایید رزرو/ }).click();
  await expect(page.locator('#sheetBody')).toContainText(/RZDEMO12|رزرو.*(ثبت|تأیید|موفق)/, { timeout: 8000 });

  // ── قفلِ B3: چیزی که سرور دید ──
  expect(captured.reservation, 'باید POST رزرو رخ داده باشد').toBeTruthy();
  const pre = (captured.reservation as { preorder?: { menu_item_id: string; qty: number }[] }).preorder;
  expect(pre, 'preorder باید در payload باشد — قبلاً چیپ‌ها تزئینی بودند').toBeTruthy();
  expect(pre!.length).toBe(1);
  expect(pre![0].menu_item_id).toBe(DEMO_MENU.menu[0].id);
  expect(pre![0].qty).toBe(1);
});
