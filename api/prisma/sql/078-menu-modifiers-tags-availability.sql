-- ═══════════════════════════════════════════════════════════════════════
-- ۰۷۸ — SPEC-A فاز ۲: افزودنی‌ها (modifier)، برچسب‌ها، پنجره‌ی دسترسی
--
-- می‌سازد:
--   • enum menu_tag (۹ مقدار)
--   • menu_modifier_groups / menu_modifier_options (Cascade به آیتم/گروه)
--   • menu_item_tags (PK مرکبِ آیتم+برچسب)
--   • menu_items.availability jsonb  ({days:int[], start_min, end_min}؛ NULL=همیشه)
--
-- ⚠️ برخلافِ ۰۷۷، PKها **DEFAULT ندارند**: schema این‌ها را @default(uuid())ِ
-- کلاینتی اعلام کرده (هیچ backfill/INSERTِ خامی در کار نیست) و DEFAULTِ اضافه
-- دقیقاً همان driftی است که گارد می‌گیرد. FKها با نامِ emitِ Prisma و
-- ON UPDATE CASCADE (درسِ ۰۶۵/۰۷۶). idempotent: IF NOT EXISTS / DO $$ duplicate_*.
-- «هر دو جا»: عیناً در schema.prisma هم اعلام شده‌اند.
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE menu_tag AS ENUM
    ('VEGETARIAN','VEGAN','SPICY','GLUTEN_FREE','CONTAINS_NUTS','CONTAINS_DAIRY','HALAL','NEW','POPULAR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS menu_modifier_groups (
  id           uuid PRIMARY KEY,
  menu_item_id uuid NOT NULL,
  name         text NOT NULL,
  min_select   int  NOT NULL DEFAULT 0,
  max_select   int  NOT NULL DEFAULT 1,
  sort_order   int  NOT NULL DEFAULT 0
);

DO $$ BEGIN
  ALTER TABLE menu_modifier_groups ADD CONSTRAINT menu_modifier_groups_menu_item_id_fkey
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS menu_modifier_groups_menu_item_id_sort_order_idx
  ON menu_modifier_groups (menu_item_id, sort_order);

CREATE TABLE IF NOT EXISTS menu_modifier_options (
  id                uuid PRIMARY KEY,
  group_id          uuid NOT NULL,
  name              text NOT NULL,
  price_delta_toman int  NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        int  NOT NULL DEFAULT 0
);

DO $$ BEGIN
  ALTER TABLE menu_modifier_options ADD CONSTRAINT menu_modifier_options_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES menu_modifier_groups(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS menu_modifier_options_group_id_sort_order_idx
  ON menu_modifier_options (group_id, sort_order);

CREATE TABLE IF NOT EXISTS menu_item_tags (
  menu_item_id uuid NOT NULL,
  tag          menu_tag NOT NULL,
  CONSTRAINT menu_item_tags_pkey PRIMARY KEY (menu_item_id, tag)
);

DO $$ BEGIN
  ALTER TABLE menu_item_tags ADD CONSTRAINT menu_item_tags_menu_item_id_fkey
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE menu_items ADD COLUMN availability jsonb;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
