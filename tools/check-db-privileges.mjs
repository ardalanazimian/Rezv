#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  گاردِ P0-022 — امتیازهای نقشی که اپ با آن به دیتابیس وصل می‌شود
//
//  منشأ: پروبِ Red Team (`rezv-18`)، نسخه‌ی مرجع در ریپوی خصوصی
//  `Rezv-security @ 348e8ea` (`redteam/2026-09-18-p0022-gate/`). آنجا
//  falsifiability محور‌به‌محور اثبات شده بود. این نسخه، نسخه‌ی یکپارچه‌شده است.
//
//  ⚠️ قاعده‌ای که Red Team خودش گذاشت و اینجا رعایت می‌شود: کسی که می‌سازد،
//  گواهیِ نسخه‌ی شیپ‌شده را نمی‌دهد. پس falsifiabilityِ **این** فایل را نه من
//  می‌گیرم نه او — CEO تعیین می‌کند چه کسی.
//
//  ── چرا یک پروبِ زنده، و چرا گاردِ ایستا کافی نیست ──
//  `tools/check-session-replication-role.mjs` فقط `api/src/**` را می‌خواند و در
//  سرآیندِ خودش می‌گوید درِ SUPERUSER را نمی‌بندد. `SET session_replication_role
//  = replica` همه‌ی تریگرهای کاربر را در همان نشست خاموش می‌کند — و پروبِ
//  `probe-rt24-089-triggers.sql` با همان یک خط تریگرهای دفترِ امتیاز را دور زد.
//  یعنی کلِ تضمینِ «دفترِ امتیاز تغییرناپذیر است» (FP-009) روی این می‌ایستد که
//  نقشِ اتصال **نتواند** آن کار را بکند. آن را فقط یک پروبِ زنده می‌بیند.
//
//  سه محوری که می‌سنجد، همه از `pg_roles` برای `current_user`:
//    • `rolsuper`      — سوپریوزر می‌تواند `session_replication_role` را ست کند
//                        و از هر تریگرِ append-only رد شود.
//    • `rolbypassrls`  — مرزِ تنانتِ RLS برای این نقش بی‌اثر است.
//    • مالکیتِ جدول    — مالکِ جدول می‌تواند `ALTER TABLE … DISABLE TRIGGER` بزند.
//
//  ── آنچه **نمی‌سنجد** (بندِ ۴c: falsifiability محورمحور است) ──
//  • امتیازهای **ایستا**ی نقش را می‌خواند، نه مقدارِ لحظه‌ایِ
//    `session_replication_role` را. اگر نقش سوپریوزر باشد، خودِ همان محور قرمز
//    می‌شود — یعنی یافته همان است، نه اینکه از قلم بیفتد.
//  • GRANTهای جدولی، نقش‌های `SET ROLE`پذیر، و امتیازهای موروثی از نقشِ دیگر.
//  • این پروب با **همان** DATABASE_URLی معنا دارد که اپ در تولید با آن وصل
//    می‌شود. اجرا روی دیتابیسِ CI چیزِ دیگری را می‌سنجد و نباید «سبزِ تولید»
//    خوانده شود.
//
//  اجرا:  node tools/check-db-privileges.mjs
//  خروج:  ۰ پاس · ۱ قرمز با محورهای نام‌برده · ۲ UNKNOWN (fail-closed)
//
//  ⚠️ خروجِ ۲ عمداً از ۱ جداست: «نتوانستم موضوع را بخوانم» با «خواندم و بد بود»
//  یکی نیست، و هیچ‌کدام pass نیست. گیت هر دو را رد می‌کند.
// ═══════════════════════════════════════════════════════════════════════
import { PrismaClient } from '../api/node_modules/@prisma/client/index.js';

// همان مجموعه‌ای که S-03 و FP-009 درباره‌اش‌اند: دفترهای append-only.
const LEDGER_TABLES = [
  'points_ledger',
  'reservation_events',
  'audit_logs',
  'platform_events',
  'economy_ledger_entries',
  'sms_transactions',
  'campaign_logs',
  'coupon_redemptions',
  'reward_redemptions',
];

const prisma = new PrismaClient();

const unknown = (why) => {
  console.error(`⚠️ P0-022 UNKNOWN (fail-closed) — ${why}`);
  process.exit(2);
};

let rows;
try {
  // پارامتری، نه الحاقِ رشته: نامِ جدول‌ها از این فایل می‌آید ولی همان قاعده
  // بی‌استثنا رعایت می‌شود.
  rows = await prisma.$queryRawUnsafe(
    `SELECT current_user::text AS role,
            r.rolsuper,
            r.rolbypassrls,
            (SELECT count(*)::int
               FROM pg_class c
              WHERE c.relname = ANY(string_to_array($1, ','))
                AND c.relowner = r.oid) AS owned
       FROM pg_roles r
      WHERE r.rolname = current_user`,
    LEDGER_TABLES.join(','),
  );
} catch (err) {
  await prisma.$disconnect().catch(() => {});
  // اولین خطِ **غیرِخالی** — پیامِ Prisma با چند خطِ خالی شروع می‌شود و
  // `split('\n')[0]` یک رشته‌ی تهی می‌داد، یعنی اپراتور دلیلی نمی‌دید.
  const raw = String((err && (err.message || err.code)) || err);
  const first = raw.split('\n').map((l) => l.trim()).find((l) => l.length > 0) || 'بدونِ پیام';
  unknown(`نقشِ اتصالِ زنده خوانده نشد: ${first}`);
}
await prisma.$disconnect().catch(() => {});

const row = rows && rows[0];
// نبودِ موضوع خطاست، نه pass (بندِ ۴ منشور).
if (!row) unknown('current_user در pg_roles پیدا نشد');

const axes = `rolsuper · rolbypassrls · مالکیتِ ${LEDGER_TABLES.length} جدولِ دفتر`;
const fails = [];
if (row.rolsuper) {
  fails.push('rolsuper=true — می‌تواند session_replication_role=replica بزند و از هر تریگرِ append-only رد شود');
}
if (row.rolbypassrls) {
  fails.push('rolbypassrls=true — مرزِ تنانتِ RLS برای این نقش بی‌اثر است');
}
if (Number(row.owned) > 0) {
  fails.push(`مالکِ ${row.owned} جدولِ دفتر است — می‌تواند ALTER TABLE … DISABLE TRIGGER بزند`);
}

if (fails.length) {
  console.error(`❌ P0-022 قرمز — نقشِ «${row.role}» · محورهای سنجیده: ${axes}`);
  for (const f of fails) console.error(`   · ${f}`);
  console.error('   نقشِ اپ باید غیرِسوپریوزر، بدونِ BYPASSRLS، و غیرِمالکِ جدول‌های دفتر باشد.');
  process.exit(1);
}

console.log(`✓ P0-022 پاس — نقشِ «${row.role}»: نه سوپریوزر، نه BYPASSRLS، مالکِ هیچ جدولِ دفتری نیست · محورهای سنجیده: ${axes}`);
process.exit(0);
