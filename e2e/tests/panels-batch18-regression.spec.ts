import { test, expect, type Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ Batch 18 — «موفقیتِ جعلی» در پنلِ کسب‌وکار (پروتکل §۳/§۱۰/§۲۷)
//
//  هر مورد یک باگِ مشاهده‌شده است، نه نگرانیِ کلی. مشترکِ همه‌شان یک الگو بود:
//  یک شاخه‌ی `else` که **بدونِ قید** اجرا می‌شد و کارِ محلی را به‌جایِ کارِ
//  سروری جا می‌زد. روی بسته‌ی دموی آفلاین این درست است؛ روی استقرارِ واقعی با
//  نشستِ منقضی یعنی دروغِ تمام‌عیار به صاحبِ کسب‌وکار.
//
//   ۱. «ارسال تبریک گروهی» فقط یک toast بود — هیچ درخواستی، هیچ پیامکی.
//   ۲. کمپینِ پیامکی در آفلاین/بدونِ توکن «کمپین ارسال شد» می‌گفت.
//   ۳. پاسخ به نظرِ مشتری محلی ذخیره می‌شد و «پاسخت ثبت شد» می‌گفت.
//   ۴. حذفِ عکسِ گالری محلی انجام می‌شد و «عکس حذف شد» می‌گفت.
//   ۵. یادداشتِ شیفت محلی می‌ماند و «یادداشت ثبت شد» می‌گفت.
//   ۶. دو KPIِ کاملاً هاردکد («۲.۱× خرید بیشتر اعضا»، «۸٪ میانگین کش‌بک»)
//      کنارِ دو KPIِ واقعی نشسته بودند و از هم تشخیص‌پذیر نبودند.
//   ۷. دکمه‌ی «تماس» در لیستِ اعضا فقط toast می‌داد (بدونِ نتیجه‌ی واقعی).
// ═══════════════════════════════════════════════════════════════════════

const BIZ = 'http://localhost:8081/';

/** ماهِ شمسیِ جاری (۱..۱۲) — دقیقاً همان چیزی که پنل با currentMonthFa()
 *  حساب می‌کند و بک‌اند در `birth_month` می‌دهد. تستِ «تولدِ این ماه» باید با
 *  هر ماهی از سال کار کند، نه فقط ماهی که تست نوشته شده. */
function currentPersianMonth(): number {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', { month: 'numeric', timeZone: 'Asia/Tehran' })
    .formatToParts(new Date());
  return Number(parts.find((p) => p.type === 'month')!.value);
}

const CLUB_MEMBERS = [
  { first_name: 'سارا', last_name: 'محمدی', phone: '09120000001', tier: 'gold', points: 120, code: 'VIS-001', birth_month: currentPersianMonth(), joined_at: new Date().toISOString() },
  { first_name: 'رضا', last_name: 'کریمی', phone: '09120000002', tier: 'silver', points: 60, code: 'VIS-002', birth_month: null, joined_at: new Date().toISOString() },
];

type Opts = { onSms?: (body: unknown) => void; smsStatus?: number };

async function mockBiz(page: Page, opts: Opts = {}) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/staff/request') return json({ devCode: '1234' });
    if (path === '/auth/staff/verify') {
      return json({
        staff: { phone: '09123456789', role: 'owner', restaurant_id: 'r1' },
        access: 'demo-access-token', refresh: 'demo-refresh-token',
      });
    }
    if (path === '/restaurant/sms' && route.request().method() === 'POST') {
      opts.onSms?.(route.request().postDataJSON());
      if (opts.smsStatus && opts.smsStatus >= 400) {
        return json({ error: { message: 'سهمیه‌ی پیامک تمام شده' } }, opts.smsStatus);
      }
      return json({ queued: 2, kind: 'campaign' });
    }
    // شکلِ واقعیِ پاسخ: { members: [...] } با birth_month عددیِ ۱..۱۲.
    if (path === '/restaurant/members') return json({ members: CLUB_MEMBERS });
    if (path === '/restaurant/cashback') {
      return json({ base_pct: 11, preorder_pct: 15, vip_pct: 20, winback_pct: 25 });
    }
    return json({ ok: true });
  });
}

async function loginBiz(page: Page) {
  await page.goto(BIZ);
  await page.locator('#staffPhone').fill('09123456789');
  await page.locator('#staffSendBtn').click();
  await expect(page.locator('#staffCode')).toBeVisible();
  await page.locator('#staffCode').fill('1234');
  await page.locator('#staffVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
}

async function gotoTab(page: Page, view: string) {
  await page.evaluate((v) => (window as unknown as { nav: (x: string) => void }).nav(v), view);
}

/** رفتن به تبِ باشگاه و صبر تا رندرِ اعضایِ واقعیِ mock.
 *  عمداً چیزی به CLUB تزریق نمی‌شود: rLoyalty وقتی توکن هست، CLUB را از
 *  loadClubMembers بازنویسی می‌کند — پس دادهٔ تست باید از خودِ mock بیاید. */
async function openLoyalty(page: Page) {
  await gotoTab(page, 'loyalty');
  await expect(page.locator('#clubList')).toContainText('سارا', { timeout: 10000 });
}

test.beforeEach(() => test.slow());

test('تبریکِ تولد: دکمه واقعاً `POST /restaurant/sms` می‌فرستد (§۳)', async ({ page }) => {
  const sent: unknown[] = [];
  await mockBiz(page, { onSms: (b) => sent.push(b) });
  await loginBiz(page);
  await openLoyalty(page);

  const btn = page.locator('#bdaySendBtn');
  await expect(btn).toBeVisible();
  await btn.click();

  // ادعایِ اصلی: یک درخواستِ واقعی رفت (قبلاً صفر بود).
  await expect.poll(() => sent.length, { timeout: 8000 }).toBe(1);
  const body = sent[0] as { kind?: string; phones?: string[] };
  expect(body.kind).toBe('campaign');
  expect(body.phones).toEqual(['09120000001']);

  // و عددِ نمایش‌داده‌شده از پاسخِ سرور می‌آید، نه شمارشِ خوش‌بینانه‌ی کلاینت.
  await expect(page.locator('#toastMsg')).toContainText('در صفِ ارسال', { timeout: 5000 });
});

test('تبریکِ تولد: ردِ سرور موفقیت اعلام نمی‌کند (§۳)', async ({ page }) => {
  await mockBiz(page, { smsStatus: 400 });
  await loginBiz(page);
  await openLoyalty(page);

  await page.locator('#bdaySendBtn').click();
  const toast = page.locator('#toastMsg');
  await expect(toast).toContainText('سهمیه‌ی پیامک تمام شده', { timeout: 5000 });
  await expect(toast).not.toContainText('در صفِ ارسال');
  // دکمه باید دوباره قابلِ استفاده باشد (بن‌بست نمی‌شود).
  await expect(page.locator('#bdaySendBtn')).toBeEnabled();
});

test('KPIهایِ باشگاه: هیچ عددِ هاردکدی نمانده و کش‌بک از سرور می‌آید (§۱۰)', async ({ page }) => {
  await mockBiz(page);
  await loginBiz(page);
  await gotoTab(page, 'loyalty');
  // کش‌بک را از سرور بخوان تا _cbLoaded ست شود، سپس صفحه‌ی باشگاه را نو کن.
  await page.evaluate(async () => {
    const w = window as unknown as { rCashback: () => Promise<void>; rLoyalty: () => Promise<void> };
    await w.rCashback();
    await w.rLoyalty();
  });

  const kpis = page.locator('#v-loyalty .kpi');
  // ادعا: عددهایِ اختراعی دیگر نیستند.
  await expect(page.locator('#v-loyalty')).not.toContainText('۲.۱×');
  await expect(page.locator('#v-loyalty')).not.toContainText('خرید بیشتر اعضا');
  // و کش‌بک همان مقدارِ سرور است (۱۱٪)، نه ۸٪ِ هاردکدِ قبلی.
  await expect(kpis.filter({ hasText: 'کش‌بکِ پایه' })).toContainText('۱۱٪');
  await expect(page.locator('#v-loyalty')).not.toContainText('۸٪');
});

test('کمپینِ پیامکی: قطعِ شبکه «ارسال شد» نمی‌گوید (§۳)', async ({ page }) => {
  await mockBiz(page);
  await loginBiz(page);
  await gotoTab(page, 'marketing');

  // شبکه را دقیقاً پیش از ارسال قطع کن — مسیرِ res.offline که باگ در آن بود.
  await page.route('**/api/v1/restaurant/sms', (route) => route.abort('failed'));
  await page.evaluate(() => {
    const w = window as unknown as { _campMessage: string; _campSegment: string; doSendCampaign: () => Promise<void> };
    w._campMessage = 'سلام'; w._campSegment = 'all';
    return w.doSendCampaign();
  });

  const toast = page.locator('#toastMsg');
  await expect(toast).toContainText('ارسال نشد', { timeout: 5000 });
  await expect(toast).not.toContainText('کمپین ارسال شد');
});

test('پاسخ به نظر: بدونِ نشستِ معتبر «ثبت شد» نمی‌گوید (§۳)', async ({ page }) => {
  await mockBiz(page);
  await loginBiz(page);
  await gotoTab(page, 'profile');

  // ⚠️ `API`, `REVIEWS`, `STAFF_NOTES` با const/let در اسکریپتِ کلاسیک اعلام
  // شده‌اند، پس **رویِ window نمی‌نشینند** — با eval در همان scope دیده می‌شوند.
  // همه در یک evaluate انجام می‌شود تا rProfile/loadReviews بینِ دو مرحله
  // REVIEWS را دوباره بازنویسی نکند.
  // تزریق، فراخوان و خواندنِ نتیجه همه در **یک** evaluate: rProfile به‌صورتِ
  // async خودش loadReviews را صدا می‌زند و REVIEWS را بازنویسی می‌کند، پس بینِ
  // دو evaluate جداگانه دادهٔ تست از بین می‌رفت.
  const replied = await page.evaluate(async () => {
    const box = document.createElement('textarea');
    box.id = 'replyText'; box.value = 'ممنون از شما';
    document.body.appendChild(box);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    g.eval('REVIEWS = [{ id: "rev1", name: "مهمان", rating: 4, text: "خوب بود", replied: false }]; API.setToken(null);');
    await g.eval('saveReply(0)');
    return g.eval('REVIEWS[0] && REVIEWS[0].replied') as boolean | undefined;
  });

  const toast = page.locator('#toastMsg');
  await expect(toast).toContainText('وارد شده باشی', { timeout: 5000 });
  await expect(toast).not.toContainText('پاسخت ثبت شد');
  // و پاسخ نباید محلی «ثبت‌شده» جا زده شود.
  expect(replied).toBeFalsy();
});

test('یادداشتِ شیفت: بدونِ نشستِ معتبر «ثبت شد» نمی‌گوید (§۳)', async ({ page }) => {
  await mockBiz(page);
  await loginBiz(page);
  await gotoTab(page, 'overview');

  const before = await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).eval('API.setToken(null); STAFF_NOTES.length') as number);

  await page.evaluate(() => {
    const box = document.createElement('textarea');
    box.id = 'noteTxt'; box.value = 'میزِ ۵ لق است';
    document.body.appendChild(box);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).eval('saveStaffNote()');
  });

  const toast = page.locator('#toastMsg');
  await expect(toast).toContainText('وارد شده باشی', { timeout: 5000 });
  await expect(toast).not.toContainText('یادداشت ثبت شد');
  const after = await page.evaluate(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).eval('STAFF_NOTES.length') as number);
  expect(after, 'یادداشت نباید محلی اضافه شود').toBe(before);
});

test('دکمه‌ی «تماس» یک لینکِ tel: واقعی است، نه toast (§۲۷)', async ({ page }) => {
  await mockBiz(page);
  await loginBiz(page);
  await openLoyalty(page);

  const call = page.locator('#clubList a[href^="tel:"]').first();
  await expect(call).toBeVisible();
  await expect(call).toHaveAttribute('href', 'tel:09120000001');
});

// ═══════════════════════════════════════════════════════════════════════
//  موجِ دوم (۲۰۲۶-۰۸-۲۴) — تبِ «تحلیل‌ها»
//   ۸. چیپِ روند `↗ ۱۸٪` و `↗ ۵٪` هاردکد بودند (همیشه سبز و رو‌به‌بالا).
//   ۹. KPIِ «رزرو این هفته» در واقع **جمعِ چهار هفته** را نشان می‌داد.
// ═══════════════════════════════════════════════════════════════════════

/** ماکِ تحلیل‌ها با آرایه‌ی چهارهفته‌ای (قدیم→جدید، مطابقِ قراردادِ بک‌اند). */
async function mockAnalytics(page: Page, weekly: number[]) {
  await page.route('**/api/v1/restaurant/analytics', (route) =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        total_customers: 100, new_customers: 40, returning_customers: 60,
        return_rate_pct: 60,
        visit_distribution: { once: 40, few: 40, loyal: 20 },
        weekly_reservations: weekly,
        peak_hours: [], heatmap: [{ dow: 1, hour: 20, count: 5 }],
      }),
    }));
}

test('روندِ هفتگی: افتِ رزرو «رشد» نشان داده نمی‌شود (§۱۰)', async ({ page }) => {
  await mockBiz(page);
  await mockAnalytics(page, [10, 20, 40, 20]);   // هفته‌ی قبل ۴۰ → این هفته ۲۰ = ‑۵۰٪
  await loginBiz(page);
  await gotoTab(page, 'analytics');

  const kpi = page.locator('#v-analytics .kpi').first();
  await expect(kpi).toContainText('رزرو هفت روزِ اخیر', { timeout: 10000 });
  // عددِ KPI باید هفته‌ی جاری باشد (۲۰)، نه جمعِ چهار هفته (۹۰).
  await expect(kpi.locator('.kpi-val')).toHaveText('۲۰');
  // چیپ باید کاهش را نشان دهد، نه رشد.
  const chip = kpi.locator('.kpi-delta');
  await expect(chip).toHaveClass(/dn/);
  await expect(chip).toContainText('۵۰٪');
  await expect(page.locator('#v-analytics')).not.toContainText('۱۸٪');
});

test('روندِ هفتگی: رشدِ واقعی درست و سبز نشان داده می‌شود', async ({ page }) => {
  await mockBiz(page);
  await mockAnalytics(page, [5, 8, 10, 15]);     // ۱۰ → ۱۵ = +۵۰٪
  await loginBiz(page);
  await gotoTab(page, 'analytics');

  const kpi = page.locator('#v-analytics .kpi').first();
  await expect(kpi.locator('.kpi-val')).toHaveText('۱۵', { timeout: 10000 });
  const chip = kpi.locator('.kpi-delta');
  await expect(chip).toHaveClass(/up/);
  await expect(chip).toContainText('۵۰٪');
});

test('روندِ هفتگی: بدونِ مبنا هیچ درصدی ادعا نمی‌شود', async ({ page }) => {
  await mockBiz(page);
  await mockAnalytics(page, [0, 0, 0, 7]);       // هفته‌ی قبل صفر → درصد بی‌معناست
  await loginBiz(page);
  await gotoTab(page, 'analytics');

  const kpi = page.locator('#v-analytics .kpi').first();
  await expect(kpi.locator('.kpi-val')).toHaveText('۷', { timeout: 10000 });
  await expect(kpi.locator('.kpi-delta')).toHaveCount(0);
});
