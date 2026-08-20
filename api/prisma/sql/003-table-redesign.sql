-- ═══════════════════════════════════════════════════════════
--  رزرونو — Migration بازطراحی مدیریت میز
--
--  برای دیتابیس موجود (production). راه‌اندازی جدید نیازی ندارد
--  (prisma db push خودکار می‌سازد).
--
--  ⚠️ هیچ داده‌ای حذف نمی‌شود. ستون min_capacity به min_party_size
--     تغییرِنام می‌دهد (RENAME، نه DROP) تا داده حفظ شود.
-- ═══════════════════════════════════════════════════════════

-- ── enumهای جدید ──
DO $$ BEGIN
  CREATE TYPE table_shape AS ENUM ('rectangle','round','booth');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE table_zone AS ENUM ('indoor','outdoor','window','vip','smoking');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE table_state AS ENUM ('free','reserved','occupied','cleaning','maintenance');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── تغییرِنام min_capacity → min_party_size (حفظ داده) ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_name='tables' AND column_name='min_capacity') THEN
    ALTER TABLE tables RENAME COLUMN min_capacity TO min_party_size;
  END IF;
END $$;

-- ── ستون‌های جدید (همه با پیش‌فرض امن) ──
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS max_party_size SMALLINT,
  ADD COLUMN IF NOT EXISTS shape table_shape NOT NULL DEFAULT 'rectangle',
  ADD COLUMN IF NOT EXISTS zone table_zone NOT NULL DEFAULT 'indoor',
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_smoking BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_accessible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_mergeable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_splittable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pos_x SMALLINT,
  ADD COLUMN IF NOT EXISTS pos_y SMALLINT,
  ADD COLUMN IF NOT EXISTS rotation SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_duration_minutes SMALLINT,
  ADD COLUMN IF NOT EXISTS state table_state NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- ── میزهایی که از قبل mergeableWith دارند، isMergeable را true کن ──
UPDATE tables SET is_mergeable = true
  WHERE array_length(mergeable_with, 1) > 0 AND is_mergeable = false;

-- ── یکتایی qr_code ──
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS tables_qr_code_key ON tables (qr_code) WHERE qr_code IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN null; END $$;

-- ── ایندکس‌های جدید ──
-- نکته: CONCURRENTLY حذف شد چون داخل transaction کار نمی‌کند و apply-sql.sh
-- (prisma db execute) فایلِ چندجمله‌ای را در یک transaction ضمنی اجرا می‌کند؛
-- روی جدول tables در راه‌اندازی قفل بی‌اهمیت است. برای افزودن روی جدولِ پر در
-- production، این دو را جدا با CREATE INDEX CONCURRENTLY اجرا کن.
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_state
  ON tables (restaurant_id, state);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_zone
  ON tables (restaurant_id, zone);

ANALYZE tables;
