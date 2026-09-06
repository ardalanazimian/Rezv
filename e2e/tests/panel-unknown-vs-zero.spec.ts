import { test, expect, type Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  «نمی‌دانیم» نباید «صفر» نشان داده شود (ML_CONTRACT · §۳)
//
//  قاعده‌ی صریحِ پروژه: «کمبودِ شواهد یعنی insufficient_data/null، **نه صفر**
//  — صفر یعنی اندازه گرفتیم و هیچ بود». همین قاعده در `apps/business/js/crm.js`
//  هم نوشته شده: «فقط null یعنی نمی‌دانیم و باید — شود».
//
//  باگی که پین می‌شود: نگاشتِ `/restaurant/customers` نرخِ بازگشت را با
//  `churn_risk_score != null ? … : 0` می‌ساخت. برایِ مشتریِ تازه‌ای که سرور
//  هنوز امتیازی برایش ندارد، کارتِ تاریخچه **«۰٪ بازگشت»** نشان می‌داد —
//  یعنی «قطعاً برنمی‌گردد»، بدترین خوانشِ ممکن، در حالی که هیچ داده‌ای نبود.
//  رستوران‌دار روی همین عدد تصمیمِ کمپینِ بازگردانی می‌گیرد.
//
//  ⚠️ خطِ بغلیِ همان map از قبل درست بود (`spent: … : '—'`) — یعنی این
//  جاافتادگی بود، نه تصمیمِ طراحی.
// ═══════════════════════════════════════════════════════════════════════

const BIZ = 'http://localhost:8081/';

/** یک مشتری **با** امتیاز و یک مشتری **بدونِ** امتیاز — تفاوتشان کلِ ادعاست. */
const CUSTOMERS = [
  { name: '[DEMO] مشتریِ باسابقه', phone: '09120000001', total_visits: 12,
    is_vip: false, churn_risk_score: 20, predicted_clv_toman: 5_000_000 },
  { name: '[DEMO] مشتریِ تازه', phone: '09120000002', total_visits: 1,
    is_vip: false, churn_risk_score: null, predicted_clv_toman: 0 },
];

async function loginAndOpenGuest(page: Page, guestName: string) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const json = (b: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (path === '/auth/staff/login') {
      return json({ staff: { role: 'owner', restaurant_name: '[DEMO] ویستا', permissions: {} },
        access: 'demo-access-token', refresh: 'demo-refresh-token' });
    }
    if (path === '/restaurant/customers') return json({ items: CUSTOMERS });
    return json({ data: [], items: [], total: 0 });
  });
  await page.goto(BIZ);
  await page.locator('#staffUser').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#staffUser').fill('ardalan');
  await page.locator('#staffPass').fill('secret');
  await page.locator('#staffLoginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/, { timeout: 15_000 });

  // ⚠️ منتظرِ `window.GUESTS` نمان: `apps/business` اسکریپتِ **کلاسیک** است و
  // `let GUESTS` رویِ window نمی‌نشیند (برخلافِ `function viewCustomerHistory`
  // که می‌نشیند). نسخه‌ی اولِ این تست همین اشتباه را کرد، تایم‌اوت خورد و بعد
  // تابع را با fallbackِ خالی صدا زد — پس **هر دو** تست به دلیلِ غلط شکستند.
  // معیارِ درست: خودِ کارتِ مشتری رویِ داشبورد رندر شده باشد، که یعنی داده
  // واقعاً از mock آمده و map شده است.
  const card = page.locator('.top-cust', { hasText: guestName });
  await card.first().waitFor({ state: 'visible', timeout: 15_000 });
  await card.first().click();   // همان مسیرِ کاربر، نه فراخوانیِ مستقیمِ تابع
  await expect(page.locator('#modalBg')).toBeVisible({ timeout: 10_000 });
}

/** مقدارِ نمایش‌داده‌شده‌ی آمارِ «بازگشت» در کارتِ تاریخچه. */
async function retStat(page: Page) {
  return page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.ch-stat-l'));
    const el = labels.find((l) => (l.textContent || '').trim() === 'بازگشت');
    return el?.parentElement?.querySelector('.ch-stat-v')?.textContent?.trim() ?? null;
  });
}

test.describe('«نمی‌دانیم» ≠ «صفر» در کارتِ تاریخچه‌ی مشتری', () => {
  test('🔴 مشتریِ بدونِ امتیازِ ریزش «—» می‌گیرد، نه «۰٪»', async ({ page }) => {
    await loginAndOpenGuest(page, '[DEMO] مشتریِ تازه');
    const v = await retStat(page);
    expect(v, 'آمارِ «بازگشت» پیدا نشد — تست چیزی نمی‌سنجد').not.toBeNull();
    expect(v, `«${v}» نمایش داده شد؛ صفر یعنی «اندازه گرفتیم و هیچ بود» و اینجا دروغ است`)
      .toBe('—');
  });

  test('کنترلِ منفی: مشتریِ دارایِ امتیاز عددِ واقعی می‌گیرد، نه «—»', async ({ page }) => {
    // بدونِ این، «همیشه — نشان بده» هم سبز می‌شد و قابلیت کاملاً می‌مرد.
    await loginAndOpenGuest(page, '[DEMO] مشتریِ باسابقه');
    const v = await retStat(page);
    expect(v).not.toBe('—');
    // churn_risk_score=20 ⇒ بازگشت = ۸۰٪ (با ارقامِ فارسی)
    expect(v, `انتظار ۸۰٪ (۱۰۰−۲۰)، دیده شد «${v}»`).toContain('۸۰');
  });
});
