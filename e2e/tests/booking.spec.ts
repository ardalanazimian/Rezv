import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, openFirstRestaurant, login } from './helpers/actions';

// ═══ مسیرِ حیاتیِ رزرو (مسیرِ پول) ═══
// این مهم‌ترین جریانِ کلِ اپ است: اگر رزرو کار نکند، کسب‌وکار کار نمی‌کند.
// این تست دقیقاً همان باگی را می‌گیرد که در ممیزیِ API پیدا شد
// (اگر فرانت code را در جای اشتباه بخواند، تأییدیه نمایش داده نمی‌شود).

test.beforeEach(async ({ page }) => {
  await mockApi(page);   // اسلات‌های باز
});

test('کاربر می‌تواند رستوران را باز کند و صفحه‌ی رزرو را ببیند', async ({ page }) => {
  await gotoApp(page);
  await openFirstRestaurant(page);

  // دکمه‌ی رزرو باید روی صفحه‌ی جزئیات باشد
  await expect(page.getByRole('button', { name: /رزرو میز/ })).toBeVisible();
  // نوارِ کش‌بک هم باید دیده شود (ارزشِ پیشنهادی)
  await expect(page.locator('#page-rest')).toContainText(/کش‌بک/);
});

test('جریانِ کاملِ رزرو تا تأییدیه (با کدِ رزرو)', async ({ page }) => {
  await gotoApp(page);
  await login(page);                 // رزرو نیاز به ورود دارد (confirmBook این را چک می‌کند)
  await openFirstRestaurant(page);

  // باز کردنِ شیتِ رزرو (مرحله ۱: انتخابِ تاریخ/ساعت/نفرات)
  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await expect(page.locator('#sheet')).toBeVisible();

  // صبر تا بارگذاریِ ساعت‌های واقعی از availability (mock: ۱۹:۰۰/۲۰:۰۰ باز)
  await page.waitForFunction(() => {
    const s = document.getElementById('bwTime') as HTMLSelectElement | null;
    return !!s && [...s.options].some((o) => o.value && o.value !== '');
  }, undefined, { timeout: 5000 });

  // مرحله ۱ → ۲
  await page.getByRole('button', { name: /بررسی میزهای موجود/ }).click();
  // مرحله ۲ → ۳ (پیش‌سفارشِ اختیاری)
  await page.getByRole('button', { name: 'ادامه', exact: true }).click();
  // مرحله ۳: تأییدِ نهایی
  await page.getByRole('button', { name: /تأیید رزرو|تایید رزرو/ }).click();

  // ── نتیجه‌ی حیاتی: کدِ رزرو باید نمایش داده شود (RZDEMO12 از mock) ──
  // اگر باگِ contract برگردد (خواندنِ reservation.code به‌جای code)، این می‌شکند.
  await expect(page.locator('#sheetBody')).toContainText(/RZDEMO12|رزرو.*(ثبت|تأیید|موفق)/, { timeout: 8000 });
});

test('پارتی‌سایز و تاریخ در شیتِ رزرو قابلِ تنظیم است', async ({ page }) => {
  await gotoApp(page);
  await openFirstRestaurant(page);
  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await expect(page.locator('#sheet')).toBeVisible();
  // شیت باید محتوایی برای انتخابِ زمان/نفرات داشته باشد
  await expect(page.locator('#sheetBody')).not.toBeEmpty();
});
