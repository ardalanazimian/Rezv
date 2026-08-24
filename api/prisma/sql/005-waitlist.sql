-- ═══════════════════════════════════════════════════════════
--  رزرونو — Migration سیستم لیست انتظار (Waitlist)
--
--  برای دیتابیس موجود. راه‌اندازی جدید نیازی ندارد (prisma db push).
--  هیچ داده‌ای حذف نمی‌شود — فقط enum و جدول جدید اضافه می‌شود.
-- ═══════════════════════════════════════════════════════════

-- ── enum وضعیت لیست انتظار ──
DO $$ BEGIN
  CREATE TYPE waitlist_status AS ENUM
    ('waiting','offered','accepted','declined','expired','seated','cancelled','no_response');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── جدول ورودی‌های لیست انتظار ──
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id          UUID NOT NULL REFERENCES restaurants(id),
  user_id                UUID REFERENCES users(id),
  guest_name             TEXT,
  guest_phone            TEXT,
  guest_email            TEXT,
  party_size             SMALLINT NOT NULL,
  priority               SMALLINT NOT NULL DEFAULT 0,
  is_vip                 BOOLEAN NOT NULL DEFAULT false,
  status                 waitlist_status NOT NULL DEFAULT 'waiting',
  joined_at              TIMESTAMP NOT NULL DEFAULT now(),
  offered_at             TIMESTAMP,
  offer_expires_at       TIMESTAMP,
  responded_at           TIMESTAMP,
  seated_at              TIMESTAMP,
  offered_table_id       UUID,
  offered_table_number   SMALLINT,
  estimated_wait_minutes SMALLINT,
  notify_sms             BOOLEAN NOT NULL DEFAULT true,
  notify_push            BOOLEAN NOT NULL DEFAULT true,
  notify_email           BOOLEAN NOT NULL DEFAULT false,
  reservation_code       TEXT,
  note                   TEXT,
  created_at             TIMESTAMP NOT NULL DEFAULT now()
);

-- ── ایندکس‌ها (صف اولویت، انقضای آفر، داشبورد مشتری) ──
CREATE INDEX IF NOT EXISTS idx_waitlist_queue
  ON waitlist_entries (restaurant_id, status, priority DESC, joined_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_offer_expiry
  ON waitlist_entries (status, offer_expires_at);
CREATE INDEX IF NOT EXISTS idx_waitlist_user
  ON waitlist_entries (user_id, status);

ANALYZE waitlist_entries;
