import { test, expect, Page } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, openFirstRestaurant, login } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  جریانِ ایمنیِ غذایی — از مهمان تا کارکنانِ رستوران (فازِ ۲، §۹ و §۱۰)
//
//  آنچه از قبل کار می‌کرد (تأییدشده با بازبینیِ مستقل، نه فرض):
//    ستون   → api/prisma/schema.prisma  Reservation.preferences String[]
//    اعتبار → api/src/app/api/v1/reservations/route.ts:24
//    ذخیره  → api/src/lib/reservations.ts:389
//    نمایشِ کارکنان → api/src/app/api/v1/restaurant/reservations/route.ts:69
//                    (note = r.preferences.join)
//
//  تنها حلقه‌ی گمشده: شیتِ رزروِ اپِ مشتری این فیلد را **هرگز نمی‌فرستاد**
//  (grep روی apps/ برایِ "preferences" → صفر)، پس ستون همیشه {} می‌ماند و
//  سطرِ یادداشتِ پنلِ رستوران هرگز پر نمی‌شد. قابلیت غایب نبود، وصل‌نشده بود.
//
//  این spec آن حلقه را پین می‌کند: بدنه‌ی واقعیِ POST /reservations بررسی
//  می‌شود، نه صرفاً وجودِ ورودی در DOM.
// ═══════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  test.slow();
  await mockApi(page);
});

/** پیش‌رفتن تا مرحله‌ی سومِ شیت (تأیید اطلاعات). */
async function advanceToStep3(page: Page) {
  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await expect(page.locator('#sheet')).toBeVisible();
  await page.waitForFunction(() => {
    const s = document.getElementById('bwTime') as HTMLSelectElement | null;
    return !!s && [...s.options].some((o) => o.value && o.value !== '');
  }, undefined, { timeout: 5000 });
  await page.getByRole('button', { name: /بررسی میزهای موجود/ }).click();
  await page.getByRole('button', { name: 'ادامه', exact: true }).click();
}

test('ورودیِ آلرژی در مرحله‌ی تأیید وجود دارد و ادعای پزشکی نمی‌کند', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  await openFirstRestaurant(page);
  await advanceToStep3(page);

  await expect(page.locator('#bkPrefs')).toBeVisible();

  const body = (await page.locator('#sheetBody').innerText()) || '';
  // §۱۰: «Do NOT imply medical verification» — نباید هیچ تضمینِ ایمنی بدهد.
  expect(body, 'نباید ادعای تضمین/تأییدِ پزشکی بشود').not.toMatch(/تضمین|تأیید پزشک|ایمنی کامل/);
  expect(body, 'باید صریح بگوید تأییدِ پزشکی نیست').toMatch(/تأییدِ پزشکی نیست|تایید پزشکی نیست/);
});

test('یادداشتِ آلرژی واقعاً در بدنه‌ی POST /reservations می‌رود', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  await openFirstRestaurant(page);
  await advanceToStep3(page);

  await page.locator('#bkPrefs').fill('آلرژی به بادام‌زمینی · بدونِ گلوتن');

  // بدنه‌ی واقعیِ درخواست گرفته می‌شود — این ادعا درباره‌ی سیم‌کشی است،
  // نه درباره‌ی وجودِ یک textarea در صفحه.
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/v1/reservations') && r.method() === 'POST'),
    page.getByRole('button', { name: /تأیید رزرو|تایید رزرو/ }).click(),
  ]);

  const sent = JSON.parse(request.postData() || '{}');
  expect(Array.isArray(sent.preferences), 'preferences باید آرایه باشد').toBe(true);
  expect(sent.preferences).toContain('آلرژی به بادام‌زمینی');
  expect(sent.preferences).toContain('بدونِ گلوتن');
  // قراردادِ سرور: حداکثر ۲۰ قلم، هر کدام حداکثر ۱۰۰ کاراکتر.
  expect(sent.preferences.length).toBeLessThanOrEqual(20);
  for (const p of sent.preferences) expect(String(p).length).toBeLessThanOrEqual(100);
});

test('خالی‌بودنِ یادداشت اصلاً فیلد را نمی‌فرستد (نه آرایه‌ی خالی)', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  await openFirstRestaurant(page);
  await advanceToStep3(page);

  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().includes('/api/v1/reservations') && r.method() === 'POST'),
    page.getByRole('button', { name: /تأیید رزرو|تایید رزرو/ }).click(),
  ]);

  const sent = JSON.parse(request.postData() || '{}');
  expect('preferences' in sent, 'وقتی چیزی نوشته نشده، فیلد نباید فرستاده شود').toBe(false);
});
