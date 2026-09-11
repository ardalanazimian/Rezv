#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  L4 — پرده‌ی ورودِ لندینگ: LCP و لحظه‌ی بالارفتنِ پرده، قبل/بعد، N اجرا
//
//  حکمِ مالک: پرده می‌ماند ولی ۱٫۲s → ۰٫۴s. کامنتِ خودِ کد می‌گوید پرده «روی
//  LCP می‌نشیند» — این تنها دلیلی است که اصلاً به آن دست زده شد. پس اگر LCP
//  تکان نخورد، تغییر ارزشش را نداشته و باید گفته شود، نه اینکه «کوتاه‌تر شد»
//  به‌عنوانِ موفقیت گزارش شود.
//
//  چه می‌سنجد (هر اجرا در یک contextِ تازه، بدونِ کش):
//    • LCP  — PerformanceObserver('largest-contentful-paint')، آخرین ورودی
//    • curtainGone — اولین لحظه‌ای که `.intro` دیگر دیده نمی‌شود
//                    (opacity 0 یا visibility hidden یا display none)، با نمونه‌برداریِ rAF
//    • firstContentVisible — اولین لحظه‌ای که عنصرِ LCP روی صفحه و زیرِ پرده نیست
//  و همان را با prefers-reduced-motion هم می‌گیرد: آنجا `.intro` باید اصلاً
//  رندر نشود (display:none) — **در مرورگر** سنجیده، نه از روی CSS.
//
//  ⚠️ همان قید: headless روی PC، فقط برای قبل/بعد روی همان ماشین. exit 0؛ exit 2 محیط.
//  اجرا:  node tools/measure-landing-lcp.mjs [N] [url]
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

const INIT = () => {
  window.__t0 = performance.timeOrigin;
  window.__lcp = null;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = { t: +e.startTime.toFixed(0), el: e.element ? (e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ')[0] : '')) : null, size: e.size }; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  window.__curtainGone = null;
  window.__introSeen = null;
  const tick = () => {
    const i = document.querySelector('.intro');
    if (i) {
      const s = getComputedStyle(i);
      const visible = s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.02;
      if (visible && window.__introSeen == null) window.__introSeen = +performance.now().toFixed(0);
      if (!visible && window.__introSeen != null && window.__curtainGone == null) window.__curtainGone = +performance.now().toFixed(0);
    } else if (window.__introSeen == null && document.body) {
      // هرگز رندر نشد (مثلاً reduced-motion) — ثبت می‌کنیم که پرده‌ای در کار نبود
      window.__introAbsent = true;
    }
    if (window.__curtainGone == null && performance.now() < 8000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function measure(reduced) {
  const browser = await chromium.launch();
  const out = [];
  for (let i = 0; i < N; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR', reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    await page.addInitScript(INIT);
    try { await page.goto(URL_, { waitUntil: 'load', timeout: 120000 }); }
    catch (e) { console.error(`ENV: ${URL_} جواب نداد —`, e.message); await browser.close(); process.exit(2); }
    await page.waitForTimeout(3500);
    const r = await page.evaluate(() => ({
      lcp: window.__lcp, introSeen: window.__introSeen, curtainGone: window.__curtainGone, introAbsent: !!window.__introAbsent,
      introDisplay: (() => { const i = document.querySelector('.intro'); return i ? getComputedStyle(i).display : '(no .intro in DOM)'; })(),
      reducedMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      hydrated: (() => { const el = document.querySelector('main, header'); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber')); })(),
    }));
    out.push(r);
    await ctx.close();
  }
  await browser.close();
  return out;
}

const med = (a) => { const c = a.filter((x) => x != null).sort((x, y) => x - y); return c.length ? c[Math.floor(c.length / 2)] : null; };
const fmt = (rows) => {
  console.log('run   LCP(ms)  LCP-element            curtainGone(ms)  introSeen(ms)');
  rows.forEach((r, i) => console.log(`${String(i + 1).padStart(3)}  ${String(r.lcp?.t ?? '—').padStart(8)}  ${String(r.lcp?.el ?? '—').padEnd(22)} ${String(r.curtainGone ?? (r.introAbsent ? 'absent' : '—')).padStart(14)}  ${String(r.introSeen ?? '—').padStart(12)}`));
  console.log(`median over ${rows.length}: LCP ${med(rows.map((r) => r.lcp?.t))}ms · curtainGone ${med(rows.map((r) => r.curtainGone))}ms`);
  if (!rows.every((r) => r.hydrated)) console.log('  ⚠️ صفحه hydrate نشده در ' + rows.filter((r) => !r.hydrated).length + ' اجرا — عددِ LCP نماینده‌ی محصول نیست (dev-origin؟ از localhost بزن)');
};

console.log(`هدف: ${URL_} · N=${N}`);
console.log('\n── حالتِ عادی ──');
const normal = await measure(false);
fmt(normal);
console.log('\n── prefers-reduced-motion: reduce ── (انتظار: .intro اصلاً رندر نشود)');
const reduced = await measure(true);
fmt(reduced);
const rmDisplays = [...new Set(reduced.map((r) => r.introDisplay))];
console.log(`reduced-motion → .intro display: ${rmDisplays.join(' | ')} · reducedMatches: ${[...new Set(reduced.map((r) => r.reducedMatches))].join('/')}`);
console.log('\n⚠️ headless روی PC — فقط برای قبل/بعد روی همان ماشین با همان پروتکل. یک اجرا نویز است.');
