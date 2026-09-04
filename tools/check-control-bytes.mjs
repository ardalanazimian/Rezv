#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ بایتِ کنترلیِ نامرئی
//
//  چرا (ششمین نمونه‌ی fake-green در این مخزن، و اولینی که از خواندن پیدا
//  نمی‌شد): یک `\b` که از مسیرِ heredoc نوشته شد به **بایتِ واقعیِ backspace**
//  (`\x08`) تبدیل شد. فایل در ادیتور و در diff کاملاً عادی به‌نظر می‌رسید،
//  Node بدونِ خطا اجرایش کرد، و regex هرگز match نکرد — یعنی گارد سبز بود و
//  هیچ چیزی را نمی‌سنجید. فقط `od -c` رویِ آن خط لوش داد.
//
//  پنج نمونه‌ی قبلی همه با خواندنِ دقیقِ کد قابلِ کشف بودند. این یکی نبود.
//  به همین دلیل یک گاردِ جدا لازم دارد، نه یک قاعده‌ی نوشتاری.
//
//  اجرا:  node tools/check-control-bytes.mjs
//  خروج:  ۰ تمیز · ۱ با file:line و آفستِ بایت
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// دامنه: هر چیزی که **اجرا** می‌شود. یک بایتِ کنترلی در یک .md زشت است؛ در یک
// اسکریپت می‌تواند بی‌صدا یک گارد را از کار بیندازد.
const SCOPE = ['tools/', '.github/workflows/', 'deploy/', 'api/prisma/', 'cron/', 'backup/'];
const RUNNABLE = /\.(mjs|js|ts|mts|sh|yml|yaml|sql|py)$/;

// مجاز: tab (\t=9) · LF (10) · CR (13). بقیه‌ی C0 و DEL ممنوع‌اند.
const FORBIDDEN = (c) => (c < 0x20 && c !== 9 && c !== 10 && c !== 13) || c === 0x7f;

let files;
try {
  files = execFileSync('git', ['ls-files', ...SCOPE], { cwd: REPO, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((f) => f && RUNNABLE.test(f));
} catch (e) {
  console.error('❌ git ls-files نشد:', String(e));
  process.exit(1);
}

// قاعده‌ی ۵: نبودِ موضوع خطاست، نه عبور.
if (files.length === 0) {
  console.error('❌ هیچ فایلِ اجراشدنی‌ای پیدا نشد — گاردِ توخالی، دامنه یا الگو شکسته است');
  process.exit(1);
}

const hits = [];
for (const f of files) {
  const buf = readFileSync(join(REPO, f));
  let line = 1;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === 10) { line++; continue; }
    if (FORBIDDEN(c)) {
      hits.push(`${f}:${line} — بایتِ 0x${c.toString(16).padStart(2, '0')} در آفستِ ${i}`);
    }
  }
}

if (hits.length) {
  console.error(`❌ بایتِ کنترلیِ نامرئی — ${hits.length} مورد:\n`);
  for (const h of hits.slice(0, 40)) console.error('  • ' + h);
  if (hits.length > 40) console.error(`  … و ${hits.length - 40} موردِ دیگر`);
  console.error('\nاین‌ها معمولاً از heredoc می‌آیند: یک `\\b` به بایتِ backspace تبدیل می‌شود و');
  console.error('regex بی‌صدا از کار می‌افتد. اسکریپتِ حاویِ regex را با ابزارِ فایل بنویس.');
  process.exit(1);
}

console.log(`✓ بدونِ بایتِ کنترلی — ${files.length} فایلِ اجراشدنی بررسی شد`);
