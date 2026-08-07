-- ═══════════════════════════════════════════════════════════════════════
--  ۰۳۵ — رفعِ drift: ستونِ tenants.version وجود نداشت
--
--  کشف‌شده با تستِ واقعیِ end-to-end رویِ Postgresِ محلی (نه فرض): schema.prisma
--  از قبل «version Int @default(1)» را رویِ Tenant تعریف کرده بود (برایِ
--  Optimistic Locking — جلوگیری از Lost Update در ویرایشِ همزمان)، ولی هیچ
--  migrationِ SQL‌ای این ستون را واقعاً نساخته بود — نه در 0_init، نه در
--  ۰۳۴ فایلِ افزایشیِ بعدی.
--
--  اثرِ واقعی: هر db.tenant.create(...) بدونِ select صریح (مثلِ مسیرِ
--  زنده‌ی trial provisioning در lib/site-orders.ts) چون Prisma به‌صورتِ
--  پیش‌فرض همه‌ی ستون‌های اسکالر را برمی‌گرداند، با خطایِ P2022
--  («The column `version` does not exist») شکست می‌خورد — یعنی مسیرِ
--  اصلیِ ثبت‌نامِ رایگان از سایت می‌توانست در محیطی که این drift دارد
--  کاملاً از کار بیفتد.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
