-- ═══════════════════════════════════════════════════════════
--  رزرونو — Migration وفاداری (امتیاز، دعوت، کارت هدیه، رویداد)
--  برای دیتابیس موجود. راه‌اندازی جدید نیازی ندارد (prisma db push).
--  هیچ داده‌ای حذف نمی‌شود.
-- ═══════════════════════════════════════════════════════════

-- ── enumها ──
DO $$ BEGIN
  CREATE TYPE points_reason AS ENUM ('reservation','referral','birthday','anniversary','signup','redemption','adjustment');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE referral_status AS ENUM ('pending','completed','rewarded');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE gift_card_status AS ENUM ('active','redeemed','expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── فیلدهای جدید User (بدون حذف داده) ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS anniversary_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_id UUID;
-- یکتایی کد دعوت (در صورت نبود)
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_key ON users(referral_code) WHERE referral_code IS NOT NULL;
EXCEPTION WHEN duplicate_table THEN null; END $$;

-- ── دفتر امتیاز ──
CREATE TABLE IF NOT EXISTS points_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  restaurant_id UUID,
  delta         INTEGER NOT NULL,
  reason        points_reason NOT NULL,
  note          TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger(user_id, created_at);

-- ── دعوت‌ها ──
CREATE TABLE IF NOT EXISTS referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   UUID NOT NULL REFERENCES users(id),
  invitee_phone TEXT NOT NULL,
  invitee_id    UUID,
  status        referral_status NOT NULL DEFAULT 'pending',
  reward_points INTEGER NOT NULL DEFAULT 500,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  completed_at  TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_referral_referrer ON referrals(referrer_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_phone ON referrals(invitee_phone);

-- ── کارت‌های هدیه ──
CREATE TABLE IF NOT EXISTS gift_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  buyer_id        UUID REFERENCES users(id),
  restaurant_id   UUID,
  amount_toman    INTEGER NOT NULL,
  balance_toman   INTEGER NOT NULL,
  recipient_name  TEXT,
  recipient_phone TEXT,
  message         TEXT,
  status          gift_card_status NOT NULL DEFAULT 'active',
  expires_at      TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gift_recipient ON gift_cards(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_gift_buyer ON gift_cards(buyer_id);

-- ── رویدادهای ویژه ──
CREATE TABLE IF NOT EXISTS special_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id),
  title         TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT,
  starts_at     TIMESTAMP NOT NULL,
  ends_at       TIMESTAMP,
  price_toman   INTEGER,
  capacity      INTEGER,
  is_published  BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_restaurant ON special_events(restaurant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_event_published ON special_events(is_published, starts_at);

ANALYZE points_ledger; ANALYZE referrals; ANALYZE gift_cards; ANALYZE special_events;
