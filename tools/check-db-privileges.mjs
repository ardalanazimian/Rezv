#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
//  گاردِ P0-022 — امتیازهای نقشی که اپ با آن به دیتابیس وصل می‌شود
//
//  منشأ: پروبِ Red Team (`rezv-18`)، نسخه‌ی مرجع در `session/rezv-8c-launch`
//  و ریپوی خصوصی `Rezv-security`. falsifiability محور‌به‌محور آنجا اثبات شد.
//  این فایل نسخه‌ی یکپارچه‌شده روی main است. گواهیِ تولید را سازنده نمی‌دهد.
//
//  ── چرا یک پروبِ زنده، و چرا گاردِ ایستا کافی نیست ──
//  `tools/check-session-replication-role.mjs` فقط `api/src/**` را می‌خواند و در
//  سرآیندِ خودش می‌گوید درِ SUPERUSER را نمی‌بندد. `SET session_replication_role
//  = replica` همه‌ی تریگرهای کاربر را در همان نشست خاموش می‌کند — و پروبِ
//  `probe-rt24-089-triggers.sql` با همان یک خط تریگرهای دفترِ امتیاز را دور زد.
//  یعنی کلِ تضمینِ «دفترِ امتیاز تغییرناپذیر است» (FP-009) روی این می‌ایستد که
//  نقشِ اتصال **نتواند** آن کار را بکند. آن را فقط یک پروبِ زنده می‌بیند.
//
//  سه محور، همه از اتصالِ زنده (`current_user` / `pg_roles` / `pg_class.relowner`)
//  نه از فایلِ پیکربندی:
//    • `rolsuper`      — می‌تواند session_replication_role را ست کند
//    • `rolbypassrls`  — مرزِ تنانتِ RLS برای این نقش بی‌اثر است
//    • مالکیتِ جدول    — مالک می‌تواند ALTER TABLE … DISABLE TRIGGER بزند
//
//  اجرا:  node tools/check-db-privileges.mjs
//  خروج:  ۰ پاس · ۱ قرمز · ۲ UNKNOWN (fail-closed)
// ═══════════════════════════════════════════════════════════════════
import { Prisma, PrismaClient } from '../api/node_modules/@prisma/client/index.js';

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

const unknown = (why) => {
  console.error(`⚠️ P0-022 UNKNOWN (fail-closed) — ${why}`);
  process.exit(2);
};

if (!process.env.DATABASE_URL || !String(process.env.DATABASE_URL).trim()) {
  unknown('DATABASE_URL تنظیم نشده');
}

const prisma = new PrismaClient();

let rows;
try {
  rows = await prisma.$queryRaw`
    SELECT current_user::text AS role,
           r.rolsuper,
           r.rolbypassrls,
           (SELECT count(*)::int
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public'
               AND c.relkind = 'r'
               AND c.relname IN (${Prisma.join(LEDGER_TABLES)})
               AND c.relowner = r.oid) AS owned
      FROM pg_roles r
     WHERE r.rolname = current_user`;
} catch (err) {
  await prisma.$disconnect().catch(() => {});
  const raw = String((err && (err.message || err.code)) || err);
  const first = raw.split('\n').map((l) => l.trim()).find((l) => l.length > 0) || 'بدونِ پیام';
  unknown(`نقشِ اتصالِ زنده خوانده نشد: ${first}`);
}
await prisma.$disconnect().catch(() => {});

const row = rows && rows[0];
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
