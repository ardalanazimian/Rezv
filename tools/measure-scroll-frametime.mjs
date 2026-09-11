#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  اندازه‌گیریِ frame-time هنگامِ اسکرولِ فیدِ اپِ مشتری — N اجرا، توزیع نه یک عدد
//
//  چرا N (منشور §۴g، ۲۰۲۶-۰۹-۱۰): دو اجرای پشتِ همِ همین اسکریپت روی یک باندل
//  max ۳۳ و ۸۳ داد. یک اجرا نویز است؛ هر عددِ زمانی فقط با N و توزیع گزارش
//  می‌شود. پیش‌فرض N=5.
//
//  ⚠️ قیدِ اصلی، مهم‌تر از عدد: این Chromiumِ headless روی PC است، نه گوشیِ
//  میان‌رده در تهران، و wheel انگشت نیست. عدد فقط برای **مقایسه‌ی قبل/بعدِ یک
//  تغییر** روی همان ماشین با همان پروتکل معتبر است — نه ادعایی درباره‌ی تجربه‌ی
//  واقعیِ کاربر. «اسکرولِ زنده با حسِ خوب» را این نمی‌سنجد؛ گوشیِ واقعی می‌سنجد.
//
//  پروتکل: ۳۹۰×۸۴۴ @2x، آنبوردینگ رد‌شده، حلقه‌ی rAF فاصله‌ی فریم‌ها را ثبت
//  می‌کند، ۱۲ فلیکِ ۲۵۰px با wheel هر ۹۰ms، ۵ فریمِ اول دور ریخته می‌شود.
//  این اندازه‌گیری است، نه گیت: exit همیشه 0.
//
//  اجرا:  node tools/measure-scroll-frametime.mjs [N] [file-url]
// ═══════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(ROOT, 'api', 'package.json'))('playwright');
const N = Number(process.argv[2] || 5);
const URL = process.argv[3] || pathToFileURL(path.join(ROOT, 'standalone', 'customer.html')).href;

const browser = await chromium.launch();
const runs = []; let evidence;
for (let i = 0; i < N; i++) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR' });
  const page = await ctx.newPage(); await page.goto(URL); await page.waitForTimeout(1200);
  await page.evaluate(() => { const o = document.getElementById('onb'); const b = o && [...o.querySelectorAll('button')].find((x) => /رد/.test(x.textContent)); b ? b.click() : o?.remove(); });
  await page.waitForTimeout(500);
  // شاهدِ hydration (۰۹-۱۱، یافته‌ی LE): با 127.0.0.1 محافظِ dev-originِ Next چانک‌های کلاینت را 403 می‌دهد؛
  // HTML می‌آید، JS نه، بوم‌ها 300×150 می‌مانند و صفحه‌ی ایستا «۶۰fps» می‌دهد. آن عدد بی‌معناست.
  if (i === 0) evidence = await page.evaluate(() => {
    const next = !!document.querySelector('script[src*="/_next/"]');
    let fiber = false; for (const el of document.querySelectorAll('body *')) { if (Object.keys(el).some((k) => k.startsWith('__reactFiber'))) { fiber = true; break; } }
    const canvases = [...document.querySelectorAll('canvas')].map((c) => `${c.width}x${c.height}`);
    return { next, fiber, canvases };
  });
  await page.evaluate(() => { window.__ft = []; let last = performance.now(); const tick = (t) => { window.__ft.push(t - last); last = t; if (window.__go) requestAnimationFrame(tick); }; window.__go = true; requestAnimationFrame(tick); });
  for (let k = 0; k < 12; k++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(90); }
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => { window.__go = false; const a = window.__ft.slice(5); a.sort((x, y) => x - y); const p = (q) => a[Math.floor(a.length * q)]; return { frames: a.length, p50: +p(.5).toFixed(1), p95: +p(.95).toFixed(1), max: +a[a.length - 1].toFixed(1), over33: a.filter((x) => x > 33).length, over50: a.filter((x) => x > 50).length }; });
  runs.push(r); await ctx.close();
}
await browser.close();

const col = (k) => runs.map((r) => r[k]);
const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
console.log(`هدف: ${URL}`);
console.log(`hydration: ${evidence.next ? `next=true fiber=${evidence.fiber}` : 'next=false (بدونِ React)'} · canvases ${evidence.canvases.length}${evidence.canvases.length ? ' (' + evidence.canvases.join(', ') + ')' : ''}`);
if (evidence.next && !evidence.fiber) console.log('⚠️ صفحه hydrate نشده (fiber=false) — این توزیع مالِ HTMLِ ایستا است، نه صفحه‌ی واقعی. 127.0.0.1 زده‌ای؟ localhost بزن.');
console.log('run  frames  p50   p95   max   >33  >50');
runs.forEach((r, i) => console.log(`${String(i + 1).padStart(3)}  ${String(r.frames).padStart(6)}  ${String(r.p50).padStart(4)}  ${String(r.p95).padStart(4)}  ${String(r.max).padStart(5)}  ${String(r.over33).padStart(3)}  ${String(r.over50).padStart(3)}`));
console.log(`median over ${N}: p95 ${med(col('p95'))} · max ${med(col('max'))} · >33ms ${med(col('over33'))} · >50ms ${med(col('over50'))}   |  worst max ${Math.max(...col('max'))}`);
console.log('⚠️ headless روی PC — فقط برای مقایسه‌ی قبل/بعد با همان پروتکل. یک اجرا نویز است.');
