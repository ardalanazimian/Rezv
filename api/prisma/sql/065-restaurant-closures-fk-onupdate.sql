-- ═══════════════════════════════════════════════════════════════════════
-- 065 — تکمیلِ FKِ restaurant_closures: افزودنِ ON UPDATE CASCADE
--
-- ⚠️ این فایل ادامه‌ی ۰۵۹ است، نه جایگزینش. ۰۵۹ از قبل در main شیپ شده
-- (کامیتِ 1e3d045) پس طبق قانونِ ۸ در CLAUDE.md ویرایش نمی‌شود؛ اصلاح
-- به‌صورتِ یک مهاجرتِ جدید می‌آید.
--
-- مشکلی که رفع می‌کند — انحرافِ واقعیِ اسکیما که امروز روی main هست:
--   • schema.prisma برای RestaurantClosure می‌گوید `onDelete: Cascade`.
--     پیش‌فرضِ `onUpdate` در Prisma برای یک relationِ الزامی «Cascade» است،
--     پس `db push` این FK را `ON DELETE CASCADE ON UPDATE CASCADE` می‌سازد.
--   • ولی ۰۵۹ فقط `ON DELETE CASCADE` می‌نویسد، یعنی روی هر DBای که از مسیرِ
--     apply-sql.sh ساخته شده FK بندِ ON UPDATE ندارد.
--   → دو مسیرِ ساختِ اسکیما به دو نتیجه‌ی متفاوت می‌رسند: دقیقاً همان
--     «CI سبز، تولید خراب» که CLAUDE.md درباره‌اش هشدار می‌دهد.
--
-- چرا main تا امروز این را ندید: گاردِ tests/schema-drift.integration.test.mts
-- در main وجود ندارد (با همین PR می‌آید)، و جابِ شل‌اسکریپتیِ schema-drift
-- عمداً فقط *نامِ ستون‌ها* را مقایسه می‌کند، پس انحرافِ FK را نمی‌بیند.
--
-- اندازه‌گیری‌شده روی Postgres واقعی (نه حدس): پس از این فایل، خروجیِ
-- pg_get_constraintdef دقیقاً با چیزی که `prisma db push` می‌سازد یکی می‌شود
-- و `prisma migrate diff` صفر statement برمی‌گرداند.
--
-- idempotent: DROP … IF EXISTS + ADD، اجرای مجدد بی‌ضرر است.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE restaurant_closures
  DROP CONSTRAINT IF EXISTS restaurant_closures_restaurant_id_fkey;

ALTER TABLE restaurant_closures
  ADD CONSTRAINT restaurant_closures_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
  ON DELETE CASCADE ON UPDATE CASCADE;
