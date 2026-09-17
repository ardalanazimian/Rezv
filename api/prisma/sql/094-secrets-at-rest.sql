-- ═══════════════════════════════════════════════════════════════════════
--  ۰۹۴ — رازها در حالتِ سکون: بخشی که بدونِ کلید انجام‌شدنی است (S-05، حکمِ D-24، ۲۰۲۶-۰۹-۱۷)
--
--  یافته (S-05، باز از ۲۰۲۶-۰۹-۰۳، BLOCKER طبقِ D-12): اعتبارنامه‌ها و توکن‌ها متنِ ساده
--  در DB بودند. D-24 دو درمان بر اساسِ کلاس داد:
--
--  ۱) توکنِ حاملی که سرور فقط **مقایسه** می‌کند → هشِ یک‌طرفه (همین فایل):
--     `staff_invites.token` = 'sha256:' || hex(sha256(token)). عینِ `hashBearerToken` در
--     `api/src/lib/secret-box.ts`؛ مسیرِ claim توکنِ ارائه‌شده را هش و با آن جست‌وجو می‌کند،
--     پس لینک‌های دعوتِ بازِ پیش از این مهاجرت همچنان کار می‌کنند.
--     پیشوندِ 'sha256:' لازم است، نه تزئینی: توکنِ خام هم ۶۴ هگز است، و `apply-sql.sh`
--     این فایل را در **هر** بوت دوباره اجرا می‌کند — بدونِ نشانه، هر بوت هشِ هش را می‌ساخت
--     و همه‌ی لینک‌ها می‌مردند. CHECKِ پایین نوشتنِ متنِ ساده را از هر مسیری (کد یا psql) می‌بندد.
--
--  ۲) رازی که سرور باید **دوباره بخواند** (merchant_idِ زرین‌پال، secretِ وب‌هوک) → AES-256-GCM
--     با کلیدِ env. آن رمزکردن **این‌جا نیست و نمی‌تواند باشد**: کلید هرگز نباید به DB برسد
--     (نه در ستون، نه در متنِ یک دستورِ SQL که در pg_stat_statements بماند). مهاجرتِ داده‌اش:
--     POST /api/v1/maintenance/secrets-reseal?seal_plaintext=1 پس از دیپلوی. تا آن اجرا،
--     خواننده‌ها ردیفِ متنِ ساده را **رد می‌کنند** (fail-closed)، نه اینکه همان را برگردانند.
--
--  ۳) رونوشتِ secretِ وب‌هوک در صف: `emit` تا امروز secretِ خام را در `jobs.payload` می‌گذاشت،
--     و ردیفِ jobِ کامل‌شده ۷ روز (مرده: ۹۰ روز) می‌ماند. حالا تحویل secret را از خودِ ردیفِ
--     webhook می‌خواند؛ این‌جا کلیدِ `secret` از payloadهای قدیمی پاک می‌شود.
--
--  idempotent: هر سه گام روی اجرای دوم هیچ ردیفی را عوض نمی‌کنند.
-- ═══════════════════════════════════════════════════════════════════════

UPDATE staff_invites
   SET token = 'sha256:' || encode(sha256(convert_to(token, 'UTF8')), 'hex')
 WHERE token NOT LIKE 'sha256:%';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_invites_token_hashed') THEN
    ALTER TABLE staff_invites
      ADD CONSTRAINT staff_invites_token_hashed CHECK (token ~ '^sha256:[0-9a-f]{64}$');
  END IF;
END $$;

UPDATE jobs
   SET payload = payload - 'secret'
 WHERE kind = 'webhook' AND payload ? 'secret';
