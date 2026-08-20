-- ═══════════════════════════════════════════════════════════
--  رزرونو — Migration فاز observability (جدول audit_logs)
--  برای دیتابیس موجود. راه‌اندازی جدید با prisma db push خودکار است.
--  هیچ داده‌ای حذف نمی‌شود. idempotent (اجرای مجدد امن).
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action        TEXT NOT NULL,
  actor_id      UUID,
  actor_type    TEXT NOT NULL DEFAULT 'anonymous',
  target_id     UUID,
  restaurant_id UUID,
  ip            TEXT,
  trace_id      TEXT,
  success       BOOLEAN NOT NULL DEFAULT true,
  detail        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_logs(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_rest    ON audit_logs(restaurant_id, created_at);

-- نکته: برای حجم بالا، در آینده پارتیشن‌بندی بر اساس created_at (ماهانه) توصیه می‌شود
-- و یک سیاست retention (مثلاً حذف رکوردهای قدیمی‌تر از ۱ سال) — مشابه فایل 002.
