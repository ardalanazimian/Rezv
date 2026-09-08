#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ کلیدِ تاریخِ ساعتِ اجرا — «run-clock → UTC date key» در api/tests/
//
//  ⚠️ چرا این فایل وجود دارد (۲۰۲۶-۰۹-۰۸):
//  `dateKeyInTz(d, tz)` در src/lib/hours.ts دقیقاً برای این ساخته شد که تاریخِ
//  یک لحظه را در تایم‌زونِ رستوران (Asia/Tehran) بدهد، نه در UTC. خودِ تست
//  (`hours.test.mts:148`) این را با assert.notEqual مستندسازی می‌کند: نزدیکِ
//  نیمه‌شبِ تهران، `dateKeyInTz(t, 'Asia/Tehran')` با `t.toISOString().slice(0,10)`
//  فرق می‌کند — تهران UTC+۳:۳۰ است، پس بینِ حدودِ ۲۰:۳۰ و ۲۴:۰۰ به وقتِ UTC،
//  روزِ تهران یک روز جلوتر از روزِ UTC است.
//
//  با این حال ۸ فیکسچرِ تستِ integration دقیقاً همین اشتباه را داشتند: یک
//  مقدارِ **ساعتِ اجرا** (`Date.now()` یا `new Date()` بدونِ آرگومان) را با
//  `.toISOString().slice(0, 10)` به کلیدِ UTC تبدیل می‌کردند و آن را به
//  `createReservation` / کوئری‌هایی می‌دادند که روز را در Asia/Tehran حساب
//  می‌کنند. نتیجه: در همان پنجره‌ی ۳٫۵ساعته، فیکسچر بی‌صدا روزِ اشتباه را
//  هدف می‌گیرد — یک باگِ وابسته به «چه ساعتی CI اجرا شد»، نه به کد.
//
//  این گارد نمونه‌ی نهم را سد می‌کند: هر جا در api/tests/ یک مقدارِ ساعتِ
//  اجرا مستقیماً (بدونِ عبور از dateKeyInTz) به کلیدِ تاریخِ UTC تبدیل شود،
//  قرمز می‌شود.
//
//  ⚠️ چرا با readdirSync و نه `git ls-files` (رجوع به بندِ ۴ج منشور):
//  `check-control-bytes.mjs` دقیقاً همین الگو را با git ls-files پیمایش
//  می‌کند و به همین دلیل یک فایلِ ۰x08دارِ untracked در tools/ را ندید —
//  گارد «✓ تمیز» چاپ کرد درحالی‌که فایلِ خطرناک اصلاً در فهرستش نبود. خطرِ
//  این گارد دقیقاً در یک فیکسچرِ **تازه‌نوشته‌شده** زندگی می‌کند — یعنی درست
//  همان لحظه‌ای که هنوز `git add` نشده. پیمایشِ دیسک، نه ایندکسِ git.
//
//  دامنه‌ی الگو عمداً محدود است: فقط زنجیره‌ای که با چشمِ خودِ `new Date(`
//  شروع شود و به `.toISOString().slice/substring(0, 10)` برسد، و فقط وقتی
//  داخلِ همان `new Date(...)` یا خودِ `Date.now()` هست یا کاملاً خالی است
//  (یعنی «الان»). یک تاریخِ ثابت (`new Date('2026-01-01T21:00:00Z')`) هرگز
//  گرفتار نمی‌شود — طبقِ سفارش: «یک تاریخِ ثابت که به کلیدِ UTC تبدیل شود
//  می‌تواند کاملاً درست باشد».
//
//  اجرا:  node tools/check-run-clock-date-keys.mjs
//  خروج:  ۰ = تمیز · ۱ = حداقل یک نمونه (با file:line چاپ می‌شود)
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TESTS_DIR = join(REPO, 'api/tests');

// ── پیمایشِ بازگشتیِ دیسک (نه git ls-files — رجوع به توضیحِ بالا) ─────────
function collectMtsFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...collectMtsFiles(full));
    else if (e.name.endsWith('.mts')) out.push(full);
  }
  return out;
}

let files;
try {
  files = collectMtsFiles(TESTS_DIR);
} catch (e) {
  console.error(`❌ خواندنِ api/tests شکست خورد: ${String(e)}`);
  process.exit(1);
}

// قاعده‌ی ۵ منشور: نبودِ موضوع خطاست، نه عبور.
if (files.length === 0) {
  console.error('❌ هیچ فایلِ .mts در api/tests پیدا نشد — گاردِ توخالی، مسیر شکسته است');
  process.exit(1);
}

// ── پیداکردنِ پرانتزِ بستنِ متناظر با یک `(` که در openIdx نشسته ───────────
function findMatchingParen(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineOf(src, idx) {
  let line = 1;
  for (let i = 0; i < idx; i++) if (src[i] === '\n') line++;
  return line;
}

// بعد از `)`، عبورِ فضایِ خالی/خطِ جدید و تطبیقِ زنجیره‌ی
// `.toISOString().slice(0, 10)` یا `.toISOString().substring(0, 10)`.
const CHAIN_RE = /^\s*\.\s*toISOString\s*\(\s*\)\s*\.\s*(?:slice|substring)\s*\(\s*0\s*,\s*10\s*\)/;

const hits = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(REPO, file).replace(/\\/g, '/');

  const newDateRe = /new\s+Date\s*\(/g;
  let m;
  while ((m = newDateRe.exec(src))) {
    const openIdx = m.index + m[0].length - 1; // اندیسِ خودِ '('
    const closeIdx = findMatchingParen(src, openIdx);
    if (closeIdx === -1) continue; // پرانتزِ ناقص — مسئولیتِ syntax-checker دیگری‌ست
    const inner = src.slice(openIdx + 1, closeIdx);
    const isRunClock = inner.trim() === '' || /Date\.now\(\)/.test(inner);
    if (!isRunClock) continue;

    const after = src.slice(closeIdx + 1);
    if (CHAIN_RE.test(after)) {
      hits.push(`${rel}:${lineOf(src, m.index)} — new Date(${inner.trim() || ''}).toISOString().slice(0, 10) : از dateKeyInTz استفاده کن`);
    }
  }
}

if (hits.length) {
  console.error(`❌ کلیدِ تاریخِ UTC از مقدارِ ساعتِ اجرا — ${hits.length} مورد:\n`);
  for (const h of hits) console.error('  • ' + h);
  console.error(
    '\nاین الگو نزدیکِ نیمه‌شبِ تهران روزِ اشتباه را هدف می‌گیرد (رجوع به\n' +
    'tests/hours.test.mts:148). به‌جایش: dateKeyInTz(new Date(...), \'Asia/Tehran\')\n' +
    'از src/lib/hours.ts — نه یک تابعِ موازیِ تازه.',
  );
  process.exit(1);
}

console.log(`✓ بدونِ کلیدِ تاریخِ UTCِ ساعتِ اجرا — ${files.length} فایلِ .mts در api/tests بررسی شد`);
