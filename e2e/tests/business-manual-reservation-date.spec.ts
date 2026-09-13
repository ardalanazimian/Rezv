import { test, expect, type Page } from '@playwright/test';

/**
 * B-01 (blocker) و B-02 (major) — مسیرِ «رزرو دستی» در پنلِ کسب‌وکار.
 *
 * B-01: `buildDateOptions` (reservations.js:227) برچسبِ تاریخ را از یک تاریخِ
 * **ثابتِ هاردکد** می‌سازد (`let day=15, mon=2, wd=5` — پنجشنبه ۱۵ خرداد) و
 * `monthLen[11]` را همیشه ۲۹ می‌گیرد، در حالی که `manualDateToISO` (:243)
 * مقدارِ ارسالی را از `new Date()`ِ واقعی + offset می‌سازد. دو محاسبه‌ی مستقل
 * ⇒ برچسبی که پرسنل می‌بیند با تاریخی که ثبت می‌شود فقط وقتی یکی است که امروز
 * واقعاً ۱۵ خرداد باشد.
 *
 * ادعا (نه «ظاهر درست است»، بلکه «واگرایی وجود ندارد»): برچسبِ گزینه‌ی
 * انتخاب‌شده باید **همان تاریخی** را نشان دهد که در بدنه‌ی POST می‌رود. تستی که
 * فقط «امروز درست نشان داده می‌شود» را بسنجد، با یک offsetِ غلط سبز می‌ماند.
 */
const BIZ = 'http://localhost:8081/';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Captured = { date?: string; time?: string; idem?: string; restaurantId?: string };

/** UUIDِ واقعی: سرور در پاسخِ ورود همین را می‌دهد و شِیمِ رزرو `zUuid` می‌خواهد. */
const RESTAURANT_UUID = '3f1a7c2e-9b44-4d1e-8a6f-2c5b7e9d0a11';

async function mockBizApi(page: Page, posts: Captured[], reservationDelayMs = 0) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    if (path === '/auth/staff/login' && method === 'POST') {
      return route.fulfill(json({
        access: 'demo-access', refresh: 'demo-refresh',
        staff: { role: 'owner', restaurant_name: 'کافه‌رستوران ویستا [DEMO]', restaurant_id: RESTAURANT_UUID, permissions: null },
      }));
    }
    if (path === '/reservations' && method === 'POST') {
      const body = route.request().postDataJSON() as { date?: string; time?: string; restaurant_id?: string };
      posts.push({ date: body?.date, time: body?.time, idem: route.request().headers()['idempotency-key'], restaurantId: body?.restaurant_id });
      // ثبت **پیش از** تأخیر انجام می‌شود تا درخواستِ دوم حتی اگر دیر برسد شمرده شود.
      if (reservationDelayMs) await new Promise((r) => setTimeout(r, reservationDelayMs));
      return route.fulfill(json({ reservation: { code: 'MAN1' } }));
    }
    if (path === '/restaurant/reservations' && method === 'GET') {
      return route.fulfill(json({ reservations: [], next_cursor: null }));
    }
    return route.fulfill(json({ ok: true }));
  });
}

async function login(page: Page) {
  await page.goto(BIZ);
  await page.locator('#staffUser').fill('owner_demo');
  await page.locator('#staffPass').fill('Passw0rd!123');
  await page.locator('#staffLoginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);
}

/** همان برچسبی که کاربر باید ببیند، از یک تاریخِ ISO — مرجعِ مستقلِ تست. */
function expectedLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * ⚠️ ساعتِ صفحه روی **مرزِ روز** ثابت می‌شود: ۰۰:۳۰ِ تهران = ۲۱:۰۰ِ UTCِ روزِ قبل.
 *
 * چرا (۲۰۲۶-۰۹-۱۳، اجرای کاملِ e2e روی 923a20a — هر سه پروژه قرمز): مرجعِ تست
 * `toISOString()` بود، یعنی روزِ **UTC**ِ ماشینِ تست، در حالی که اپ — درست، طبقِ
 * رفعِ B-01 در دستورِ ۰۴۵ — روزِ تقویمیِ **رستوران** (Asia/Tehran) را می‌فرستد.
 * این دو فقط میانِ نیمه‌شبِ تهران و نیمه‌شبِ UTC از هم جدا می‌شوند؛ پس تست
 * هر شب سه ساعت و نیم قرمز بود (اجرای من ۰۲:۳۵–۰۳:۱۷ تهران)، و بقیه‌ی روز —
 * بدتر — **نمی‌توانست** برگشتِ اپ به روزِ UTC را بگیرد، چون دو ساعت یکی بودند.
 * با ساعتِ ثابت روی مرز، همان ادعا در هر ساعتی از روز واقعاً سنجیده می‌شود.
 *
 * و دستگاهِ پرسنل روی UTC اجرا می‌شود (describe پایین)، چون نقصِ اصلیِ ۰۴۵
 * «تبلتی که روی UTC مانده» بود؛ با دستگاهِ تهران، اپی که به ساعتِ دستگاه
 * برگردد همان روز را می‌دهد و تست سبز می‌ماند — اندازه‌گیری شد، نه فرض.
 */
const BOUNDARY = new Date('2026-09-12T21:00:00Z');
// پیش‌فرضِ HOURS_STATE.timezone در apps/business/js/crm.js — این mock ساعاتِ کاری را لود نمی‌کند
const RESTAURANT_TZ = 'Asia/Tehran';

/** روزِ تقویمیِ رستوران در لحظه‌ی BOUNDARY، به‌علاوه‌ی n روز — مستقل از TZِ ماشینِ تست. */
function restaurantDay(n: number): string {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: RESTAURANT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(BOUNDARY).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

test.describe('B-01 — تبلتِ پرسنل روی UTC، رستوران در تهران (دستورِ ۰۴۵)', () => {
  // دستگاه عمداً **غیرِ** تایم‌زونِ رستوران است: پیکربندیِ پروژه‌ها Asia/Tehran است و با
  // آن، برگشتِ اپ به «ساعتِ دستگاه» (خودِ نقصِ ۰۴۵) از این تست دیده نمی‌شد.
  test.use({ timezoneId: 'UTC' });

  test('B-01: برچسبِ تاریخِ انتخاب‌شده با تاریخی که POST می‌شود یکی است', async ({ page }) => {
    const posts: Captured[] = [];
    await page.clock.setFixedTime(BOUNDARY);
    // کنترلِ مثبتِ روش: اگر این دو برابر باشند، BOUNDARY دیگر روی مرز نیست و ادعای پایین تهی است.
    expect(restaurantDay(0), 'BOUNDARY باید روزِ تهران را از روزِ UTC جدا کند')
      .not.toBe(BOUNDARY.toISOString().slice(0, 10));
    await mockBizApi(page, posts);
    await login(page);
    await page.evaluate(() => (window as unknown as { openManual: () => void }).openManual());

    const sel = page.locator('#mDate');
    await expect(sel).toBeVisible();

    // یک روزِ **غیرِ امروز** انتخاب می‌شود تا offset هم سنجیده شود، نه فقط مبدأ.
    await sel.selectOption('d5');
    const shownLabel = (await sel.locator('option[value="d5"]').innerText()).trim();
    expect(shownLabel.length, 'گزینه‌ی d5 باید وجود داشته باشد — نبودش خطاست، نه عبور').toBeGreaterThan(0);

    await page.locator('#mName').fill('مهمانِ آزمایشی');
    await page.locator('#mPhone').fill('۰۹۱۲۰۰۰۰۰۰۰');
    await page.locator('button.btn-primary.btn-lg.btn-block').click();

    await expect.poll(() => posts.length, { timeout: 10_000 }).toBeGreaterThan(0);
    const sentDate = posts[0].date;
    expect(sentDate, 'بدنه‌ی POST باید تاریخ داشته باشد').toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // ⚠️ ورود با رمز (مسیرِ اصلیِ تولید — OTP در پنل‌ها خاموش است) `STAFF_INFO` را
    // ست نمی‌کرد، فقط مسیرِ OTP این کار را می‌کرد. پس بدنه
    // `restaurant_id: STAFF_INFO?.restaurant_id || undefined` می‌فرستاد و چون
    // `undefined` از JSON حذف می‌شود، کلید اصلاً نمی‌رفت — در حالی که شِیمِ سرور
    // (`reservations/route.ts:22`) آن را `zUuid`ِ الزامی می‌خواهد. یعنی رزروِ
    // دستی برای هر کارمندی که با رمز وارد شده بود روی سرور رد می‌شد.
    expect(posts[0].restaurantId, 'رزروِ دستی بدونِ restaurant_id رفت — سرور آن را رد می‌کند (zUuid)')
      .toBe(RESTAURANT_UUID);

    // قلبِ ادعا: آنچه دیده شد == آنچه ثبت شد.
    expect(shownLabel, `برچسبِ «${shownLabel}» با تاریخِ ثبت‌شده‌ی ${sentDate} نمی‌خواند`)
      .toBe(expectedLabel(sentDate!));

    // ⚠️ assertِ بالا فقط **توافق** را می‌سنجد. جهشی که برچسب و مقدار را با هم
    // جابه‌جا کند (مثلاً offset را یک‌واحد زیاد کند) از آن رد می‌شود، چون هر دو
    // با هم می‌لغزند. پس مبدأ و گام هم جدا پین می‌شوند:
    expect(sentDate, 'گزینه‌ی d5 باید دقیقاً پنج روز بعد از امروزِ رستوران باشد').toBe(restaurantDay(5));

    const todayLabel = (await sel.locator('option[value="today"]').innerText()).trim();
    expect(todayLabel, 'برچسبِ «امروز» باید تاریخِ واقعیِ امروزِ رستوران را نشان دهد')
      .toBe(`امروز — ${expectedLabel(restaurantDay(0))}`);
  });
});

/**
 * B-02 (major): «ثبت رزرو» گاردِ in-flight ندارد و دکمه قفل نمی‌شود، و
 * `manualIdemKey` **داخلِ** `saveManual` ساخته می‌شود (reservations.js:436) —
 * پس هر کلیک کلیدِ تازه می‌گیرد و idempotency روی سرور هم نجاتش نمی‌دهد.
 *
 * ⚠️ نسخه‌ی اولِ این تست **سبز شد در حالی که باگ حاضر بود**: پاسخِ mock فوری
 * برمی‌گشت، مودال پیش از کلیکِ دوم بسته می‌شد و کلیکِ دوم به جایی نمی‌خورد.
 * تستی که وقتی موضوعش حاضر است سبز بماند تست نیست (منشور §۴). درمانش تأخیرِ
 * واقعی در پاسخ است تا دو کلیک واقعاً **هم‌پوشان** شوند — همان چیزی که در
 * شبکه‌ی کند رخ می‌دهد و اصلاً دلیلِ وجودِ این باگ است.
 */
test('B-02: دو کلیکِ هم‌پوشان روی «ثبت رزرو» فقط یک رزرو می‌سازد', async ({ page }) => {
  const posts: Captured[] = [];
  // پاسخِ کند: کلیکِ دوم در حالی می‌رسد که اولی هنوز در پرواز است.
  await mockBizApi(page, posts, 900);
  await login(page);
  await page.evaluate(() => (window as unknown as { openManual: () => void }).openManual());

  await expect(page.locator('#mDate')).toBeVisible();
  await page.locator('#mName').fill('مهمانِ آزمایشی');
  await page.locator('#mPhone').fill('۰۹۱۲۰۰۰۰۰۰۰');

  const btn = page.locator('button.btn-primary.btn-lg.btn-block');
  await btn.click({ noWaitAfter: true });
  // کلیکِ دوم عمداً بدونِ انتظار و با force — اگر رفع کار کند دکمه غیرفعال است
  // و این کلیک بی‌اثر می‌ماند؛ اگر نکند، درخواستِ دوم می‌رود.
  await page.waitForTimeout(120);
  await btn.click({ noWaitAfter: true, force: true }).catch(() => { /* دکمه قفل شده — همان مطلوب است */ });

  await expect.poll(() => posts.length, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500); // فرصت دادن به درخواستِ دومِ احتمالی که برسد

  expect(posts.length, `دو کلیکِ هم‌پوشان ${posts.length} رزرو ساخت`).toBe(1);
});

/**
 * نیمه‌ی دومِ رفعِ B-02، که تستِ بالا **نمی‌تواند** بسنجد.
 *
 * وقتی گاردِ in-flight کار می‌کند، فقط یک POST می‌رود، پس assertِ «کلید عوض
 * نشده» بی‌معنا سبز می‌ماند — گارد آن را می‌پوشاند. برای پین‌کردنِ مستقلِ
 * کلید، گارد باید **آزاد** شود: تلاشِ اول شکست بخورد (۵۰۰)، بعد کاربر دوباره
 * بزند. آن تلاشِ دوم باید **همان** کلید را ببرد، وگرنه سرور دو عملیاتِ متفاوت
 * می‌بیند و idempotency هیچ‌کاری نمی‌کند.
 */
test('B-02: تلاشِ دوباره پس از شکست، همان کلیدِ idempotency را می‌برد', async ({ page }) => {
  const posts: Captured[] = [];
  let failFirst = true;
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    if (path === '/auth/staff/login' && method === 'POST') {
      return route.fulfill(json({
        access: 'a', refresh: 'r',
        staff: { role: 'owner', restaurant_name: 'ویستا [DEMO]', restaurant_id: RESTAURANT_UUID, permissions: null },
      }));
    }
    if (path === '/reservations' && method === 'POST') {
      posts.push({ idem: route.request().headers()['idempotency-key'] });
      if (failFirst) { failFirst = false; return route.fulfill(json({ error: 'boom' }, 500)); }
      return route.fulfill(json({ reservation: { code: 'MAN1' } }));
    }
    if (path === '/restaurant/reservations' && method === 'GET') return route.fulfill(json({ reservations: [], next_cursor: null }));
    return route.fulfill(json({ ok: true }));
  });
  await login(page);
  await page.evaluate(() => (window as unknown as { openManual: () => void }).openManual());
  await expect(page.locator('#mDate')).toBeVisible();
  await page.locator('#mName').fill('مهمانِ آزمایشی');
  await page.locator('#mPhone').fill('۰۹۱۲۰۰۰۰۰۰۰');

  const btn = page.locator('button.btn-primary.btn-lg.btn-block');
  await btn.click();
  await expect.poll(() => posts.length).toBe(1);
  // گارد باید آزاد شده باشد وگرنه پرسنل بعد از خطا گیر می‌کند — خودش یک ادعاست.
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect.poll(() => posts.length, { timeout: 10_000 }).toBe(2);

  expect(posts[0].idem, 'تلاشِ اول باید کلید داشته باشد').toBeTruthy();
  expect(posts[1].idem, 'تلاشِ دوباره باید همان کلید را ببرد، نه کلیدِ تازه')
    .toBe(posts[0].idem);
});
