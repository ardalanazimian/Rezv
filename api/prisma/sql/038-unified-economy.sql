-- ═══════════════════════════════════════════════════════════════════════
--  ۰۳۸ — اقتصادِ یکپارچه‌ی مشتری (Unified Customer Economy)
--
--  فازِ اولِ سیستمِ Gamification/Reliability/Cancellation-Policy که در
--  جلسه‌ی برنامه‌ریزیِ ۲۰۲۶-۰۸-۱۲ طراحی شد. این migration فقط جدول‌ها را
--  می‌سازد (schema.prisma هم‌زمان آپدیت شده) — منطقِ محاسبه (فرمولِ
--  reliabilityScore، الگوریتمِ resolvePolicy، Penalty/Recovery Engine)
--  در کدِ اپلیکیشن (فازِ بعدی) پیاده می‌شود، نه اینجا.
--
--  دامنه‌بندی (مهم، برایِ جلوگیری از سردرگمیِ بعدی):
--    • reliabilityScore/xpTotal/walletBalance/strikeCount → سراسری (رویِ
--      User، جدولِ customer_economy_profiles) — اعتماد باید بینِ
--      رستوران‌ها منتقل بشه.
--    • club_members.points (موجود) → دست‌نخورده می‌مونه. اون ارزِ داخلیِ
--      خودِ رستورانه، کاملاً جدا از این اقتصادِ پلتفرمی.
--    • cancellation_policies/missions/reward_marketplace_items → می‌تونن
--      per-restaurant باشن (restaurant_id) یا سراسری (NULL).
--
--  RLS: طبقِ درسِ migration 037 (جدول‌هایی که هیچ‌وقت migration نگرفته
--  بودن)، این migration از همون اول RLS رو رویِ هر جدولِ جدید فعال
--  می‌کنه — نه اینکه بعداً یادمون بره. فقط ENABLE، بدونِ policy
--  (deny-by-default، هم‌راستا با بقیه‌ی جدول‌ها — کنترلِ دسترسیِ واقعی
--  در کدِ اپلیکیشن است).
--
--  idempotent: همه‌ی CREATE TABLE/TYPE با IF NOT EXISTS محافظت شدن.
-- ═══════════════════════════════════════════════════════════════════════

-- ── enum ها ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'economy_ledger_kind') THEN
    CREATE TYPE economy_ledger_kind AS ENUM (
      'xp_earn', 'wallet_earn', 'wallet_spend',
      'reliability_event', 'strike_add', 'strike_decay'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_status') THEN
    CREATE TYPE mission_status AS ENUM ('active', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reward_item_kind') THEN
    CREATE TYPE reward_item_kind AS ENUM (
      'coupon_grant', 'free_item', 'priority_boost', 'gift_card_credit', 'event_access'
    );
  END IF;
END $$;

-- ── پروفایلِ اقتصادیِ مشتری — یک ردیف برایِ هر User، سراسری ──
CREATE TABLE IF NOT EXISTS customer_economy_profiles (
  user_id               uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  reliability_score     integer NOT NULL DEFAULT 75,
  reputation_tier       text NOT NULL DEFAULT 'bronze',
  xp_total              integer NOT NULL DEFAULT 0,
  wallet_balance        integer NOT NULL DEFAULT 0,
  strike_count          integer NOT NULL DEFAULT 0,
  has_active_abuse_flag boolean NOT NULL DEFAULT false,
  last_violation_at     timestamptz,
  last_recomputed_at    timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_economy_profiles_reputation_tier_idx
  ON customer_economy_profiles (reputation_tier);

-- ── دفترِ حسابِ اقتصادِ یکپارچه (append-only) ──
CREATE TABLE IF NOT EXISTS economy_ledger_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id),
  restaurant_id  uuid REFERENCES restaurants(id),
  kind           economy_ledger_kind NOT NULL,
  amount         integer NOT NULL,
  reservation_id uuid REFERENCES reservations(id),
  mission_id     uuid,
  source         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- محافظِ idempotency: هر (رزرو، نوع) فقط یک‌بار. NULLها یکتا حساب
  -- نمی‌شن (رفتارِ استانداردِ Postgres) پس ردیف‌هایِ بدونِ reservation_id
  -- (referral/mission/manual) محدود نمی‌شن — دقیقاً رفتارِ خواسته‌شده.
  UNIQUE (reservation_id, kind)
);
CREATE INDEX IF NOT EXISTS economy_ledger_entries_user_created_idx
  ON economy_ledger_entries (user_id, created_at);
CREATE INDEX IF NOT EXISTS economy_ledger_entries_restaurant_created_idx
  ON economy_ledger_entries (restaurant_id, created_at);

-- ── سایه‌ی اعتبار برایِ شماره‌هایِ بدونِ حساب (guest booking) ──
CREATE TABLE IF NOT EXISTS phone_reliability_shadows (
  phone               text PRIMARY KEY,
  reliability_score   integer NOT NULL DEFAULT 75,
  strike_count        integer NOT NULL DEFAULT 0,
  last_recomputed_at  timestamptz NOT NULL DEFAULT now(),
  merged_into_user_id uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── سیاستِ کنسلیِ هر رستوران ──
CREATE TABLE IF NOT EXISTS cancellation_policies (
  restaurant_id         uuid PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  free_cancel_hours     integer NOT NULL DEFAULT 24,
  partial_penalty_hours integer NOT NULL DEFAULT 2,
  partial_penalty_pct   integer NOT NULL DEFAULT 50,
  deposit_required      boolean NOT NULL DEFAULT false,
  auto_confirm          boolean NOT NULL DEFAULT true,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── override سیاستِ کنسلی برایِ رویدادهایِ ویژه (SpecialEvent موجود) ──
ALTER TABLE special_events ADD COLUMN IF NOT EXISTS policy_override jsonb;

-- ── مأموریت/چالش (Gamification) ──
CREATE TABLE IF NOT EXISTS missions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurants(id),
  title         text NOT NULL,
  description   text,
  kind          text NOT NULL,
  target_count  integer NOT NULL DEFAULT 1,
  xp_reward     integer NOT NULL DEFAULT 0,
  wallet_reward integer NOT NULL DEFAULT 0,
  strike_relief integer NOT NULL DEFAULT 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  status        mission_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS missions_restaurant_status_idx
  ON missions (restaurant_id, status);

CREATE TABLE IF NOT EXISTS mission_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id   uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id),
  progress     integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  claimed_at   timestamptz,
  UNIQUE (mission_id, user_id)
);

-- ── کاتالوگِ خرجِ سکه (Reward Marketplace) ──
CREATE TABLE IF NOT EXISTS reward_marketplace_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid REFERENCES restaurants(id),
  title           text NOT NULL,
  description     text,
  kind            reward_item_kind NOT NULL,
  cost_coins      integer NOT NULL,
  min_tier        text NOT NULL DEFAULT 'bronze',
  stock_remaining integer,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reward_marketplace_items_restaurant_active_idx
  ON reward_marketplace_items (restaurant_id, is_active);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id             uuid NOT NULL REFERENCES reward_marketplace_items(id),
  user_id             uuid NOT NULL REFERENCES users(id),
  coins_spent         integer NOT NULL,
  result_coupon_id    uuid REFERENCES coupons(id),
  result_gift_card_id uuid REFERENCES gift_cards(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reward_redemptions_user_created_idx
  ON reward_redemptions (user_id, created_at);

-- ── RLS: فعال روی همه‌ی جدول‌هایِ تازه‌ساز، از همون اول (درسِ migration 037) ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customer_economy_profiles', 'economy_ledger_entries', 'phone_reliability_shadows',
    'cancellation_policies', 'missions', 'mission_progress',
    'reward_marketplace_items', 'reward_redemptions'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
