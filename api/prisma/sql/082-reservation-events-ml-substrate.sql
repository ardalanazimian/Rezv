-- ═══════════════════════════════════════════════════════════════════════
--  M0 — زیرساختِ رویداد برای ML (طرحِ docs/audit/fixes/M0-EVENT-SUBSTRATE-DESIGN.md،
--  گزینه‌ی A، تأییدشده توسطِ CEO `rezv-9c [5283b5]` در ۲۰۲۶-۰۹-۰۹)
--
--  ⚠️ چرا این جدول و نه یک جدولِ تازه: `reservation_events` از قبل وجود دارد و
--  **درست کار می‌کند** — `lifecycle.ts` آن را داخلِ همان تراکنشی می‌نویسد که
--  وضعیتِ رزرو را عوض می‌کند، و پشتِ یک compare-and-set، پس دقیقاً یک ردیف به
--  ازای هر انتقالِ واقعی. ساختنِ emitterِ دوم کنارِ آن، همان تکراری بود که
--  دستورِ ۰۳۹ §۲.۱ هشدارش را داد. پس غنی‌سازی، نه جایگزینی.
--
--  آنچه اضافه می‌شود و چرا هرکدام برای ML لازم است:
--    restaurant_id / tenant_id  — ویژگیِ point-in-time نباید با join به جدولی
--                                 ساخته شود که **قابلِ تغییر** است. رزرو ممکن
--                                 است بعداً عوض شود؛ این ردیف نباید عوض شود.
--    rule_version               — بدونش، ردیف‌های پیش و پس از تغییرِ یک قانون
--                                 غیرقابلِ تفکیک می‌شوند.
--    holdout_bucket             — تنها نمونه‌ی بی‌طرفی که سیستم خواهد داشت.
--                                 از روزِ صفر، وگرنه هرگز.
--    decision_inputs            — «در لحظه‌ی تصمیم چه می‌دانستیم». بدونش هر
--                                 feature بعداً از وضعِ *امروز* بازسازی می‌شود
--                                 و این نشتِ زمانی است — در متریکِ آفلاین
--                                 نامرئی و در تولید کُشنده.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE reservation_events
  ADD COLUMN IF NOT EXISTS restaurant_id   UUID,
  ADD COLUMN IF NOT EXISTS tenant_id       UUID,
  ADD COLUMN IF NOT EXISTS rule_version    TEXT,
  ADD COLUMN IF NOT EXISTS holdout_bucket  SMALLINT,
  ADD COLUMN IF NOT EXISTS decision_inputs JSONB;

-- ردیف‌های پیش از این مهاجرت این ستون‌ها را NULL دارند. **عمدی**: NULL یعنی
-- «نمی‌دانیم»، و هیچ backfillی نمی‌کنیم چون بازسازیِ «آن‌موقع چه می‌دانستیم» از
-- روی وضعِ امروز دقیقاً همان نشتِ زمانی است که این ستون‌ها برای جلوگیری از آن
-- ساخته شده‌اند. مصرف‌کننده باید NULL را کنار بگذارد، نه پُر کند.
COMMENT ON COLUMN reservation_events.decision_inputs IS
  'ورودی‌های در-دسترسِ لحظه‌ی تصمیم. هر کلید {value, window} است؛ window اجباری است. NULL = پیش از مهاجرتِ 082، هرگز backfill نمی‌شود.';
COMMENT ON COLUMN reservation_events.holdout_bucket IS
  'سطلِ ۰..۹۹، پایدار به ازای هر مهمان. NULL = مهمانِ ناشناس. هرگز برای بهترکردنِ عدد پس گرفته نمی‌شود.';

-- پرس‌وجویِ آموزش همیشه «همه‌ی انتقال‌های این رستوران در این بازه» است.
-- ⚠️ نام عمداً قراردادِ Prisma است (`<table>_<col>_<col>_idx`) و نه یک نامِ
-- دلخواه: گاردِ drift (`tests/schema-drift`) نامِ ایندکس را با آنچه
-- `@@index([restaurantId, createdAt])` تولید می‌کند مقایسه می‌کند، و نامِ
-- دست‌سازِ اولِ من یک ALTER INDEX ... RENAME به‌عنوانِ انحراف تولید کرد.
CREATE INDEX IF NOT EXISTS reservation_events_restaurant_id_created_at_idx
  ON reservation_events (restaurant_id, created_at);
-- و ارزیابیِ holdout همیشه به‌تفکیکِ سطل و نوعِ انتقال است.
CREATE INDEX IF NOT EXISTS reservation_events_holdout_idx
  ON reservation_events (holdout_bucket, to_status)
  WHERE holdout_bucket IS NOT NULL;

-- ── append-only، با تریگر و نه RLS ──
-- ⚠️ چرا تریگر: RLS اینجا **بی‌اثر** است. اندازه‌گیریِ این نشست روی HEAD:
--     SELECT count(*) FROM pg_policies WHERE schemaname='public';  → 0
--     … BASE TABLE در public;                                      → 72
-- اپ با کاربرِ owner وصل می‌شود، و ownerِ جدول از RLS معاف است مگر
-- FORCE ROW LEVEL SECURITY. پس یک policy اینجا امنیتِ نمایشی بود.
-- تریگرِ BEFORE برای owner هم اجرا می‌شود.
-- ⚠️ UPDATE و DELETE عمداً **یکسان رفتار نمی‌شوند**، و این یک تصمیم است نه
-- سهل‌انگاری. تهدیدِ اصلیِ دادهٔ آموزش **بازنویسیِ خاموش** است: ردیفی که عوض
-- شده از ردیفی که همیشه همان بوده قابلِ تفکیک نیست، و هیچ متریکی این را
-- نشان نمی‌دهد. حذف بدتر به نظر می‌رسد ولی **قابلِ کشف** است — نسبتِ پوششِ
-- به‌تفکیکِ نوعِ انتقال (M0 §۶.۵) با افتادنِ یک کلاس پایین می‌آید.
--
-- اندازه‌گیریِ این نشست، پیش از تصمیم:
--     ۴۷ فایلِ تست رزرو حذف می‌کنند (که با onDelete: Cascade به اینجا می‌رسد)
--     در `src/` **هیچ کدی** رزرو حذف نمی‌کند — حذف فقط در تستِ فیکسچر است
-- پس DELETE کاملاً بسته نمی‌شود، بلکه به «فقط از راهِ cascade» محدود می‌شود.

CREATE OR REPLACE FUNCTION reservation_events_no_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'reservation_events فقط-افزودنی است: بازنویسیِ دادهٔ آموزش هر متریکِ پایین‌دستی را ابطال‌ناپذیر می‌کند'
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reservation_events_guard_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- تنها حذفِ مجاز: cascade از حذفِ خودِ رزرو (FK با ON DELETE CASCADE).
  -- در آن حالت والد پیش از رسیدن به اینجا رفته است، پس نبودنش امضای cascade
  -- است. حذفِ **مستقیمِ** یک رویداد در حالی که رزرو زنده است — یعنی دقیقاً
  -- «پاک‌کردنِ تاریخ بدونِ پاک‌کردنِ موضوعش» — رد می‌شود.
  --
  -- ⚠️ نسخه‌ی اولِ من به‌جای این، یک دریچه‌ی `SET LOCAL app.allow_event_purge`
  -- داشت. اندازه‌گیری ردش کرد: تریگرِ DELETE روی **cascade** هم شلیک می‌کند و
  -- ۴۷ فایلِ تست که رزرو حذف می‌کنند شکستند (۱۵۴۵ تستِ قرمز در یک اجرا).
  -- این نسخه هم آن را درست می‌کند و هم گاردِ **قوی‌تری** است: دیگر هیچ
  -- دریچه‌ای نیست که کدِ اپ بتواند بازش کند.
  IF NOT EXISTS (SELECT 1 FROM reservations WHERE id = OLD.reservation_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION
    'حذفِ مستقیم از reservation_events مجاز نیست: تاریخِ انتقال‌ها فقط با حذفِ خودِ رزرو (cascade) می‌رود'
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reservation_events_no_update ON reservation_events;
CREATE TRIGGER reservation_events_no_update
  BEFORE UPDATE ON reservation_events
  FOR EACH ROW EXECUTE FUNCTION reservation_events_no_update();

DROP TRIGGER IF EXISTS reservation_events_no_delete ON reservation_events;
CREATE TRIGGER reservation_events_no_delete
  BEFORE DELETE ON reservation_events
  FOR EACH ROW EXECUTE FUNCTION reservation_events_guard_delete();
