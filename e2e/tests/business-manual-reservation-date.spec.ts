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

type Captured = { date?: string; time?: string; idem?: string };

async function mockBizApi(page: Page, posts: Captured[], reservationDelayMs = 0) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    if (path === '/auth/staff/login' && method === 'POST') {
      return route.fulfill(json({
        access: 'demo-access', refresh: 'demo-refresh',
        staff: { role: 'owner', restaurant_name: 'کافه‌رستوران ویستا [DEMO]', restaurant_id: 'r-1', permissions: null },
      }));
    }
    if (path === '/reservations' && method === 'POST') {
      const body = route.request().postDataJSON() as { date?: string; time?: string };
      posts.push({ date: body?.date, time: body?.time, idem: route.request().headers()['idempotency-key'] });
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

test('B-01: برچسبِ تاریخِ انتخاب‌شده با تاریخی که POST می‌شود یکی است', async ({ page }) => {
  const posts: Captured[] = [];
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

  // قلبِ ادعا: آنچه دیده شد == آنچه ثبت شد.
  expect(shownLabel, `برچسبِ «${shownLabel}» با تاریخِ ثبت‌شده‌ی ${sentDate} نمی‌خواند`)
    .toBe(expectedLabel(sentDate!));

  // ⚠️ assertِ بالا فقط **توافق** را می‌سنجد. جهشی که برچسب و مقدار را با هم
  // جابه‌جا کند (مثلاً offset را یک‌واحد زیاد کند) از آن رد می‌شود، چون هر دو
  // با هم می‌لغزند. پس مبدأ و گام هم جدا پین می‌شوند:
  const expectDay = (n: number) => {
    const d = new Date(); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  expect(sentDate, 'گزینه‌ی d5 باید دقیقاً پنج روز بعد از امروز باشد').toBe(expectDay(5));

  const todayLabel = (await sel.locator('option[value="today"]').innerText()).trim();
  expect(todayLabel, 'برچسبِ «امروز» باید تاریخِ واقعیِ امروز را نشان دهد')
    .toBe(`امروز — ${expectedLabel(expectDay(0))}`);
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
        staff: { role: 'owner', restaurant_name: 'ویستا [DEMO]', restaurant_id: 'r-1', permissions: null },
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
