#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ مقدارِ خام در CSS — ratchet روی دیف، نه sweep روی مخزن   (DS-010 §۵)
//
//  چرا: «اپل» یعنی مقادیرِ کمتر و عمدی. اندازه‌گیریِ ۰۹-۱۱ روی apps/customer/css/app.css:
//    font-size با px خام ۲۵۹ در برابرِ ۲ توکنی · ۱۰۸ رنگِ hex هاردکد · ۹۵ شعاعِ خام ·
//    ۲۰ مدتِ حرکتِ متمایز. توکن هست (--fs-*, --radius-*, --motion-*, ۱۷ رنگ)؛
//    استفاده نمی‌شود. یک قاعده که گیت ندارد، نثر است.
//
//  ⚠️ ratchet، نه sweep (همان حکمِ بازبین برای assert.rejects): بازنویسیِ ۴۶۰ مورد
//  در یک کامیت بازبینی‌ناپذیر است. فقط خطوطِ **افزوده‌شده** در دیف سنجیده می‌شوند؛
//  موجودی هنگامِ تماس تنگ می‌شود.
//
//  چهار مقدارِ خام، هر کدام با جانشینِ توکنی در پیامِ خطا:
//    font-size: 14px            → var(--fs-*) یا font: var(--type-*)
//    color/background: #hex     → var(--…) از tokens.css
//    border-radius: 13px        → var(--radius-*) (50% برای دایره مجاز)
//    transition/animation 350ms → var(--motion-*)، var(--ease-*)
//
//  دامنه: apps/*/css/*.css و shared/css/*.css **جز** tokens.css (تنها جایی که
//  مقدارِ خام حق دارد زندگی کند). standalone/ نه — تولید می‌شود.
//
//  ثابت‌های طراحی، همان سه‌تای check-rejects-matcher:
//   ۱) baseِ resolve‌نشده خطاست، نه سبز. دیفِ خالی سبز ولی گویاست.
//   ۲) نثر (کامنت) جدا می‌شود، هرگز ممنوع نمی‌شود — کامنتی که «14px» را نقل کند
//      نباید گارد را قرمز کند.
//   ۳) ابطال‌پذیری دو جهته: مقدارِ خامِ تازه قرمز، مقدارِ توکنیِ تازه سبز.
//
//  اجرا:  node tools/check-css-raw-values.mjs            # ratchet روی دیف
//         node tools/check-css-raw-values.mjs --report   # آمارِ کلِ مخزن (خبری)
//  محیط:  CSS_RAW_BASE=<ref>  (پیش‌فرض origin/main؛ صفرِ ۴۰رقمی = شاخه‌ی تازه → origin/main)
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IN_SCOPE = (f) => /^(apps\/[^/]+\/css\/[^/]+\.css|shared\/css\/[^/]+\.css)$/.test(f) && !f.endsWith('tokens.css');

// ── قواعد: هر کدام روی یک اعلانِ CSS (خاصیت: مقدار) ──
const RULES = [
  { id: 'font-size', prop: /^font(-size)?$/, raw: /(^|[\s,/])\d*\.?\d+(px|rem|em)\b/, fix: 'var(--fs-*) یا font: var(--type-*)' },
  { id: 'hex-colour', prop: /^(color|background(-color|-image)?|border(-[a-z]+)?(-color)?|fill|stroke|outline(-color)?|box-shadow|text-shadow)$/, raw: /#[0-9a-fA-F]{3,8}\b/, fix: 'var(--…) از tokens.css' },
  { id: 'radius', prop: /^border(-[a-z]+)?-radius$/, raw: /(^|\s)\d*\.?\d+(px|rem)\b/, fix: 'var(--radius-*)؛ 50% برای دایره مجاز', allow: /^\s*50%\s*$/ },
  // ⚠️ allow: مدتِ «تقریباً صفر»ِ reduced-motion (.01ms / 0.01ms / 0.001ms) مجاز است — این
  // الگویِ استانداردِ خاموش‌کردنِ حرکت است و خودِ DS-010 الزامش می‌کند. نسخه‌ی اولِ این
  // regex `\b` پیش از `.` می‌خواست که وجود ندارد، پس `.01ms` را قرمز می‌کرد: گاردی که
  // قاعده‌ی خودش را می‌شکست. با تزریق گرفته شد (DIR-1d: ۲ به‌جای ۱)، نه با حدس.
  { id: 'duration', prop: /^(transition(-duration)?|animation(-duration)?)$/, raw: /(^|[\s,])\d*\.?\d+m?s\b/, fix: 'var(--motion-*)', allow: /(^|[^0-9.])0*\.0*1ms\b/ },
];

function stripComments(css) {
  // نثر جدا می‌شود ولی شماره‌ی خط حفظ: کامنت با فاصله پر می‌شود، \n می‌ماند.
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** اعلان‌ها را با شماره‌ی خط برمی‌گرداند: [{line, prop, value}] */
function declarations(css) {
  const out = [];
  const src = stripComments(css);
  const re = /([a-zA-Z-]+)\s*:\s*([^;{}]+)(;|(?=\}))/g;
  let m;
  while ((m = re.exec(src))) {
    const prop = m[1].toLowerCase();
    if (prop.startsWith('--')) continue;                 // تعریفِ توکن اینجا نیست (tokens.css خارج از دامنه است)
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ line, prop, value: m[2].trim() });
  }
  return out;
}

function violations(css) {
  const out = [];
  for (const d of declarations(css)) {
    if (/var\(--/.test(d.value) && !/#[0-9a-fA-F]{3,8}\b/.test(d.value) && !/\d+(px|rem|em|ms|s)\b/.test(d.value)) continue; // کاملاً توکنی
    for (const r of RULES) {
      if (!r.prop.test(d.prop)) continue;
      if (r.allow && r.allow.test(d.value)) continue;
      if (r.raw.test(d.value)) out.push({ line: d.line, rule: r.id, decl: `${d.prop}: ${d.value.slice(0, 60)}`, fix: r.fix });
    }
  }
  return out;
}

function git(args, opts = {}) { return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...opts }).trim(); }

function report() {
  const files = git(['ls-files', 'apps/*/css/*.css', 'shared/css/*.css']).split('\n').filter(IN_SCOPE);
  let total = 0;
  console.log('مقدارِ خام در CSS (کلِ مخزن — خبری، exit همیشه 0):');
  for (const f of files) {
    const v = violations(readFileSync(path.join(REPO_ROOT, f), 'utf8'));
    if (!v.length) continue;
    total += v.length;
    const by = {}; for (const x of v) by[x.rule] = (by[x.rule] || 0) + 1;
    console.log(`  ${f.padEnd(40)} ${String(v.length).padStart(4)}   ${Object.entries(by).map(([k, n]) => k + ' ' + n).join(' · ')}`);
  }
  console.log(`مجموع ${total} · گیت روی دیف است، نه اینجا.`);
  process.exit(0);
}

function resolveBase() {
  let ref = process.env.CSS_RAW_BASE?.trim();
  if (ref && /^0{40}$/.test(ref)) { console.log('base صفر (شاخه‌ی تازه) — origin/main.'); ref = undefined; }
  for (const c of ref ? [ref] : ['origin/main', 'main']) {
    try { return { ref: c, sha: git(['rev-parse', '--verify', `${c}^{commit}`]) }; } catch { /* بعدی */ }
  }
  console.error('✗ baseِ دیف resolve نشد — CSS_RAW_BASE را ست کن. بدونِ base این گارد نمی‌داند چه چیزی تازه است؛ سبز نمی‌دهد.');
  process.exit(1);
}

function main() {
  if (process.argv.includes('--report')) return report();
  const base = resolveBase();
  let mb; try { mb = git(['merge-base', base.sha, 'HEAD']); } catch { mb = base.sha; }
  const changed = git(['diff', '--name-only', '--diff-filter=ACMR', mb, 'HEAD']).split('\n').filter(IN_SCOPE);
  console.log(`base: ${base.ref} (${mb.slice(0, 7)}) · فایل‌های CSSِ تغییرکرده در دامنه: ${changed.length}`);
  if (!changed.length) { console.log('هیچ CSSِ در دامنه‌ای در این دیف عوض نشده — **هیچ اعلانِ تازه‌ای بررسی نشد.** «چیزی برای سنجیدن نبود»، نه «همه‌چیز خوب است».'); process.exit(0); }

  const failures = []; let checked = 0;
  for (const rel of changed) {
    const abs = path.join(REPO_ROOT, rel); if (!existsSync(abs)) continue;
    const patch = git(['diff', '-U0', mb, 'HEAD', '--', rel]);
    const added = new Set(); let n = 0;
    for (const l of patch.split('\n')) {
      const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (h) { n = Number(h[1]); continue; }
      if (l.startsWith('+') && !l.startsWith('+++')) { added.add(n); n++; }
      else if (!l.startsWith('-') && !l.startsWith('---')) n++;
    }
    for (const v of violations(readFileSync(abs, 'utf8'))) {
      if (!added.has(v.line)) continue;                   // موجودی — ratchet دست نمی‌زند
      checked++; failures.push({ where: `${rel}:${v.line}`, ...v });
    }
    checked += 0;
  }
  console.log(`اعلان‌های خامِ **تازه** در این دیف: ${failures.length}`);
  if (failures.length) {
    console.error(`✗ ${failures.length} مقدارِ خامِ تازه — توکن هست، استفاده نشده:`);
    for (const f of failures) console.error(`  · [${f.rule}] ${f.where}\n      ${f.decl}\n      → ${f.fix}`);
    console.error('\nاین گیت فقط خطوطِ افزوده‌شده را می‌سنجد؛ ۴۶۰+ موردِ موجود عمداً دست‌نخورده‌اند.');
    process.exit(1);
  }
  console.log('✓ هیچ مقدارِ خامِ تازه‌ای در CSSِ این دیف نیست.');
  process.exit(0);
}
main();
