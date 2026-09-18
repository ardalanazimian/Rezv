import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { closeSearchCtxSheet, gotoApp, openFirstRestaurant, openRestaurantTile, openSearchCtxSheet } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  زمینه‌ی رزرو: تاریخِ واقعی + ماندگاری بینِ رستوران‌ها
//
//  دو باگ که با اندازه‌گیری در مرورگر پیدا شدند و اینجا قفل می‌شوند:
//
//  ۱) انتخابگرِ تاریخ فقط چهار گزینه‌ی ثابت داشت (امروز/فردا/پنجشنبه/جمعه).
//     برای اپی که کارش رزروِ میز است یعنی «ماه بعد» اصلاً ممکن نبود.
//  ۲) تاریخ و تعدادِ نفر بینِ رستوران‌ها نگه داشته نمی‌شد: کاربر که سه رستوران
//     را برای یک شبِ مشخص مقایسه می‌کرد، هر بار باید دوباره واردشان می‌کرد.
//
//  «کِی» و «چند نفر»ِ نوارِ جست‌وجو هم پیش از این هیچ‌جا خوانده نمی‌شدند —
//  کنترلی که ظاهرِ کارکردن داشت ولی نداشت.
// ═══════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  // ⚠️ فازِ ۲: این جریان‌ها چندمرحله‌ای‌اند و زیرِ بارِ موازیِ کلِ سوئیت از مهلتِ
  // پیش‌فرضِ ۳۰ ثانیه رد می‌شدند — با اجرایِ کاملِ سوئیت واقعاً مشاهده شد
  // (۵ شکست با ۴ ورکر، ۲۷/۲۷ پاس با ۱ ورکر). مهلت بیشتر می‌شود،
  // هیچ assertionی ضعیف نمی‌شود.
  test.slow();
  await mockApi(page);
});

test('انتخابگرِ تاریخ افقِ واقعی دارد، نه چند کلمه‌ی ثابت', async ({ page }) => {
  await gotoApp(page);

  // ⚠️ [DS-007 §۶] افقِ تاریخ از selectِ هیرو به شیتِ «کِی و چند نفر؟» رفت.
  await openSearchCtxSheet(page);
  const opts = page.locator('#ctxWhen option');
  expect(await opts.count()).toBeGreaterThanOrEqual(30);

  // مقدارها باید ISO باشند تا بک‌اند نیازی به حدس‌زدنِ «پنجشنبه» نداشته باشد
  const first = await opts.first().getAttribute('value');
  const last = await opts.last().getAttribute('value');
  expect(first).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(last).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  // و باید واقعاً چند هفته جلو برود
  const days = (new Date(last!).getTime() - new Date(first!).getTime()) / 86_400_000;
  expect(days).toBeGreaterThanOrEqual(29);

  // دو گزینه‌ی اول برچسبِ انسانی دارند، بقیه تاریخِ شمسی
  await expect(opts.nth(0)).toHaveText('امروز');
  await expect(opts.nth(1)).toHaveText('فردا');
});

test('انتخابِ نوارِ جست‌وجو تا شیتِ رزرو دنبال می‌آید', async ({ page }) => {
  await gotoApp(page);

  await openSearchCtxSheet(page);
  const target = await page.locator('#ctxWhen option').nth(5).getAttribute('value');
  await page.selectOption('#ctxWhen', target!);
  await page.selectOption('#ctxParty', '4');
  await closeSearchCtxSheet(page);

  await openFirstRestaurant(page);
  await page.getByRole('button', { name: /رزرو میز/ }).click();

  await expect(page.locator('#bwDate')).toHaveValue(target!);
  await expect(page.locator('#bwParty')).toHaveValue('4');
});

test('زمینه بعد از رفتن به رستورانِ دیگر هم می‌ماند', async ({ page }) => {
  await gotoApp(page);

  await openSearchCtxSheet(page);
  const target = await page.locator('#ctxWhen option').nth(7).getAttribute('value');
  await page.selectOption('#ctxWhen', target!);
  await page.selectOption('#ctxParty', '6');
  await closeSearchCtxSheet(page);

  // رستورانِ اول → شیت → بستن → برگشت به کشف
  await openFirstRestaurant(page);
  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await expect(page.locator('#bwDate')).toHaveValue(target!);
  await page.evaluate(() => (window as unknown as { closeSheet?: () => void }).closeSheet?.());
  await page.evaluate(() => (window as unknown as { go?: (p: string) => void }).go?.('discover'));

  // رستورانِ دوم — همان تاریخ و تعداد باید از قبل انتخاب باشد
  await openRestaurantTile(page, 1);
  await page.getByRole('button', { name: /رزرو میز/ }).click();

  await expect(page.locator('#bwDate')).toHaveValue(target!);
  await expect(page.locator('#bwParty')).toHaveValue('6');
});

test('خلاصه‌ی تأیید همان تاریخ و تعدادِ انتخاب‌شده را نشان می‌دهد', async ({ page }) => {
  await gotoApp(page);
  await openSearchCtxSheet(page);
  await page.selectOption('#ctxParty', '3');
  await closeSearchCtxSheet(page);

  await openFirstRestaurant(page);
  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await page.getByRole('button', { name: /بررسی میزهای موجود/ }).click();
  await page.getByRole('button', { name: /^ادامه$/ }).click();

  const summary = page.locator('.summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('۳ نفر');
  // رگرسیونِ واقعی: پیش از این «۲ نفر»ِ ثابت یا undefined می‌آمد
  await expect(summary).not.toContainText(/undefined|NaN/);
});
