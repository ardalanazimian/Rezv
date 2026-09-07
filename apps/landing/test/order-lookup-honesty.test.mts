// ═══════════════════════════════════════════════════════════════════════
//  «سرور جواب نداد» ≠ «سفارشت وجود ندارد»  (پروتکل §۱۰)
//
//  یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۵: `getOrderStatus` در هر شکستی `null` می‌داد و
//  صفحه‌ی /order/[code] روی همان `null` می‌نوشت «درخواستی با این کد پیدا نشد
//  — کد را دوباره بررسی کنید». یعنی وقتی API در دسترس نبود، به کسی که واقعاً
//  خرید کرده گفته می‌شد سفارشش ثبت نشده. بدترین پیام، در بدترین لحظه.
//
//  ⚠️ این یک حالتِ نظری نیست: بیلدِ CI عمداً بدونِ SITE_API_BASE اجرا می‌شود
//  («حالتِ امن»)، پس «پیکربندی‌نشده» یک وضعیتِ استقرارِ واقعی است.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.SITE_API_BASE = 'http://api.test';
const { getOrderStatus } = await import('../lib/site-api.ts');

const realFetch = globalThis.fetch;
function stubStatus(status: number, body: unknown = {}) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;
}
function restore() { globalThis.fetch = realFetch; }

describe('پیگیریِ سفارش — سه حالتِ متفاوت قاطی نمی‌شوند', () => {
  test('۴۰۴ِ بالادست → not_found (تنها حالتی که حق داریم بگوییم «نیست»)', async () => {
    stubStatus(404);
    assert.equal((await getOrderStatus('RZO-AB12CD')).kind, 'not_found');
    restore();
  });

  test('۵۰۰ِ بالادست → unavailable، نه not_found', async () => {
    stubStatus(500);
    assert.equal((await getOrderStatus('RZO-AB12CD')).kind, 'unavailable');
    restore();
  });

  test('۵۰۳ (نگهداری) → unavailable', async () => {
    stubStatus(503);
    assert.equal((await getOrderStatus('RZO-AB12CD')).kind, 'unavailable');
    restore();
  });

  test('قطعیِ شبکه → unavailable', async () => {
    globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
    assert.equal((await getOrderStatus('RZO-AB12CD')).kind, 'unavailable');
    restore();
  });

  test('بدنه‌ی خرابِ غیر-JSON → unavailable، نه not_found', async () => {
    globalThis.fetch = (async () =>
      new Response('<html>گیت‌وی</html>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
    assert.equal((await getOrderStatus('RZO-AB12CD')).kind, 'unavailable');
    restore();
  });

  test('۲۰۰ِ سالم → found و خودِ سفارش برمی‌گردد', async () => {
    stubStatus(200, { code: 'RZO-AB12CD', status: 'pending', kind: 'purchase', business_name: 'ک', created_at: '2026-08-25T00:00:00Z' });
    const r = await getOrderStatus('RZO-AB12CD');
    assert.equal(r.kind, 'found');
    if (r.kind === 'found') assert.equal(r.order.code, 'RZO-AB12CD');
    restore();
  });
});

describe('پیکربندیِ غایب (حالتِ امنِ CI) صادقانه اعلام می‌شود', () => {
  test('SITE_API_BASE تنظیم‌نشده → unavailable، نه not_found', async () => {
    // ⚠️ بازنویسیِ ۲۰۲۶-۰۹-۰۷ — این تست از مسیرِ غلط سبز می‌شد.
    //
    // `getOrderStatus` **سه** مسیر دارد که همگی همان شیء را می‌دهند:
    //   `if (!base)` (پیکربندی نشده — موضوعِ تست) · `catch` (شبکه/DNS) ·
    //   `if (!res.ok)` (۵xx). پس assert روی `.kind === 'unavailable'` هیچ‌کدام
    //   را از دیگری تفکیک نمی‌کند و برخلافِ seo هیچ **پیامی** هم برای assert
    //   وجود ندارد.
    //
    // قبلاً با `import('../lib/site-api.ts?nobase')` نمونه‌ی تازه می‌خواست؛ روی
    // Node 20 آن کش‌شکن کار نمی‌کند، پس base منجمد می‌ماند، fetch به
    // `http://api.test` می‌خورد، `catch` می‌گیردش و همان `unavailable` را
    // می‌دهد ⇒ سبز، بی‌آنکه موضوعِ تست هرگز حاضر باشد.
    //
    // تنها شاهدِ قابلِ تفکیک این است که **هیچ fetchی تلاش نشده باشد**. حالا
    // `serverBase()` تنبل است پس کش‌شکن لازم نیست، و اگر روزی دوباره منجمد شود
    // این تست می‌افتد به‌جای آنکه بی‌صدا رد شود.
    const prev = process.env.SITE_API_BASE;
    const prevSeo = process.env.SEO_API_BASE;
    const prevFetch = globalThis.fetch;
    let fetchAttempted = false;
    globalThis.fetch = (() => { fetchAttempted = true; throw new Error('نباید در حالتِ پیکربندی‌نشده fetch شود'); }) as typeof fetch;
    try {
      process.env.SITE_API_BASE = '';
      process.env.SEO_API_BASE = '';
      assert.equal((await getOrderStatus('RZO-AB12CD')).kind, 'unavailable');
      assert.equal(fetchAttempted, false, 'باید از مسیرِ «پیکربندی نشده» رد شود، نه از catchِ شبکه');
    } finally {
      globalThis.fetch = prevFetch;
      // `process.env.X = undefined` رشته‌ی "undefined" می‌گذارد، نه پاک می‌کند.
      if (prev === undefined) delete process.env.SITE_API_BASE; else process.env.SITE_API_BASE = prev;
      if (prevSeo === undefined) delete process.env.SEO_API_BASE; else process.env.SEO_API_BASE = prevSeo;
    }
  });
});
