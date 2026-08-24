import { test, expect } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, openFirstRestaurant } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ P1-3 — ادعایِ پیش‌پرداخت باید حقیقتِ سرور باشد، نه متنِ ثابت
//  (پروتکل §۲۰ قراردادِ API، §۳ صداقت، §۲۶ حالتِ گمراه‌کننده)
//
//  باگی که پین می‌شود: اپِ مشتری در دو جا هاردکد می‌گفت «رزرو رایگان ·
//  بدون پیش‌پرداخت» و «هنوز پولی پرداخت نمی‌کنی» — در حالی که
//  CancellationPolicy.depositRequired یک سیاستِ واقعیِ قابلِ‌تنظیمِ رستوران است.
//  رستورانی که بیعانه را روشن می‌کرد، همچنان به مشتری «رایگان» نشان داده می‌شد.
//
//  mock دو رستوران دارد: اولی بدونِ بیعانه، دومی **با** بیعانه.
// ═══════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  test.slow();
  await mockApi(page);
});

test('رستورانِ بدونِ بیعانه: «رزرو رایگان» گفته می‌شود', async ({ page }) => {
  await gotoApp(page);
  await openFirstRestaurant(page);   // رستورانِ ۱ — deposit_required: false
  await expect(page.locator('.rp-bookbar-sub')).toContainText(/بدون پیش‌پرداخت/, { timeout: 8000 });
});

test('رستورانِ دارایِ بیعانه: هرگز «بدون پیش‌پرداخت» ادعا نمی‌شود', async ({ page }) => {
  await gotoApp(page);
  // رستورانِ ۲ (سوشی بار) — deposit_required: true
  await page.evaluate(() =>
    (window as unknown as { openRest: (id: number) => void }).openRest(2)
  );
  const sub = page.locator('.rp-bookbar-sub');
  await expect(sub).toBeVisible({ timeout: 8000 });

  const text = (await sub.innerText()) || '';
  // این ادعا قلبِ باگ است: پیش از رفع، اینجا «رزرو رایگان · بدون پیش‌پرداخت»
  // نوشته می‌شد در حالی که رستوران واقعاً بیعانه می‌گرفت.
  expect(text, 'رستورانی که بیعانه می‌گیرد نباید «بدون پیش‌پرداخت» نشان دهد').not.toMatch(/بدون پیش‌پرداخت/);
  expect(text, 'باید صریح بگوید بیعانه می‌گیرد').toMatch(/بیعانه/);
});

test('شیتِ رزرو هم همان حقیقت را می‌گوید، نه متنِ ثابت', async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() =>
    (window as unknown as { openRest: (id: number) => void }).openRest(2)
  );
  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await expect(page.locator('#sheet')).toBeVisible();

  const sheet = (await page.locator('#sheetBody').innerText()) || '';
  expect(sheet, 'شیتِ رزرو نباید «هنوز پولی پرداخت نمی‌کنی» را برایِ رستورانِ بیعانه‌دار بگوید')
    .not.toMatch(/هنوز پولی پرداخت نمی‌کنی/);
});

test('رستورانِ بدونِ دادهٔ سیاست: هیچ ادعایی نمی‌کند (سکوت، نه حدس)', async ({ page }) => {
  await gotoApp(page);
  // رستورانِ ۳ در mock اصلاً booking_policy ندارد → depositRequired = null
  await page.evaluate(() =>
    (window as unknown as { openRest: (id: number) => void }).openRest(3)
  );
  // ⚠️ عمداً toBeVisible استفاده نمی‌شود: وقتی سرور چیزی نگفته، depositLabel()
  // رشته‌ی خالی برمی‌گرداند و این عنصر خالی (و از دیدِ Playwright «hidden»)
  // می‌ماند — که دقیقاً رفتارِ **درست** است. پس محتوا سنجیده می‌شود، نه دیده‌شدن.
  const sub = page.locator('.rp-bookbar-sub');
  await expect(sub).toHaveCount(1, { timeout: 8000 });
  const text = ((await sub.textContent()) || '').trim();
  // نه «رایگان» ادعا کند نه «بیعانه» — چون سرور نگفته.
  expect(text, 'بدونِ دادهٔ سرور نباید هیچ ادعایی درباره‌ی پیش‌پرداخت بشود').toBe('');
});
