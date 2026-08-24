-- ═══════════════════════════════════════════════════════════════════════
--  ۰۵۳ — عکسِ آپلودیِ آیتمِ منو + شخصی‌سازیِ صفحه‌ی منویِ عمومی
--
--  ── بخشِ ۱: عکسِ آیتم از راهِ آپلود، نه لینکِ آزاد ──────────────────────
--
--  مهاجرتِ ۰۵۲ ستونِ `image_url` را اضافه کرد و API آدرسِ دلخواهِ کلاینت را
--  می‌پذیرفت. این برایِ یک محصولِ واقعی کافی نیست و سه اشکالِ جدی دارد:
--    • هیچ تضمینی نیست که آن آدرس واقعاً تصویر باشد — رستوران‌دار می‌تواند
--      آدرسِ هر چیزی را بگذارد و صفحه‌ی عمومی آن را در <img> بنشاند.
--    • هات‌لینک به میزبانِ بیرونی: روزی که آن میزبان بالا نیاید، منویِ روی
--      میزها عکسِ شکسته نشان می‌دهد و کسی خبردار نمی‌شود.
--    • هیچ اعتبارسنجیِ حجم/ابعاد/فرمت و هیچ امکانِ نظارتی وجود ندارد.
--
--  خطِ لوله‌ی درست از قبل در همین پروژه هست و برایِ گالریِ رستوران کار
--  می‌کند (`lib/media.ts` + `lib/media-store.ts`): تشخیصِ فرمت از روی
--  magic-byte، سقفِ حجم و ابعاد، کلیدِ ذخیره‌سازی، و سروِ فایل از
--  `/api/v1/media/<key>`. این مهاجرت همان الگو را به منو می‌آورد.
--
--  `image_url` حذف نمی‌شود: دقیقاً مثلِ `restaurant_photos.url` نگه داشته
--  می‌شود ولی از این پس *مقدارش را سرور می‌نویسد* (`/api/v1/media/<key>`)،
--  نه کلاینت. یعنی خواننده‌ها (صفحه‌ی SEO، اپِ مشتری) تغییری نمی‌کنند.
--
--  ⚠️ تفاوتِ عمدی با گالریِ رستوران: عکسِ گالری با وضعیتِ `pending` می‌نشیند
--  و تا تأییدِ پلتفرم دیده نمی‌شود. عکسِ آیتمِ منو **بی‌درنگ منتشر می‌شود**،
--  چون طبقِ مدلِ اختیاراتِ محصول، منو مالِ خودِ رستوران است و باید بدونِ
--  دخالتِ شرکت به‌روز شود. نظارتِ شرکت همچنان ممکن است (حذف/غیرفعال‌سازی)،
--  ولی مسیرِ عادیِ به‌روزرسانی را قفل نمی‌کند.
--
--  ── بخشِ ۲: شخصی‌سازیِ صفحه‌ی منو ───────────────────────────────────────
--
--  صفحه‌ی منویِ عمومی امروز برایِ همه‌ی رستوران‌ها یک‌شکل است. رستوران‌دار
--  هیچ کنترلی بر هویتِ بصریِ صفحه‌ای که QRش را روی میز چاپ می‌کند ندارد.
--  این ستون‌ها حداقلِ واقعیِ آن کنترل‌اند (نه یک سیستمِ تمِ کامل):
--    • menu_accent   — رنگِ تأکیدِ برند (#RRGGBB)
--    • menu_theme    — 'light' | 'dark' | 'auto'
--    • menu_tagline  — یک خطِ معرفی زیرِ نامِ رستوران
--    • menu_layout   — 'list' | 'grid' (شبکه برایِ منویِ عکس‌محور)
--  همه nullable: NULL یعنی «رستوران‌دار انتخاب نکرده» و صفحه به پیش‌فرضِ
--  پلتفرم برمی‌گردد — نه یک مقدارِ جعلیِ ازپیش‌نشسته.
--
--  ایمنیِ تولید: همه‌ی ستون‌ها nullable و بدونِ بازنویسیِ جدول؛ idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- ── عکسِ آیتمِ منو (متادیتایِ فایلِ آپلودشده) ──
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_storage_key TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_mime        TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_width       INTEGER;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_height      INTEGER;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_byte_size   INTEGER;

-- ── شخصی‌سازیِ صفحه‌ی منویِ عمومی ──
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS menu_accent  TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS menu_theme   TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS menu_tagline TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS menu_layout  TEXT;

-- مقادیرِ مجاز در سطحِ دیتابیس تضمین می‌شوند، نه فقط در اعتبارسنجیِ API:
-- یک اسکریپتِ دستی یا مهاجرتِ آینده هم نباید بتواند مقدارِ بی‌معنا بنشاند.
-- NULL مجاز است (یعنی «انتخاب‌نشده»).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_menu_theme_chk') THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_menu_theme_chk
      CHECK (menu_theme IS NULL OR menu_theme IN ('light', 'dark', 'auto'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_menu_layout_chk') THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_menu_layout_chk
      CHECK (menu_layout IS NULL OR menu_layout IN ('list', 'grid'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_menu_accent_chk') THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_menu_accent_chk
      CHECK (menu_accent IS NULL OR menu_accent ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;
