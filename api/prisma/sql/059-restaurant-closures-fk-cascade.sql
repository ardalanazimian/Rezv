-- ═══════════════════════════════════════════════════════════════════════
-- 059 — همسان‌سازیِ FKِ restaurant_closures با schema.prisma (ON DELETE CASCADE)
--
-- ⚠️ driftِ واقعیِ کشف‌شده در ممیزیِ ۲۰۲۶-۰۸-۲۴، دقیقاً از همان کلاسی که
-- CLAUDE.md درباره‌اش هشدار می‌دهد («CI سبز، تولید خراب»):
--   • schema.prisma برای RestaurantClosure می‌گوید onDelete: Cascade —
--     پس مسیرِ CI (db push) این FK را CASCADE می‌سازد و همه‌ی تست‌ها سبزند.
--   • مهاجرتِ دستیِ 021 همان FK را *بدونِ* CASCADE ساخته — پس در مسیرِ
--     تولید (migrate deploy + apply-sql.sh) حذفِ رستورانی که تعطیلیِ
--     ثبت‌شده دارد با نقضِ FK می‌شکند.
-- کشفش هم عملی بود، نه نظری: اجرای تست‌های integration روی DBای که با مسیرِ
-- تولید ساخته شده بود، در cleanup با
-- «Foreign key constraint violated: restaurant_closures_restaurant_id_fkey»
-- شکست — همان چیزی که در CI هرگز دیده نمی‌شود.
--
-- idempotent: اگر constraint از قبل CASCADE باشد، drop/add دوباره همان نتیجه
-- را می‌دهد (اجرای مجدد بی‌ضرر است).
-- ═══════════════════════════════════════════════════════════════════════

-- ⚠️ `ON UPDATE CASCADE` اجباری است و تزئینی نیست: پیش‌فرضِ `onUpdate` در Prisma
-- برای یک relationِ الزامی «Cascade» است، پس `db push` این FK را
-- `ON DELETE CASCADE ON UPDATE CASCADE` می‌سازد. اگر اینجا فقط ON DELETE بنویسیم،
-- این مهاجرت رویِ مسیرِ CI همان FKِ درست را با یکی که ON UPDATE ندارد جایگزین
-- می‌کند و گاردِ schema-drift.integration قرمز می‌شود (اندازه‌گیری‌شده روی
-- Postgres واقعی، نه حدس).

ALTER TABLE restaurant_closures
  DROP CONSTRAINT IF EXISTS restaurant_closures_restaurant_id_fkey;

ALTER TABLE restaurant_closures
  ADD CONSTRAINT restaurant_closures_restaurant_id_fkey
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE ON UPDATE CASCADE;
