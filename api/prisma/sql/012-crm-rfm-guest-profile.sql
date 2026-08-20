-- ═══════════════════════════════════════════════════════════════════════
--  رزرونو — Migration فاز CRM (RFM + GuestProfile سراسری)
--  idempotent، بدون حذف داده. تست‌شده روی PostgreSQL واقعی.
-- ═══════════════════════════════════════════════════════════════════════

-- ── RFM: فیلدهای امتیاز به customer_insights ──
ALTER TABLE customer_insights ADD COLUMN IF NOT EXISTS r_score SMALLINT;
ALTER TABLE customer_insights ADD COLUMN IF NOT EXISTS f_score SMALLINT;
ALTER TABLE customer_insights ADD COLUMN IF NOT EXISTS m_score SMALLINT;
ALTER TABLE customer_insights ADD COLUMN IF NOT EXISTS rfm_segment TEXT;

-- ── GuestProfile سراسری (نمای cross-restaurant مشتری) ──
CREATE TABLE IF NOT EXISTS guest_profiles (
  user_id                 UUID PRIMARY KEY,
  global_visits           INT NOT NULL DEFAULT 0,
  global_spend_toman      INT NOT NULL DEFAULT 0,
  global_clv_toman        INT NOT NULL DEFAULT 0,
  restaurants_visited     INT NOT NULL DEFAULT 0,
  last_visit_anywhere     TIMESTAMP,
  is_vip_anywhere         BOOLEAN NOT NULL DEFAULT false,
  preferred_restaurant_id UUID,
  dietary_tags            TEXT[] NOT NULL DEFAULT '{}',
  updated_at              TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_vip ON guest_profiles(is_vip_anywhere);

-- نکته: FK به users عمداً در سطح Prisma relation گذاشته نشد (برای جراحی‌بودن).
-- در صورت نیاز به یکپارچگی ارجاعی سخت:
-- ALTER TABLE guest_profiles ADD CONSTRAINT fk_guest_user
--   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
