import { test, expect, type Page } from '@playwright/test';
import { openSmsLogin } from './helpers/actions';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ سطوحِ پنلِ کسب‌وکار که فازِ ۲ تغییرشان داد (§۳، §۶، §۲۸)
//
//  چرا این فایل لازم است: `panels-smoke` فقط **بارگذاری** را می‌سنجد و
//  `panels-flow` فقط ورود و ناوبری. هیچ‌کدام تبِ «باشگاه مشتریان» یا
//  «پلانِ سالن» را باز نمی‌کنند — دقیقاً همان دو سطحی که در Batch 6 و 8
//  عوض شدند. این همان شکافِ P2-2 (نبودِ پوششِ تراکنشی) است، محدود به
//  چیزی که واقعاً تغییر کرده.
//
//  آنچه پین می‌شود:
//   ۱. تبِ باشگاه دیگر پنج مشتریِ ساختگی نشان نمی‌دهد (Batch 6، §۳)
//   ۲. فرمِ «ثبت دستی عضو» با کدِ عضویتِ جعلی حذف شده (Batch 6، §۳/§۲۸)
//   ۳. پلانِ سالن هر پنج وضعیتِ میز را می‌شناسد (Batch 8، §۶)
//   ۴. هیچ خطای JS در هیچ‌کدام از این مسیرها
// ═══════════════════════════════════════════════════════════════════════

const BIZ = 'http://localhost:8081/';

async function mockPanelApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/staff/request') return json({ devCode: '1234' });
    if (path === '/auth/staff/verify') {
      return json({
        staff: { role: 'owner', restaurant_name: 'رستورانِ دمو', permissions: {} },
        access: 'demo-access-token', refresh: 'demo-refresh-token',
      });
    }
    // رزروها: عمداً **خالی** تا پلانِ سالن دقیقاً وضعیتِ میزهایِ زیر را نشان
    // دهد. syncTablesFromReservations وضعیتِ میز را از رزروهایِ امروز مشتق
    // می‌کند؛ با دادهٔ نمونه، میزهایِ آزاد به «رزروشده» ارتقا می‌یافتند و تست
    // غیرقطعی می‌شد. کلید `reservations` است (رجوع کن به loadReservations).
    if (path.startsWith('/restaurant/reservations')) return json({ reservations: [], next_cursor: null });
    // باشگاه: عمداً **خالی** — تا ثابت شود پنل ردیفِ ساختگی جایگزین نمی‌کند.
    if (path.startsWith('/restaurant/members')) return json({ members: [] });
    // میزها: هر پنج وضعیتِ بک‌اند، شاملِ دو تایی که پنل قبلاً نمی‌شناخت.
    if (path === '/restaurant/tables') {
      // کلید `items` است، نه `tables` — loadTables در data.js دقیقاً همین را
      // می‌خواند (`res.data?.items`) و در غیرِ این‌صورت به DEMO_TABLES می‌افتد.
      return json({
        items: [
          { id: 't1', number: 1, capacity: 2, state: 'free',        is_active: true },
          { id: 't2', number: 2, capacity: 4, state: 'reserved',    is_active: true },
          { id: 't3', number: 3, capacity: 4, state: 'occupied',    is_active: true },
          { id: 't4', number: 4, capacity: 6, state: 'cleaning',    is_active: true },
          { id: 't5', number: 5, capacity: 2, state: 'maintenance', is_active: true },
        ],
      });
    }
    return json({ ok: true });
  });
}

async function loginBusiness(page: Page) {
  await page.goto(BIZ);
  await openSmsLogin(page, 'staff');
  await page.locator('#staffPhone').fill('09123456789');
  await page.locator('#staffSendBtn').click();
  await expect(page.locator('#staffCode')).toBeVisible();
  await page.locator('#staffCode').fill('1234');
  await page.locator('#staffVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
}


/**
 * ناوبری به یک تب.
 *
 * ⚠️ عمداً به‌جایِ کلیکِ روی `.sb-item`، تابعِ سراسریِ `nav()` صدا زده می‌شود.
 * دلیل: رویِ ویوپورتِ موبایل سایدبار خارج از قابِ دید است و Playwright با
 * «element is outside of the viewport» تایم‌اوت می‌دهد. تعاملِ خودِ سایدبار
 * موضوعِ `panels-flow.spec.ts` است؛ این فایل **محتوایِ رندرشده‌ی** تب‌ها را
 * می‌سنجد (چیزی که Batch 6/8 عوضش کرد). این یک دور زدنِ ادعا نیست — همان
 * مسیرِ رندری اجرا می‌شود که کلیک هم اجرا می‌کند (onclick="nav('...')").
 */
async function gotoTab(page: Page, view: string) {
  await page.evaluate((v) => (window as unknown as { nav: (x: string) => void }).nav(v), view);
}

test.beforeEach(async ({ page }) => {
  test.slow();
  await mockPanelApi(page);
});

test('تبِ باشگاه: با پاسخِ خالیِ سرور هیچ عضوِ ساختگی نشان نمی‌دهد (§۳)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await loginBusiness(page);

  await gotoTab(page, 'loyalty');
  await expect(page.locator('#v-loyalty')).toHaveClass(/active/);

  const body = (await page.locator('#v-loyalty').innerText()) || '';
  // پنج نامِ ساختگیِ حذف‌شده — هیچ‌کدام نباید دیده شوند.
  for (const fake of ['کیان', 'نیلوفر', 'مریم', 'امیر', 'سامان']) {
    expect(body, `عضوِ ساختگیِ «${fake}» نباید نمایش داده شود`).not.toContain(fake);
  }
  // و شماره‌هایِ ساختگیِ واقع‌نما هم نه.
  expect(body).not.toMatch(/۰۹۱۲[۰-۹]{7}/);

  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});

test('تبِ باشگاه: فرمِ «ثبت دستی عضو» با کدِ جعلی حذف شده (§۳/§۲۸)', async ({ page }) => {
  await loginBusiness(page);
  await gotoTab(page, 'loyalty');
  await expect(page.locator('#v-loyalty')).toHaveClass(/active/);

  // ورودی‌هایِ فرمِ قدیمی نباید وجود داشته باشند.
  await expect(page.locator('#cFn')).toHaveCount(0);
  await expect(page.locator('#cPh')).toHaveCount(0);
  // سه selectِ تاریخِ تولد که دادهٔ حساس جمع می‌کردند و دور می‌ریختند.
  await expect(page.locator('#cD')).toHaveCount(0);
  await expect(page.locator('#cM')).toHaveCount(0);
  await expect(page.locator('#cY')).toHaveCount(0);

  const body = (await page.locator('#v-loyalty').innerText()) || '';
  expect(body, 'کدِ عضویتِ ساختگیِ VIS- نباید ساخته شود').not.toMatch(/VIS-/);
  // و به‌جایش مسیرِ واقعی معرفی شده باشد.
  expect(body).toMatch(/واک‌این|ثبتِ ورود/);
});

test('پلانِ سالن: هر پنج وضعیتِ میز شناخته می‌شود، نه سه‌تا (§۶)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await loginBusiness(page);

  await gotoTab(page, 'floor');
  await expect(page.locator('#v-floor')).toHaveClass(/active/);

  // ادعایِ اصلیِ این رفع: پیش از آن، cleaning و maintenance هر دو به 'free'
  // تا می‌شدند — یعنی این دو کلاس اصلاً در DOM ظاهر نمی‌شدند و میزِ تعمیراتی
  // به کارکنان «آزاد» نشان داده می‌شد.
  await expect(page.locator('.table-el.maintenance')).toHaveCount(1);
  await expect(page.locator('.table-el.cleaning')).toHaveCount(1);

  // هر پنج میز رندر شده‌اند (چیزی از قلم نیفتاده).
  await expect(page.locator('.table-el')).toHaveCount(5);

  // ⚠️ عمداً رویِ شمارشِ دقیقِ free/reserved/seated ادعا نمی‌شود:
  // syncTablesFromReservations وضعیتِ آن سه را از رزروهایِ امروز مشتق می‌کند
  // (مثلاً 'reserved'ِ بدونِ رزروِ متناظر به 'free' برمی‌گردد) — رفتارِ درستِ
  // از‌پیش‌موجود که این batch تغییرش نداده. ادعا کردن رویِ آن، تست را به
  // منطقی گره می‌زد که موضوعِ این رفع نیست.
  const stateClasses = await page.locator('.table-el').evaluateAll(
    (els) => els.map((e) => e.className),
  );
  // هیچ میزی نباید هم‌زمان maintenance و free باشد (فروپاشیِ قبلی).
  for (const cls of stateClasses) {
    expect(cls.includes('maintenance') && cls.includes('free')).toBe(false);
  }

  expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
});
