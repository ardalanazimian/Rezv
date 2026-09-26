-- ═══════════════════════════════════════════════════════════════════
--  ۰۹۷ — نقشِ محدودِ `rezervno_app` برای اتصالِ زمانِ اجرای اپ (P0-022)
--
--  چرا: تریگرهای ۰۸۹/۰۹۰ در برابر DMLِ عادی حتی با نقشِ مالک/سوپریوزر می‌ایستند،
--  ولی دو فرار امتیاز می‌خواهند:
--    • SET session_replication_role = replica   → SUPERUSER
--    • ALTER TABLE … DISABLE TRIGGER            → مالکِ جدول
--  تا وقتی DATABASE_URL همان نقشِ صاحبِ DB باشد، مصالحه‌ی API یعنی بازنویسیِ دفتر.
--
--  این مهاجرت نقش را می‌سازد و GRANT می‌دهد. **DATABASE_URL را عوض نمی‌کند.**
--  عوض‌کردنِ اتصالِ پیش‌فرض هر مسیرِ خواندن/نوشتن را یک‌جا باز‌اجازه می‌کند و
--  طبقِ تیکتِ P0-022 پیش از لانچ تعویق شده. اپراتور پس از سنجشِ زنده:
--      ALTER ROLE rezervno_app PASSWORD '…';
--      DATABASE_URL=postgresql://rezervno_app:…@…/rezervno
--      DATABASE_DIRECT_URL=postgresql://rezervno:…@…/rezervno   # مهاجرت‌ها
--  و `node tools/check-db-privileges.mjs` روی همان URL باید خروج ۰ بدهد.
--
--  آنچه این فایل **نمی‌کند** (عمدی):
--    • CREATE POLICY / FORCE ROW LEVEL SECURITY — آن بستهٔ جداگانهٔ RLS است
--    • پسورد — پسورد در مهاجرت نمی‌نشیند
--    • تغییرِ مالکیتِ جدول
--
--  idempotent.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rezervno_app') THEN
    CREATE ROLE rezervno_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS;
  ELSE
    ALTER ROLE rezervno_app
      LOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION
      NOBYPASSRLS;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO rezervno_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO rezervno_app;
REVOKE CREATE ON SCHEMA public FROM rezervno_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rezervno_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rezervno_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rezervno_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO rezervno_app;

-- دفترها: TRUNCATE به نقشِ اپ داده نمی‌شود (جدا از GRANTِ جدولی).
-- UPDATE روی هر نه جدول بسته است — هیچ مسیرِ تولیدی ردیفِ دفتر را بازنویسی نمی‌کند.
-- DELETE فقط جایی می‌ماند که retentionِ مستند دارد (audit_logs، platform_events).
REVOKE UPDATE, TRUNCATE ON TABLE
  points_ledger,
  reservation_events,
  audit_logs,
  platform_events,
  economy_ledger_entries,
  sms_transactions,
  campaign_logs,
  coupon_redemptions,
  reward_redemptions
FROM rezervno_app;

REVOKE DELETE ON TABLE
  points_ledger,
  reservation_events,
  economy_ledger_entries,
  sms_transactions,
  campaign_logs,
  coupon_redemptions,
  reward_redemptions
FROM rezervno_app;
