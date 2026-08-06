#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  ممیزیِ اندازه‌گیری‌شده‌ی دسترس‌پذیری — اپ‌های استاتیکِ رزرونو
//
//  چرا این وجود دارد: نقض‌های دسترس‌پذیری در بازرسیِ چشمی دیده نمی‌شوند.
//  «۱٫۳۲:۱ کنتراست» یا «هدفِ لمسیِ ۱۷ پیکسلی» را فقط با اندازه‌گیری در
//  مرورگرِ واقعی می‌شود پیدا کرد — و فقط با همان می‌شود ثابت کرد که برنگشته‌اند.
//
//  اجرا:  cd e2e && npm run audit -- [مسیرِ اپ]   (پیش‌فرض: apps/customer)
//  خروج:  ۰ اگر هیچ نقضی نباشد، ۱ در غیرِ این‌صورت — قابلِ‌وصل به CI.
//
//  دو معیار سنجیده می‌شود:
//   ۱. اندازه‌ی هدفِ لمسی — WCAG 2.5.5 و حداقلِ هر دو پلتفرم: ۴۴×۴۴px
//   ۲. کنتراستِ متن — WCAG 1.4.3 AA: ۴٫۵:۱ عادی، ۳:۱ بزرگ
//
//  برای متنِ روی گرادیان، محاسبه‌ی CSS جواب نمی‌دهد (پس‌زمینه‌ی مات وجود ندارد)،
//  پس از رندرِ واقعی نمونه‌ی پیکسلی گرفته می‌شود: صدکِ ۱۰ در برابرِ صدکِ ۹۰ِ
//  درخشندگی. این تقریب است نه اندازه‌گیریِ رسمی — با برچسبِ «پیکسلی» جدا گزارش
//  می‌شود تا با موردهای قطعی اشتباه نشود.
// ═══════════════════════════════════════════════════════════════════════
import { chromium, devices } from '@playwright/test';
import { PNG } from 'pngjs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = process.argv[2] || 'apps/customer';
const PORT = 4188;
const MIN_TOUCH = 44;

const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const parseRGB = (s) => {
  const m = String(s).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  return m ? { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] } : null;
};
const flatten = (fg, bg) => fg.rgb.map((c, i) => Math.round(c * fg.a + bg[i] * (1 - fg.a)));
const threshold = (px, weight) => (px >= 24 || (px >= 18.66 && +weight >= 700)) ? 3 : 4.5;

// عنصرهایی که روی گرادیان‌اند و باید پیکسلی سنجیده شوند
const PIXEL_SAMPLED = ['.rc-name', '.rc-rating', '.rc-meta', '.rc-cb', '.rc-social-t', '.rc-slot', '.occ-label', '.occ-sub', '.rc-hotbadge'];

const server = spawn('npx', ['--yes', 'serve', '-p', String(PORT), '-L', path.join(ROOT, APP_DIR)], { stdio: 'ignore' });
const stop = () => { try { server.kill(); } catch {} };
process.on('exit', stop);
await new Promise((r) => setTimeout(r, 4000));

// نسخه‌ی @playwright/test گاهی بیلدِ مرورگری می‌خواهد که در ایمیج نیست؛
// هر بیلدِ موجود در PLAYWRIGHT_BROWSERS_PATH پذیرفته است (بدونِ دانلودِ تازه).
function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter((x) => x.startsWith('chromium-')).sort().reverse()) {
    const p = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}
const browser = await chromium.launch({ executablePath: findChromium() });
const problems = { touch: [], keyboard: [], contrast: [], pixel: [], overflow: [] };

for (const [label, dev] of [['iPhone 13', devices['iPhone 13']], ['Pixel 5', devices['Pixel 5']]]) {
  // reducedMotion اجباری است، نه سلیقه: اپ کارت‌ها را با
  // «.reveal{transform:scale(.97)}» وارد می‌کند و شیت را با animation بالا می‌آورد.
  // بدونِ آن getBoundingClientRect هندسه‌ی وسطِ انیمیشن را می‌دهد — ۴۴px واقعی
  // ۴۳px خوانده می‌شد و selectِ داخلِ شیت ۲۸px. اپ خودش این مدیا-کوئری را
  // پشتیبانی می‌کند و در آن حالت transformها خنثی‌اند، پس اندازه‌ها واقعی‌اند.
  const ctx = await browser.newContext({ ...dev, serviceWorkers: 'block', locale: 'fa-IR', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { try { localStorage.setItem('rz_onboarded', '1'); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);

  // ── هدفِ لمسی + رسیدنِ کیبورد ──
  const els = await page.evaluate((MIN) => {
    const SEL = 'button, a[href], [role="button"], select, input, textarea, .chip, .rc-slot, .occ-card, .hcard, .opt, .botnav-item, .event-card';
    const out = [];
    for (const el of document.querySelectorAll(SEL)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (!el.closest('.page.active, .botnav, .sheet.open, .topbar, header')) continue;
      const nativelyFocusable = ['A', 'BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(el.tagName);
      out.push({
        sel: typeof el.className === 'string' && el.className.trim()
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase(),
        w: Math.round(r.width), h: Math.round(r.height),
        text: (el.textContent || '').trim().slice(0, 20),
        small: r.height < MIN || r.width < MIN,
        // «قابلِ رسیدن» یعنی یا خودش فوکوس‌پذیر است یا tabindex گرفته.
        // هندلرِ کیبورد لازم نیست اینجا چک شود: a11y.js یک شنونده‌ی سراسری روی
        // [role=button][tabindex] دارد که Enter/Space را به click تبدیل می‌کند.
        reachable: nativelyFocusable || el.tabIndex >= 0,
      });
    }
    return out;
  }, MIN_TOUCH);

  for (const e of els) {
    if (e.small) problems.touch.push({ device: label, ...e });
    if (!e.reachable) problems.keyboard.push({ device: label, ...e });
  }

  // ── کنتراست روی پس‌زمینه‌ی مات ──
  const samples = await page.evaluate(() => {
    const out = []; const seen = new Set();
    for (const el of document.querySelectorAll('.page.active *, .botnav *, header *')) {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
      if (!own) continue;
      const cs = getComputedStyle(el);
      // متنِ گرادیانی (background-clip:text) رنگِ شفاف دارد و قابلِ محاسبه نیست
      if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.color === 'rgba(0, 0, 0, 0)') continue;
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : el.tagName;
      const key = cs.color + '|' + cs.fontSize + '|' + cls;
      if (seen.has(key)) continue; seen.add(key);
      let bg = 'rgb(255,255,255)', p = el, gradient = false;
      while (p) {
        const s = getComputedStyle(p);
        if (s.backgroundImage && s.backgroundImage !== 'none') gradient = true;
        if (s.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor)) { bg = s.backgroundColor; break; }
        p = p.parentElement;
      }
      out.push({ cls, text: own.slice(0, 22), color: cs.color, bg, gradient, px: parseFloat(cs.fontSize), weight: cs.fontWeight });
    }
    return out;
  });

  const pixelClasses = new Set(PIXEL_SAMPLED.map((s) => s.slice(1)));
  for (const s of samples) {
    if (s.gradient) continue;                       // پیکسلی سنجیده می‌شود
    // عنصرهایی که پیکسلی سنجیده می‌شوند از مسیرِ محاسبه‌ی مسطح کنار می‌روند.
    // نمونه: .rc-cb داخلِ .rc-panel است که آلفا دارد ولی گرادیانِ کارت خواهرِ
    // آن است نه نیایش، پس این مسیر اسکریم را روی سفید صاف می‌کرد و ۴٫۴۷:۱
    // کاذب می‌داد؛ اندازه‌گیریِ پیکسلی همان را ۷٫۲۶:۱ می‌خواند.
    if (pixelClasses.has(s.cls)) continue;
    const fg = parseRGB(s.color), bgp = parseRGB(s.bg);
    if (!fg || !bgp) continue;
    const bgRGB = bgp.a < 1 ? flatten(bgp, [255, 255, 255]) : bgp.rgb;
    const cr = contrast(fg.a < 1 ? flatten(fg, bgRGB) : fg.rgb, bgRGB);
    const need = threshold(s.px, s.weight);
    if (cr < need) problems.contrast.push({ device: label, ...s, cr, need });
  }

  // ── نمونه‌ی پیکسلی برای متنِ روی گرادیان ──
  if (label === 'iPhone 13') {
    for (const sel of PIXEL_SAMPLED) {
      const el = page.locator(sel).first();
      if (!(await el.count())) continue;
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(200);
      const buf = await el.screenshot().catch(() => null);
      if (!buf) continue;
      // پس‌زمینه = پرتکرارترین رنگِ کراپ (متن همیشه اقلیتِ پیکسل‌هاست، پس مُد
      // همان زمینه است — و چون از رندرِ واقعی می‌آید، گرادیان را درست می‌گیرد).
      // روشِ صدکی که اول نوشتم اینجا می‌شکست: روی چیپِ ۶۳×۴۳ متن زیرِ ۱۰٪ مساحت
      // است، پس صدکِ ۱۰ و ۹۰ هر دو زمینه را می‌خواندند و ۱٫۳۳:۱ کاذب می‌داد.
      const { color, px, weight } = await el.evaluate((n) => {
        const cs = getComputedStyle(n);
        return { color: cs.color, px: parseFloat(cs.fontSize), weight: cs.fontWeight };
      });
      const fg = parseRGB(color);
      if (!fg) continue;

      // پس‌زمینه = پرتکرارترین رنگِ کراپ، ولی پیکسل‌های نزدیک به رنگِ متن کنار
      // گذاشته می‌شوند. چرا: روی «قرار عاشقانه» متن ۲۴۹۷ پیکسل از ۲۵۵۴ را پر
      // می‌کرد، پس مُد خودِ متن می‌شد و ۱٫۰۶:۱ کاذب می‌داد. با این فیلتر، مُد
      // همیشه زمینه است — و چون از رندرِ واقعی می‌آید، گرادیان را درست می‌گیرد.
      const png = PNG.sync.read(buf);
      const bins = new Map();
      const near = (r, g, b) => Math.abs(r - fg.rgb[0]) + Math.abs(g - fg.rgb[1]) + Math.abs(b - fg.rgb[2]) < 90;
      for (let i = 0; i < png.data.length; i += 4) {
        const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
        if (near(r, g, b)) continue;
        const k = (r >> 3 << 10) | (g >> 3 << 5) | (b >> 3);
        bins.set(k, (bins.get(k) || 0) + 1);
      }
      if (!bins.size) continue;   // کراپ تماماً هم‌رنگِ متن — چیزی برای سنجش نیست
      let best = 0, bestK = 0;
      for (const [k, n] of bins) if (n > best) { best = n; bestK = k; }
      const bgPix = [((bestK >> 10) & 31) << 3, ((bestK >> 5) & 31) << 3, (bestK & 31) << 3];
      const cr = contrast(fg.a < 1 ? flatten(fg, bgPix) : fg.rgb, bgPix);
      const need = threshold(px, weight);
      problems.pixel.push({ sel, cr, need, px, pass: cr >= need, text: ((await el.textContent()) || '').trim().slice(0, 18) });
    }
  }

  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (ov > 0) problems.overflow.push({ device: label, px: ov });

  await ctx.close();
}
await browser.close();
stop();

// ── گزارش ──
const uniq = (arr, keyFn) => { const m = new Map(); for (const x of arr) if (!m.has(keyFn(x))) m.set(keyFn(x), x); return [...m.values()]; };
let failed = 0;

console.log(`\n■ ممیزیِ دسترس‌پذیری — ${APP_DIR}\n`);

const touch = uniq(problems.touch, (t) => `${t.sel}|${t.w}x${t.h}`);
console.log(`▸ هدفِ لمسی زیرِ ${MIN_TOUCH}px — ${problems.touch.length} مورد، ${touch.length} الگو`);
for (const t of touch.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h)).slice(0, 15)) {
  console.log(`    ${String(t.w).padStart(4)}×${String(t.h).padStart(3)}  ${t.sel.padEnd(24)} "${t.text}"`);
}
if (problems.touch.length) failed++; else console.log('    ✓ پاک');

const kb = uniq(problems.keyboard, (t) => t.sel);
console.log(`\n▸ غیرقابلِ رسیدن با کیبورد — ${problems.keyboard.length} مورد`);
for (const t of kb.slice(0, 10)) console.log(`    ${t.sel.padEnd(24)} "${t.text}"`);
if (problems.keyboard.length) failed++; else console.log('    ✓ پاک');

const ct = uniq(problems.contrast, (c) => `${c.cls}|${c.color}`);
console.log(`\n▸ کنتراست روی پس‌زمینه‌ی مات — ${ct.length} الگو`);
for (const c of ct.sort((a, b) => a.cr - b.cr)) {
  console.log(`    ${c.cr.toFixed(2)}:1 (نیاز ${c.need})  .${c.cls} ${c.px}px  "${c.text}"`);
}
if (ct.length) failed++; else console.log('    ✓ پاک');

console.log('\n▸ کنتراستِ پیکسلی روی گرادیان (تقریبی)');
for (const p of problems.pixel.sort((a, b) => a.cr - b.cr)) {
  console.log(`    ${p.pass ? '✓' : '✗'} ${p.cr.toFixed(2)}:1 (نیاز ${p.need})  ${p.sel.padEnd(16)} "${p.text}"`);
}
if (problems.pixel.some((p) => !p.pass)) failed++;

console.log(`\n▸ سرریزِ افقی`);
if (!problems.overflow.length) console.log('    ✓ صفر روی هر دو دستگاه');
else { problems.overflow.forEach((o) => console.log(`    ${o.device}: ${o.px}px`)); failed++; }

console.log(failed ? `\n✗ ${failed} دسته نقض دارد\n` : '\n✓ همه‌ی معیارها پاک\n');
process.exit(failed ? 1 : 0);
