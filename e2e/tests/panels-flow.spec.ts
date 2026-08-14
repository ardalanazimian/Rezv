import { test, expect, type Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
//  e2e رفتاریِ پنلِ کسب‌وکار (business) — ورودِ staff → بازِ پنل
//  فراتر از اسموک: جریانِ واقعیِ ورود (شماره → کد → enterPanel) را درایو می‌کند و
//  تأیید می‌کند که پنل باز می‌شود و صفحه‌ی داشبورد (overview) فعال می‌شود.
//  بک‌اند mock می‌شود (staff-auth) چون سرورِ استاتیک /api ندارد. این شبکه‌ی ایمنیِ
//  رفتاری، پیش‌نیازِ ادغام‌های بعدیِ API client است (CONSOLIDATION_ROADMAP قدم ۳).
// ═══════════════════════════════════════════════════════════

const BIZ = 'http://localhost:8081/';
const CO = 'http://localhost:8082/';

// mockِ سطحِ پنل: فقط auth را واقعی جواب می‌دهد؛ بقیه‌ی /api پاسخِ خالیِ موفق
// تا viewها بدونِ خطا رندر شوند (دادهٔ نمونه/خالی).
// نکته: business از /auth/staff/* استفاده می‌کند و company از /auth/admin/* —
// هر دو باید mock شوند وگرنه ورودِ پنلِ شرکت به شاخه‌ی «کد اشتباه است» می‌افتد.
async function mockPanelApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/staff/request' || path === '/auth/admin/request') return json({ devCode: '1234' });
    if (path === '/auth/staff/verify') {
      return json({
        staff: { role: 'owner', restaurant_name: 'رستورانِ دمو', permissions: {} },
        access: 'demo-access-token',
        refresh: 'demo-refresh-token',
      });
    }
    if (path === '/auth/admin/verify') {
      return json({
        admin: { phone: '09123456789', role: 'platform_admin' },
        access: 'demo-access-token',
        refresh: 'demo-refresh-token',
      });
    }
    // پیش‌فرض: پاسخِ خالیِ موفق تا viewها نشکنند
    return json({ ok: true });
  });
}

test('پنلِ کسب‌وکار: ورودِ staff (شماره → کد) پنل را باز و داشبورد را فعال می‌کند', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockPanelApi(page);

  await page.goto(BIZ);

  // مرحله‌ی ۱: شماره‌ی موبایل
  const phone = page.locator('#staffPhone');
  await expect(phone).toBeVisible();
  await phone.fill('09123456789');
  await page.locator('#staffSendBtn').click();

  // مرحله‌ی ۲: کدِ ورود (دمو: ۱۲۳۴)
  const code = page.locator('#staffCode');
  await expect(code).toBeVisible();
  await code.fill('1234');
  await page.locator('#staffVerifyBtn').click();

  // نتیجه: overlayِ ورود مخفی و داشبورد فعال
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#v-overview')).toHaveClass(/active/);
  await expect(page.locator('.sb-brand').first()).toBeVisible();

  // بدونِ خطای اجرا-نشده‌ی JS در کلِ جریان
  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});

test('پنلِ شرکت: ورودِ مدیرِ پلتفرم (شماره → کد) پنل را باز و داشبورد را فعال می‌کند', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockPanelApi(page); // همان mockِ staff-auth (company هم /auth/staff/* را صدا می‌زند)

  await page.goto(CO);

  // مرحله‌ی ۱: شماره‌ی موبایلِ مدیر
  const phone = page.locator('#adminPhone');
  await expect(phone).toBeVisible();
  await phone.fill('09123456789');
  await page.locator('#adminSendBtn').click();

  // مرحله‌ی ۲: کدِ ورود (دمو: ۱۲۳۴)
  const code = page.locator('#adminCode');
  await expect(code).toBeVisible();
  await code.fill('1234');
  await page.locator('#adminVerifyBtn').click();

  // نتیجه: overlayِ ورود مخفی و داشبورد فعال
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#v-overview')).toHaveClass(/active/);
  await expect(page.locator('.sb-brand').first()).toBeVisible();

  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});

test('پنلِ کسب‌وکار: ناوبری به «رزروها» لیستِ رزرو را رندر می‌کند', async ({ page }) => {
  // فراتر از ورود: عملیاتِ اصلیِ پنل (viewِ رزروها) تا کنون e2e رفتاری نداشت.
  // چون mock آرایه‌ی reservations نمی‌دهد، viewِ رزرو به دادهٔ نمونهٔ محلی fallback
  // می‌کند و همان را رندر می‌کند — این خودِ رندرِ لیست را بدونِ خطا تأیید می‌کند.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockPanelApi(page);

  await page.goto(BIZ);

  // ورودِ staff (دمو)
  await page.locator('#staffPhone').fill('09123456789');
  await page.locator('#staffSendBtn').click();
  await page.locator('#staffCode').fill('1234');
  await page.locator('#staffVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#v-overview')).toHaveClass(/active/);

  // ناوبری به رزروها از همان مسیرِ nav() که آیتمِ نوارِ کناری هم صدا می‌زند.
  // روی موبایل کلیکِ مستقیمِ آیتم به‌خاطرِ نوارِ کناریِ off-canvas و overlayها ناپایدار
  // است؛ nav() را مستقیم صدا می‌زنیم تا همان رفتار پایدار روی هر viewport تست شود.
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('reservations'));

  // نتیجه: viewِ رزروها فعال و حداقل یک ردیفِ رزرو رندر شده
  await expect(page.locator('#v-reservations')).toHaveClass(/active/);
  await expect(page.locator('#resTL .tl-item').first()).toBeVisible();

  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});

test('پنلِ شرکت: ناوبری به «رستوران‌ها» لیستِ رستوران را رندر می‌کند', async ({ page }) => {
  // فراتر از ورود: عملیاتِ اصلیِ پنلِ شرکت (viewِ رستوران‌ها). چون mock دادهٔ واقعی
  // نمی‌دهد، view به دادهٔ نمونهٔ محلی fallback می‌کند و همان را رندر می‌کند.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockPanelApi(page);

  await page.goto(CO);

  // ورودِ مدیرِ پلتفرم (دمو)
  await page.locator('#adminPhone').fill('09123456789');
  await page.locator('#adminSendBtn').click();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  // overlay باید واقعاً بسته شود؛ بدونِ این چک، اسرشنِ v-overview بی‌معناست
  // (v-overview از ابتدا active است و تست حتی با شکستِ ورود سبز می‌شد).
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#v-overview')).toHaveClass(/active/);

  // ناوبری به رستوران‌ها از همان مسیرِ nav() (روی موبایل کلیکِ مستقیمِ آیتم به‌خاطرِ
  // نوارِ کناریِ off-canvas ناپایدار است؛ nav() همان مسیری است که onclick صدا می‌زند).
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('restaurants'));

  // نتیجه: viewِ رستوران‌ها فعال و حداقل یک ردیفِ رستوران رندر شده
  await expect(page.locator('#v-restaurants')).toHaveClass(/active/);
  await expect(page.locator('#restList .rest-row').first()).toBeVisible();

  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});

test('پنلِ شرکت: صفِ «تأییدِ ساعتِ کاری» پیشنهاد را با تفاوتِ روزها رندر می‌کند', async ({ page }) => {
  // Part 3 (تأییدِ ساعتِ کاری، ۲۰۲۶-۰۸-۱۴): بعد از mockِ عمومیِ panel API
  // (که فقط {ok:true} می‌دهد)، اینجا مسیرِ hours-changes را با یک پیشنهادِ
  // واقعی override می‌کنیم تا خودِ رندرِ کارت/دیفِ روزها (نه فقط حالتِ خالی)
  // تست شود.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockPanelApi(page);
  await page.route('**/api/v1/admin/hours-changes**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'r1',
          restaurant: { id: 'r1', name: '[DEMO] رستورانِ تستِ e2e', city: 'تهران' },
          status: 'pending', status_label: 'در انتظارِ تأییدِ شرکت',
          rejection_reason: null, requested_at: new Date().toISOString(), reviewed_at: null,
          live_opening_hours: { '6': [['12:00', '22:00']] },
          proposed_opening_hours: { '6': [['12:00', '23:00']] },
        }],
        total: 1, pending_count: 1, limit: 50, offset: 0,
      }),
    });
  });

  await page.goto(CO);
  await page.locator('#adminPhone').fill('09123456789');
  await page.locator('#adminSendBtn').click();
  await page.locator('#adminCode').fill('1234');
  await page.locator('#adminVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
  await expect(page.locator('#v-overview')).toHaveClass(/active/);

  // بجِ سایدبار باید از همان لحظه‌ی ورود عددِ صف را نشان بدهد (refreshHoursChangeBadge)
  await expect(page.locator('#hoursBadge')).toBeVisible();

  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('hours'));

  await expect(page.locator('#v-hours')).toHaveClass(/active/);
  const card = page.locator('.hchange-card').first();
  await expect(card).toBeVisible();
  await expect(card.locator('.hchange-rest')).toContainText('رستورانِ تستِ e2e');
  // روزِ شنبه بینِ زنده (۲۲:۰۰) و پیشنهاد (۲۳:۰۰) فرق دارد — باید هایلایت شود
  await expect(card.locator('.hchange-day.diff').first()).toBeVisible();
  await expect(card.getByRole('button', { name: 'تأیید و زنده‌سازی' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'رد' })).toBeVisible();

  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});
