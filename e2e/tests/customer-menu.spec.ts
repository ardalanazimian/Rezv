import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp } from './helpers/actions';

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
