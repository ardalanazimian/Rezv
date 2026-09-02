import { test, expect, type Page } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════
//  کنتراستِ چیپِ روندِ KPI — راستی‌آزماییِ `kpi-trend-pill-contrast`
//
//  یکی از هشت یافته‌ی a11yِ «راستی‌آزمایی‌نشده»ی OPEN-FINDINGS §۴.
//
//  ⚠️ چرا ممیزیِ کنتراستِ موجود (`panel-authed-audit.spec.ts`) نگرفته بود:
//  آن ممیزی فقط چیزی را می‌سنجد که در همان لحظه **رندر شده** است، و با
//  دادهٔ mockِ خالی هیچ‌وقت چیپِ `.down` (روندِ نزولی) ساخته نمی‌شود. یعنی
//  «سبز»ِ آن ممیزی درباره‌ی این حالت هیچ نمی‌گفت.
//
//  اینجا هر چهار واریانت عمداً در DOMِ **پنلِ واقعیِ واردشده** تزریق می‌شوند
//  تا کلِ cascade (توکن‌ها، ارث‌بری، زمینه‌ی واقعی) اعمال شود — نه حسابِ دستی
//  روی مقادیرِ خامِ CSS، که می‌تواند با آنچه مرورگر واقعاً محاسبه می‌کند فرق
//  داشته باشد.
//
//  آستانه ۴٫۵ است نه ۳: متنِ چیپ `font-size:11px;font-weight:700` است و
//  «درشت» در WCAG یعنی ≥۱۸٫۶۶px (یا ≥۱۴pt bold ≈ ۱۸٫۶۶px) — ۱۱px bold
//  درشت حساب نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

const BIZ = 'http://localhost:8081/';
const VARIANTS = ['', 'up', 'down', 'est'];

async function login(page: Page) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/v1/, '');
    const json = (b: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (path === '/auth/staff/login') {
      return json({ staff: { role: 'owner', restaurant_name: '[DEMO] ویستا', permissions: {} },
        access: 'demo-access-token', refresh: 'demo-refresh-token' });
    }
    return json({ data: [], items: [], total: 0 });
  });
  await page.goto(BIZ);
  await page.locator('#staffUser').waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('#staffUser').fill('ardalan');
  await page.locator('#staffPass').fill('secret');
  await page.locator('#staffLoginBtn').click();
  await expect(page.locator('#loginOverlay')).toHaveClass(/hidden/, { timeout: 15_000 });
}

/** کنتراستِ محاسبه‌شده‌ی هر واریانت، از رویِ getComputedStyle در مرورگرِ واقعی. */
async function measure(page: Page, variants: string[]) {
  return page.evaluate((vs) => {
    const srgb = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const lum = (a: number[]) => 0.2126 * srgb(a[0]) + 0.7152 * srgb(a[1]) + 0.0722 * srgb(a[2]);
    const P = (s: string) => { const m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
    const over = (f: number[], b: number[]) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;top:0;left:0;z-index:99999';
    document.body.appendChild(host);
    const out: Array<{ v: string; ratio: number; fg: string; bg: string }> = [];
    for (const v of vs) {
      const el = document.createElement('span');
      el.className = 'kpi-trend' + (v ? ' ' + v : '');
      el.textContent = '↓ ۱۲٪';
      host.appendChild(el);
      const st = getComputedStyle(el);
      const fg = P(st.color);
      let bgRaw = P(st.backgroundColor);
      // اگر خودِ چیپ زمینه‌ی شفاف داشت، به بالادست برو تا زمینه‌ی واقعی پیدا شود.
      let node: HTMLElement | null = el.parentElement;
      let bg: number[] = bgRaw && bgRaw[3] > 0 ? bgRaw.slice(0, 3) : [255, 255, 255];
      if (!(bgRaw && bgRaw[3] > 0)) {
        while (node) {
          const p = P(getComputedStyle(node).backgroundColor);
          if (p && p[3] > 0) { bg = p.slice(0, 3); break; }
          node = node.parentElement;
        }
      }
      const f = fg ? (fg[3] < 1 ? over(fg, bg) : fg.slice(0, 3)) : [0, 0, 0];
      const a = lum(f), b = lum(bg);
      const hi = Math.max(a, b), lo = Math.min(a, b);
      out.push({ v: v || '(پایه)', ratio: +(((hi + 0.05) / (lo + 0.05)).toFixed(2)), fg: st.color, bg: st.backgroundColor });
      el.remove();
    }
    host.remove();
    return out;
  }, variants);
}

test('چیپِ روندِ KPI در هر چهار واریانت کنتراستِ AA دارد', async ({ page }) => {
  await login(page);
  const res = await measure(page, VARIANTS);

  // کنترلِ مثبتِ روش: اگر تزریق یا اندازه‌گیری کار نکند، آرایه خالی/صفر می‌شود
  // و تست بی‌معنا سبز می‌ماند.
  expect(res.length, 'هیچ واریانتی اندازه‌گیری نشد').toBe(VARIANTS.length);
  for (const r of res) expect(r.ratio, `کنتراستِ ${r.v} صفر/نامعتبر است`).toBeGreaterThan(1);

  const bad = res.filter((r) => r.ratio < 4.5);
  expect(bad, 'واریانت‌هایِ زیرِ AA:\n' +
    res.map((r) => `  ${r.v}: ${r.ratio} (${r.fg} روی ${r.bg})`).join('\n')).toEqual([]);
});
