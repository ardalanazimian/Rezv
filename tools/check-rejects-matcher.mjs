#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ ماچرِ `assert.rejects` — ratchet روی دیف، نه sweep روی مخزن
//
//  مسئله (اندازه‌گیریِ بازبین، دستورِ ۰۴۲ — و در §گزارش زیر بازتولید می‌شود):
//  نیمی از ادعاهایِ rejection در `api/tests/` **هویتِ شکست را نمی‌سنجند**.
//
//    assert.rejects(fn)                      ← فقط «رد شد» را ثابت می‌کند
//    assert.rejects(fn, 'پیامِ فارسی')       ← Node این رشته را **پیامِ خطای
//                                               خودِ assert** می‌خواند، نه
//                                               انتظار. هیچ‌چیز سنجیده نمی‌شود.
//
//  ⚠️ **ضعیف یعنی غلط نیست.** `assert.rejects(fn)` واقعاً ثابت می‌کند تابع رد
//  شد؛ اگر رد نشود قرمز می‌شود. نقص باریک‌تر و بدتر است: این تست‌ها **سبز
//  می‌مانند اگر هویتِ شکست عوض شود** — همان شکلِ «P2028 که ۵۰۰ می‌داد».
//
//  و شکلِ رشته‌ای خطرناک‌تر از شکلِ برهنه است، به دلیلی ظریف: انسان پیامِ
//  فارسیِ آرگومانِ دوم را می‌خواند و منطقاً نتیجه می‌گیرد **آن** انتظار است.
//  تست **شبیهِ پوشش** به‌نظر می‌رسد. همان کلاسی که در DS-001 §۴‑ب ثبت شد:
//  تستِ ۲۰۲۶-۰۸-۲۵ یک مسیرِ فایل را پین کرده بود و سه نمونه از چهار نمونه‌ی
//  همان نقص را نمی‌دید، در حالی که وجودش خودش دلیلِ آسودگی بود.
//
//  ── چرا ratchet و نه sweep ────────────────────────────────────────────
//  حکمِ بازبین و CEO: بازنویسیِ ۵۶ ادعا در یک کامیت دیفی می‌سازد که کسی
//  نمی‌تواند بازبینی کند، و شکست‌هایی تولید می‌کند که از شکست‌هایِ
//  همیشه‌غلط قابلِ تفکیک نیستند. پس **فقط `assert.rejects` تازه** سنجیده
//  می‌شود؛ کدِ موجود دست‌نخورده می‌ماند و هنگامِ تماس تنگ می‌شود.
//
//  ── ثابت‌هایِ طراحی (هر سه از درس‌هایِ همین هفته) ──────────────────────
//   ۱) **تجزیه، نه grep.** `assert.rejects` چندخطی است؛ grep ماچری را که
//      روی خطِ بعد نشسته از دست می‌دهد و آن را «برهنه» گزارش می‌کند. اینجا
//      پرانتز تطبیق داده می‌شود و کاما در **سطحِ بالا** تقسیم می‌شود، با
//      نادیده‌گرفتنِ رشته/تمپلیت/کامنت/regex.
//   ۲) **دیفِ خالی باید معنادار باشد، نه بی‌صدا سبز.** اگر baseای قابلِ
//      resolve نباشد ⇦ خطا. اگر دیف هیچ فایلِ تستی نداشته باشد، صریح چاپ
//      می‌شود که «هیچ ادعایِ تازه‌ای بررسی نشد» — سبز، ولی گویا. همان درسِ
//      `scan-list` در check-loyalty-constant-binding.mjs.
//   ۳) **ابطال‌پذیری دو جهت دارد.** ادعایِ بدونِ ماچر باید قرمز شود، **و**
//      ادعایِ با ماچر باید سبز بماند. گاردی که همه را بگیرد گارد نیست.
//
//  ── یک سبزِ کاذبِ اجتناب‌شده ───────────────────────────────────────────
//  شکلِ `assert.rejects(fn, undefined, msg)` هشدار داده شده بود، ولی
//  اندازه‌گیری نشان داد **در این مخزن اصلاً وجود ندارد**. گاردی که فقط آن را
//  بگیرد صفر مورد می‌گیرد و سبزِ کاذبِ کامل می‌دهد. پس دو شکلِ **واقعی**
//  سنجیده می‌شوند: آرگومانِ دومِ غایب، و آرگومانِ دومِ رشته‌ای.
//
//  اجرا:
//    node tools/check-rejects-matcher.mjs            # ratchet روی دیف
//    node tools/check-rejects-matcher.mjs --report   # آمارِ کلِ مخزن (خبری)
//  محیط:
//    REJECTS_BASE=<ref>   baseِ دیف. اگر ست نشود از origin/main استفاده
//                         می‌شود و اگر آن هم نبود، خطا — نه سبز.
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = 'assert.rejects';
const TEST_DIR = 'api/tests/';

// ═══ تجزیه ══════════════════════════════════════════════════════════════

/**
 * از ایندکسِ یک `(` تا پرانتزِ بسته‌ی متناظرش را برمی‌گرداند و آرگومان‌هایِ
 * **سطحِ بالا** را تقسیم می‌کند.
 *
 * رشته‌ی تک/دو-نقل‌قولی، تمپلیت، کامنتِ خطی و بلوکی، و regex literal نادیده
 * گرفته می‌شوند — وگرنه یک `)` داخلِ رشته‌ی فارسی یا یک `,` داخلِ regex
 * تجزیه را می‌شکند و گارد بی‌صدا اشتباه می‌شمارد.
 */
function splitCallArgs(src, openIdx) {
  let i = openIdx + 1;
  let depth = 1;
  const args = [];
  let start = i;
  // برایِ تشخیصِ regex از تقسیم: یک `/` وقتی regex است که نویسه‌ی معنادارِ
  // قبلش یک عملگر یا نقطه‌شروع باشد، نه یک مقدار.
  let prevMeaningful = '(';

  const pushArg = (end) => args.push({ text: src.slice(start, end), start });

  while (i < src.length && depth > 0) {
    const c = src[i];
    const c2 = src[i + 1];

    if (c === '/' && c2 === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl; continue; }
    if (c === '/' && c2 === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 2; continue; }

    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        // ${...} در تمپلیت می‌تواند پرانتز/کاما داشته باشد — از رویش می‌پریم.
        if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
          let d = 1; i += 2;
          while (i < src.length && d > 0) { if (src[i] === '{') d++; else if (src[i] === '}') d--; i++; }
          continue;
        }
        i++;
      }
      prevMeaningful = quote;
      continue;
    }

    if (c === '/' && /[(,=:&|!?+\-*%~^[{;]/.test(prevMeaningful)) {
      // regex literal — تا `/`ِ بسته، با احترام به \ و کلاسِ [...]
      i++;
      let inClass = false;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { i++; break; }
        else if (src[i] === '\n') break; // قسمت نشد regex بوده
        i++;
      }
      while (i < src.length && /[a-z]/.test(src[i])) i++; // فلگ‌ها
      prevMeaningful = '/';
      continue;
    }

    if (c === '(' || c === '[' || c === '{') { depth++; prevMeaningful = c; i++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) { pushArg(i); return { args, end: i }; }
      prevMeaningful = c; i++; continue;
    }
    if (c === ',' && depth === 1) { pushArg(i); i++; start = i; prevMeaningful = ','; continue; }

    if (!/\s/.test(c)) prevMeaningful = c;
    i++;
  }
  return null; // پرانتزِ نابسته — فایل ناقص یا تجزیه شکست
}

/** آرگومانِ دوم را رده‌بندی می‌کند. */
function classify(argText) {
  const t = argText.trim();
  if (t === '') return 'absent';
  if (/^['"`]/.test(t)) return 'string';
  if (/^\//.test(t)) return 'regex';
  if (/^\{/.test(t)) return 'object';
  return 'value'; // شناسه، کلاسِ خطا، فراخوانی، …
}

const WEAK = new Set(['absent', 'string']);

/** همه‌ی فراخوانی‌هایِ assert.rejects در یک فایل. */
function findCalls(src) {
  const out = [];
  let from = 0;
  for (;;) {
    const idx = src.indexOf(TARGET, from);
    if (idx === -1) break;
    from = idx + TARGET.length;
    // باید دقیقاً `assert.rejects(` باشد، نه `assert.rejectsFoo`
    const after = src.slice(idx + TARGET.length).match(/^\s*\(/);
    if (!after) continue;
    const openIdx = idx + TARGET.length + after[0].length - 1;
    const parsed = splitCallArgs(src, openIdx);
    if (!parsed) continue;
    const kind = parsed.args.length < 2 ? 'absent' : classify(parsed.args[1].text);
    out.push({ line: src.slice(0, idx).split('\n').length, kind, argc: parsed.args.length });
  }
  return out;
}

// ═══ حالتِ گزارش: کلِ مخزن ══════════════════════════════════════════════

function listTestFiles() {
  const out = execFileSync('git', ['ls-files', `${TEST_DIR}*.mts`], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function report() {
  const tally = { absent: 0, string: 0, regex: 0, value: 0, object: 0 };
  const weakFiles = new Set();
  let total = 0;
  for (const rel of listTestFiles()) {
    const calls = findCalls(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
    for (const c of calls) {
      tally[c.kind] = (tally[c.kind] ?? 0) + 1;
      total++;
      if (WEAK.has(c.kind)) weakFiles.add(rel);
    }
  }
  const weak = tally.absent + tally.string;
  console.log(`${total} فراخوانیِ ${TARGET} در ${TEST_DIR} (تجزیه‌شده، نه grep):`);
  console.log(`  آرگومانِ دومِ regex        ${String(tally.regex).padStart(3)}   می‌سنجد`);
  console.log(`  کلاس/شناسه/شیء            ${String(tally.value + tally.object).padStart(3)}   می‌سنجد`);
  console.log(`  بدونِ آرگومانِ دوم          ${String(tally.absent).padStart(3)}   هیچ نمی‌سنجد`);
  console.log(`  رشته به‌عنوانِ آرگومانِ دوم  ${String(tally.string).padStart(3)}   هیچ نمی‌سنجد ← Node رشته را پیام می‌خواند`);
  console.log(`  ${'─'.repeat(46)}`);
  console.log(`  ${weak} از ${total} ضعیف (${total ? Math.round((weak / total) * 100) : 0}٪) در ${weakFiles.size} فایل`);
  console.log('');
  console.log('⚠️ «ضعیف» یعنی **غلط نیست** — این ادعاها واقعاً ثابت می‌کنند رد شد.');
  console.log('   نقص این است که اگر هویتِ شکست عوض شود، سبز می‌مانند.');
  console.log('');
  console.log('این گزارش خبری است و exit را عوض نمی‌کند؛ گیت روی دیف است، نه اینجا.');
  process.exit(0);
}

// ═══ حالتِ ratchet: فقط دیف ═════════════════════════════════════════════

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

/** SHAِ تماماً صفر — گیت‌هاب برایِ «هیچ کامیتِ قبلی‌ای نبود» می‌فرستدش. */
const ZERO_SHA = /^0{40}$/;

function resolveBase() {
  let explicit = process.env.REJECTS_BASE?.trim();
  // ⚠️ اولین push روی یک شاخه‌ی تازه `event.before` را تماماً صفر می‌دهد.
  // اگر همین‌طور جلو می‌رفت، ابزار خطا می‌داد و **ساختنِ شاخه** را قرمز
  // می‌کرد — گیتی که کارِ بی‌ربط را می‌شکند، همان گیتی است که آدم‌ها یاد
  // می‌گیرند دورش بزنند. پس «صفر» = «باز هم نمی‌دانم»، و به شاخه‌ی اصلی
  // برمی‌گردیم؛ نه سکوت، نه شکست.
  if (explicit && ZERO_SHA.test(explicit)) {
    console.log('base از رویدادِ push تماماً صفر بود (شاخه‌ی تازه) — به origin/main برمی‌گردیم.');
    explicit = undefined;
  }
  const candidates = explicit ? [explicit] : ['origin/main', 'main'];
  for (const ref of candidates) {
    try {
      // stderr خفه می‌شود: امتحانِ نافرجامِ یک کاندیدا **خطا نیست**، و
      // `fatal: Needed a single revision`ِ گیت پیامِ خودمان را گل‌آلود می‌کند.
      const sha = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
        cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      return { ref, sha };
    } catch { /* کاندیدایِ بعدی */ }
  }
  // ثابتِ طراحیِ ۲: baseِ resolve‌نشده **خطاست**، نه سبز. گاردی که نتواند
  // دیف را تعیین کند، هیچ نمی‌داند — و «هیچ نمی‌دانم» هرگز «قبول» نیست.
  console.error(`✗ baseِ دیف resolve نشد (امتحان شد: ${candidates.join('، ')}).`);
  console.error('  REJECTS_BASE را ست کن. در CI با fetch-depth: 0 و یک fetchِ صریحِ base.');
  console.error('  بدونِ base این گارد نمی‌داند چه چیزی «تازه» است — پس سبز نمی‌دهد.');
  process.exit(1);
}

function main() {
  if (process.argv.includes('--report')) return report();

  const base = resolveBase();
  let mergeBase;
  try { mergeBase = git(['merge-base', base.sha, 'HEAD']); } catch { mergeBase = base.sha; }

  const changed = git(['diff', '--name-only', '--diff-filter=ACMR', mergeBase, 'HEAD'])
    .split('\n').filter((f) => f.startsWith(TEST_DIR) && f.endsWith('.mts'));

  console.log(`base: ${base.ref} (${mergeBase.slice(0, 7)}) · فایل‌هایِ تستِ تغییرکرده: ${changed.length}`);

  if (changed.length === 0) {
    // سبز، ولی **گویا** — نه یک ✓ که شبیهِ پوشش به‌نظر برسد.
    console.log('هیچ فایلِ تستی در این دیف عوض نشده، پس **هیچ ادعایِ تازه‌ای بررسی نشد**.');
    console.log('این «همه‌چیز خوب است» نیست؛ «چیزی برای سنجیدن نبود» است.');
    process.exit(0);
  }

  const failures = [];
  let checked = 0;

  for (const rel of changed) {
    const abs = path.join(REPO_ROOT, rel);
    if (!existsSync(abs)) continue; // در دیف بود ولی حالا نیست (rename/حذف)
    const nowCalls = findCalls(readFileSync(abs, 'utf8'));

    // خطوطِ **افزوده‌شده** در این دیف — فقط ادعایِ تازه سنجیده می‌شود.
    const patch = git(['diff', '-U0', mergeBase, 'HEAD', '--', rel]);
    const addedLines = new Set();
    let newLine = 0;
    for (const l of patch.split('\n')) {
      const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (h) { newLine = Number(h[1]); continue; }
      if (l.startsWith('+') && !l.startsWith('+++')) { addedLines.add(newLine); newLine++; }
      else if (!l.startsWith('-') && !l.startsWith('---')) newLine++;
    }

    for (const c of nowCalls) {
      if (!addedLines.has(c.line)) continue; // ادعایِ موجود — ratchet دست نمی‌زند
      checked++;
      if (WEAK.has(c.kind)) {
        failures.push({
          where: `${rel}:${c.line}`,
          kind: c.kind,
          msg: c.kind === 'absent'
            ? 'آرگومانِ دوم ندارد — فقط «رد شد» را می‌سنجد، نه اینکه **چرا**. اگر هویتِ شکست عوض شود سبز می‌ماند.'
            : 'آرگومانِ دومش یک **رشته** است. Node رشته را پیامِ خطای خودِ assert می‌خواند، نه انتظار — پس هیچ‌چیز سنجیده نمی‌شود، در حالی که خواندنش شبیهِ پوشش است.',
        });
      }
    }
  }

  console.log(`ادعاهایِ ${TARGET}ِ **تازه** در این دیف: ${checked}`);
  console.log('');

  if (failures.length > 0) {
    console.error(`✗ ${failures.length} ادعایِ تازه هویتِ شکست را نمی‌سنجد:`);
    for (const f of failures) console.error(`  · [${f.kind}] ${f.where}\n      ${f.msg}`);
    console.error('');
    console.error('رفع: آرگومانِ دوم را یک ماچرِ واقعی کن —');
    console.error("  assert.rejects(fn, /SLOT_FULL/)            یا");
    console.error("  assert.rejects(fn, (e) => e.code === 'SLOT_FULL')");
    console.error('  پیامِ توضیحی جایش آرگومانِ **سوم** است، نه دوم.');
    console.error('');
    console.error('این گیت فقط ادعاهایِ تازه را می‌سنجد؛ کدِ موجود عمداً دست‌نخورده است.');
    process.exit(1);
  }

  console.log(`✓ هر ادعایِ ${TARGET}ِ تازه در این دیف هویتِ شکست را می‌سنجد.`);
  process.exit(0);
}

main();
