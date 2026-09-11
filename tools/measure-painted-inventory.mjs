#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  موجودیِ نقاشی‌شده: چند اندازه/وزن/رنگ/شعاع/سایه واقعاً روی صفحه رندر می‌شود —
//  نه چند تا در CSS نوشته شده.                                   (DS-010 §۱)
//
//  چرا جدا از شمارشِ CSS: «existing ≠ visible» (منشور §۴h). ۳۸ مقدارِ font-size در
//  app.css و ۱۳ تای نقاشی‌شده دو عددِ متفاوت با دو معنای متفاوت‌اند؛ سقف‌های §۲ی
//  DS-010 روی عددِ نقاشی‌شده تعریف شده‌اند (۶ اندازه، ۳ رنگِ متن، ۴ شعاع، …).
//
//  روش: ۳۹۰×۸۴۴ @2x، locale fa-IR، آنبوردینگ (اگر #onb هست) رد می‌شود، بعد برای
//  هر عنصرِ **قابلِ دیدن** (ابعاد > 0 و top < 3000px، یعنی حدودِ ۳٫۵ صفحه‌ی اول)
//  درونِ scope، getComputedStyle خوانده می‌شود. اندازه/وزن/رنگِ متن فقط برای
//  عنصرهایی که خودشان گره‌ی متنی دارند — وگرنه هر div ِ بی‌متن یک «اندازه‌ی فونت»
//  می‌شمرد. ارقام گرد می‌شوند (13.6px و 14px یکی نیستند ولی 13.99 و 14 هستند).
//
//  ⚠️ این اندازه‌گیریِ همان‌ماشین/همان‌پروتکل است: عدد فقط برای مقایسه‌ی قبل/بعد
//  معتبر است. اندازه‌گیری است، نه گیت: exit 0 = سنجیده شد؛ exit 2 = محیط (URL باز
//  نشد، Playwright نبود) — «سنجیده نشد» با «سنجیده شد و خوب بود» یکی نیست.
//  ⚠️ standalone/*.html تولیدی است — اگر apps/ را عوض کرده‌ای، اول
//  `python tools/build-standalone.py`.
//
//  اجرا:  node tools/measure-painted-inventory.mjs [url] [scope-selector]
//         node tools/measure-painted-inventory.mjs                       # اپِ مشتری، صفحه‌ی خانه
//         node tools/measure-painted-inventory.mjs http://localhost:3200/ 'main *, header *, nav *'   # لندینگ (سرورِ خودت)
// ═══════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadChromium() {
  // CI: e2e/ دارد @playwright/test؛ محلی: api/ دارد playwright. هر کدام بود.
  for (const [pkg, mod] of [['e2e', '@playwright/test'], ['api', 'playwright']]) {
    const p = path.join(ROOT, pkg, 'package.json');
    if (!existsSync(p)) continue;
    try { return createRequire(p)(mod).chromium; } catch { /* بعدی */ }
  }
  console.error('✗ محیط: Playwright پیدا نشد (نه e2e/@playwright/test، نه api/playwright). هیچ عددی سنجیده نشد.');
  process.exit(2);
}
const chromium = loadChromium();
const URL = process.argv[2] || pathToFileURL(path.join(ROOT, 'standalone', 'customer.html')).href;
const SCOPE = process.argv[3] || '#page-discover *, .nav *, .botnav *';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR' });
const page = await ctx.newPage();
try { await page.goto(URL, { waitUntil: 'load' }); }
catch (e) { console.error(`✗ محیط: ${URL} باز نشد — ${String(e.message).split('\n')[0]}\n  هیچ عددی سنجیده نشد. (سرور بالاست؟ لندینگ را خودت باید بالا بیاوری.)`); await browser.close(); process.exit(2); }
await page.waitForTimeout(1200);
await page.evaluate(() => { const o = document.getElementById('onb'); if (!o) return; const b = [...o.querySelectorAll('button')].find((x) => /رد/.test(x.textContent)); b ? b.click() : o.remove(); });
await page.waitForTimeout(600);

// شاهدِ hydration (۰۹-۱۱، یافته‌ی LE): با 127.0.0.1 محافظِ dev-originِ Next چانک‌های کلاینت را 403
// می‌دهد — HTML می‌آید، JS نه؛ صفحه‌ی ایستا «سالم» به نظر می‌رسد. عددِ روی صفحه‌ی hydrate‌نشده بی‌معناست.
const ev = await page.evaluate(() => {
  const next = !!document.querySelector('script[src*="/_next/"]');
  let fiber = false; for (const el of document.querySelectorAll('body *')) { if (Object.keys(el).some((k) => k.startsWith('__reactFiber'))) { fiber = true; break; } }
  const canvases = [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`);
  return { next, fiber, canvases };
});
const hydration = ev.next ? `next=true fiber=${ev.fiber}` : 'next=false (بدونِ React)';
if (ev.next && !ev.fiber) console.error('⚠️ صفحه hydrate نشده (fiber=false) — عددها مالِ HTMLِ ایستا هستند. 127.0.0.1 زده‌ای؟ localhost بزن.');

const r = await page.evaluate((scope) => {
  const vis = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < 3000; };
  const els = [...document.querySelectorAll(scope)].filter(vis);
  const tally = (get) => { const m = new Map(); for (const el of els) { const v = get(getComputedStyle(el), el); if (v == null) continue; m.set(v, (m.get(v) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const fontSizes = tally((cs, el) => (hasText(el) ? Math.round(parseFloat(cs.fontSize)) : null));
  const fontWeights = tally((cs, el) => (hasText(el) ? cs.fontWeight : null));
  const textColors = tally((cs, el) => (hasText(el) ? cs.color : null));
  const bgColors = tally((cs) => (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : null));
  const borderColors = tally((cs) => (cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : null));
  const radii = tally((cs) => (cs.borderTopLeftRadius !== '0px' ? cs.borderTopLeftRadius : null));
  const shadows = tally((cs) => (cs.boxShadow !== 'none' ? cs.boxShadow : null));
  const gradientSurfaces = els.filter((el) => /gradient/.test(getComputedStyle(el).backgroundImage)).length;
  const backdropBlurSurfaces = els.filter((el) => ((getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter || '')).includes('blur')).length;
  return { elements: els.length, fontSizes, fontWeights, textColors, bgColors, borderColors, radii, shadows, gradientSurfaces, backdropBlurSurfaces };
}, SCOPE);
await browser.close();

// خلاصه — همان ردیف‌های جدولِ §۱ DS-010، به همان ترتیب.
const n = (a) => a.length;
console.log(`url: ${URL}\nscope: ${SCOPE}\nhydration: ${hydration} · canvases ${ev.canvases.length}${ev.canvases.length ? ' (' + ev.canvases.join(', ') + ')' : ''}\nelements visible: ${r.elements}`);
console.log(`painted font sizes ${n(r.fontSizes)} · weights ${n(r.fontWeights)} · text/bg/border colours ${n(r.textColors)}/${n(r.bgColors)}/${n(r.borderColors)} · radii ${n(r.radii)} · shadows ${n(r.shadows)} · gradient surfaces ${r.gradientSurfaces} · backdrop-blur surfaces ${r.backdropBlurSurfaces}`);
console.log('font sizes (px → uses): ' + r.fontSizes.map(([v, c]) => `${v}×${c}`).join(' '));
console.log('weights: ' + r.fontWeights.map(([v, c]) => `${v}×${c}`).join(' '));
console.log('radii: ' + r.radii.map(([v, c]) => `${v}×${c}`).join(' '));
if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 1));
process.exit(0);
