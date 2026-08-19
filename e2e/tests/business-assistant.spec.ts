import { test, expect, Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════
//  رگرسیونِ دستیارِ هوشمندِ پنلِ بیزنس (تبِ «دستیار AI»)
//
//  چرا این تست وجود دارد — یک باگِ واقعی که فقط با مرورگر دیده شد:
//  چت‌باکس ابتدا داخلِ قالبِ *مسیرِ موفقِ* `custRenderAI` رندر می‌شد، یعنی اگر
//  `/restaurant/ai` (کارت‌های پیشنهاد) خطا می‌داد، تابع زودتر return می‌کرد و
//  چت‌باکس **اصلاً در DOM نمی‌آمد** — دو قابلیتِ کاملاً مستقل به یک نقطه‌ی
//  شکست گره خورده بودند. حالا چت پیش از fetchِ کارت‌ها رندر می‌شود.
//  تستِ دوم پایین دقیقاً همین را قفل می‌کند تا رگرسیون برنگردد.
//
//  API با `page.route` mock می‌شود (همان انضباطِ بقیه‌ی تست‌ها): بدونِ
//  دیتابیس/بک‌اندِ زنده، قطعی و قابلِ اجرا در CI.
// ═══════════════════════════════════════════════════════════

const PANEL = 'http://localhost:8081/';

/** پنل را در حالتِ «واردشده» می‌گذارد تا گاردِ `API.getToken()` رد شود. */
async function loginAs(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('rz_biz_access', 'e2e-fake-token');
    localStorage.setItem('rz_biz_restaurant_id', 'e2e-restaurant');
  });
}

/**
 * پاسخِ موفقِ دستیار. `aiOk=false` یعنی کارت‌های پیشنهاد خطا بدهند.
 *
 * ⚠️ ترتیبِ ثبت مهم است: در Playwright **آخرین** route‌ای که ثبت شود اولویت
 * دارد، نه اختصاصی‌ترین. اولین نسخه‌ی این هلپر catch-all را آخر ثبت می‌کرد و
 * همان GET /restaurant/ai را می‌بلعید — یعنی حالتِ ۵۰۰ اصلاً به کلاینت
 * نمی‌رسید و تستِ رگرسیون بی‌صدا بی‌اثر شده بود. پس اول catch-all، بعد
 * روت‌های اختصاصی.
 */
async function mockAssistant(page: Page, opts: { aiOk?: boolean } = {}) {
  const { aiOk = true } = opts;

  // بقیه‌ی فراخوانی‌هایِ پنل (داشبورد، شعبه‌ها، …) نباید تست را بشکنند.
  await page.route('**/api/v1/**', async (route) => {
    if (route.request().method() === 'GET') { await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); return; }
    await route.fallback();
  });

  await page.route('**/api/v1/restaurant/assistant', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          log_id: 'e2e-log-1', understood: true,
          intent: 'reservations_today', confidence: 0.9,
          answer: 'امروز ۳ رزروِ فعال دارید.', suggestions: [],
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_questions: 0, learned_words: 0 }) });
  });

  await page.route('**/api/v1/restaurant/ai', async (route) => {
    if (!aiOk) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL', message: 'خطای سرور' } }) }); return; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cards: [] }) });
  });

  await page.route('**/api/v1/restaurant/crm/recommendations', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
}

/** به تبِ مشتریان → زیرتبِ «دستیار AI» می‌رود و منتظرِ رندر می‌ماند. */
async function openAssistantTab(page: Page) {
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('customers'));
  await page.evaluate(async () => {
    const w = window as unknown as { setCustTab: (t: string) => void; custRenderAI: () => Promise<void> };
    w.setCustTab('ai');
    await w.custRenderAI();
  });
}

test.describe('دستیارِ هوشمندِ پنلِ بیزنس', () => {
  test('سؤالِ کارمند پاسخِ واقعی از API می‌گیرد و در چت نشان داده می‌شود', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await loginAs(page);
    await mockAssistant(page);
    await page.goto(PANEL);
    await openAssistantTab(page);

    const input = page.locator('#assistantInput');
    await expect(input).toBeVisible();

    await input.fill('امروز چند رزرو داریم؟');
    await page.locator('#assistantSend').click();

    // پاسخِ سرور در حبابِ چت ظاهر می‌شود — نه پیامِ خطا، نه عددِ ساختگی.
    await expect(page.locator('#assistantBody')).toContainText('امروز ۳ رزروِ فعال دارید.');
    // و خودِ سؤالِ کاربر هم در تاریخچه می‌ماند.
    await expect(page.locator('#assistantBody')).toContainText('امروز چند رزرو داریم؟');

    expect(errors, `خطاهای JS: ${errors.join(' | ')}`).toEqual([]);
  });

  test('با شکستِ کارت‌های پیشنهاد، چت‌باکس همچنان رندر و قابل‌استفاده می‌ماند', async ({ page }) => {
    // ⚠️ قفلِ رگرسیونِ باگِ اصلی: قبلاً خطای /restaurant/ai باعث می‌شد
    // custRenderAI زودتر return کند و چت‌باکس اصلاً ساخته نشود.
    await loginAs(page);
    await mockAssistant(page, { aiOk: false });
    await page.goto(PANEL);
    await openAssistantTab(page);

    // چت‌باکس باید باشد…
    await expect(page.locator('#assistantInput')).toBeVisible();
    // …و واقعاً کار کند، نه فقط در DOM باشد.
    await page.locator('#assistantInput').fill('امروز چند رزرو داریم؟');
    await page.locator('#assistantSend').click();
    await expect(page.locator('#assistantBody')).toContainText('امروز ۳ رزروِ فعال دارید.');

    // و شکستِ کارت‌ها باید صادقانه گزارش شود، نه بی‌صدا خالی بماند.
    await expect(page.locator('#ct-ai')).toContainText('پیشنهادها بارگیری نشد');
  });
});
