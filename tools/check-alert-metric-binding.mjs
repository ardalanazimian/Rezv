#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ اتصالِ متریک↔آلارم (round-20، پاسخ به F-C)
//
//  چرا این گارد لازم است: promtool (چه check rules چه test rules) فقط
//  PromQL و رفتارِ قاعده روی سری‌های *ساختگی* را می‌سنجد — هیچ‌کدام کد را
//  نمی‌خوانند. یک بازبین ثابت کرد: نامِ متریک را فقط در
//  `api/src/lib/metrics.ts` عوض کن (alerts.yml دست‌نخورده بماند)، هر دو
//  promtool سبز می‌مانند در حالی که قاعده دیگر به هیچ‌چیزِ واقعی‌ای گوش
//  نمی‌دهد. این گارد آن شکاف را می‌بندد: سمتِ کد را واقعاً می‌خواند.
//
//  دو جهت، دو سیاستِ متفاوتِ عمدی:
//   ۱) هر rezervno_* که در یک expr استفاده شده ولی هیچ‌جا با
//      new Counter/Gauge/Histogram('...') اعلام نشده → خطای قطعی (exit 1).
//      یک قاعده که به متریکِ نامتصل گوش می‌دهد بدتر از نبودِ قاعده است —
//      ظاهرِ پوشش دارد، هیچ‌وقت فایر نمی‌شود.
//   ۲) هر متریکِ اعلام‌شده که در هیچ expr ای استفاده نشده → فقط هشدار
//      (exit را عوض نمی‌کند). نه هر متریکی لایقِ alert است — خیلی‌ها فقط
//      برای داشبورد/دیباگ‌اند (مثلِ cacheHits/dbDuration). تبدیلِ این به
//      خطا یک allowlistِ رشد‌کننده می‌ساخت (دقیقاً هشدارِ منشور ۴ب): هر
//      متریکِ عمداً بی‌آلارم (مثلِ rezervno_slot_lock_fallback_total که
//      الان در یک workstreamِ جدا زیر بررسی است) باید استثنا می‌شد. سیگنالِ
//      واقعی همان جهتِ اول است؛ این جهت فقط دیدنی‌کردنِ شکاف است.
//
//  چرا استخراج فقط از فیلدِ expr است، نه کلِ متنِ فایل: خودِ فایل نمونه‌ی
//  زنده‌ی این خطر را دارد — نامِ گروه‌ها («rezervno_security»،
//  «rezervno_queue»، …) و متنِ کامنت‌ها/annotationها («rezervno_auth_failures_total
//  هیچ نویسنده‌ای نداشت») همگی با یک regexِ سراسریِ rezervno_* قاطی می‌شدند
//  و یا false-positive تولید می‌کردند (نامِ گروه هرگز متریک نیست) یا نویز
//  می‌ساختند. پارسِ صریحِ فقط expr این را بدونِ allowlist حل می‌کند.
//
//  اجرا: node tools/check-alert-metric-binding.mjs
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ALERTS_PATH = path.join(REPO_ROOT, 'observability', 'alerts.yml');
const METRICS_SCAN_ROOT = path.join(REPO_ROOT, 'api', 'src');

const METRIC_TOKEN_RE = /rezervno_[a-zA-Z0-9_]+/g;
const ALERT_NAME_RE = /^\s*-\s*alert:\s*(\S+)\s*$/;
const EXPR_KEY_RE = /^(\s*)expr:\s*(.*)$/;
const BLOCK_SCALAR_HEADS = new Set(['|', '|-', '|+', '>', '>-', '>+']);

// ── ۱) استخراجِ متریک‌های واقعاً استفاده‌شده، فقط از فیلدِ expr هر قاعده ──
function extractReferencedMetrics(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  /** @type {Map<string, Set<string>>} metricName -> alertNames که آن را صدا زدند */
  const referenced = new Map();
  let currentAlert = '(بدونِ نامِ alert — قبل از اولین `- alert:`)';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const alertMatch = ALERT_NAME_RE.exec(line);
    if (alertMatch) {
      currentAlert = alertMatch[1];
      continue;
    }
    const exprMatch = EXPR_KEY_RE.exec(line);
    if (!exprMatch) continue;

    const indent = exprMatch[1].length;
    const rest = exprMatch[2].trim();
    let exprText;

    if (rest === '' || BLOCK_SCALAR_HEADS.has(rest)) {
      // block scalar (`expr: |` و مشابه): همه‌ی خطوطِ بعدی که تورفتگی‌شان
      // بیشتر از خودِ «expr:» است (یا خالی‌اند) بخشی از مقدارند.
      const collected = [];
      let j = i + 1;
      while (j < lines.length) {
        const l = lines[j];
        if (l.trim() === '') { collected.push(''); j++; continue; }
        const thisIndent = l.length - l.trimStart().length;
        if (thisIndent <= indent) break;
        collected.push(l);
        j++;
      }
      exprText = collected.join('\n');
      i = j - 1;
    } else {
      exprText = rest;
    }

    const tokens = exprText.match(METRIC_TOKEN_RE) ?? [];
    for (const t of tokens) {
      if (!referenced.has(t)) referenced.set(t, new Set());
      referenced.get(t).add(currentAlert);
    }
  }
  return referenced;
}

// ── ۲) استخراجِ متریک‌های واقعاً اعلام‌شده در کد ──
// عمداً کلِ api/src را می‌گردد، نه فقط metrics.ts — فرضِ «یک فایل کلِ
// declarationهاست» خودش یک حدس است؛ باید verify شود (و شد: grep روی کلِ
// مخزن هیچ new Counter/Gauge/Histogram دیگری با rezervno_* پیدا نکرد،
// فقط api/src/lib/metrics.ts).
const DECLARE_RE = /new\s+(Counter|Gauge|Histogram)\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;

function listTsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) listTsFiles(full, out);
    else if (/\.(ts|tsx|mts)$/.test(entry)) out.push(full);
  }
  return out;
}

function extractDeclaredMetrics(scanRoot) {
  /** @type {Map<string, {type: string, file: string, line: number}>} */
  const declared = new Map();
  for (const file of listTsFiles(scanRoot)) {
    const text = readFileSync(file, 'utf8');
    DECLARE_RE.lastIndex = 0;
    let m;
    while ((m = DECLARE_RE.exec(text))) {
      const [, type, name] = m;
      const line = text.slice(0, m.index).split('\n').length;
      const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
      if (declared.has(name)) {
        // نامِ تکراری خودش یک خبرِ بد است ولی این گارد را نمی‌شکند —
        // فقط اولین محلِ اعلام را نگه می‌داریم.
        continue;
      }
      declared.set(name, { type, file: rel, line });
    }
  }
  return declared;
}

// ── ۳) تطبیق: پسوندهای هیستوگرام (_bucket/_sum/_count) قاعده‌ی سراسری‌اند، ──
// نه استثنایِ موردی — Histogram در render() این سه را خودکار می‌سازد
// (metrics.ts، کلاسِ Histogram)، پس نامِ ارجاع‌شده در PromQL همیشه با
// نامِ اعلام‌شده در کد فرق دارد؛ این تنها انحرافِ سیستماتیکی است که مجاز
// می‌شود، و روی *هر* هیستوگرام یکسان اعمال می‌شود (نه allowlist).
const HISTOGRAM_SUFFIXES = ['_bucket', '_sum', '_count'];

function resolveBinding(name, declared) {
  if (declared.has(name)) return { ok: true, matchedAs: name };
  for (const suf of HISTOGRAM_SUFFIXES) {
    if (name.endsWith(suf)) {
      const base = name.slice(0, -suf.length);
      const entry = declared.get(base);
      if (entry && entry.type === 'Histogram') return { ok: true, matchedAs: base };
    }
  }
  return { ok: false };
}

// ── اجرا ──
function main() {
  const yamlText = readFileSync(ALERTS_PATH, 'utf8');
  const referenced = extractReferencedMetrics(yamlText);
  const declared = extractDeclaredMetrics(METRICS_SCAN_ROOT);

  if (referenced.size === 0) {
    console.error('✗ هیچ متریکِ rezervno_* از expr استخراج نشد — گارد احتمالاً چیزی را نمی‌بیند (خودِ گارد خراب است، نه فایل).');
    process.exit(1);
  }
  if (declared.size === 0) {
    console.error(`✗ هیچ new Counter/Gauge/Histogram در ${path.relative(REPO_ROOT, METRICS_SCAN_ROOT)} پیدا نشد — گارد احتمالاً مسیرِ اسکن اشتباه است.`);
    process.exit(1);
  }

  const failures = [];
  for (const [name, alertNames] of referenced) {
    const { ok } = resolveBinding(name, declared);
    if (!ok) failures.push({ name, alertNames: [...alertNames] });
  }

  const orphanDeclared = [];
  for (const [name, info] of declared) {
    let used = false;
    for (const refName of referenced.keys()) {
      const { ok, matchedAs } = resolveBinding(refName, declared);
      if (ok && matchedAs === name) { used = true; break; }
    }
    if (!used) orphanDeclared.push({ name, ...info });
  }

  console.log(`متریکِ استفاده‌شده در alerts.yml (فقط از expr): ${referenced.size}`);
  console.log(`متریکِ اعلام‌شده در ${path.relative(REPO_ROOT, METRICS_SCAN_ROOT)}: ${declared.size}`);
  console.log('');

  if (orphanDeclared.length > 0) {
    console.log(`⚠ هشدار (غیرِمسدودکننده): ${orphanDeclared.length} متریکِ اعلام‌شده هیچ alertی ندارند — لزوماً باگ نیست، خیلی‌ها فقط برایِ داشبورد/دیباگ‌اند:`);
    for (const o of orphanDeclared.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  · ${o.name}  (${o.type}, ${o.file}:${o.line})`);
    }
    console.log('');
  }

  if (failures.length > 0) {
    console.error(`✗ ${failures.length} متریک در observability/alerts.yml استفاده شده ولی در کد اعلام نشده (قاعده به هیچ‌چیزِ واقعی‌ای گوش نمی‌دهد):`);
    for (const f of failures.sort((a, b) => a.name.localeCompare(b.name))) {
      console.error(`  · ${f.name}  ← استفاده در: ${f.alertNames.join(', ')}`);
    }
    console.error('');
    console.error('رفع: یا اسمِ درست را در alerts.yml بگذار، یا اگر متریک واقعاً حذف/rename شده، خودِ قاعده را هم حذف/به‌روزرسانی کن.');
    process.exit(1);
  }

  console.log('✓ همه‌ی متریک‌هایِ استفاده‌شده در alerts.yml در کد واقعاً اعلام شده‌اند.');
  process.exit(0);
}

main();
