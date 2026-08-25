-- ═══════════════════════════════════════════════════════════
--  رزرونو — Migration گسترش چرخه‌ی حیات رزرو + audit log
--
--  برای دیتابیس موجود. راه‌اندازی جدید نیازی ندارد (prisma db push).
--  ⚠️ هیچ داده‌ای حذف نمی‌شود. وضعیت‌های قدیمی (arrived,
--     cancelled_by_user/restaurant) حفظ می‌شوند.
-- ═══════════════════════════════════════════════════════════

-- ── افزودن وضعیت‌های جدید به enum (قدیمی‌ها دست‌نخورده) ──
-- PostgreSQL: ALTER TYPE ... ADD VALUE خارج از transaction.
DO $$ BEGIN ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'waitlisted'; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'auto_confirmed'; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'preparing'; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'checked_in'; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'running_late'; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'dining'; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'rejected'; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'cancelled'; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TYPE reservation_status ADD VALUE IF NOT EXISTS 'auto_cancelled'; EXCEPTION WHEN others THEN null; END $$;

-- ── جدول audit log (لاگ رویداد رزرو) ──
CREATE TABLE IF NOT EXISTS reservation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  from_status     reservation_status,
  to_status       reservation_status NOT NULL,
  actor           TEXT NOT NULL DEFAULT 'system',
  reason          TEXT,
  is_automatic    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resv_events_resv_created
  ON reservation_events (reservation_id, created_at);

ANALYZE reservation_events;
