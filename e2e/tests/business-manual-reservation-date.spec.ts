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

async function mockBizApi(page: Page, posts: Captured[]) {
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
  await page.locator('button:has-text("ثبت رزرو")').click();

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

// تستِ B-02 (دابل‌کلیک) عمداً اینجا نیست: نسخه‌ی اولش **سبز شد بدونِ اینکه
// موضوعش را لمس کند** — پاسخِ mock فوری برمی‌گشت، مودال پیش از کلیکِ دوم بسته
// می‌شد و کلیکِ دوم به جایی نمی‌خورد. تستی که وقتی باگ حاضر است سبز بماند، تست
// نیست (منشور §۴). با تأخیرِ واقعی در پاسخ، همراهِ رفعِ B-02، در کامیتِ بعدی
// اضافه می‌شود.
