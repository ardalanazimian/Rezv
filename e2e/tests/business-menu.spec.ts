import { test, expect, Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  SPEC-A فاز ۱ — صفحه‌ی مدیریتِ منو در پنلِ بیزنس (تا امروز صفر تستِ E2E داشت)
//
//  قفل می‌کند: چهار حالتِ صفحه (loading/error/empty/success)، سکشن‌بندیِ
//  رابطه‌ایِ دسته‌ها، toggleِ سریعِ «ناموجود» (دقیقاً یک PATCH با
//  is_out_of_stock)، و reorderِ دسته‌ای (یک PATCH با ترتیبِ کامل).
// ═══════════════════════════════════════════════════════════════════════

const PANEL = 'http://localhost:8081/';

const CATS = [
  { id: 'c0000000-0000-4000-8000-000000000001', name: 'پیش‌غذا', sort_order: 10, is_active: true },
  { id: 'c0000000-0000-4000-8000-000000000002', name: 'غذای اصلی', sort_order: 20, is_active: true },
];
const ITEMS = [
  { id: 'd0000000-0000-4000-8000-000000000001', name: 'سالاد سزار', emoji: '🥗', price_toman: 180000,
    is_active: true, sold_count: 3, category: 'پیش‌غذا', category_id: CATS[0].id,
    is_out_of_stock: false, description: 'با سسِ مخصوص', image_url: null, sort_order: 10,
    tags: [], availability: null },
  { id: 'd0000000-0000-4000-8000-000000000002', name: 'کبابِ کوبیده', emoji: '🍢', price_toman: 320000,
    is_active: true, sold_count: 9, category: 'غذای اصلی', category_id: CATS[1].id,
    is_out_of_stock: false, description: null, image_url: null, sort_order: 10,
    tags: [], availability: null },
];

type Opts = { menuStatus?: number; empty?: boolean; delayMs?: number };
const calls: {
  itemPatch: { id: string; body: Record<string, unknown> }[];
  reorder: Record<string, unknown>[];
  tagsPut: { id: string; tags: string[] }[];
  groupPost: Record<string, unknown>[];
} = { itemPatch: [], reorder: [], tagsPut: [], groupPost: [] };

async function mockPanel(page: Page, opts: Opts = {}) {
  calls.itemPatch = [];
  calls.reorder = [];
  calls.tagsPut = [];
  calls.groupPost = [];
  const modGroups: Record<string, unknown>[] = [];
  // کپیِ قابلِ‌جهش تا PATCHِ mock تغییرِ واقعی را در GETِ بعدی هم منعکس کند.
  const items = ITEMS.map(i => ({ ...i }));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/staff/request') return json({ ok: true, dev_code: '1234' });
    if (path === '/auth/staff/verify') {
      return json({
        access: 'demo-access', refresh: 'demo-refresh',
        staff: { role: 'owner', restaurant_name: '[DEMO] ویستا', permissions: null },
      });
    }
    if (path === '/restaurant/menu' && method === 'GET') {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.menuStatus && opts.menuStatus >= 400) return json({ error: { message: 'خطای آزمایشیِ سرور' } }, opts.menuStatus);
      if (opts.empty) return json({ items: [], categories: [], public_menu_url: 'https://rezervno.ir/r/demo/menu' });
      return json({ items, categories: CATS, public_menu_url: 'https://rezervno.ir/r/demo/menu' });
    }
    if (/^\/restaurant\/menu\/[^/]+\/tags$/.test(path) && method === 'PUT') {
      const id = path.split('/')[3];
      const body = route.request().postDataJSON() as { tags: string[] };
      calls.tagsPut.push({ id, tags: body.tags });
      return json({ tags: body.tags });
    }
    if (/^\/restaurant\/menu\/[^/]+\/modifiers$/.test(path)) {
      if (method === 'POST') {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        calls.groupPost.push(body);
        const g = { id: 'g-' + (modGroups.length + 1), name: body.name,
          min_select: body.min_select ?? 0, max_select: body.max_select ?? 1, sort_order: 0, options: [] };
        modGroups.push(g);
        return json(g, 201);
      }
      return json({ groups: modGroups });
    }
    if (path === '/restaurant/menu/reorder' && method === 'PATCH') {
      calls.reorder.push(route.request().postDataJSON() as Record<string, unknown>);
      return json({ reordered: { categories: 2, items: 0 } });
    }
    // ⚠️ بعد از reorder — الگویِ [^/]+ رشته‌ی «reorder» را هم می‌گیرد.
    if (/^\/restaurant\/menu\/[^/]+$/.test(path) && method === 'PATCH') {
      const id = path.split('/').pop()!;
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.itemPatch.push({ id, body });
      const it = items.find(x => x.id === id)!;
      Object.assign(it, { is_out_of_stock: body.is_out_of_stock ?? it.is_out_of_stock });
      return json(it);
    }
    return json({ data: [], items: [], total: 0 });
  });
}

async function loginBiz(page: Page) {
  await page.goto(PANEL);
  { const t = page.locator('button:has-text("ورود با پیامک")'); if (await t.isVisible().catch(() => false)) await t.click(); }
  await page.locator('#staffPhone').fill('09123456789');
  await page.locator('#staffSendBtn').click();
  await page.locator('#staffCode').fill('1234');
  await page.locator('#staffVerifyBtn').click();
  await expect(page.locator('#loginOverlay')).toBeHidden({ timeout: 15_000 });
  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('menu'));
}

test('success: سکشن‌های دسته با ترتیبِ خودِ رستوران‌دار + ردیفِ آیتم‌ها', async ({ page }) => {
  await mockPanel(page);
  await loginBiz(page);
  await expect(page.locator('#v-menu')).toContainText('پیش‌غذا');
  await expect(page.locator('#v-menu')).toContainText('سالاد سزار');
  await expect(page.locator('#v-menu')).toContainText('غذای اصلی');
  // کنترل‌های مدیریتِ دسته حاضرند
  await expect(page.locator('button:has-text("دسته‌ی جدید")')).toBeVisible();
});

test('toggleِ «ناموجود» = دقیقاً یک PATCH با is_out_of_stock و chip روی ردیف', async ({ page }) => {
  await mockPanel(page);
  await loginBiz(page);
  const row = page.locator('#v-menu .top-cust', { hasText: 'سالاد سزار' });
  await row.locator('button:has-text("ناموجود")').click();
  await expect(row.locator('.seg-vip', { hasText: 'ناموجود' })).toBeVisible();
  expect(calls.itemPatch.length, 'فقط یک PATCH').toBe(1);
  expect(calls.itemPatch[0].id).toBe(ITEMS[0].id);
  expect(calls.itemPatch[0].body).toEqual({ is_out_of_stock: true });
});

test('reorderِ دسته: دکمه‌ی پایین → یک PATCH با ترتیبِ کاملِ تازه', async ({ page }) => {
  await mockPanel(page);
  await loginBiz(page);
  await page.locator('button[aria-label="انتقالِ دسته به پایین"]:enabled').first().click();
  await expect
    .poll(() => calls.reorder.length, { message: 'یک درخواستِ reorder' })
    .toBe(1);
  const body = calls.reorder[0] as { categories: { id: string; sort_order: number }[] };
  expect(body.categories.length).toBe(2);
  // «پیش‌غذا» بعد از جابه‌جایی باید sort_order بزرگ‌تر از «غذای اصلی» بگیرد
  const byId = Object.fromEntries(body.categories.map(c => [c.id, c.sort_order]));
  expect(byId[CATS[0].id]).toBeGreaterThan(byId[CATS[1].id]);
});

test('error: شکستِ سرور → پیامِ «منو بارگیری نشد» + تلاشِ دوباره (نه حالتِ خالیِ جعلی)', async ({ page }) => {
  await mockPanel(page, { menuStatus: 500 });
  await loginBiz(page);
  await expect(page.locator('#v-menu')).toContainText('منو بارگیری نشد');
  await expect(page.locator('#v-menu button:has-text("تلاش دوباره")')).toBeVisible();
  await expect(page.locator('#v-menu')).not.toContainText('هنوز آیتمی در منو نیست');
});

test('empty: منوی واقعاً خالی → CTA افزودنِ اولین آیتم', async ({ page }) => {
  await mockPanel(page, { empty: true });
  await loginBiz(page);
  await expect(page.locator('#v-menu')).toContainText('هنوز آیتمی در منو نیست');
  await expect(page.locator('#v-menu button:has-text("افزودنِ اولین آیتم")')).toBeVisible();
});

test('loading: قبل از پاسخ، وضعیتِ بارگیری دیده می‌شود', async ({ page }) => {
  await mockPanel(page, { delayMs: 1500 });
  await loginBiz(page);
  await expect(page.locator('#v-menu')).toContainText('در حال بارگیریِ منو');
  await expect(page.locator('#v-menu')).toContainText('سالاد سزار', { timeout: 10_000 });
});

test('فرم: برچسب + پنجره‌ی سرو → PATCH و PUTِ درست (۰۷۸)', async ({ page }) => {
  await mockPanel(page);
  await loginBiz(page);
  const row = page.locator('#v-menu .top-cust', { hasText: 'سالاد سزار' });
  await row.locator('button:has-text("ویرایش")').click();

  // برچسبِ «تند»
  await page.locator('#miTags [data-tag="SPICY"]').click();
  await expect(page.locator('#miTags [data-tag="SPICY"]')).toHaveAttribute('aria-pressed', 'true');

  // پنجره: شنبه (=۶ در قراردادِ سرور) از ۰۸:۰۰ تا ۱۲:۰۰
  // WebKitِ موبایل: hit-testِ چک‌باکسِ ریز داخلِ مودال گاهی به خودِ dialog
  // می‌خورد؛ force + assertِ toBeChecked حالتِ واقعی را همچنان قفل می‌کند.
  await page.locator('.miDay[value="6"]').check({ force: true });
  await expect(page.locator('.miDay[value="6"]')).toBeChecked();
  await page.locator('#miAvFrom').fill('08:00');
  await page.locator('#miAvTo').fill('12:00');

  await page.locator('button:has-text("ذخیره")').click();
  // ⚠️ گیتِ واقعی، نه تزئینی (رفعِ شکستِ واقعیِ اجرای کاملِ ۲۰۲۶-۰۸-۲۷،
  // هم‌زمان روی mobile-chrome و desktop-chrome): گیتِ قبلی
  // toContainText('سالاد سزار') پوچ بود — فهرستِ زیرِ مودال از همان اول
  // همین متن را دارد و هیچ هم‌گاه‌سازی‌ای با پایانِ ذخیره نمی‌کرد؛ در نتیجه
  // شمارنده‌ها با درخواستِ دومِ اپ (PUTِ برچسب‌ها) مسابقه می‌دادند و زیرِ
  // بارِ سه‌موتوره itemPatch=1 ولی tagsPut هنوز 0 دیده می‌شد. menuSave فقط
  // بعد از هر دو await (PATCH و PUT) closeModal می‌کند، پس پنهان‌شدنِ مودال
  // یعنی هر دو درخواست تمام شده‌اند — به‌علاوه همان الگوی pollِ تستِ reorder.
  // هیچ assertionی ضعیف نشده؛ بسته‌شدنِ مودال یک قفلِ تازه هم هست.
  await expect(page.locator('#modalBg')).toBeHidden();
  await expect.poll(() => calls.tagsPut.length, { message: 'PUTِ برچسب‌ها باید ثبت شود' }).toBe(1);

  expect(calls.itemPatch.length).toBe(1);
  expect(calls.itemPatch[0].body.availability).toEqual({ days: [6], start_min: 480, end_min: 720 });
  expect(calls.tagsPut[0].tags).toEqual(['SPICY']);
});

test('افزودنی: ساختِ گروه از فرمِ ویرایش → POSTِ درست و رندرِ گروه (۰۷۸)', async ({ page }) => {
  await mockPanel(page);
  await loginBiz(page);
  const row = page.locator('#v-menu .top-cust', { hasText: 'سالاد سزار' });
  await row.locator('button:has-text("ویرایش")').click();

  await page.locator('button:has-text("مدیریتِ افزودنی‌ها")').click();
  await page.locator('#mgName').fill('سایز');
  await page.locator('#mgMin').fill('1');
  await page.locator('#mgMax').fill('1');
  await page.locator('button:has-text("ساختِ گروه")').click();

  await expect(page.locator('#miModsBox')).toContainText('سایز');
  expect(calls.groupPost.length).toBe(1);
  expect(calls.groupPost[0]).toEqual({ name: 'سایز', min_select: 1, max_select: 1 });
});
