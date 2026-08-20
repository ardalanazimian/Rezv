-- ═══════════════════════════════════════════════════════════
--  رزرونو — Migration فاز v2 (هوش مشتری، کوپن، کمپین خودکار، RBAC)
--  برای دیتابیس موجود. راه‌اندازی جدید نیازی ندارد (prisma db push).
--  هیچ داده‌ای حذف نمی‌شود. همه‌ی DDLها idempotent هستند (اجرای مجدد امن است).
-- ═══════════════════════════════════════════════════════════

-- ── enumها ──
DO $$ BEGIN
  CREATE TYPE customer_segment AS ENUM ('new_customer','active','at_risk','churned','vip');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE coupon_kind AS ENUM ('percent','fixed','free_item');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE automation_trigger AS ENUM ('birthday','winback','post_visit','vip_milestone','no_show_followup');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── فیلدهای جدید Reservation (بدون حذف داده) ──
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS no_show_risk_score SMALLINT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS no_show_risk_tier TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS deposit_requested BOOLEAN NOT NULL DEFAULT false;

-- ── CustomerInsight: CLV + ریسک + سگمنت، per (رستوران × کاربر) ──
CREATE TABLE IF NOT EXISTS customer_insights (
  restaurant_id        UUID NOT NULL REFERENCES restaurants(id),
  user_id              UUID NOT NULL REFERENCES users(id),
  total_visits         INTEGER NOT NULL DEFAULT 0,
  total_spend_toman    INTEGER NOT NULL DEFAULT 0,
  avg_spend_toman      INTEGER NOT NULL DEFAULT 0,
  visit_frequency_days DOUBLE PRECISION,
  predicted_clv_toman  INTEGER NOT NULL DEFAULT 0,
  first_visit_at       TIMESTAMP,
  last_visit_at        TIMESTAMP,
  no_show_count        INTEGER NOT NULL DEFAULT 0,
  cancel_count         INTEGER NOT NULL DEFAULT 0,
  completed_count      INTEGER NOT NULL DEFAULT 0,
  no_show_rate_pct     INTEGER NOT NULL DEFAULT 0,
  churn_risk_score     INTEGER NOT NULL DEFAULT 0,
  segment              customer_segment NOT NULL DEFAULT 'new_customer',
  is_vip               BOOLEAN NOT NULL DEFAULT false,
  updated_at           TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_insight_segment_clv ON customer_insights(restaurant_id, segment, predicted_clv_toman DESC);
CREATE INDEX IF NOT EXISTS idx_insight_churn ON customer_insights(restaurant_id, churn_risk_score DESC);

-- ── Coupon Engine ──
CREATE TABLE IF NOT EXISTS coupons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id),
  code              TEXT NOT NULL,
  kind              coupon_kind NOT NULL,
  value             INTEGER NOT NULL DEFAULT 0,
  free_menu_item_id UUID,
  min_party_size    SMALLINT,
  max_redemptions   INTEGER,
  redemption_count  INTEGER NOT NULL DEFAULT 0,
  per_user_limit    INTEGER NOT NULL DEFAULT 1,
  target_segment    customer_segment,
  valid_from        TIMESTAMP NOT NULL DEFAULT now(),
  valid_until       TIMESTAMP,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, code)
);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(restaurant_id, is_active, valid_until);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id         UUID NOT NULL REFERENCES coupons(id),
  user_id           UUID,
  reservation_code  TEXT,
  discount_toman    INTEGER NOT NULL,
  redeemed_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_redemptions_coupon_user ON coupon_redemptions(coupon_id, user_id);

-- ── Marketing Automation ──
CREATE TABLE IF NOT EXISTS marketing_automations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id),
  name              TEXT NOT NULL,
  trigger           automation_trigger NOT NULL,
  trigger_config    JSONB NOT NULL DEFAULT '{}',
  message_template  TEXT NOT NULL,
  coupon_id         UUID,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_run_at       TIMESTAMP,
  sent_count        INTEGER NOT NULL DEFAULT 0,
  converted_count   INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automations_active ON marketing_automations(restaurant_id, is_active, trigger);

-- ── Staff Permissions (RBAC ماژولار) ──
CREATE TABLE IF NOT EXISTS staff_permissions (
  staff_id                  UUID PRIMARY KEY REFERENCES staff(id),
  can_manage_reservations   BOOLEAN NOT NULL DEFAULT true,
  can_manage_tables         BOOLEAN NOT NULL DEFAULT true,
  can_manage_waitlist       BOOLEAN NOT NULL DEFAULT true,
  can_view_analytics        BOOLEAN NOT NULL DEFAULT false,
  can_view_revenue          BOOLEAN NOT NULL DEFAULT false,
  can_manage_campaigns      BOOLEAN NOT NULL DEFAULT false,
  can_manage_coupons        BOOLEAN NOT NULL DEFAULT false,
  can_manage_staff          BOOLEAN NOT NULL DEFAULT false,
  can_manage_settings       BOOLEAN NOT NULL DEFAULT false,
  updated_at                TIMESTAMP NOT NULL DEFAULT now()
);

-- ── ایندکس روی reservations برای فیلتر ریسک بالا (جدول بزرگ → CONCURRENTLY) ──
-- ⚠️ این خط را جدا و خارج از transaction اجرا کن (مثل فایل 001):
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resv_noshow_risk
--   ON reservations(restaurant_id, no_show_risk_tier, slot_start);
