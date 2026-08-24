-- ═══════════════════════════════════════════════════════════
--  رزرونو — Migration صف Job (جدول jobs)
--  الگوی FOR UPDATE SKIP LOCKED — تست‌شده روی PostgreSQL 17 واقعی.
--  idempotent، بدون حذف داده.
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('pending','processing','completed','failed','dead');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  priority        SMALLINT NOT NULL DEFAULT 5,            -- 1=بالاترین ... 9=پایین‌ترین
  status          job_status NOT NULL DEFAULT 'pending',
  idempotency_key TEXT,
  attempts        SMALLINT NOT NULL DEFAULT 0,
  max_attempts    SMALLINT NOT NULL DEFAULT 5,
  run_after       TIMESTAMP NOT NULL DEFAULT now(),
  last_error      TEXT,
  locked_at       TIMESTAMP,
  result          JSONB,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- idempotency: یک کار با همین کلید فقط یک‌بار
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idem ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
-- claim: pendingها به ترتیب priority سپس run_after (partial index برای کارایی)
CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(status, priority, run_after) WHERE status = 'pending';
-- monitoring/cleanup
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);

-- نکته: برای حجم بالا، یک سیاست retention (حذف completedهای قدیمی‌تر از چند روز)
-- و آرشیو deadها برای تحقیق توصیه می‌شود.
