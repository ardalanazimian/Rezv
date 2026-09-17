-- ═══════════════════════════════════════════════════════════════════════
--  ۰۹۲ — «دیرتر می‌رسم»: هشدارِ پیش از عدم‌حضور، تمدیدِ مهمان، و بازه‌های D-18 (STATE M-13 · F001)
--
--  چرا (Feature Verification، ۲۰۲۶-۰۹-۱۶، اندازه‌گیری‌شده): مهمانی که ۱۷ دقیقه دیر کرده بود در
--  **یک** تیکِ cron هم running_late شد هم no_show — صفر پیامک پیش از آن. حکمِ CEO D-20: هیچ جریمه‌ای
--  بدونِ سیگنالِ قابلِ‌مشاهده‌ی قبلی و یک پنجره‌ی واقعی پس از آن.
--
--  ستون‌ها:
--    reservations.late_warned_at          لحظه‌ای که ارائه‌دهنده پیامکِ هشدار را **پذیرفت** (نه لحظه‌ی
--                                         صف‌شدن)، یا لحظه‌ی «دیرتر می‌رسم»ِ خودِ مهمان. NULL = هشداری
--                                         نرسیده → cron هرگز no_show نمی‌کند.
--    reservations.late_eta_signaled_at    «دیرتر می‌رسم» — یک‌بار برای هر رزرو.
--    reservations.late_extension_minutes  تمدیدِ پذیرفته‌شده، ۰..۳۰.
--    restaurants.max_late_extension_minutes  سقفِ تمدید برای مهمان، ۰..۳۰، پیش‌فرض ۱۵ (D-18؛ ۰ مجاز).
--  و `restaurants.late_grace_minutes` (از 0_init، پیش‌فرض ۱۵) حالا بازه‌ی ۱۰..۶۰ دارد (D-18).
--
--  ── چرا CHECKها «NOT VALID ← clamp با audit ← VALIDATE» (شرطِ CEO، ۲۰۲۶-۰۹-۱۷) ──────────
--  اندازه‌گیری روی سه DBِ تازه: صفر رستوران بیرون از ۱۰..۶۰ (همه ۱۵) و `late_grace_minutes` تا امروز
--  **هیچ نویسنده‌ای** در api/src نداشت. ولی دادهٔ تولید اندازه‌گیری نشده (محیطِ مستقری وجود ندارد)،
--  و `ADD CONSTRAINT … CHECK` ِ ساده روی یک ردیفِ ناهمخوان **کلِ deploy را می‌کُشد** — همان کلاسِ
--  «روی DBِ تازه سبز، در تولید خراب». پس:
--    ۱) قید `NOT VALID` اضافه می‌شود (ردیف‌های تازه را از همین لحظه می‌سنجد، قبلی‌ها را نه)؛
--    ۲) هر ردیفِ ناهمخوان به نزدیک‌ترین مرز clamp می‌شود و **برای هر کدام** یک ردیفِ audit با مقدارِ
--       قبلی و بعدی نوشته می‌شود — تغییرِ بی‌صدای تنظیمِ یک رستوران ممنوع است؛
--    ۳) `VALIDATE CONSTRAINT` — حالا قطعاً موفق.
--  idempotent: ستون‌ها `IF NOT EXISTS`، قیدها `duplicate_object`، clamp فقط ردیفِ ناهمخوان را می‌بیند
--  (اجرای دوم هیچ ردیف و هیچ auditی نمی‌سازد)، و VALIDATEِ قیدِ معتبر بی‌اثر است.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS late_warned_at TIMESTAMP(3);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS late_eta_signaled_at TIMESTAMP(3);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS late_extension_minutes SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS max_late_extension_minutes SMALLINT NOT NULL DEFAULT 15;

-- ── ۱) قیدها، NOT VALID ──
DO $$ BEGIN
  ALTER TABLE restaurants ADD CONSTRAINT restaurants_late_grace_minutes_range
    CHECK (late_grace_minutes BETWEEN 10 AND 60) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE restaurants ADD CONSTRAINT restaurants_max_late_extension_minutes_range
    CHECK (max_late_extension_minutes BETWEEN 0 AND 30) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE reservations ADD CONSTRAINT reservations_late_extension_minutes_range
    CHECK (late_extension_minutes BETWEEN 0 AND 30) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── ۲) clampِ ردیف‌های ناهمخوان، هر ستون با auditِ خودش ──
-- ⚠️ هر دو ستونِ رستوران در **یک** UPDATE: قیدِ NOT VALID ردیف‌های قدیمی را نمی‌سنجد ولی **نسخه‌ی
-- تازه‌ی هر ردیفی که UPDATE می‌شود** را می‌سنجد. نسخه‌ی اولِ همین مهاجرت دو UPDATEِ جدا داشت و روی
-- رستورانی که هر دو مقدارش بیرون از بازه بود شکست خورد (clampِ مهلت، ردیف را با تمدیدِ هنوز-۴۵ دوباره
-- نوشت → نقضِ قیدِ دوم → کلِ مهاجرت rollback). آزمونِ روی دادهٔ ناهمخوان گرفتش، نه DBِ تازه.
WITH bad AS (
  SELECT id, late_grace_minutes AS old_grace, max_late_extension_minutes AS old_ext
  FROM restaurants
  WHERE late_grace_minutes NOT BETWEEN 10 AND 60 OR max_late_extension_minutes NOT BETWEEN 0 AND 30
  FOR UPDATE
), fixed AS (
  UPDATE restaurants r SET
    late_grace_minutes = LEAST(60, GREATEST(10, b.old_grace)),
    max_late_extension_minutes = LEAST(30, GREATEST(0, b.old_ext))
  FROM bad b WHERE r.id = b.id
  RETURNING r.id, b.old_grace, r.late_grace_minutes AS new_grace, b.old_ext, r.max_late_extension_minutes AS new_ext
)
INSERT INTO audit_logs (id, action, actor_type, restaurant_id, detail, created_at)
SELECT gen_random_uuid(), 'migration.092.clamp_late_grace_minutes', 'system', id,
       jsonb_build_object('column', 'late_grace_minutes', 'old', old_grace, 'new', new_grace, 'rule', 'D-18: 10..60'),
       CURRENT_TIMESTAMP
FROM fixed WHERE old_grace <> new_grace
UNION ALL
SELECT gen_random_uuid(), 'migration.092.clamp_max_late_extension_minutes', 'system', id,
       jsonb_build_object('column', 'max_late_extension_minutes', 'old', old_ext, 'new', new_ext, 'rule', 'D-18: 0..30'),
       CURRENT_TIMESTAMP
FROM fixed WHERE old_ext <> new_ext;

-- late_extension_minutes روی رزرو تازه است (پیش‌فرض ۰) و هیچ ردیفِ ناهمخوانی نمی‌تواند داشته باشد؛
-- clamp با همان شکل برای یکنواختی و اجرای دوباره.
UPDATE reservations SET late_extension_minutes = LEAST(30, GREATEST(0, late_extension_minutes))
WHERE late_extension_minutes NOT BETWEEN 0 AND 30;

-- ── ۳) اعتبارسنجی ──
ALTER TABLE restaurants VALIDATE CONSTRAINT restaurants_late_grace_minutes_range;
ALTER TABLE restaurants VALIDATE CONSTRAINT restaurants_max_late_extension_minutes_range;
ALTER TABLE reservations VALIDATE CONSTRAINT reservations_late_extension_minutes_range;
