import { test, expect, type Page } from '@playwright/test';

/**
 * A2-002 (blocker, round 16): دکمه‌های ردیفِ رزرو با `RES[i]` (فهرستِ نمونه/امروزِ داشبورد)
 * کار می‌کردند در حالی که ردیف‌ها از آرایه‌ی fetch‌شده‌ی همان تب رندر می‌شدند — در تبِ
 * «روزهای آینده» کلیکِ «رسید» روی رزروِ اشتباه (یا روی ردیفِ نمونه‌ی بدونِ code) PATCH می‌زد.
 * ادعا: PATCHِ تغییرِ وضعیت باید دقیقاً code ی همان ردیفی را داشته باشد که کاربر دید.
 */
const BIZ = 'http://localhost:8081/';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

function isoDaysFromNow(days: number, hour = 20) {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d.toISOString();
}

async function mockBizApi(page: Page, patches: string[]) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = route.request().method();
    if (path === '/auth/staff/login' && method === 'POST') {
      return route.fulfill(json({ access: 'demo-access', refresh: 'demo-refresh',
        staff: { role: 'owner', restaurant_name: 'کافه‌رستوران ویستا [DEMO]', permissions: null } }));
    }
    if (path === '/restaurant/reservations' && method === 'GET') {
      const date = url.searchParams.get('date');
      if (date === 'upcoming') {
        return route.fulfill(json({ reservations: [
          { code: 'UPC1', status: 'confirmed', name: 'Upcoming Guest', party_size: 4, table_number: 7, slot_start: isoDaysFromNow(3), phone: '09121111111' },
        ], next_cursor: null }));
      }
      return route.fulfill(json({ reservations: [
        { code: 'TODAY1', status: 'confirmed', name: 'Today Guest', party_size: 2, table_number: 3, slot_start: isoDaysFromNow(0), phone: '09122222222' },
      ], next_cursor: null }));
    }
    if (/^\/restaurant\/reservations\/[^/]+\/status$/.test(path) && method === 'PATCH') {
      patches.push(path);
      return route.fulfill(json({ ok: true }));
    }
    return route.fulfill(json({ ok: true }));
  });
}

test('تبِ «روزهای آینده»: «رسید» روی ردیفِ دیده‌شده PATCH می‌زند، نه روی RES[i] ی امروز', async ({ page }) => {
  const patches: string[] = [];
  await mockBizApi(page, patches);
  await page.goto(BIZ);
  await page.locator('#staffUser').fill('owner_demo');
  await page.locator('#staffPass').fill('Passw0rd!123');
  await page.locator('#staffLoginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/);

  await page.evaluate(() => (window as unknown as { nav: (v: string) => void }).nav('reservations'));
  await page.locator('button:has-text("روزهای آینده")').click();
  const row = page.locator('#resTL .tl-name', { hasText: 'Upcoming Guest' });
  await expect(row).toBeVisible();

  await page.locator('#resTL [onclick^="markArrived("]').first().click();
  await expect.poll(() => patches.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(patches[0]).toBe('/restaurant/reservations/UPC1/status');
  expect(patches.some((p) => p.includes('TODAY1') || p.includes('undefined'))).toBe(false);
});
