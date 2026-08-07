-- ═══════════════════════════════════════════════════════════════════════
--  ۰۳۶ — رفعِ drift: چند ستونِ schema.prisma هیچ‌وقت واقعاً migrate نشده بودند
--
--  کشف‌شده با تستِ واقعیِ end-to-end رویِ Postgresِ محلی (اجرایِ کاملِ
--  0_init + apply-sql.sh رویِ یک DBِ خالی، سپس seed) — نه با فرض. دقیقاً
--  همان الگویی که کامنتِ خودِ 021b قبلاً برایِ sms_transactions مستند کرده
--  بود («فقط از راهِ prisma db push در CI ساخته می‌شد») برایِ این ستون‌ها
--  هم اتفاق افتاده — مدل‌ها در schema.prisma هستند، ولی هیچ فایلِ SQL این
--  ستون‌های خاص را نساخته بود.
--
--  اثرِ واقعی روی نصبِ تازه (0_init+apply-sql.sh، بدونِ prisma db push):
--  هر db.restaurant.create(...) یا db.user.create(...) بدونِ select صریح،
--  با P2022 («column does not exist») شکست می‌خورد — دقیقاً همان الگویی
--  که برایِ tenants.version در ۰۳۵ پیدا شد.
--
--  restaurants: ساعتِ کاری، قواعدِ قیمت‌گذاریِ AI، حداقل مبلغ، heartbeat
--  آنلاین‌بودن، و موجودیِ پیامک — همه‌شان از قبل در کدِ برنامه استفاده
--  می‌شدند (hours.ts، pricing.ts، sms.ts) ولی ستونشان وجود نداشت.
--  users.email: فیلدِ اختیاریِ یکتا (برایِ آینده — ورودِ ایمیلی/رسید).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS opening_hours        jsonb,
  ADD COLUMN IF NOT EXISTS pricing_rules        jsonb,
  ADD COLUMN IF NOT EXISTS base_min_spend_toman integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_seen_at         timestamptz,
  ADD COLUMN IF NOT EXISTS online_gating        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_balance          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sms_total_sent       integer NOT NULL DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email text;

-- @unique در schema.prisma — چند NULL مجاز است (رفتارِ استانداردِ Postgres
-- برای UNIQUE INDEX)، فقط مقادیرِ غیرِNULLِ تکراری رد می‌شوند.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email);
