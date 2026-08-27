#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ رگرسیونِ escape در مسیرهایِ رندرِ اپِ مشتری
//
//  ⚠️ چرا این فایل وجود دارد (باگِ واقعی، ۲۰۲۶-۰۸-۲۵، با اجرا اثبات شد):
//  `cardHTML` در `apps/customer/js/data/discover.js` فیلدِ `cuisine` را
//  بدونِ `esc` مستقیم داخلِ `innerHTML` می‌گذاشت. آن فیلد را **صاحبِ
//  رستوران** از پنلِ خودش می‌نویسد (route `restaurant/branches`، فقط
//  `z.string().max(50)` و هیچ پاک‌سازیِ HTML) و از APIِ عمومیِ
//  `/v1/restaurants` به فیدِ **همه‌ی** مشتری‌ها می‌رسد. یعنی یک XSSِ
//  ذخیره‌شده‌ی «یک رستوران ← هر بازدیدکننده». ۵۰ کاراکتر برای
//  `<img src=x onerror=…>` (۲۸ کاراکتر) کافی است.
//
//  چرا `tools/xss-sink-audit.mjs` کافی نبود: آن یک اسکنِ regex است و
//  «این تمپلیت درون‌یابی دارد» را گزارش می‌کند، نه «این مقدار escape
//  نشده». برای همین ۶۳ موردِ `unsafe` دارد که بیشترشان اسکلتِ استاتیک‌اند
//  و موردِ واقعی بینشان گم بود. این فایل برعکس است: کم‌تعداد ولی
//  **اجرایی** — تابعِ واقعی را با یک بارِ حمله صدا می‌زند و به خروجی نگاه
//  می‌کند. یعنی صفرِ false positive.
//
//  اجرا: node tools/xss-escaping-regression.mjs      (از ریشه‌ی مخزن)
// ═══════════════════════════════════════════════════════════════════════
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── شیمِ حداقلیِ DOM ──
// اپِ مشتری ES Module است و ماژول‌هایش در زمانِ import به `document`/`window`
// دست می‌زنند. این شیم فقط آن‌قدری است که ماژول بار شود؛ هیچ رفتاری را
// شبیه‌سازی نمی‌کند و نباید بکند.
const noop = () => {};
const stubEl = new Proxy({}, { get: (_t, k) => {
  if (k === 'style') return {};
  if (k === 'classList') return { add: noop, remove: noop, contains: () => false, toggle: noop };
  if (k === 'querySelectorAll' || k === 'getElementsByTagName') return () => [];
  if (k === 'addEventListener' || k === 'appendChild' || k === 'setAttribute') return noop;
  if (k === 'textContent' || k === 'innerHTML' || k === 'value') return '';
  if (k === 'dataset') return {};
  if (k === 'getAttribute') return () => null;
  if (k === 'setProperty' || k === 'focus' || k === 'blur' || k === 'remove') return noop;
  return undefined;
} });

globalThis.document = {
  getElementById: () => stubEl, querySelector: () => stubEl, querySelectorAll: () => [],
  createElement: () => stubEl, addEventListener: noop, body: stubEl,
  documentElement: stubEl, head: stubEl, cookie: '',
};
globalThis.addEventListener = noop;
globalThis.removeEventListener = noop;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'node', language: 'fa-IR' }, configurable: true,
});
globalThis.location = { protocol: 'https:', href: 'https://x/', hostname: 'x', search: '' };
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.requestAnimationFrame = noop;
globalThis.fetch = async () => ({ ok: false, status: 0, json: async () => ({}) });

// ── بارهای حمله ──
// هرکدام یک شکلِ متفاوت از فرار: تگِ کامل، بستنِ attribute، و بستنِ رشته‌ی JS.
const PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '"><script>alert(1)</script>',
  "');alert(1);//",
];

const discover = await import(join(ROOT, 'apps/customer/js/data/discover.js'));

/** رستورانِ آزمایشی که **همه‌ی** فیلدهای رشته‌ایِ قابلِ‌نمایشش بارِ حمله دارند. */
function poisoned(payload) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'x', n: payload, e: payload, cuisine: payload, price: payload,
    cb: 5, rt: 4.5, visits7d: 3, tags: [payload], vibes: [payload],
    slots: [payload],
  };
}

const CASES = [
  { name: 'cardHTML (کارتِ فید)', run: (p) => discover.cardHTML(poisoned(p)) },
  { name: 'slotsHTML (چیپ‌هایِ ساعت)', run: (p) => discover.slotsHTML(poisoned(p)) },
];

let failures = 0;
for (const c of CASES) {
  for (const payload of PAYLOADS) {
    let html;
    try {
      html = c.run(payload);
    } catch (e) {
      console.error(`✗ ${c.name} با بارِ ${JSON.stringify(payload)} استثنا داد: ${e.message}`);
      failures++;
      continue;
    }
    if (html.includes(payload)) {
      console.error(`✗ ${c.name}: بارِ ${JSON.stringify(payload)} **خام** در خروجی است — escape نشده`);
      failures++;
    } else {
      console.log(`✓ ${c.name} · ${JSON.stringify(payload)}`);
    }
  }
}

if (failures > 0) {
  console.error(`\n✗ ${failures} مسیرِ رندر مقدارِ کنترل‌شده‌ی کاربر را بدونِ escape بیرون می‌دهد.`);
  console.error('  هر مقداری که از API یا ورودیِ کاربر می‌آید باید از `esc()` رد شود.');
  process.exit(1);
}
console.log(`\n✓ هر ${CASES.length * PAYLOADS.length} ترکیب escape شد.`);
// ⚠️ خروجِ صریح لازم است: `init.js` یک `setTimeout(boot)` ثبت می‌کند که بعد از
// پایانِ منطقِ ما در محیطِ بدونِ DOM می‌شکند و کدِ خروجِ ۱ می‌دهد — یعنی گاردِ
// سبز، CIِ قرمز. بدونِ این خط، خودِ این فایل یک false positive بود.
process.exit(0);
