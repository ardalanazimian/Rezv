#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گیتِ A3 — حذفِ فیچر و پذیرشِ ریسک
//
//  دستورِ خودمختاریِ v2 §A3: پیش‌شرط، یک ردیف در docs/DECISIONS.md با بسته‌ی
//  a–f، «کاربر چه می‌بیند»، و هزینه‌ی برگشت. حذف علاوه بر آن اثباتِ اینکه هیچ
//  چیزی به آن وابسته نیست (file:line) لازم دارد.
//
//  اجرا:  node tools/gate-decision.mjs --id D-00X [--removal]
//  خروج:  ۰ = ردیف کامل است · غیرِصفر = ناقص، با نامِ دقیقِ بندِ غایب
//
//  ⚠️ این گیت **کیفیتِ** تصمیم را قضاوت نمی‌کند — نمی‌تواند. چیزی که می‌سنجد
//     این است که تصمیم واقعاً ثبت شده و هیچ بندی خالی نمانده. ادعای بزرگ‌تری
//     از این نمی‌کند، چون گیتی که ادعای بزرگ‌تر از توانش کند خودش fake-green است.
// ═══════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = join(REPO, 'docs/DECISIONS.md');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };
const id = arg('--id');
const isRemoval = argv.includes('--removal');

const deny = (r) => { console.error(`❌ گیتِ A3 رد کرد.\n   دلیل: ${r}`); process.exit(1); };

if (!id) deny('--id داده نشد');
if (!existsSync(LEDGER)) deny(`${LEDGER} وجود ندارد — دفترِ تصمیم هنوز ساخته نشده`);

const text = readFileSync(LEDGER, 'utf8').replace(/\r\n/g, '\n');

// هر ردیف با «## <ID> — ...» شروع می‌شود و تا سرتیترِ بعدی ادامه دارد.
const sections = text.split(/\n(?=## )/).filter((s) => s.startsWith('## '));
if (sections.length === 0) deny('هیچ ردیفی در دفتر پیدا نشد — نبودِ موضوع خطاست، نه عبور');

const entry = sections.find((s) => new RegExp(`^## \\s*${id}\\b`).test(s));
if (!entry) {
  const ids = sections.map((s) => (s.match(/^## \s*(\S+)/) ?? [])[1]).filter(Boolean).join(' | ');
  deny(`ردیفی با شناسه‌ی «${id}» نیست. ردیف‌های موجود: ${ids || '(هیچ)'}`);
}

// هر بند باید هم وجود داشته باشد و هم **محتوا** داشته باشد. یک برچسبِ خالی
// همان «سبزِ توخالی» است که این پروژه سه بار خورده.
const REQUIRED = [
  ['a.', 'منبع'],
  ['b.', 'نسب‌نامه'],
  ['c.', 'وابستگیِ امروز'],
  ['d.', 'تصمیم'],
  ['e.', 'کاربر چه می‌بیند'],
  ['f.', 'برگشت‌پذیری'],
];

const missing = [];
const empty = [];
for (const [key, label] of REQUIRED) {
  const re = new RegExp(`\\*\\*${key.replace('.', '\\.')}[^*]*\\*\\*([^\\n]*(?:\\n(?!\\s*-\\s\\*\\*|## )[^\\n]*)*)`);
  const m = re.exec(entry);
  if (!m) { missing.push(`${key} ${label}`); continue; }
  const body = m[1].replace(/[\s—–\-]/g, '');
  if (body.length < 3) empty.push(`${key} ${label}`);
}
if (missing.length) deny(`بندهای غایب: ${missing.join('، ')}`);
if (empty.length) deny(`بندهای خالی (برچسب هست، محتوا نیست): ${empty.join('، ')}`);

// خطِ گیت باید کدِ خروجِ واقعی داشته باشد، نه ادعای نثری.
if (!/\*\*گیت:\*\*/.test(entry)) deny('خطِ **گیت:** ندارد — کدام گیت این تصمیم را مجاز کرده؟');

if (isRemoval) {
  // حذف بارِ اثباتِ سنگین‌تری دارد: باید نشان دهد هیچ‌چیز وابسته نیست، با file:line.
  const c = /\*\*c\.[^*]*\*\*([\s\S]*?)(?=\n\s*-\s\*\*d\.|\n## |$)/.exec(entry)?.[1] ?? '';
  const hasFileLine = /[\w./-]+\.(ts|tsx|mts|js|mjs|css|html|sql|sh|py|yml|json):\d+/.test(c);
  const saysNothing = /هیچ\s*[‌]?چیز/.test(c);
  if (!hasFileLine && !saysNothing) {
    deny('حذف نیاز به اثباتِ عدمِ وابستگی دارد: بندِ c باید یا file:line بیاورد یا صریحاً بگوید «هیچ‌چیز اجرایش نمی‌کند»');
  }
}

console.log(`✅ گیتِ A3 مجاز کرد — ردیفِ «${id}» کامل است${isRemoval ? ' (شاملِ اثباتِ عدمِ وابستگی)' : ''}`);
