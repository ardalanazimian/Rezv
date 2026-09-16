#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ ایستا — `session_replication_role` هرگز در کدِ اپ ظاهر نشود
//  (بندِ ۶ی FP-009، docs/DECISIONS.md · ۲۰۲۶-۰۹-۱۶)
//
//  چرا وجود دارد: `SET [LOCAL] session_replication_role = replica` **همه‌ی**
//  تریگرهای کاربر را در همان نشستِ Postgres خاموش می‌کند. پروبِ Red Team
//  (`docs/audit/redteam/probe-rt24-089-triggers.sql`، گامِ ۶) با همین یک خط
//  تریگرهای دفترِ امتیاز را دور زد و `DELETE 2` گرفت. یعنی هر تضمینی که روی
//  تریگر ایستاده — از جمله «دفترِ امتیاز تغییرناپذیر است» — با یک خط SQL از
//  داخلِ کد قابلِ خاموش‌کردن است.
//
//  ⚠️ این گارد **درِ SUPERUSER را نمی‌بندد** و ادعایش را هم نمی‌کند:
//    • اپ با نقشِ owner/SUPERUSER وصل می‌شود (`P0-022`) و آن ردیف همان‌جا
//      پارک است؛ تا وقتی نقش عوض نشود، هر کسی که به DB دسترسی دارد می‌تواند
//      این پارامتر را دستی ست کند.
//    • این اسکریپت فقط `api/src/**` را می‌خواند: نه مهاجرت‌های SQL، نه
//      `api/tests/**`، نه اسکریپت‌های عملیاتی، نه `psql`ی که کسی دستی می‌زند،
//      و نه مقدارِ واقعیِ پارامتر در زمانِ اجرا (آن را فقط یک پروبِ زنده
//      می‌بیند: `SELECT current_setting('session_replication_role')`).
//  پس ادعایش دقیقاً یک چیز است: **هیچ مسیرِ کدی در اپ عمداً از این در رد
//  نمی‌شود.** بیشتر از این را از این فایل نخوان.
//
//  ⚠️ کنترلِ مثبت اجباری است (قاعده‌ی ۲ی CLAUDE.md): گاردی که نتواند نشان
//  دهد **می‌بیند**، از «صفر یافته» و «اسکنر خراب» یک چیز می‌فهمد. این فایل
//  پیش از هر ادعایی الگو را روی نمونه‌های ساختگی می‌آزماید و اگر نگیردشان،
//  با کدِ ۲ («گیت اجرا نشد») می‌میرد، نه با ۰.
// ═══════════════════════════════════════════════════════════════════════
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SCAN_DIR = join(ROOT, 'api', 'src');
const GATE_DID_NOT_RUN = 2;

/** خودِ ادعا: هر شکلی از این پارامتر، با هر فاصله/کوتیشن، در هر جای فایل. */
const PATTERN = /session_replication_role/i;

/** نمونه‌های ساختگی — هیچ‌کدام از مخزن نمی‌آیند؛ فقط ابزار را می‌سنجند. */
const MUST_MATCH = [
  "await db.$executeRawUnsafe(\"SET LOCAL session_replication_role = 'replica'\");",
  '// TODO: SET session_replication_role = replica before bulk import',
  "prisma.$queryRaw`SET session_replication_role TO replica`",
  'const p = "SESSION_REPLICATION_ROLE";',
];
const MUST_NOT_MATCH = [
  "await db.$executeRaw`SET LOCAL statement_timeout = '5s'`;",
  'const role = auth.role;',
  'session.replicationLag',
];

function selfTest() {
  const missed = MUST_MATCH.filter((s) => !PATTERN.test(s));
  const falsePos = MUST_NOT_MATCH.filter((s) => PATTERN.test(s));
  if (missed.length || falsePos.length) {
    console.error('⛔ خودِ گارد خراب است — گیت اجرا نشد (این «صفر یافته» نیست):');
    for (const s of missed) console.error(`   ندید: ${s}`);
    for (const s of falsePos) console.error(`   مثبتِ کاذب: ${s}`);
    process.exit(GATE_DID_NOT_RUN);
  }
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

selfTest();

let files;
try {
  if (!statSync(SCAN_DIR).isDirectory()) throw new Error('not a directory');
  files = walk(SCAN_DIR);
} catch (e) {
  console.error(`⛔ ${relative(ROOT, SCAN_DIR)} خوانده نشد — گیت اجرا نشد: ${e.message}`);
  process.exit(GATE_DID_NOT_RUN);
}

// دامنه‌ی خالی یعنی مسیر عوض شده، نه اینکه کد پاک است.
if (files.length < 50) {
  console.error(`⛔ فقط ${files.length} فایل زیرِ ${relative(ROOT, SCAN_DIR)} دیده شد — دامنه مشکوک است، گیت اجرا نشد.`);
  process.exit(GATE_DID_NOT_RUN);
}

const hits = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (PATTERN.test(line)) hits.push(`${relative(ROOT, f).split(sep).join('/')}:${i + 1}: ${line.trim().slice(0, 140)}`);
  });
}

if (hits.length) {
  console.error('');
  console.error('✗ نقضِ بندِ ۶ی FP-009 — `session_replication_role` در کدِ اپ:');
  for (const h of hits) console.error(`    ${h}`);
  console.error('');
  console.error('  این پارامتر همه‌ی تریگرهای نشست را خاموش می‌کند — از جمله سه تریگرِ');
  console.error('  دفترِ امتیاز (مهاجرتِ ۰۸۹) که تضمینِ «امتیاز هرگز منقضی نمی‌شود» رویشان');
  console.error('  ایستاده. اگر واقعاً به bulk-import بدونِ تریگر نیاز داری، آن یک تصمیمِ');
  console.error('  ثبت‌شده در docs/DECISIONS.md می‌خواهد، نه یک خط در مسیرِ درخواست.');
  process.exit(1);
}

console.log(`✓ session_replication_role در ${files.length} فایلِ api/src نیست — و اسکنر روی ${MUST_MATCH.length} نمونه‌ی ساختگی ثابت کرد که می‌بیندش.`);
console.log('  ⚠️ دامنه: فقط api/src. درِ SUPERUSER (P0-022)، مهاجرت‌ها، تست‌ها و psqlِ دستی را نمی‌سنجد.');
