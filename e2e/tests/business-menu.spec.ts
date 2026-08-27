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
    is_out_of_stock: false, description: 'با سسِ مخصوص', image_url: null, sort_order: 10 },
  { id: 'd0000000-0000-4000-8000-000000000002', name: 'کبابِ کوبیده', emoji: '🍢', price_toman: 320000,
    is_active: true, sold_count: 9, category: 'غذای اصلی', category_id: CATS[1].id,
    is_out_of_stock: false, description: null, image_url: null, sort_order: 10 },
];

type Opts = { menuStatus?: number; empty?: boolean; delayMs?: number };
const calls: { itemPatch: { id: string; body: Record<string, unknown> }[]; reorder: Record<string, unknown>[] } =
  { itemPatch: [], reorder: [] };

async function mockPanel(page: Page, opts: Opts = {}) {
  calls.itemPatch = [];
  calls.reorder = [];
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
