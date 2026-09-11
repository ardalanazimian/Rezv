#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  L3 — فریم‌تایمِ لندینگ، **به تفکیکِ ناحیه‌ی صفحه**، تا کلِ ارتفاع
//
//  چرا این ابزارِ جدا لازم شد: `measure-scroll-frametime.mjs` (پروتکلِ اپِ
//  مشتری) فقط ۱۲ فلیکِ ۲۵۰px می‌زند = ۳۰۰۰px. لندینگ ۱۳٬۶۴۷px است؛ یعنی آن
//  پروتکل فقط ۲۲٪ بالای صفحه را می‌بیند و چهار بومِ rAF و بخشِ pin ممکن است
//  اصلاً واردِ دید نشوند. ۶۰fps روی آن پنجره درباره‌ی بقیه‌ی صفحه چیزی
//  نمی‌گوید — سبزِ توخالی.
//
//  این ابزار تا تهِ صفحه اسکرول می‌کند و فریم‌ها را در **سطل‌های scrollY**
//  می‌ریزد، به‌علاوه‌ی شمارشِ rAFهای غیر از خودش در هر سطل — تا معلوم شود
//  کدام ناحیه فریم می‌خورد و آیا بوم‌ها آن‌جا واقعاً می‌دوند یا خاموش‌اند.
//  بعد از هر عبور، به بالا برمی‌گردد و N بار تکرار می‌کند (§۴g: یک اجرا نویز است).
//
//  ⚠️ همان قید: Chromiumِ headless روی PC، wheel نه انگشت. فقط برای مقایسه‌ی
//  قبل/بعد و **مکان‌یابی** روی همان ماشین. اندازه‌گیری است نه گیت — exit 0،
//  مگر محیط خراب باشد (exit 2).
//  اجرا:  node tools/measure-landing-regions.mjs [N] [url] [bucketPx] [mobile|desktop]
// ═══════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = createRequire(path.join(ROOT, 'api', 'package.json'))('playwright')); }
catch (e) { console.error('ENV: playwright resolve نشد —', e.message); process.exit(2); }

const N = Number(process.argv[2] || 5);
// ⚠️ localhost، نه 127.0.0.1 — یافته‌ی ۲۰۲۶-۰۹-۱۱: محافظِ dev-originِ Next چانک‌های
// کلاینت را برای مبدأِ 127.0.0.1 با 403 رد می‌کند (HTML می‌آید، JS نه). صفحه hydrate
// نمی‌شود، هیچ useEffectی نمی‌دود، بوم‌ها ۳۰۰×۱۵۰ می‌مانند و rAFِ صفحه صفر است —
// و هر عددِ frame-time روی چنین صفحه‌ای **صفحه‌ی ایستا** را می‌سنجد نه محصول را.
// همین یک حرف ۶۰fpsِ من را در برابرِ ۳۳msِ DS-009 توضیح داد؛ کد یکی بود.
const URL_ = process.argv[3] || 'http://localhost:3201/';
const BUCKET = Number(process.argv[4] || 1000);
// ⚠️ viewport پارامتر است: بوم‌ها و pin روی دسکتاپ و موبایل رفتارِ متفاوت دارند
// (pointer:coarse بودجه‌ی ذرات را کم می‌کند، برخی افکت‌ها فقط با hover فعال‌اند).
// یک عددِ موبایل درباره‌ی دسکتاپ چیزی نمی‌گوید و برعکس.   mobile | desktop
const VP = (process.argv[5] || 'mobile') === 'desktop'
  ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, locale: 'fa-IR' }
  : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR' };
const FLICK = 250, GAP_MS = 90;

const browser = await chromium.launch();
const runs = [];
for (let i = 0; i < N; i++) {
  const ctx = await browser.newContext(VP);
  const page = await ctx.newPage();
  try { await page.goto(URL_, { waitUntil: 'networkidle', timeout: 120000 }); }
  catch (e) { console.error(`ENV: ${URL_} جواب نداد —`, e.message); await browser.close(); process.exit(2); }
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    // شمارشِ rAFهای «دیگران»: هر requestAnimationFrame که کدِ صفحه ثبت می‌کند
    // (نه حلقه‌ی خودِ سنجه) — نشانه‌ی این‌که بوم/pin در آن لحظه زنده است.
    window.__foreignRaf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => orig((t) => { if (!cb.__probe) window.__foreignRaf++; return cb(t); });
    window.__samples = [];   // {dt, y}
    window.__go = true;
    let last = performance.now();
    const loop = (t) => { if (!window.__go) return; window.__samples.push({ dt: t - last, y: scrollY, raf: window.__foreignRaf }); last = t; const f = loop; f.__probe = true; orig(f); };
    loop.__probe = true;
    orig(loop);
  });

  // ⚠️ بدونِ hydration هیچ useEffectی اجرا نمی‌شود: بوم‌ها ۳۰۰×۱۵۰ می‌مانند و rAF صفر —
  // و ۶۰fps یک صفحه‌ی ایستا سنجیده می‌شود نه صفحه‌ی واقعی. پس شاهدِ hydration ثبت می‌شود.
  const hyd = await page.evaluate(() => ({
    fiber: !!document.querySelector('canvas, main, header') && Object.keys(document.querySelector('canvas, main, header')).some((k) => k.startsWith('__reactFiber')),
    canvasesSized: [...document.querySelectorAll('canvas')].filter((c) => !(c.width === 300 && c.height === 150)).length,
    canvases: document.querySelectorAll('canvas').length,
  }));
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  const flicks = Math.ceil(docH / FLICK) + 2;
  for (let k = 0; k < flicks; k++) { await page.mouse.wheel(0, FLICK); await page.waitForTimeout(GAP_MS); }
  await page.waitForTimeout(300);

  const r = await page.evaluate((BUCKET) => {
    window.__go = false;
    const s = window.__samples.slice(5);
    const buckets = new Map();
    let prevRaf = s.length ? s[0].raf : 0;
    for (const x of s) {
      const b = Math.floor(x.y / BUCKET) * BUCKET;
      const o = buckets.get(b) || { dts: [], raf: 0 };
      o.dts.push(x.dt); o.raf += Math.max(0, x.raf - prevRaf); prevRaf = x.raf;
      buckets.set(b, o);
    }
    const q = (a, p) => { const c = [...a].sort((u, v) => u - v); return c.length ? +c[Math.floor(c.length * p)].toFixed(1) : null; };
    const all = s.map((x) => x.dt);
    const rows = [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([y, o]) => ({
      y, frames: o.dts.length, p50: q(o.dts, .5), p95: q(o.dts, .95), max: q(o.dts, 1 - 1e-9) ?? +Math.max(...o.dts).toFixed(1),
      over33: o.dts.filter((d) => d > 33).length, foreignRaf: o.raf,
    }));
    return { docH: document.documentElement.scrollHeight, reached: scrollY, frames: all.length,
      p50: q(all, .5), p95: q(all, .95), max: +Math.max(...all).toFixed(1), over33: all.filter((d) => d > 33).length, rows };
  }, BUCKET);
  runs.push({ ...r, hyd });
  await ctx.close();
}
await browser.close();

const med = (a) => { const c = [...a].sort((x, y) => x - y); return c[Math.floor(c.length / 2)]; };
console.log(`هدف: ${URL_} · N=${N} · سطل ${BUCKET}px · ارتفاعِ سند ${runs[0].docH}px · رسید تا ${med(runs.map((r) => r.reached))}px`);
console.log(`hydration: fiber=${runs.every((r) => r.hyd.fiber)} · بوم‌های سایزشده ${med(runs.map((r) => r.hyd.canvasesSized))}/${runs[0].hyd.canvases}`
  + (runs.every((r) => r.hyd.fiber) ? '' : '   ⚠️ صفحه hydrate نشده — این عدد صفحه‌ی ایستا را می‌سنجد، نه صفحه‌ی واقعی'));
console.log('run  frames  p50   p95   max   >33');
runs.forEach((r, i) => console.log(`${String(i + 1).padStart(3)}  ${String(r.frames).padStart(6)}  ${String(r.p50).padStart(4)}  ${String(r.p95).padStart(4)}  ${String(r.max).padStart(5)}  ${String(r.over33).padStart(3)}`));
console.log(`median over ${N}: p50 ${med(runs.map((r) => r.p50))} · p95 ${med(runs.map((r) => r.p95))} · max ${med(runs.map((r) => r.max))} · >33ms ${med(runs.map((r) => r.over33))}`);

// ناحیه‌ها: میانه‌ی هر سطل روی N اجرا
const keys = [...new Set(runs.flatMap((r) => r.rows.map((x) => x.y)))].sort((a, b) => a - b);
console.log('\nناحیه(px)   frames  p50    p95    max   >33  rAF-صفحه   ← میانه روی N');
for (const y of keys) {
  const rows = runs.map((r) => r.rows.find((x) => x.y === y)).filter(Boolean);
  if (!rows.length) continue;
  const m = (k) => med(rows.map((x) => x[k]));
  console.log(`${String(y).padStart(6)}-${String(y + BUCKET).padEnd(6)} ${String(m('frames')).padStart(5)}  ${String(m('p50')).padStart(5)}  ${String(m('p95')).padStart(5)}  ${String(m('max')).padStart(5)}  ${String(m('over33')).padStart(3)}   ${String(m('foreignRaf')).padStart(6)}`);
}
console.log('\n⚠️ headless روی PC — برای مکان‌یابی و مقایسه‌ی قبل/بعد با همان پروتکل. یک اجرا نویز است.');
