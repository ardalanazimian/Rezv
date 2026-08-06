-- ═══════════════════════════════════════════════════════════════════════
--  ۰۳۲ — بازبینیِ عکسِ گالری + آپلودِ مستقیمِ فایل
--
--  تا پیش از این، عکس فقط با «لینک» اضافه می‌شد و بی‌درنگ روی صفحه‌ی عمومی
--  و اپ مشتری می‌نشست. حالا فایل مستقیم آپلود می‌شود و تا وقتی در پنل شرکت
--  تأیید نشود، هیچ‌جای عمومی دیده نمی‌شود.
--
--  ⚠️ نکته‌ی مهاجرت: ردیف‌های موجود عمداً approved می‌شوند، نه pending.
--     اگر پیش‌فرضِ pending روی داده‌ی قدیمی اعمال می‌شد، گالریِ همه‌ی
--     رستوران‌های فعال در لحظه‌ی دیپلوی خالی می‌شد — یک قطعیِ محتوایی که
--     هیچ‌کس درخواستش نکرده بود. بازبینی فقط برای عکسِ تازه است.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'photo_status') THEN
    CREATE TYPE photo_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- ── فایلِ آپلودشده ──
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS storage_key    text;
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS mime_type      text;
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS byte_size      integer;
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS width          integer;
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS height         integer;
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS original_name  text;
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS uploaded_by_staff_id uuid;

-- ── بازبینی ──
-- پیش‌فرضِ ستون pending است (برای درج‌های تازه)، ولی بلافاصله پس از افزودن،
-- ردیف‌های موجود به approved برگردانده می‌شوند.
ALTER TABLE restaurant_photos
  ADD COLUMN IF NOT EXISTS status photo_status NOT NULL DEFAULT 'pending';
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS reviewed_at      timestamptz;
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS reviewed_by_id   uuid;
ALTER TABLE restaurant_photos ADD COLUMN IF NOT EXISTS rejection_reason text;

-- پرکردنِ داده‌ی قدیمی: هر عکسی که پیش از این migration وجود داشته منتشر بوده
-- است، پس همان‌طور می‌ماند. شرطِ storage_key IS NULL یعنی «افزوده‌شده با لینک»
-- — دقیقاً همان ردیف‌های قدیمی. اجرای دوباره‌ی فایل چیزی را خراب نمی‌کند چون
-- عکس‌های تازه همیشه storage_key دارند.
UPDATE restaurant_photos
   SET status = 'approved', reviewed_at = COALESCE(reviewed_at, created_at)
 WHERE storage_key IS NULL
   AND status = 'pending';

-- صفِ بازبینی: «pendingها، قدیمی‌ترین اول» — بدونِ این، هر بار باز کردنِ صف
-- یک sequential scan روی کلِ گالریِ پلتفرم بود.
CREATE INDEX IF NOT EXISTS restaurant_photos_status_created_at_idx
  ON restaurant_photos (status, created_at);

-- کلیدِ فایل باید یکتا باشد: دو ردیف نباید به یک فایل روی دیسک اشاره کنند،
-- وگرنه حذفِ یکی، عکسِ دیگری را هم از بین می‌برد.
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_photos_storage_key_key
  ON restaurant_photos (storage_key) WHERE storage_key IS NOT NULL;
