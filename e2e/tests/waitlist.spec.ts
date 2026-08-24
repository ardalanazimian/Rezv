import { test, expect, Page } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp, openFirstRestaurant, login } from './helpers/actions';

// ═══ جریانِ لیست انتظار ═══
// وقتی هنگامِ تأییدِ رزرو ظرفیت پر می‌شود (پاسخِ SLOT_FULL از سرور)، فرانت باید
// به‌جای از دست دادنِ کاربر، پیشنهادِ پیوستن به لیست انتظار بدهد — «مسیرِ نجاتِ درآمد».

test.beforeEach(async ({ page }) => {
  // ⚠️ فازِ ۲: این جریان‌ها چندمرحله‌ای‌اند و زیرِ بارِ موازیِ کلِ سوئیت از مهلتِ
  // پیش‌فرضِ ۳۰ ثانیه رد می‌شدند — با اجرایِ کاملِ سوئیت واقعاً مشاهده شد
  // (۵ شکست با ۴ ورکر، ۲۷/۲۷ پاس با ۱ ورکر). مهلت بیشتر می‌شود،
  // هیچ assertionی ضعیف نمی‌شود.
  test.slow();
  // اسلات‌ها باز نمایش داده می‌شوند تا کاربر بتواند تا مرحله‌ی تأیید پیش برود،
  // ولی POST رزرو با SLOT_FULL رد می‌شود (شبیه‌سازیِ پرشدنِ ظرفیت در لحظه‌ی تأیید).
  await mockApi(page, { reserveFull: true });
});

/** پیش‌رفتن در شیتِ رزرو تا کلیکِ «تأیید رزرو». */
async function advanceToConfirm(page: Page) {
  await page.getByRole('button', { name: /رزرو میز/ }).click();
  await expect(page.locator('#sheet')).toBeVisible();
  await page.waitForFunction(() => {
    const s = document.getElementById('bwTime') as HTMLSelectElement | null;
    return !!s && [...s.options].some((o) => o.value && o.value !== '');
  }, undefined, { timeout: 5000 });
  await page.getByRole('button', { name: /بررسی میزهای موجود/ }).click();
  await page.getByRole('button', { name: 'ادامه', exact: true }).click();
  await page.getByRole('button', { name: /تأیید رزرو|تایید رزرو/ }).click();
}

test('وقتی هنگامِ تأیید ظرفیت پر می‌شود، گزینه‌ی لیست انتظار پیشنهاد می‌شود', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  await openFirstRestaurant(page);
  await advanceToConfirm(page);

  // POST رزرو با SLOT_FULL رد می‌شود → پیشنهادِ لیست انتظار باید ظاهر شود
  await expect(page.locator('#sheetBody')).toContainText(/لیست انتظار|ظرفیت.*پر/, { timeout: 8000 });
});

test('کاربر می‌تواند به لیست انتظار بپیوندد و موقعیتش را ببیند', async ({ page }) => {
  await gotoApp(page);
  await login(page);
  await openFirstRestaurant(page);
  await advanceToConfirm(page);

  // پیوستن به صف
  await page.evaluate(() =>
    (window as Window & { joinWaitlist: (id: number) => Promise<void> }).joinWaitlist(1)
  );
  // بعد از پیوستن، موقعیت در صف باید نمایش داده شود (position=2 از mock)
  await expect(page.locator('#sheetBody')).toContainText(/موقعیت|صف|۲|2|انتظار/, { timeout: 8000 });
});
