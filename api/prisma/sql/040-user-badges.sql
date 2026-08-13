-- ═══════════════════════════════════════════════════════════════════════
--  ۰۴۰ — نشان‌هایِ کنترل‌شده‌یِ پلتفرم (Company Control Plane، فازِ ۳)
--
--  کاملاً جدا از BADGES در apps/customer/js/data/seed.js (نشان‌هایِ emojiِ
--  قدیمی/نمایشیِ سمتِ کلاینت، بدونِ رکوردِ سرور). این سیستم را فقط ادمینِ
--  پلتفرم تعریف/اعطا/لغو می‌کند و در دیتابیس ثبت می‌شود (auditable).
--
--  «آماده‌یِ بلاکچین»: دو ستونِ nullableِ chain_tx_hash/token_id رویِ
--  user_badges — اگر روزی این نشان‌ها NFT شدن، شناسه‌ی تراکنش/توکن همین‌جا
--  ثبت می‌شود. هیچ runtime/کتابخانه‌ی بلاکچینی الان اضافه نشده.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS badge_definitions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                 text NOT NULL UNIQUE,
  name                text NOT NULL,
  description         text,
  icon                text NOT NULL DEFAULT 'star',
  color               text,
  is_active           boolean NOT NULL DEFAULT true,
  created_by_admin_id uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id            uuid NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES users(id),
  granted_at          timestamptz NOT NULL DEFAULT now(),
  granted_by_admin_id uuid,
  note                text,
  -- «الان فعال است» = revoked_at نال. هم‌الگو با بن سختِ کاربر (migration 039).
  revoked_at          timestamptz,
  revoked_by_admin_id uuid,
  revoke_reason       text,
  chain_tx_hash       text,
  token_id            text
);
CREATE INDEX IF NOT EXISTS user_badges_user_idx ON user_badges (user_id);
CREATE INDEX IF NOT EXISTS user_badges_badge_idx ON user_badges (badge_id);
-- یک نشانِ فعال به‌ازای هر (کاربر، تعریفِ نشان) — ایندکسِ جزئی روی رکوردهایِ رفع‌نشده.
CREATE UNIQUE INDEX IF NOT EXISTS user_badges_active_unique ON user_badges (badge_id, user_id) WHERE revoked_at IS NULL;

-- ── RLS: فعال روی جدول‌هایِ تازه‌ساز، از همون اول (درسِ migration 037) ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['badge_definitions', 'user_badges'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
