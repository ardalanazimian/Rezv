#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  اندازه‌گیریِ DS-007 §۶ — دو شرطِ حکم‌شده‌ی صفحه‌ی اولِ اپِ مشتری، روی باندلِ واقعی
//
//  این **اندازه‌گیری** است، نه گیتِ CI (تصمیمِ سیم‌کشی با CEO). ولی exit code
//  معنادار است: 0 = هر دو شرط برقرار، 1 = دست‌کم یکی نه. امروز (۱۹۹c47d) باید
//  قرمز باشد — ابطال‌پذیریِ رایگان، بدونِ مصنوعِ ساختگی.
//
//  شرطِ ۱ — اولین کارتِ رستوران (#feed .rc) در ۳۹۰×۸۴۴، بعد از آنبوردینگ، زیرِ
//           400px از بالای سند باشد. (۱۹۹c47d: ۹۸۲px.)
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
//  Playwright از api/node_modules می‌آید؛ مرورگر: npx playwright install chromium
//  هدف: standalone/customer.html — پس پیش از سنجش، باندل را بازتولید کن.
// ═══════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(ROOT, 'api', 'package.json'))('playwright');
const BUNDLE = pathToFileURL(path.join(ROOT, 'standalone', 'customer.html')).href;
const LIMIT = 400;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR' });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BUNDLE); await page.waitForTimeout(1200);
await page.evaluate(() => { const o = document.getElementById('onb'); const b = o && [...o.querySelectorAll('button')].find((x) => /رد/.test(x.textContent)); b ? b.click() : o?.remove(); });
await page.waitForTimeout(400);

// ── شرطِ ۱ ──
const firstCardTop = await page.evaluate(() => { const c = document.querySelector('#feed .rc'); return c ? Math.round(c.getBoundingClientRect().top + window.scrollY) : null; });

// ── شرطِ ۲‑الف / ب ──
const trigger = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[onclick*="openPalette"]')];
  const vis = els.filter((e) => e.offsetParent && e.getBoundingClientRect().width > 0);
  return { total: els.length, visible: vis.length, labels: vis.map((e) => e.getAttribute('aria-label')) };
});
let paletteOpens = false;
if (trigger.visible) {
  try { await page.click('[onclick*="openPalette"]:visible', { timeout: 3000 }); } catch { trigger.clickFailed = true; }
  await page.waitForTimeout(300);
  paletteOpens = await page.evaluate(() => { const c = document.getElementById('cmdk'); return !!(c && c.offsetParent); });
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
console.log(JSON.stringify({ bundle: 'standalone/customer.html', firstCardTop, limit: LIMIT, cond1_underLimit: cond1, trigger, paletteOpens, search: { ...search, before, after }, cond2_searchReachableAndWorks: cond2, undefinedPrices, pageErrors: errors.slice(0, 3) }, null, 1));
console.log(cond1 && cond2 ? '✓ S1: هر دو شرط برقرار' : `✗ S1: ${!cond1 ? 'شرطِ ۱ (اولین کارت زیرِ ' + LIMIT + 'px) ' : ''}${!cond2 ? 'شرطِ ۲ (جست‌وجو نمایان و کارا)' : ''} برقرار نیست`);
await browser.close();
process.exit(cond1 && cond2 ? 0 : 1);
