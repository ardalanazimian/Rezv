-- ═══════════════════════════════════════════════════════════════════════
--  ۰۹۶ — لینکِ دعوت (توکنِ حامل) پس از پایانِ jobِ پیامک در جدولِ jobs نمی‌ماند
--  (پیگیریِ S-05، حکمِ CEO، ۲۰۲۶-۰۹-۱۷)
--
--  ۰۹۴ توکنِ دعوت را در `staff_invites` فقط هش نگه داشت. ولی `sendInviteSms` (lib/provisioning.ts)
--  لینکِ دارای توکن را در `jobs.payload.tokens[2]` می‌گذارد، چون پیامک باید آن را برساند؛ و retention
--  jobِ completed را ۷ روز و dead را ۹۰ روز نگه می‌دارد. jobِ در انتظار یا تلاشِ دوباره لینک را لازم دارد،
--  jobِ پایانی نه.
--
--  چرا تریگر و نه کدِ queue: به حالتِ پایانی از چند مسیر می‌رسیم — completeJob، failJob، بازپس‌گیریِ
--  SQL در reclaimStaleJobs، یا UPDATEِ دستیِ اپراتور. تریگر همه را یک‌جا می‌پوشاند.
--  فقط `#token=…` پاک می‌شود؛ پایه‌ی لینک برای ردِ عملیاتی می‌ماند.
--
--  چرا فایلِ تازه و نه ۰۹۴: ۰۹۴ روی main ادغام شده (bd80c1f) و مهاجرتِ ادغام‌شده ویرایش نمی‌شود.
--  شماره: ۰۹۵ مالِ گزینه‌ی A ی P1-4 است (تخصیصِ CEO)؛ این دو به هم وابسته نیستند.
--
--  idempotent: تابع جایگزین می‌شود، تریگر فقط اگر نبود ساخته می‌شود، و ردیفِ ازقبل‌پاک‌شده دیگر با
--  الگو جور نیست — اجرای دوم هیچ ردیفی را عوض نمی‌کند.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION jobs_redact_invite_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'sms'
     AND NEW.status IN ('completed', 'dead')
     AND NEW.payload->>'template' = 'staff_invite'
     AND NEW.payload->'tokens'->>2 ~ '#token=[0-9a-f]+'
  THEN
    NEW.payload := jsonb_set(
      NEW.payload, '{tokens,2}',
      to_jsonb(regexp_replace(NEW.payload->'tokens'->>2, '#token=[0-9a-f]+', '#token=[redacted]'))
    );
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'jobs_redact_invite_link' AND tgrelid = 'jobs'::regclass AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER jobs_redact_invite_link
      BEFORE INSERT OR UPDATE ON jobs
      FOR EACH ROW EXECUTE FUNCTION jobs_redact_invite_link();
  END IF;
END $$;

UPDATE jobs
   SET payload = jsonb_set(
         payload, '{tokens,2}',
         to_jsonb(regexp_replace(payload->'tokens'->>2, '#token=[0-9a-f]+', '#token=[redacted]'))
       )
 WHERE kind = 'sms'
   AND status IN ('completed', 'dead')
   AND payload->>'template' = 'staff_invite'
   AND payload->'tokens'->>2 ~ '#token=[0-9a-f]+';
