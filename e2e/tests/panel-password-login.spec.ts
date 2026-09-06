import { test, expect, type Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
//  ورود با نام کاربری و رمز (مهاجرتِ ۰۷۴) — پوششِ E2E
//
//  ⚠️ چرا این فایل لازم بود: با مهاجرتِ ۰۷۴ فرمِ **پیش‌فرضِ** هر دو پنل از
//  OTP به «نام کاربری/رمز» عوض شد، ولی هیچ اسپکِ E2Eی به `adminUser`,
//  `adminPass`, `staffUser`, `staffPass` اشاره نمی‌کرد — یعنی مسیرِ اصلیِ
//  ورودِ هر دو پنل صفر پوششِ رفتاری داشت. اسپک‌های موجود فقط مسیرِ OTP را
//  درایو می‌کنند (و از `openSmsLogin` رد می‌شوند تا به آن برسند).
//
//  تمرکز روی سه چیزی که واقعاً می‌تواند بی‌صدا بشکند:
//   ۱. §۳ — ردِ سرور نباید «موفقیت» شود. این خانواده‌ی باگی است که کلِ
//      پروتکل حولش نوشته شده، و اینجا مسیرِ ورود است: پنلی که با ۴۰۱ باز شود
//      یعنی دورزدنِ کاملِ احراز هویت از دیدِ کاربر.
//   ۲. عدمِ نشتِ «کاربر هست یا نه» از سمتِ کلاینت — سرور عمداً برای
//      «کاربر نیست» و «رمز غلط» یک پیام می‌دهد؛ اگر کلاینت تفکیکشان کند
//      همان نشتی که سرور بست از این طرف باز می‌شود.
//   ۳. تفکیکِ ردِ واقعی از حالتِ آفلاین — کلاینت در آفلاین عمداً پنلِ دمو را
//      باز می‌کند (`res.offline`). اگر این دو قاطی شوند، یک ۴۰۱ِ واقعی هم
//      می‌تواند پنل را باز کند.
// ═══════════════════════════════════════════════════════════

const BIZ = 'http://localhost:8081/';
const CO = 'http://localhost:8082/';

type Panel = { url: string; user: string; pass: string; btn: string; loginPath: string };
const PANELS: Record<'business' | 'company', Panel> = {
  business: { url: BIZ, user: '#staffUser', pass: '#staffPass', btn: '#staffLoginBtn', loginPath: '/auth/staff/login' },
  company:  { url: CO,  user: '#adminUser', pass: '#adminPass', btn: '#adminLoginBtn', loginPath: '/auth/admin/login' },
};

const OK_BODY = {
  staff: { role: 'owner', restaurant_name: 'رستورانِ دمو', permissions: {} },
  admin: { phone: '09123456789', role: 'platform_admin' },
  access: 'demo-access-token',
  refresh: 'demo-refresh-token',
};

/** mockِ پنل. `loginStatus` پاسخِ **مسیرِ ورودِ رمز** را کنترل می‌کند؛ بقیه‌ی
 *  /api پاسخِ خالیِ موفق می‌گیرند تا viewها بدونِ خطا رندر شوند. */
async function mockPanel(page: Page, p: Panel, opts: { loginStatus?: number; loginBody?: unknown } = {}) {
  const calls: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === p.loginPath) {
      calls.push(path);
      const status = opts.loginStatus ?? 200;
      // ⚠️ بدنه همیشه JSONِ معتبر است — وگرنه httpJson آن را `offline` می‌فهمد و
      //    کلاینت پنلِ دمو را باز می‌کند، یعنی تست به دلیلِ **غلط** سبز/قرمز می‌شد.
      return json(status === 200 ? OK_BODY
        : (opts.loginBody ?? { error: { code: 'INVALID_CREDENTIALS', message: 'نام کاربری یا رمز عبور اشتباه است' } }),
        status);
    }
    return json({ ok: true, data: [], items: [], total: 0 });
  });
  return calls;
}

async function submit(page: Page, p: Panel, user: string, pass: string) {
  await page.locator(p.user).waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator(p.user).fill(user);
  await page.locator(p.pass).fill(pass);
  await page.locator(p.btn).click();
}

for (const [name, p] of Object.entries(PANELS) as Array<[string, Panel]>) {
  test.describe(`${name} — ورود با نام کاربری و رمز`, () => {
    test('فرمِ پیش‌فرضِ ورود «نام کاربری/رمز» است، نه پیامک', async ({ page }) => {
      // اگر روزی پیش‌فرض برگردد به OTP، بقیه‌ی این فایل بی‌معنا می‌شود و باید بداند.
      await mockPanel(page, p);
      await page.goto(p.url);
      await expect(page.locator(p.user)).toBeVisible({ timeout: 15_000 });
      await expect(page.locator(p.pass)).toBeVisible();
    });

    test('اعتبارنامه‌ی درست پنل را باز می‌کند و داشبورد فعال می‌شود', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await mockPanel(page, p);
      await page.goto(p.url);
      await submit(page, p, 'ardalan', 'correct-horse');
      await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/, { timeout: 15_000 });
      await expect(page.locator('#v-overview')).toHaveClass(/active/);
      expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
    });

    test('🔴 §۳ — ردِ ۴۰۱ سرور پنل را باز نمی‌کند', async ({ page }) => {
      const calls = await mockPanel(page, p, { loginStatus: 401 });
      await page.goto(p.url);
      await submit(page, p, 'ardalan', 'wrong-password');
      // درخواست واقعاً رفته باشد — وگرنه این تست فقط «کلاینت هیچ‌کاری نکرد» را
      // می‌سنجد و با حذفِ کلِ فراخوانی هم سبز می‌ماند.
      await expect.poll(() => calls.length, { timeout: 15_000 }).toBe(1);
      await expect(page.locator('#loginOverlay')).not.toHaveClass(/hidden/);
      // و دکمه دوباره فعال شده تا کاربر گیر نکند.
      await expect(page.locator(p.btn)).toBeEnabled({ timeout: 15_000 });
    });

    test('🔴 «کاربر نیست» و «رمز غلط» از هم تفکیک‌پذیر نیستند', async ({ page }) => {
      // سرور عمداً یک پیام می‌دهد؛ کلاینت هم نباید چیزِ دقیق‌تری بسازد.
      const seen: string[] = [];
      for (const who of ['no-such-user', 'ardalan']) {
        await mockPanel(page, p, { loginStatus: 401 });
        await page.goto(p.url);
        await submit(page, p, who, 'whatever');
        // ⚠️ عمداً روی #toastMsg و با poll، نه روی سلکتورِ کلاسیِ عام:
        // `#toast` عنصرِ **دائمیِ** DOM است (فقط کلاسِ `show` می‌گیرد) و
        // بعد از ۲۴۰۰ms خودش پنهان می‌شود. سلکتورِ عام می‌توانست همان
        // ظرفِ خالی را «visible» ببیند و رشته‌ی تهی بخواند — که در اجرای
        // تکیِ فایل سبز می‌شد و در کلِ سوئیت (کندتر) قرمز. poll روی
        // *محتوا* هر دو مشکل را می‌بندد.
        const msg = page.locator('#toastMsg');
        await expect.poll(async () => ((await msg.textContent()) || '').trim(),
          { timeout: 15_000 }).not.toEqual('');
        seen.push(((await msg.textContent()) || '').trim());
      }
      expect(seen[0]).not.toEqual('');
      expect(seen[0], `پیام‌ها تفکیک‌پذیرند: ${JSON.stringify(seen)}`).toEqual(seen[1]);
    });

    test('فیلدِ خالی اصلاً درخواستی نمی‌فرستد', async ({ page }) => {
      const calls = await mockPanel(page, p);
      await page.goto(p.url);
      await page.locator(p.user).waitFor({ state: 'visible', timeout: 15_000 });
      await page.locator(p.btn).click();
      await expect(page.locator('#loginOverlay')).not.toHaveClass(/hidden/);
      expect(calls, 'با فیلدِ خالی نباید هیچ درخواستی برود').toEqual([]);
    });

    test('رفت‌وبرگشتِ فرمِ رمز ↔ پیامک کار می‌کند', async ({ page }) => {
      await mockPanel(page, p);
      await page.goto(p.url);
      const smsBtn = name === 'company' ? '#adminSmsLoginBtn' : '#staffSmsLoginBtn';
      const phone = name === 'company' ? '#adminPhone' : '#staffPhone';
      await page.locator(smsBtn).waitFor({ state: 'visible', timeout: 15_000 });
      await page.locator(smsBtn).click();
      await expect(page.locator(phone)).toBeVisible({ timeout: 15_000 });
      // برگشت — وگرنه کاربری که اشتباه روی «پیامک» زده در آن فرم گیر می‌کند.
      await page.locator('.login-back').click();
      await expect(page.locator(p.user)).toBeVisible({ timeout: 15_000 });
    });
  });
}
