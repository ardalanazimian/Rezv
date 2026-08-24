-- ═══════════════════════════════════════════════════════════
--  رزرونو — Migration فاز سازمانی (idempotency + webhooks + fraud)
--  idempotent، بدون حذف داده. تست‌شده روی PostgreSQL واقعی.
-- ═══════════════════════════════════════════════════════════

-- ── Idempotency سطح HTTP (جلوگیری از double-submit) ──
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT PRIMARY KEY,
  scope      TEXT NOT NULL,
  response   JSONB,
  status     TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  expires_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idem_expiry ON idempotency_keys(expires_at);

-- ── Webhook خروجی (ادغام شخص ثالث) ──
CREATE TABLE IF NOT EXISTS webhooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  url           TEXT NOT NULL,
  events        TEXT[] NOT NULL DEFAULT '{}',
  secret        TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_rest ON webhooks(restaurant_id, is_active);

-- ── Fraud: ستون ip به coupon_redemptions (برای تشخیص چند‌حسابی) ──
ALTER TABLE coupon_redemptions ADD COLUMN IF NOT EXISTS ip TEXT;
