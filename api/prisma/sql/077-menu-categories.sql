-- ═══════════════════════════════════════════════════════════════════════
-- ۰۷۷ — SPEC-A فاز ۱: دسته‌بندیِ رابطه‌ایِ منو + وضعیتِ «ناموجود»
--
-- می‌سازد:
--   • جدولِ menu_categories (+unique رستوران+نام، ایندکسِ ترتیب، FK)
--   • menu_items.category_id (FK با SET NULL — حذفِ دسته آیتم را نمی‌کشد)
--   • menu_items.is_out_of_stock (برچسبِ «ناموجود»؛ جدا از is_active)
--   • backfill: رشته‌های متمایزِ ستونِ متنیِ category → ردیفِ دسته + لینک
--
-- ستونِ متنیِ menu_items.category حذف نمی‌شود: میرورِ سازگاری برای
-- مصرف‌کننده‌های موجود (groupByCategoryِ سایتِ SEO، پنل، اپِ مشتری) است و
-- سرور از این پس در هر تغییرِ دسته سینکش می‌کند.
--
-- ⚠️ ON UPDATE CASCADE در FKها عمدی است: پیش‌فرضِ emitِ Prisma همین است و
-- بدونش گاردِ drift قرمز می‌شود (درسِ ۰۶۵/۰۷۶). نامِ ایندکس‌ها/قیدها دقیقاً
-- نام‌های تولیدیِ Prisma است تا db push (مسیرِ CI) ایندکسِ دوم نسازد (درسِ ۰۷۴).
-- idempotent: IF NOT EXISTS یا DO $$ … duplicate_* THEN NULL؛ backfill هم
-- دوباراجرایی‌پذیر است (ON CONFLICT DO NOTHING + فقط ردیف‌های category_id IS NULL).
-- «هر دو جا»: همه‌ی این‌ها عیناً در schema.prisma اعلام شده‌اند.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS menu_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name          text NOT NULL,
  sort_order    int  NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- @updatedAt پریزما سمتِ کلاینت می‌نویسد؛ DEFAULT برای ردیف‌های backfillِ
  -- همین فایل و هر INSERT خامِ آینده لازم است.
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- نامِ تولیدیِ Prisma برای @@unique([restaurantId, name])
CREATE UNIQUE INDEX IF NOT EXISTS menu_categories_restaurant_id_name_key
  ON menu_categories (restaurant_id, name);

-- نامِ تولیدیِ Prisma برای @@index([restaurantId, sortOrder])
CREATE INDEX IF NOT EXISTS menu_categories_restaurant_id_sort_order_idx
  ON menu_categories (restaurant_id, sort_order);

DO $$ BEGIN
  ALTER TABLE menu_categories ADD CONSTRAINT menu_categories_restaurant_id_fkey
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE menu_items ADD COLUMN category_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE menu_items ADD COLUMN is_out_of_stock boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- SET NULL: آیتمِ دسته‌ی حذف‌شده «دسته‌نشده» می‌شود، گم نمی‌شود.
DO $$ BEGIN
  ALTER TABLE menu_items ADD CONSTRAINT menu_items_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- map صریح در schema: menu_items_rest_cat_sort_idx
CREATE INDEX IF NOT EXISTS menu_items_rest_cat_sort_idx
  ON menu_items (restaurant_id, category_id, sort_order);

-- ── backfill (دوباراجرایی‌پذیر) ──
-- ۱) هر رشته‌ی متمایزِ دسته‌ی متنی → یک ردیفِ menu_categories
INSERT INTO menu_categories (restaurant_id, name)
SELECT DISTINCT restaurant_id, btrim(category)
FROM menu_items
WHERE category IS NOT NULL AND btrim(category) <> ''
ON CONFLICT (restaurant_id, name) DO NOTHING;

-- ۲) لینکِ آیتم‌های هنوز-لینک‌نشده به دسته‌ی هم‌نامِ همان رستوران
UPDATE menu_items mi
SET category_id = mc.id
FROM menu_categories mc
WHERE mi.category_id IS NULL
  AND mi.category IS NOT NULL AND btrim(mi.category) <> ''
  AND mc.restaurant_id = mi.restaurant_id
  AND mc.name = btrim(mi.category);
