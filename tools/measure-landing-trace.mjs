#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  L3 — «فریم‌های گم‌شده کجا می‌روند؟» — تایم‌لاینِ خودِ مرورگر، نه حدس
//
//  انتسابِ rAF نشان داد کلِ callbackهای rAF فقط ~۱۱٪ از زمان‌اند؛ پس ۳۰fps از
//  بیرونِ جاوااسکریپت می‌آید: Layout / Paint / Composite / Style. این ابزار یک
//  traceِ Chromium (دسته‌های devtools.timeline) در طولِ همان پروتکلِ اسکرول
//  می‌گیرد و مدتِ رویدادها را بر اساسِ نام جمع می‌زند — همان چیزی که پنلِ
//  Performance نشان می‌دهد، فقط قابلِ‌تکرار و بدونِ چشم.
//
//  ⚠️ trace خودش سربار دارد؛ عددهای مطلقش با اجرای بدونِ trace فرق می‌کند.
//  برای **سهمِ نسبی** (چند درصد Paint، چند درصد Layout) معتبر است، برای fps نه.
//  ⚠️ headless روی PC. exit 0؛ exit 2 محیط.
//  اجرا:  node tools/measure-landing-trace.mjs [url] [mobile|desktop]
// ═══════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = createRequire(path.join(ROOT, 'api', 'package.json'))('playwright')); }
catch (e) { console.error('ENV: playwright resolve نشد —', e.message); process.exit(2); }
const URL_ = process.argv[2] || 'http://localhost:3203/';
const VP = (process.argv[3] || 'mobile') === 'desktop'
  ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, locale: 'fa-IR' }
  : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR' };

const browser = await chromium.launch();
const ctx = await browser.newContext(VP);
const page = await ctx.newPage();
try { await page.goto(URL_, { waitUntil: 'networkidle', timeout: 180000 }); }
catch (e) { console.error(`ENV: ${URL_} جواب نداد —`, e.message); await browser.close(); process.exit(2); }
await page.waitForTimeout(1500);
const hyd = await page.evaluate(() => { const el = document.querySelector('main, header'); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber')); });
const docH = await page.evaluate(() => document.documentElement.scrollHeight);

const dir = mkdtempSync(path.join(os.tmpdir(), 'rz-trace-'));
const tracePath = path.join(dir, 'trace.json');
await browser.startTracing(page, { path: tracePath, screenshots: false, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing'] });
const t0 = Date.now();
const flicks = Math.ceil(docH / 250) + 2;
for (let k = 0; k < flicks; k++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(90); }
await page.waitForTimeout(300);
const wall = Date.now() - t0;
await browser.stopTracing();
await browser.close();

const raw = JSON.parse(readFileSync(tracePath, 'utf8'));
unlinkSync(tracePath);
const events = raw.traceEvents || raw;
// فقط رویدادهای کاملِ (X) نخِ اصلیِ رندرر؛ رویدادهای تو‌در‌تو را از کل کم نمی‌کنیم —
// این جمعِ «self+children» است، برای سهمِ نسبیِ دسته‌ها کافی است (مثلِ خودِ DevTools در حالتِ Bottom-Up نیست).
const byName = new Map();
let total = 0;
for (const e of events) {
  if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
  const n = e.name;
  if (!/^(Layout|UpdateLayoutTree|Paint|PaintImage|CompositeLayers|UpdateLayerTree|Rasterize|RasterTask|ImageDecodeTask|DecodeImage|FunctionCall|EvaluateScript|RunMicrotasks|TimerFire|EventDispatch|HitTest|ScrollLayer|Animation|PrePaint|Layerize|Commit|GPUTask|BeginMainThreadFrame|DrawFrame|ParseHTML|StyleRecalcInvalidationTracking|ScheduleStyleRecalculation|InvalidateLayout|ForcedLayout|MajorGC|MinorGC|UpdateCounters)$/.test(n)) continue;
  const ms = e.dur / 1000;
  byName.set(n, (byName.get(n) || 0) + ms);
  total += ms;
}
const rows = [...byName.entries()].sort((a, b) => b[1] - a[1]);
console.log(`هدف: ${URL_} · ${VP.viewport.width}px · hydrated=${hyd}${hyd ? '' : '  ⚠️ بدونِ hydration بی‌معنا'} · اسکرول ${wall}ms · رویدادها ${events.length}`);
console.log('\n   ms      %   رویداد');
for (const [n, ms] of rows.slice(0, 14)) console.log(`${String(ms.toFixed(0)).padStart(6)}  ${String((100 * ms / total).toFixed(0)).padStart(4)}%  ${n}`);
console.log(`\nجمعِ دسته‌های شمرده‌شده: ${total.toFixed(0)}ms (self+children؛ برای سهمِ نسبی)`);
// طولانی‌ترین رویدادهای تکیِ Layout/Paint — این‌ها فریم می‌کُشند
const worst = events.filter((e) => e.ph === 'X' && /^(Layout|Paint|UpdateLayoutTree|Rasterize|RasterTask)$/.test(e.name)).sort((a, b) => b.dur - a.dur).slice(0, 6)
  .map((e) => `${e.name} ${(e.dur / 1000).toFixed(1)}ms${e.args?.data?.dirtyObjects ? ' dirty=' + e.args.data.dirtyObjects : ''}${e.args?.beginData?.dirtyObjects ? ' dirty=' + e.args.beginData.dirtyObjects : ''}${e.args?.data?.clip ? ' clip=' + JSON.stringify(e.args.data.clip).slice(0, 40) : ''}`);
console.log('\nطولانی‌ترین‌ها:'); for (const w of worst) console.log('  ' + w);
console.log('\n⚠️ trace سربار دارد — سهمِ نسبی معتبر است، fps نه. headless روی PC.');
