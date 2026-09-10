#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  اندازه‌گیریِ DS-007 §۶ — دو شرطِ حکم‌شده‌ی صفحه‌ی اولِ اپِ مشتری، روی باندلِ واقعی
//
//  گیتِ CI است (حکمِ CEO ۲۰۲۶-۰۹-۱۰: سیم‌کشی در همان تحویلی که سبزش می‌کند)،
//  در jobِ `e2e` — تنها jobی که مرورگر دارد. exit: 0 = هر دو شرط برقرار،
//  1 = دست‌کم یکی نه، **2 = خطای محیط** (Playwright/مرورگر پیدا نشد) تا قرمزِ
//  محیط با قرمزِ محصول قاطی نشود. پیش از A (۱۹۹c47d) باید 1 بدهد — ابطال‌پذیریِ
//  رایگان، بدونِ مصنوعِ ساختگی.
//
//  شرطِ ۱ — اولین کارتِ رستوران (#feed .rc) در ۳۹۰×۸۴۴، بعد از آنبوردینگ، در
//           **نیمه‌ی اولِ صفحه** باشد: top < 50% ارتفاعِ viewport (۸۴۴ → ۴۲۲px).
//           ⚠️ حد **نسبت** است نه عدد (حکمِ CEO ۲۰۲۶-۰۹-۱۰): «۴۰۰px» یک تقریبِ
//           من بود که به حکم تبدیل شده بود و دقتی پیدا کرده بود که نداشت؛ قصدِ
//           واقعی «کارت در نیمه‌ی اولِ صفحه» است و نسبت همان را می‌گوید و با
//           اندازه‌ی صفحه مقیاس می‌گیرد. پیش از A: ۹۸۲px؛ بعد از A: ۳۹۲px،
//           حاشیه ~۳۰px — گارد حاشیه‌ی لحظه را چاپ می‌کند تا نفرِ بعدی بداند
//           چقدر جا دارد.
//  شرطِ ۲ — جست‌وجو از رابط **قابلِ رسیدن و کارا** باشد:
//           الف) یک تریگرِ **نمایانِ** openPalette (offsetParent != null، عرض > 0)
//           ب) کلیک روی آن پالت (#cmdk) را باز کند
//           ج) doSearch('برگر') فید را بی‌خطا فیلتر کند (کارت‌ها کمتر شوند)
//           ⚠️ بدونِ شرطِ ۲، حذفِ کاملِ جست‌وجو هم شرطِ ۱ را سبز می‌کند.
//           ⚠️ «الف» با grep قابلِ اثبات نیست — index.html:85 دکمه را **دارد**
//           و app.css:825 روی موبایل **پنهانش** می‌کند. موجود ≠ نمایان.
//  sanityِ V1 — هیچ «undefined تومان» در منویِ اولین رستوران (DS-006 V1).
//
//  اجرا (از ریشه‌ی مخزن یا هر جا):  node tools/measure-home-s1.mjs
//  Playwright از e2e/ (CI) یا api/ (محلی) برداشته می‌شود؛ مرورگر: npx playwright install chromium
//  هدف: standalone/customer.html — پس پیش از سنجش، باندل را بازتولید کن.
// ═══════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Playwright از هر جایی که نصب است — چون این ابزار در دو محیط اجرا می‌شود:
//   • محلی: api/node_modules/playwright (تست‌های api)
//   • CI، jobِ e2e: e2e/node_modules/@playwright/test (ایمیجِ Playwright، api نصب نیست)
// ⚠️ اگر فقط api را می‌خواند، در CI با MODULE_NOT_FOUND می‌افتاد — exit 1 به
// دلیلِ غلط، که شبیهِ «گارد قرمز شد» می‌خواند. همان تله‌ی worktree/reset.
function loadChromium() {
  const tries = [
    [path.join(ROOT, 'e2e', 'package.json'), '@playwright/test'],
    [path.join(ROOT, 'e2e', 'package.json'), 'playwright'],
    [path.join(ROOT, 'api', 'package.json'), 'playwright'],
    [path.join(ROOT, 'api', 'package.json'), '@playwright/test'],
  ];
  for (const [from, pkg] of tries) {
    try { const m = createRequire(from)(pkg); if (m.chromium) return { chromium: m.chromium, from: `${path.relative(ROOT, path.dirname(from))}/${pkg}` }; } catch { /* بعدی */ }
  }
  console.error('✗ Playwright پیدا نشد — نه در e2e/ نه در api/. این خطای محیط است، نه نتیجه‌ی سنجش.');
  process.exit(2);
}
const { chromium, from: pwFrom } = loadChromium();
const BUNDLE = pathToFileURL(path.join(ROOT, 'standalone', 'customer.html')).href;
const VIEWPORT = { width: 390, height: 844 };
const LIMIT_RATIO = 0.5;                                   // نیمه‌ی اولِ صفحه
const LIMIT = Math.round(VIEWPORT.height * LIMIT_RATIO);   // ۴۲۲ روی ۸۴۴

// خطای راه‌اندازیِ مرورگر (نسخه‌ی نصب‌نشده، مسیرِ اشتباهِ PLAYWRIGHT_BROWSERS_PATH)
// exit 2 است، نه 1: «مرورگر بالا نیامد» با «صفحه‌ی اول شرط را ندارد» یکی نیست.
let browser;
try { browser = await chromium.launch(); }
catch (e) { console.error('✗ مرورگر راه نیفتاد — خطای محیط، نه نتیجه‌ی سنجش:\n  ' + String(e.message).split('\n')[0]); process.exit(2); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BUNDLE); await page.waitForTimeout(1200);
await page.evaluate(() => { const o = document.getElementById('onb'); const b = o && [...o.querySelectorAll('button')].find((x) => /رد/.test(x.textContent)); b ? b.click() : o?.remove(); });
await page.waitForTimeout(400);

// ── شرطِ ۱ ──
const firstCardTop = await page.evaluate(() => { const c = document.querySelector('#feed .rc'); return c ? Math.round(c.getBoundingClientRect().top + window.scrollY) : null; });

// ── شرطِ ۲‑الف / ب ──
// ⚠️ «نمایان» را با offsetParent نسنج. نسخه‌ی اول همین بود و LE گرفت: #cmdk
// position:fixed است و offsetParent ِ عنصرِ fixed در همه‌ی مرورگرها null است —
// پس «پالت باز شد» هرگز true نمی‌شد، حتی روی اپِ کاملاً سالم. سنجه‌ای که جوابش
// از قبل معلوم است، سنجه نیست. سیگنال‌های واقعیِ دیدنی‌بودن: مستطیلِ غیرصفر،
// opacity غیرصفر، visibility visible، display غیرِ none. به نامِ کلاس هم تکیه
// نمی‌کنیم. همین قاعده برای تریگر هم — اگر روزی nav از sticky به fixed برود،
// همان تله دوباره سر بلند می‌کرد.
const trigger = await page.evaluate(() => {
  const shown = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0; };
  const els = [...document.querySelectorAll('[onclick*="openPalette"]')];
  const vis = els.filter(shown);
  return { total: els.length, visible: vis.length, labels: vis.map((e) => e.getAttribute('aria-label')) };
});
let paletteOpens = false;
if (trigger.visible) {
  try { await page.click('[onclick*="openPalette"]:visible', { timeout: 3000 }); } catch { trigger.clickFailed = true; }
  await page.waitForTimeout(300);
  paletteOpens = await page.evaluate(() => {
    const c = document.getElementById('cmdk'); if (!c) return false;
    const r = c.getBoundingClientRect(); const s = getComputedStyle(c);
    return r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0 && s.pointerEvents !== 'none';
  });
  await page.keyboard.press('Escape');
}

// ── شرطِ ۲‑ج ──
const before = await page.evaluate(() => document.querySelectorAll('#feed .rc').length);
const search = await page.evaluate(() => {
  try {
    const inp = document.getElementById('sQ'); if (inp) inp.value = 'برگر'; // سازگاری با هیرویِ قدیمی
    if (typeof window.doSearch !== 'function') return { ok: false, why: 'doSearch not on window' };
    window.doSearch('برگر'); return { ok: true };
  } catch (e) { return { ok: false, why: e.message }; }
});
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({ cards: document.querySelectorAll('#feed .rc').length, title: document.getElementById('feedTitle')?.textContent.trim() }));

// ── sanity V1 ──
await page.evaluate(() => { const inp = document.getElementById('sQ'); if (inp) inp.value = ''; window.doSearch && window.doSearch(''); });
await page.waitForTimeout(300);
let undefinedPrices = null;
try { await page.click('#feed .rc[data-rid]', { timeout: 3000 }); await page.waitForTimeout(800); undefinedPrices = await page.evaluate(() => [...document.querySelectorAll('.menu-price')].filter((e) => /undefined/.test(e.textContent)).length); } catch { undefinedPrices = 'no card clickable'; }

const cond1 = firstCardTop !== null && firstCardTop < LIMIT;
const cond2 = trigger.visible > 0 && paletteOpens && search.ok && after.cards < before;
const margin = firstCardTop === null ? null : LIMIT - firstCardTop;   // مثبت = جا هست، منفی = چقدر گذشته
console.log(JSON.stringify({ bundle: 'standalone/customer.html', playwright: pwFrom, viewport: VIEWPORT, firstCardTop, limit: `${LIMIT}px (${LIMIT_RATIO * 100}% of viewport height)`, marginPx: margin, cond1_firstHalfOfScreen: cond1, trigger, paletteOpens, search: { ...search, before, after }, cond2_searchReachableAndWorks: cond2, undefinedPrices, pageErrors: errors.slice(0, 3) }, null, 1));
if (cond1 && cond2) {
  console.log(`✓ S1: هر دو شرط برقرار — اولین کارت ${firstCardTop}px، حد ${LIMIT}px (${LIMIT_RATIO * 100}٪ صفحه)، حاشیه ${margin}px`);
} else {
  console.log(`✗ S1: ${!cond1 ? `شرطِ ۱ — اولین کارت باید در نیمه‌ی اولِ صفحه باشد (< ${LIMIT}px = ${LIMIT_RATIO * 100}٪ از ${VIEWPORT.height})؛ الان ${firstCardTop}px، ${-margin}px بیشتر. ` : ''}${!cond2 ? 'شرطِ ۲ — جست‌وجو باید از رابط نمایان و کارا باشد (تریگرِ openPalette دیده شود، پالت باز شود، doSearch فیلتر کند).' : ''}`);
}
await browser.close();
process.exit(cond1 && cond2 ? 0 : 1);
