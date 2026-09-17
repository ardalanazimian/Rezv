import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './helpers/mock-api';
import { gotoApp } from './helpers/actions';

/**
 * حسابِ مسدود: چرا، سرنوشتِ امتیاز، و راهِ اعتراض (STATE M-14 · F003).
 *
 * چرا (Feature Verification، ۲۰۲۶-۰۹-۱۷): `USER_BANNED` در `confirmOtp` به شاخه‌ی «کد اشتباه از
 * سرور» می‌افتاد و فقط یک toastِ گذرا نشان می‌داد؛ در مسیرِ refresh هم `refreshAccessToken` فقط
 * `false` برمی‌گرداند و کاربرِ مسدود «نشست منقضی شد» می‌دید. هیچ دلیلی، هیچ جمله‌ای درباره‌ی
 * امتیازها، و هیچ راهِ اعتراضی نبود.
 *
 * ⚠️ API mock است → فقط **UI** سنجیده می‌شود. اینکه سرور یادداشتِ داخلیِ ادمین را **نمی‌فرستد**
 * در `api/tests/user-ban-public-reason.integration.test.mts` روی بدنه‌ی خامِ پاسخ پین شده است.
 */

const banned = (reason_key: string | null) => ({
  status: 403,
  contentType: 'application/json',
  body: JSON.stringify({ error: {
    code: 'USER_BANNED', message: 'دسترسیِ این حساب توسطِ رزرونو مسدود شده است',
    details: { reason_key, banned_at: '2026-09-10T08:00:00.000Z' },
  } }),
});

async function reachOtpStep(page: Page) {
  await gotoApp(page);
  await page.evaluate(() => (window as unknown as { openLogin: () => void }).openLogin());
  await page.locator('#loginPhone').fill('09123456789');
  await page.locator('#loginPhone').press('Enter').catch(() => {});
  const send = page.locator('#loginPhone + button');
  if (await send.isVisible().catch(() => false)) await send.click();
  await expect(page.locator('#otpCode')).toBeVisible();
  await page.locator('#otpCode').fill('123456');
}

test.describe('حسابِ مسدود — توضیح، نه toast', () => {
  test.slow();

  test('ورود: برگه‌ی مسدودی با «چرا؟» و سرنوشتِ امتیاز — نه «کد اشتباه است»', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/v1/auth/otp/verify', (route) => route.fulfill(banned('repeated_no_show')));
    await reachOtpStep(page);
    await page.locator('#otpCode').press('Enter');
    const sheet = page.locator('#sheet');
    await expect(sheet).toContainText('حسابت مسدود شده');
    await expect(sheet).toContainText('چند بار رزرو کردی و حاضر نشدی، بدونِ لغو.');
    await expect(sheet).toContainText('پاک نشده‌اند؛ تا رفعِ مسدودیت قابلِ استفاده نیستند');
    // هیچ toastی روی برگه نمی‌نشیند — نه «کد اشتباه است» و نه پیامِ خامِ سرور. جهشِ حذفِ شاخه‌ی
    // USER_BANNED در confirmOtp پیامِ سرور را toast می‌کند که «کد» ندارد. ادعا روی **متن** است نه
    // کلاسِ `show`: toast بعد از ۲.۴ ثانیه پنهان می‌شود و `not.toHaveClass` تا پنهان‌شدنش صبر
    // می‌کرد و جهش را رد می‌داد؛ متنِ `#toastMsg` بعد از پنهان‌شدن هم می‌ماند.
    await expect(page.locator('#toastMsg')).not.toContainText('کد');
    await expect(page.locator('#toastMsg')).not.toContainText('مسدود شده است');
  });

  test('بنِ قدیمی بدونِ کلید: پیامِ عمومی، بدونِ حدسِ دلیل', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/v1/auth/otp/verify', (route) => route.fulfill(banned(null)));
    await reachOtpStep(page);
    await page.locator('#otpCode').press('Enter');
    await expect(page.locator('#sheet')).toContainText('دلیلی برای نمایش ثبت نشده');
  });

  test('کنترل: کدِ واقعاً اشتباه همچنان همان toast را دارد و برگه‌ی مسدودی باز نمی‌شود', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/v1/auth/otp/verify', (route) => route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'OTP_INVALID', message: 'کد تأیید نامعتبر یا منقضی است' } }),
    }));
    await reachOtpStep(page);
    await page.locator('#otpCode').press('Enter');
    await expect(page.locator('#toastMsg')).toContainText('کد تأیید نامعتبر');
    await expect(page.locator('#sheet')).not.toContainText('حسابت مسدود شده');
  });

  test('نشستِ ذخیره‌شده + refreshِ مسدود: برگه‌ی مسدودی، نه «نشست منقضی شد»', async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => {
      try { localStorage.setItem('rz_access', 'expired-access'); localStorage.setItem('rz_refresh', 'old-refresh'); } catch { /* ignore */ }
    });
    await page.route('**/api/v1/me', (route) => route.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'ابتدا وارد شوید' } }),
    }));
    await page.route('**/api/v1/auth/refresh', (route) => route.fulfill(banned('promo_abuse')));
    await gotoApp(page);
    await expect(page.locator('#sheet')).toContainText('حسابت مسدود شده');
    await expect(page.locator('#sheet')).toContainText('استفاده‌ی غیرعادی از کدِ تخفیف، دعوت یا امتیاز دیده شد.');
    await expect(page.locator('#toastMsg')).not.toContainText('نشست منقضی شد');
    const stored = await page.evaluate(() => [localStorage.getItem('rz_access'), localStorage.getItem('rz_refresh')]);
    expect(stored).toEqual([null, null]);
  });

  test('«اعتراض» همان فرمِ تماس را با شماره و موضوعِ پشتیبانی می‌فرستد', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/v1/auth/otp/verify', (route) => route.fulfill(banned('abusive_conduct')));
    let sent: Record<string, unknown> | null = null;
    await page.route('**/api/v1/site/contact', (route) => {
      sent = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await reachOtpStep(page);
    await page.locator('#otpCode').press('Enter');
    await expect(page.locator('#sheet')).toContainText('حسابت مسدود شده');
    await page.locator('#banAppealName').fill('سارا');
    await page.getByRole('button', { name: 'اعتراض' }).click();
    await expect(page.locator('#banAppeal')).toContainText('اعتراضت ثبت شد.');
    expect(sent).toMatchObject({ name: 'سارا', phone: '09123456789', topic: 'support' });
    expect(String((sent as unknown as { message: string }).message)).toContain('اعتراض به مسدودیِ حساب');
  });

  test('«اعتراض» ناموفق: خطا گفته می‌شود و دکمه دوباره فعال است', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/v1/auth/otp/verify', (route) => route.fulfill(banned('under_review')));
    await page.route('**/api/v1/site/contact', (route) => route.fulfill({
      status: 429, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'تعداد درخواست بیش از حد مجاز' } }),
    }));
    await reachOtpStep(page);
    await page.locator('#otpCode').press('Enter');
    await page.locator('#banAppealName').fill('سارا');
    await page.getByRole('button', { name: 'اعتراض' }).click();
    await expect(page.locator('#banAppealErr [role="alert"]')).toContainText('تعداد درخواست بیش از حد مجاز');
    await expect(page.getByRole('button', { name: 'اعتراض' })).toBeEnabled();
    await expect(page.locator('#banAppeal')).not.toContainText('اعتراضت ثبت شد');
  });
});
