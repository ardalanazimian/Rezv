#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  L3 — «کدام حلقه فریم را می‌خورد؟» — انتسابِ زمانِ هر callbackِ rAF
//
//  چرا انتساب و نه دودویی‌کردن با حذفِ کامپوننت: اندازه‌گیریِ ناحیه‌ای نشان
//  داد صفحه در **همه‌ی** نواحی ~۳۰fps است، حتی جایی که هیچ بومی در دید نیست، و
//  در هر سطل ۶۶–۱۴۸ rAFِ صفحه ثبت می‌شود — حلقه‌ها همیشه می‌دوند و فقط رسم را
//  با IntersectionObserver قطع می‌کنند. پس هزینه سراسری است و «کدام بخش» سؤالِ
//  درستی نیست؛ «کدام callback» هست. این ابزار هر callbackِ rAF صفحه را زمان
//  می‌گیرد و بر اساسِ متنِ تابع (اثرانگشتِ ۹۰ کاراکتری) جمع می‌زند.
//
//  ⚠️ محدودیت‌ها، صریح: (۱) فقط کارِ داخلِ rAF را می‌بیند — listenerهای scroll،
//  layout/paintِ مرورگر و کارِ compositor بیرون از این‌اند؛ اگر جمعِ callbackها
//  خیلی کمتر از فریم‌های گم‌شده بود، مقصر بیرونِ rAF است و همین هم یافته است.
//  (۲) dev-mode است مگر URL به build اشاره کند. (۳) headless روی PC.
//  اجرا:  node tools/measure-landing-raf-attrib.mjs [url] [mobile|desktop]
// ═══════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = createRequire(path.join(ROOT, 'api', 'package.json'))('playwright')); }
catch (e) { console.error('ENV: playwright resolve نشد —', e.message); process.exit(2); }
const URL_ = process.argv[2] || 'http://localhost:3201/';
const VP = (process.argv[3] || 'mobile') === 'desktop'
  ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, locale: 'fa-IR' }
  : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR' };

const browser = await chromium.launch();
const ctx = await browser.newContext(VP);
const page = await ctx.newPage();
// ⚠️ قلاب باید **پیش از** اسکریپت‌های صفحه نصب شود، وگرنه حلقه‌هایی که مرجعِ
// اصلی را نگه داشته‌اند از دید می‌افتند (init script = قبل از هر چیز).
await page.addInitScript(() => {
  const orig = window.requestAnimationFrame.bind(window);
  const stats = new Map();   // fp -> {ms, calls, max}
  window.__rafStats = stats;
  window.__rafTotalMs = 0;
  window.__frames = 0;
  window.requestAnimationFrame = (cb) => orig((t) => {
    const src = String(cb);
    const fp = src.replace(/\s+/g, ' ').slice(0, 90);
    const t0 = performance.now();
    try { return cb(t); } finally {
      const d = performance.now() - t0;
      const s = stats.get(fp) || { ms: 0, calls: 0, max: 0 };
      s.ms += d; s.calls++; if (d > s.max) s.max = d; stats.set(fp, s);
      window.__rafTotalMs += d;
    }
  });
  // شمارشِ فریم‌ها با یک حلقه‌ی سبکِ خودی (بدونِ ثبت در stats)
  const tick = () => { window.__frames++; orig(tick); };
  orig(tick);
  // longtaskها هم — کارِ بیرونِ rAF را نشان می‌دهند
  window.__longTasks = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longTasks.push(+e.duration.toFixed(0)); }).observe({ type: 'longtask', buffered: true }); } catch {}
});
try { await page.goto(URL_, { waitUntil: 'networkidle', timeout: 180000 }); }
catch (e) { console.error(`ENV: ${URL_} جواب نداد —`, e.message); await browser.close(); process.exit(2); }
await page.waitForTimeout(1500);
const hyd = await page.evaluate(() => { const el = document.querySelector('main, header'); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber')); });
// صفر کردنِ شمارنده‌ها پس از بارگذاری، تا فقط دوره‌ی اسکرول شمرده شود
await page.evaluate(() => { window.__rafStats.clear(); window.__rafTotalMs = 0; window.__frames = 0; window.__longTasks.length = 0; window.__tStart = performance.now(); });
const docH = await page.evaluate(() => document.documentElement.scrollHeight);
const flicks = Math.ceil(docH / 250) + 2;
for (let k = 0; k < flicks; k++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(90); }
await page.waitForTimeout(300);
const r = await page.evaluate(() => {
  const wall = performance.now() - window.__tStart;
  const rows = [...window.__rafStats.entries()].map(([fp, s]) => ({ fp, ms: +s.ms.toFixed(0), calls: s.calls, avg: +(s.ms / s.calls).toFixed(2), max: +s.max.toFixed(1) })).sort((a, b) => b.ms - a.ms);
  const lt = window.__longTasks;
  return { wall: +wall.toFixed(0), frames: window.__frames, rafTotalMs: +window.__rafTotalMs.toFixed(0), rows, longTasks: lt.length, longTaskMs: lt.reduce((a, b) => a + b, 0) };
});
await browser.close();
const fpsAvg = (r.frames / (r.wall / 1000)).toFixed(1);
console.log(`هدف: ${URL_} · ${VP.viewport.width}px · hydrated=${hyd}${hyd ? '' : '  ⚠️ بدونِ hydration این انتساب بی‌معناست'}`);
console.log(`دوره‌ی اسکرول: ${r.wall}ms · ${r.frames} فریم (~${fpsAvg} fps) · جمعِ کارِ rAF ${r.rafTotalMs}ms (${(100 * r.rafTotalMs / r.wall).toFixed(0)}٪ از زمان) · longtask: ${r.longTasks} عدد / ${r.longTaskMs}ms`);
console.log('\n   ms   calls   avg/call   max   callback (اثرانگشت)');
for (const x of r.rows.slice(0, 10)) console.log(`${String(x.ms).padStart(5)}  ${String(x.calls).padStart(5)}   ${String(x.avg).padStart(7)}  ${String(x.max).padStart(5)}   ${x.fp}`);
const top = r.rows[0];
if (top) console.log(`\nسهمِ اولی از کلِ کارِ rAF: ${(100 * top.ms / Math.max(1, r.rafTotalMs)).toFixed(0)}٪ · سهمِ کلِ rAF از زمانِ دیواری: ${(100 * r.rafTotalMs / r.wall).toFixed(0)}٪`);
console.log('⚠️ اگر سهمِ rAF از زمانِ دیواری کوچک است، فریم‌های گم‌شده از بیرونِ rAF می‌آیند (layout/paint/scroll listener) — این ابزار آن‌ها را نمی‌بیند.');
