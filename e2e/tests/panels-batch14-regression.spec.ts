import { test, expect, type Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ Batch 14 — سطوحی که «موفقیتِ جعلی» یا «حالتِ خوش‌بینانه» داشتند
//  (فازِ ۲، پروتکل §۳ و §۲۶–۲۹)
//
//  هر تستِ این فایل یک باگِ *مشاهده‌شده* را پین می‌کند، نه یک نگرانیِ کلی:
//
//   ۱. پنلِ شرکت، حالتِ دمو: هشت رستورانِ ساختگی عینِ دادهٔ واقعی نمایش داده
//      می‌شدند — بدونِ برچسبِ [DEMO] و بدونِ بنرِ آفلاین، چون مسیرِ دمو از
//      loadAdminRestaurants() (که هر دو سازوکارِ صداقت آن‌جاست) رد می‌شد.
//   ۲. سوییچ‌هایِ اضطراری: شکستِ خواندنِ فلگ‌ها به {} تبدیل می‌شد و
//      flags[key] !== false هر پنج سوییچ را «فعال» با نشانِ سبز رندر می‌کرد.
//      یعنی مدیرِ پلتفرم باور می‌کرد قابلیت‌ها روشن‌اند در حالی که وضعیت
//      *ناشناخته* بود — رویِ پنلِ کلیدِ اضطراری، بدترین نوعِ گمراهی.
//   ۳. ویرایشگرِ قواعدِ اقتصاد: در شکستِ خواندن، اعدادِ پیش‌فرضِ کد (۱۰۰/۲۰)
//      داخلِ inputهایِ قابلِ ویرایش می‌نشستند و یک «ذخیره»ی ساده همان‌ها را
//      رویِ اقتصادِ واقعیِ پلتفرم می‌نوشت.
//   ۴. سوییچِ خریدِ کارتِ هدیه — تنها فلگی که جلویِ ساختِ اعتبارِ بدونِ پرداخت
//      را می‌گیرد — اصلاً در پنل نبود.
//   ۵. جست‌وجویِ رستوران در تاپ‌بار هیچ هندلری نداشت.
//   ۶. لیستِ انتظارِ پنلِ رستوران: دکمه‌ی «آفر میز» رویِ هر ردیف بود ولی سرور
//      همیشه سرِ صف را ترفیع می‌داد؛ و «حذف» فقط آرایه‌ی محلی را فیلتر می‌کرد
//      و موفقیت اعلام می‌کرد، بدونِ هیچ درخواستی و بدونِ هیچ مسیرِ سروری.
// ═══════════════════════════════════════════════════════════════════════

const BIZ = 'http://localhost:8081/';
const CO = 'http://localhost:8082/';

type Opts = { failFlags?: boolean; failEco?: boolean };

async function mockCompanyApi(page: Page, opts: Opts = {}) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/admin/request') return json({ devCode: '1234' });
    if (path === '/auth/admin/verify') return json({ access: 'demo-access', refresh: 'demo-refresh' });
    if (path === '/admin/security') {
      return json({
        sensitive_actions: [],
        recent_failed_actions: [],
        coupon_abuse_signals: [],
        high_no_show_customers: [],
        flagged_abuse_users: [],
        economy_overview: { tier_distribution: [], total_xp_granted: 0, active_abuse_flags: 0, total_economy_profiles: 0 },
      });
    }
    if (path === '/admin/feature-flags') {
      if (opts.failFlags) return json({ error: { message: 'boom' } }, 500);
      return json({
        flags: {
          reservations_enabled: true, waitlist_enabled: true, reward_marketplace_enabled: true,
          missions_claim_enabled: true, ai_recommendations_enabled: true, gift_card_purchase_enabled: false,
        },
      });
    }
    if (path === '/admin/economy-rules') {
      if (opts.failEco) return json({ error: { message: 'boom' } }, 500);
      return json({ rules: { completed_xp: 77, completed_coins: 7 } });
    }
    if (path === '/admin/moderation-queue') {
      return json({ banned_users_count: 0, flagged_abuse_users_count: 0, banned_ips_count: 0, pending_photos_count: 0 });
    }
    if (path === '/admin/security/banned-ips') return json({ items: [] });
    if (path === '/admin/restaurants') return json({ restaurants: [] });
    return json({ ok: true });
  });
}

async function loginCompany(page: Page) {
  await page.goto(CO);
  await page.locator('#adminPhone').fill('09123456789');
  await page.locator('#adminSendBtn').click();
  await expect(page.locator('#adminCode')).toBeVisible();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
}

/** ناوبری با همان تابعی که خودِ onclick صدا می‌زند (سایدبار روی موبایل خارج از قاب است). */
async function gotoTab(page: Page, view: string) {
  await page.evaluate((v) => (window as unknown as { nav: (x: string) => void }).nav(v), view);
}

test.beforeEach(() => test.slow());

// ─────────────────────── پنلِ شرکت ───────────────────────

test('حالتِ دمو: دادهٔ ساختگی برچسبِ [DEMO] و بنرِ آفلاین دارد (§۳)', async ({ page }) => {
  // بدونِ mock هیچ بک‌اندی در دسترس نیست، پس verifyAdminOtp آفلاین برمی‌گردد و
  // مسیرِ دمو (کد ۱۲۳۴) فعال می‌شود — دقیقاً سناریویِ باگ.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/api/v1/**', (route) => route.abort());

  await page.goto(CO);
  await page.locator('#adminPhone').fill('09123456789');
  await page.locator('#adminSendBtn').click();
  await expect(page.locator('#adminCode')).toBeVisible();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);

  await gotoTab(page, 'restaurants');
  const list = page.locator('#restList');
  await expect(list).toBeVisible();
  const text = (await list.textContent()) ?? '';
  expect(text.trim().length, 'فهرستِ نمونه باید رندر شده باشد').toBeGreaterThan(0);
  expect(text, 'هر نامِ ساختگی باید برچسبِ [DEMO] بگیرد').toContain('[DEMO]');

  await expect(page.locator('#offlineBanner'), 'بنرِ آفلاین باید دیده شود').toBeVisible();
  expect(errors, 'هیچ خطای JS نباید رخ دهد').toEqual([]);
});

test('امنیت: شکستِ خواندنِ فلگ‌ها «فعال»ِ جعلی نشان نمی‌دهد (§۳)', async ({ page }) => {
  await mockCompanyApi(page, { failFlags: true });
  await loginCompany(page);
  await gotoTab(page, 'security');

  const view = page.locator('#v-security');
  await expect(view).toContainText('وضعیتِ سوییچ‌هایِ ایمنی خوانده نشد');
  await expect(
    view.getByRole('button', { name: 'غیرفعال‌کردن' }),
    'وقتی وضعیت نامعلوم است هیچ دکمه‌ی خاموش‌کردنی نباید رندر شود',
  ).toHaveCount(0);
});

test('امنیت: شکستِ خواندنِ قواعدِ اقتصاد ویرایشگرِ قابلِ‌ذخیره نمی‌سازد (§۳)', async ({ page }) => {
  await mockCompanyApi(page, { failEco: true });
  await loginCompany(page);
  await gotoTab(page, 'security');

  const view = page.locator('#v-security');
  await expect(view).toContainText('قواعدِ اقتصاد خوانده نشد');
  await expect(page.locator('#ecoXp'), 'هیچ inputی نباید با عددِ ساختگی رندر شود').toHaveCount(0);
  await expect(page.locator('#ecoCoins')).toHaveCount(0);
});

test('امنیت: مقدارِ واقعیِ سرور در ویرایشگر می‌نشیند، نه پیش‌فرضِ کد', async ({ page }) => {
  await mockCompanyApi(page);
  await loginCompany(page);
  await gotoTab(page, 'security');
  await expect(page.locator('#ecoXp')).toHaveValue('77');
  await expect(page.locator('#ecoCoins')).toHaveValue('7');
});

test('امنیت: سوییچِ خریدِ کارتِ هدیه هست و وضعیتِ واقعی‌اش را می‌گوید', async ({ page }) => {
  await mockCompanyApi(page);
  await loginCompany(page);
  await gotoTab(page, 'security');

  const view = page.locator('#v-security');
  // این فلگ در بک‌اند وجود داشت ولی در پنلِ اپراتور غایب بود.
  await expect(view).toContainText('gift_card_purchase_enabled');
  // mock مقدارش را false داده — پس باید «غیرفعال» باشد، نه «فعال».
  const row = view.locator('.mini-row', { hasText: 'gift_card_purchase_enabled' });
  await expect(row).toContainText('غیرفعال');
});

test('امنیت: پاسخِ ناقصِ سرور حالتِ خطا می‌دهد، نه «در حال بارگذاری»ِ ابدی', async ({ page }) => {
  // این باگ حین نوشتنِ همین فایل پیدا شد: rSecurity هیچ catchی نداشت، پس هر
  // استثنایی داخلش (مثلاً فیلدِ غایب در پاسخ) بی‌صدا رد می‌شد و ویو تا ابد
  // رویِ «در حال بارگذاری...» می‌ماند — بدونِ خطا و بدونِ راهِ تلاشِ دوباره.
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/admin/request') return json({ devCode: '1234' });
    if (path === '/auth/admin/verify') return json({ access: 'a', refresh: 'r' });
    // عمداً ناقص: هیچ‌کدام از شش آرایه‌ای که rSecurity می‌خواند وجود ندارد.
    if (path === '/admin/security') return json({});
    return json({ ok: true });
  });

  await loginCompany(page);
  await gotoTab(page, 'security');

  const view = page.locator('#v-security');
  await expect(view, 'نباید رویِ حالتِ بارگذاری گیر کند').not.toContainText('در حال بارگذاری');
  await expect(view).toContainText('بارگذاری نشد');
});

test('امنیت: شکستِ صفِ نظارت صفرِ سبز نشان نمی‌دهد (§۳)', async ({ page }) => {
  // همان کلاسِ fail-openِ فلگ‌ها: شکستِ fetch به شیءِ همه‌صفر تبدیل می‌شد و
  // چهار عددِ صفر با نشانِ «همه‌چیز مرتب» رندر می‌شد، در حالی که سرور اصلاً
  // چیزی نگفته بود — بکلاگِ واقعیِ نظارت نامرئی می‌شد.
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/admin/request') return json({ devCode: '1234' });
    if (path === '/auth/admin/verify') return json({ access: 'a', refresh: 'r' });
    if (path === '/admin/security') {
      return json({
        sensitive_actions: [], recent_failed_actions: [], coupon_abuse_signals: [],
        high_no_show_customers: [], flagged_abuse_users: [],
        economy_overview: { tier_distribution: [], total_xp_granted: 0, active_abuse_flags: 0, total_economy_profiles: 0 },
      });
    }
    if (path === '/admin/moderation-queue') return json({ error: { message: 'boom' } }, 500);
    if (path === '/admin/security/banned-ips') return json({ error: { message: 'boom' } }, 500);
    if (path === '/admin/feature-flags') {
      return json({ flags: { reservations_enabled: true, waitlist_enabled: true, reward_marketplace_enabled: true, missions_claim_enabled: true, ai_recommendations_enabled: true, gift_card_purchase_enabled: false } });
    }
    if (path === '/admin/economy-rules') return json({ rules: { completed_xp: 10, completed_coins: 1 } });
    if (path === '/admin/restaurants') return json({ restaurants: [] });
    return json({ ok: true });
  });

  await loginCompany(page);
  await gotoTab(page, 'security');

  const view = page.locator('#v-security');
  await expect(view).toContainText('خلاصه‌ی صفِ نظارت خوانده نشد');
  await expect(view).toContainText('فهرستِ IPهایِ بن‌شده خوانده نشد');
  await expect(view, 'حالتِ خالیِ سبز نباید ادعا شود').not.toContainText('هیچ IPای بن نشده');
});

test('پنلِ اپراتور کنترلِ خروج دارد و adminLogout را صدا می‌زند', async ({ page }) => {
  // adminLogout از قبل کاملاً پیاده بود ولی هیچ کنترلی صدایش نمی‌زد — کنسولی
  // که می‌تواند کاربر بن کند و فلگِ سراسری بزند هیچ راهِ خروجی نداشت.
  await mockCompanyApi(page);
  await loginCompany(page);
  const btn = page.locator('.sb-foot-logout');
  await expect(btn).toHaveCount(1);
  await expect(btn).toHaveAttribute('aria-label', 'خروج از حساب');
  expect(await btn.getAttribute('onclick')).toContain('adminLogout');
});

test('مودالِ تمدید برایِ پلنِ تمدیدناپذیر چیپِ معتبر انتخاب می‌کند', async ({ page }) => {
  // باگ: چیپ‌ها فقط pro/enterprise‌اند ولی renewPlan از پلنِ فعلی پر می‌شد.
  // برایِ تنانتِ starter/basic/trial هیچ چیپی انتخاب‌شده نبود و خلاصه پلنی
  // را می‌گفت که بک‌اند ردش می‌کند.
  //
  // ⚠️ چرا از مسیرِ دمو: RESTAURANTS با `let` در سطحِ اسکریپت تعریف شده، پس
  // رویِ window نیست و از page.evaluate قابلِ تزریق نبود (تلاشِ اولِ همین تست
  // دقیقاً به همین دلیل تایم‌اوت خورد). دادهٔ نمونه‌ی خودِ پنل رستورانی با
  // پلنِ `basic` دارد — همان کلاسِ «تمدیدناپذیر»ی که starter در آن است.
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.goto(CO);
  await page.locator('#adminPhone').fill('09123456789');
  await page.locator('#adminSendBtn').click();
  await expect(page.locator('#adminCode')).toBeVisible();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);

  // id=3 در دادهٔ نمونه پلنِ 'basic' دارد (تمدیدناپذیر، مثلِ starter).
  await page.evaluate(() => (window as unknown as { openRenew: (id: string) => void }).openRenew('3'));

  const sel = page.locator('#planOpts .opt.sel');
  await expect(sel, 'باید دقیقاً یک چیپ انتخاب‌شده باشد').toHaveCount(1);
  expect(['pro', 'enterprise'], 'پلنِ پیش‌انتخاب باید تمدیدشدنی باشد')
    .toContain(await sel.getAttribute('data-plan'));
  await expect(page.locator('#sumPlan'), 'خلاصه نباید پلنِ ردشدنی بگوید').not.toHaveText('پایه');
});

test('جست‌وجویِ تاپ‌بار واقعاً فهرست را فیلتر می‌کند', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'نوارِ جست‌وجویِ تاپ‌بار رویِ موبایل با CSS پنهان است (.tb-search)');
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.goto(CO);
  await page.locator('#adminPhone').fill('09123456789');
  await page.locator('#adminSendBtn').click();
  await expect(page.locator('#adminCode')).toBeVisible();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);

  await gotoTab(page, 'restaurants');
  await expect(page.locator('#restList')).toBeVisible();

  // عبارتی که قطعاً با هیچ نامی نمی‌خورد → باید حالتِ خالیِ مخصوصِ جست‌وجو بدهد.
  await page.locator('#globalSearch').fill('zzz-هیچ-رستورانی');
  await expect(page.locator('#restList')).toContainText('رستورانی با این نام پیدا نشد');
});

// ─────────────────────── پنلِ رستوران ───────────────────────

/** پنلِ رستوران با یک شعبه که سرور آن را **بسته** اعلام کرده. */
async function mockBusinessBranch(page: Page, isOpen: boolean) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/auth/staff/request') return json({ devCode: '1234' });
    if (path === '/auth/staff/verify') {
      return json({ staff: { role: 'owner', restaurant_name: 'رستورانِ دمو', permissions: {} }, access: 'a', refresh: 'r' });
    }
    if (path === '/restaurant/branches') {
      return json({
        branches: [{ id: 'b1', name: '[DEMO] شعبه‌ی مرکزی', slug: 'markazi', is_open: isOpen }],
        current_restaurant_id: 'b1',
        locked_to_branch: false,
      });
    }
    if (path.startsWith('/restaurant/reservations')) return json({ reservations: [], next_cursor: null });
    return json({ ok: true });
  });
}

test('نشانِ باز/بسته حقیقتِ سرور را نشان می‌دهد، نه یک پیش‌فرضِ خوش‌بینانه (§۳)', async ({ page }) => {
  // باگ: #tbStatus یک دکمه بود که فقط کلاسِ خودش را عوض می‌کرد و «رستوران بسته
  // شد» toast می‌داد. سرور، اپِ مشتری و موتورِ ظرفیت هیچ‌کدام خبردار نمی‌شدند و
  // رزرو ادامه داشت. هیچ endpointی هم برایِ نوشتنِ این حالت وجود ندارد.
  await mockBusinessBranch(page, false);
  await loginBusiness(page);

  const badge = page.locator('#tbStatus');
  await expect(badge).toHaveClass(/closed/);
  await expect(page.locator('#tbStatusText')).toHaveText('بسته');
  // دیگر دکمه نیست — چون هیچ نوشتنی پشتش نبود.
  expect(await badge.evaluate((el) => el.tagName)).not.toBe('BUTTON');
});

test('نشانِ باز/بسته برایِ شعبه‌ی باز هم درست است', async ({ page }) => {
  await mockBusinessBranch(page, true);
  await loginBusiness(page);
  await expect(page.locator('#tbStatus')).toHaveClass(/open/);
  await expect(page.locator('#tbStatusText')).toHaveText('باز');
});

test('کارت‌هایِ دستیارِ AI همه به مقصدِ واقعی می‌روند، نه toastِ «به‌زودی»', async ({ page }) => {
  // بک‌اند هفت نوع کارت می‌فرستد؛ handleAiAction فقط سه‌تا را می‌شناخت و
  // چهارتایِ دیگر — با برچسبِ دکمه‌ی مشخص — به toastِ «به‌زودی» می‌افتادند.
  // این تست فقط کدِ سراسری را بازرسی می‌کند، پس ورود لازم نیست — حذفش هم
  // سریع‌ترش می‌کند و هم از اشباعِ سرورِ استاتیک در اجرایِ موازی مصون نگهش
  // می‌دارد. assertion دست‌نخورده است.
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.goto(BIZ);
  await page.waitForFunction(() => typeof (window as unknown as { handleAiAction?: unknown }).handleAiAction === 'function');

  const unknown = await page.evaluate(() => {
    const ids = ['winback', 'vip_retention', 'noshow_upcoming', 'revenue_drop',
                 'slow_day', 'occupancy_drop', 'no_automation'];
    const src = String((window as unknown as { handleAiAction: unknown }).handleAiAction);
    return ids.filter((id) => !src.includes(`'${id}'`));
  });
  expect(unknown, 'هر idی که بک‌اند می‌فرستد باید مقصدِ صریح داشته باشد').toEqual([]);
});

async function mockBusinessWaitlist(page: Page, onDelete: (u: string) => void, deleteOk = true) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/staff/request') return json({ devCode: '1234' });
    if (path === '/auth/staff/verify') {
      return json({ staff: { role: 'owner', restaurant_name: 'رستورانِ دمو', permissions: {} }, access: 'a', refresh: 'r' });
    }
    if (path === '/restaurant/waitlist' && req.method() === 'DELETE') {
      onDelete(req.url());
      return deleteOk ? json({ status: 'cancelled' }) : json({ error: { message: 'رد شد' } }, 409);
    }
    if (path === '/restaurant/waitlist') {
      return json({
        queue: [
          { id: 'w1', name: '[DEMO] اول', party_size: 2, status: 'waiting', priority: 0, waited_minutes: 5, estimated_wait_minutes: 10, is_vip: false },
          { id: 'w2', name: '[DEMO] دوم', party_size: 4, status: 'waiting', priority: 0, waited_minutes: 3, estimated_wait_minutes: 20, is_vip: false },
        ],
        size: 2,
      });
    }
    if (path.startsWith('/restaurant/reservations')) return json({ reservations: [], next_cursor: null });
    return json({ ok: true });
  });
}

async function loginBusiness(page: Page) {
  await page.goto(BIZ);
  await page.locator('#staffPhone').fill('09123456789');
  await page.locator('#staffSendBtn').click();
  await expect(page.locator('#staffCode')).toBeVisible();
  await page.locator('#staffCode').fill('1234');
  await page.locator('#staffVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
}

test('لیستِ انتظار: «آفر میز» فقط رویِ نفرِ اول است (سرور همیشه سرِ صف را می‌دهد)', async ({ page }) => {
  await mockBusinessWaitlist(page, () => {});
  await loginBusiness(page);
  await gotoTab(page, 'waitlist');

  await expect(page.locator('.wl-card')).toHaveCount(2);
  await expect(
    page.locator('.wl-queue').getByRole('button', { name: 'آفر میز' }),
    'دو دکمه یعنی دوباره ادعایِ «آفر به این نفرِ خاص»',
  ).toHaveCount(1);
});

test('لیستِ انتظار: «حذف» واقعاً DELETE می‌فرستد (§۳)', async ({ page }) => {
  const calls: string[] = [];
  await mockBusinessWaitlist(page, (u) => calls.push(u));
  page.on('dialog', (d) => d.accept());
  await loginBusiness(page);
  await gotoTab(page, 'waitlist');

  await page.locator('.wl-card').first().getByRole('button', { name: 'حذف' }).click();
  await expect.poll(() => calls.length, { timeout: 8000 }).toBe(1);
  expect(calls[0], 'شناسه‌ی ورودی باید در درخواست باشد').toContain('entry_id=w1');
});

test('لیستِ انتظار: ردِ سرور موفقیت اعلام نمی‌کند و ردیف را حذف نمی‌کند (§۳)', async ({ page }) => {
  await mockBusinessWaitlist(page, () => {}, false);
  page.on('dialog', (d) => d.accept());
  await loginBusiness(page);
  await gotoTab(page, 'waitlist');

  await expect(page.locator('.wl-card')).toHaveCount(2);
  await page.locator('.wl-card').first().getByRole('button', { name: 'حذف' }).click();

  await expect(page.locator('#toastMsg')).toContainText('رد شد');
  await expect(page.locator('.wl-card'), 'ردیف نباید محلی ناپدید شود').toHaveCount(2);
});
