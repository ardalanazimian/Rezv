-- ═══════════════════════════════════════════════════════════════════════
--  ۰۹۰ — هفت دفتر/لاگِ «فقط-افزودنی» واقعاً فقط-افزودنی می‌شوند، و TRUNCATE روی
--  reservation_events بسته می‌شود (RT-25)
--
--  چرا: Red Team (`rezv-31`، batch 1، `origin/redteam/retest-2026-09-16 @ e32e200`) روی DBِ
--  زنده نشان داد از جدول‌هایی که نام یا کامنتشان «append-only» است فقط `reservation_events`
--  تریگر دارد — و همان هم با یک `TRUNCATE` خالی می‌شود، چون تریگرِ سطحِ‌ردیف روی TRUNCATE
--  شلیک نمی‌کند. پروبِ B آن‌ها: یک ردیفِ `payment.refund_required` در `audit_logs` با
--  UPDATE به `nothing_happened` تبدیل و بعد حذف شد — همان ردِ بدهیِ بازپرداختی که
--  `payments/callback/route.ts` صریحاً «نیمه‌ی ماندگار» می‌داند.
--
--  همان اصلِ FP-009 (docs/DECISIONS.md) که ۰۸۹ روی points_ledger اعمال کرد، اینجا روی بقیه:
--  ردِ مالی/حسابرسی فقط افزوده می‌شود؛ پاک‌سازیِ تست بازنویسی می‌شود، نه قاعده شل.
--
--  ── اندازه‌گیریِ پیش از نوشتن (git grep روی 99065a7، ۲۰۲۶-۰۹-۱۶) ─────────────
--  تنها مسیرهای UPDATE/DELETE/TRUNCATE در api/src روی این هشت جدول:
--    • maintenance/retention/route.ts:  DELETE FROM audit_logs WHERE created_at < now() - '1 year'
--    • lib/platform-events.ts (prunePlatformEvents): DELETE … WHERE ingested_at < now() - N روز،
--      N از env (TELEMETRY_RETENTION_*_DAYS؛ پیش‌فرض‌ها ۹۰/۱۸۰/۴۰۰)
--  هیچ UPDATEی روی هیچ‌کدام، هیچ TRUNCATEی، هیچ `restaurant.delete`ی. تنها cascade به این
--  جدول‌ها: sms_transactions ← restaurants (ON DELETE CASCADE).
--
--  ── شکلِ هر جدول (حکم‌های CEO `rezv-87`، ۲۰۲۶-۰۹-۱۶/۱۷) ───────────────────────
--  همه‌ی هشت جدول:         BEFORE TRUNCATE (سطحِ statement)
--  همه جز reservation_events: BEFORE UPDATE (ردیفی) — reservation_events از ۰۸۲ دارد
--  DELETE:
--    economy_ledger_entries · campaign_logs · coupon_redemptions · reward_redemptions
--      → بی‌قید و شرط (مسیرِ حذفی در api/src ندارند).
--    sms_transactions → بی‌قید و شرط + FK به RESTRICT — **حکمِ D-16**: اصلِ FP-009 («هیچ
--      cascadeی به دفترِ پول؛ حذفِ حساب یعنی ناشناس‌سازی») روی دفترِ اعتبارِ پیامک. در api/src
--      هیچ حذفِ رستورانی نیست، پس تولید چیزی از دست نمی‌دهد؛ برگشتش یک ALTERِ FK است.
--    audit_logs → فقط ردیف‌های قدیمی‌تر از ۱ سال: **دقیقاً** قاعده‌ی retention. شواهدِ تازه
--      (از جمله بدهیِ RT-13) حذف‌ناپذیر می‌شوند، و اگر کسی روزی retention را کوتاه‌تر کند،
--      به‌جای خوردنِ بی‌صدای شواهد، با خطا می‌ایستد.
--    platform_events → فقط ردیف‌هایی که `ingested_at`شان قدیمی‌تر از ۹۰ روز است. این **کف**
--      برابرِ کوچک‌ترین ردیفِ نگه‌داریِ شیپ‌شده است (TELEMETRY_RETENTION_ANON_DAYS = 90). ستون
--      عمداً `ingested_at` است نه `created_at`: جدول created_at ندارد و خودِ هرس روی ingested_at
--      فیلتر می‌کند — کفی روی ستونِ دیگر همان ردیفی را که هرس می‌خواهد نمی‌سنجید.
--      مقدارِ env کمتر از ۹۰ از این پس بلند شکست می‌خورد، نه اینکه زیرلایه‌ی ML را بخورد.
--    reservation_events → دست‌نخورده (گاردِ «والد رفته»ی ۰۸۲ درستِ همان جدول است).
--
--  ── اثرِ جانبیِ اندازه‌گیری‌شده: FKهای SET NULL حالا حذفِ والد را رد می‌کنند ─────────
--  سه FK به این جدول‌ها `ON DELETE SET NULL` است (روی DBِ شکلِ تولید سنجیده شد):
--    economy_ledger_entries(reservation_id) · economy_ledger_entries(restaurant_id)
--    reward_redemptions(result_coupon_id)   · reward_redemptions(result_gift_card_id)
--  SET NULL یعنی UPDATEِ ردیفِ فرزند — و تریگرِ UPDATEِ همین فایل ردش می‌کند. پس حذفِ یک رزرو یا
--  رستورانِ دارای ردیفِ اقتصاد، یا کوپن/کارتِ هدیه‌ای که حاصلِ یک ردیمِ جایزه بوده، از این پس رد
--  می‌شود (عملاً RESTRICT، با پیامِ تریگر). اندازه‌گیریِ api/src: **صفر** حذفِ این والدها
--  (git grep روی `.coupon|giftCard|reservation|restaurant|user.delete*` و `DELETE FROM` — کنترلِ
--  مثبت: `.coupon.update|create` سه بار پیدا شد). پس هیچ مسیرِ تولیدی نمی‌شکند؛ تست‌ها بازنویسی شدند.
--  و این همان جهتِ FP-009 است: ردِ مالی نباید با حذفِ سوژه‌اش بی‌صدا تغییر کند.
--
--  ── مرزِ صادقانه (همان متنِ ۰۸۹) ───────────────────────────────────────────
--  `session_replication_role = replica` همه‌ی تریگرهای کاربر را خاموش می‌کند و نقشِ اتصالِ اپ
--  مالکِ دیتابیس است. این تریگرها کدِ اپ و مهاجرت‌های عادی را می‌بندند، نه کسی را که عمداً
--  نقشِ replication را عوض کند یا تریگر را DROP کند (P0-022).
--
--  idempotent: CREATE OR REPLACE FUNCTION · DROP TRIGGER IF EXISTS · FK با DROP IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════

-- یک تابعِ مشترک برای ردِ بی‌قید و شرط — نامِ جدول و نوعِ عمل از خودِ تریگر می‌آید،
-- پس پیامِ خطا همیشه می‌گوید کدام جدول و کدام عمل (برای ردیفی و statement هر دو کار می‌کند).
CREATE OR REPLACE FUNCTION append_only_reject()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    '% فقط-افزودنی است: % مجاز نیست (مهاجرتِ ۰۹۰) — ردِ مالی/حسابرسی فقط افزوده می‌شود',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

-- audit_logs: حذف فقط همان چیزی که retention حذف می‌کند.
CREATE OR REPLACE FUNCTION audit_logs_guard_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.created_at < now() - INTERVAL '1 year' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION
    'audit_logs فقط-افزودنی است: حذفِ ردیفِ جوان‌تر از ۱ سال مجاز نیست (مهاجرتِ ۰۹۰ — فقط retention حذف می‌کند)'
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

-- platform_events: کفِ ۹۰ روز روی ingested_at — کوچک‌ترین ردیفِ retentionِ شیپ‌شده.
CREATE OR REPLACE FUNCTION platform_events_guard_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.ingested_at < now() - INTERVAL '90 days' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION
    'platform_events فقط-افزودنی است: حذفِ ردیفِ جوان‌تر از ۹۰ روز مجاز نیست (مهاجرتِ ۰۹۰ — کفِ کوچک‌ترین ردیفِ retention)'
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

-- ── TRUNCATE (سطحِ statement) روی هر هشت جدول ────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'reservation_events', 'audit_logs', 'platform_events', 'economy_ledger_entries',
    'sms_transactions', 'campaign_logs', 'coupon_redemptions', 'reward_redemptions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_truncate', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION append_only_reject()',
      t || '_no_truncate', t);
  END LOOP;
END $$;

-- ── UPDATE (ردیفی) روی هفت جدول — reservation_events از ۰۸۲ دارد ─────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs', 'platform_events', 'economy_ledger_entries',
    'sms_transactions', 'campaign_logs', 'coupon_redemptions', 'reward_redemptions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_update', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION append_only_reject()',
      t || '_no_update', t);
  END LOOP;
END $$;

-- ── DELETE (ردیفی) ────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'economy_ledger_entries', 'sms_transactions', 'campaign_logs', 'coupon_redemptions', 'reward_redemptions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_no_delete', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION append_only_reject()',
      t || '_no_delete', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS audit_logs_guard_delete ON audit_logs;
CREATE TRIGGER audit_logs_guard_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_guard_delete();

DROP TRIGGER IF EXISTS platform_events_guard_delete ON platform_events;
CREATE TRIGGER platform_events_guard_delete
  BEFORE DELETE ON platform_events
  FOR EACH ROW EXECUTE FUNCTION platform_events_guard_delete();

-- ── sms_transactions → restaurants: CASCADE → RESTRICT (حکمِ D-16) ───────────
-- ON UPDATE CASCADE صریح نوشته می‌شود تا هر دو مسیرِ ساختِ اسکیما (db push با
-- `onDelete: Restrict` در schema.prisma، و migrate deploy + همین فایل) یک FKِ یکسان
-- بسازند — همان خطِ baselineِ انحرافی که ۰۲۲ ساخته بود برداشته می‌شود.
ALTER TABLE sms_transactions DROP CONSTRAINT IF EXISTS sms_transactions_restaurant_id_fkey;
ALTER TABLE sms_transactions
  ADD CONSTRAINT sms_transactions_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON UPDATE CASCADE ON DELETE RESTRICT;
