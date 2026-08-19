-- ═══════════════════════════════════════════════════════════════════════
--  ۰۴۶ — تفکیکِ «صفرِ تأییدشده» از «نامعلوم» در ستون‌هایِ مبلغیِ customer_insights
--
--  مسئله (ممیزیِ ۲۰۲۶-۰۸-۱۹): رزرونو عمداً POS-agnostic است و مبلغِ فاکتور را
--  نمی‌بیند؛ تنها منبعِ مبلغ، `reservation_items` (پیش‌سفارش از منو) است. هیچ
--  روتی برایِ ساختِ آیتمِ منو وجود ندارد، پس رستورانِ واقعی منوی خالی دارد →
--  پیش‌سفارش ممکن نیست → مبلغ همیشه ۰ محاسبه می‌شد و همان ۰ به‌عنوانِ عددِ
--  اندازه‌گیری‌شده ذخیره و به رستوران‌دار نشان داده می‌شد.
--
--  چون ستون‌ها NOT NULL DEFAULT 0 بودند، «نداریم» و «صفر بود» غیرقابلِ تفکیک
--  بودند. بعد از این migration:
--     NULL = اندازه‌گیری‌ناپذیر (رستوران هیچ آیتمِ منویِ فعال ندارد)
--     0    = واقعاً پیش‌سفارشی ثبت نشده، درحالی‌که امکانش بوده
--
--  هم‌الگو با `intelligence_score` که از قبل nullable است و در کد با
--  `nulls: 'last'` مرتب می‌شود.
--
--  ایمنیِ تولید: DROP NOT NULL و DROP DEFAULT قفلِ کوتاهِ ACCESS EXCLUSIVE
--  می‌گیرند و داده‌ای بازنویسی نمی‌کنند (بدونِ table rewrite).
--  backfill فقط ردیف‌هایی را NULL می‌کند که *هر سه* مقدارشان صفر است **و**
--  رستورانشان هیچ آیتمِ منویِ فعال ندارد — یعنی دقیقاً همان صفرهایی که
--  ساختاراً جعلی بودند. هیچ مقدارِ ناصفری لمس نمی‌شود.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE customer_insights ALTER COLUMN total_spend_toman   DROP NOT NULL;
ALTER TABLE customer_insights ALTER COLUMN total_spend_toman   DROP DEFAULT;
ALTER TABLE customer_insights ALTER COLUMN avg_spend_toman     DROP NOT NULL;
ALTER TABLE customer_insights ALTER COLUMN avg_spend_toman     DROP DEFAULT;
ALTER TABLE customer_insights ALTER COLUMN predicted_clv_toman DROP NOT NULL;
ALTER TABLE customer_insights ALTER COLUMN predicted_clv_toman DROP DEFAULT;

-- backfill محافظه‌کارانه: فقط صفرهایِ ساختاراً اندازه‌گیری‌ناپذیر
UPDATE customer_insights ci
SET total_spend_toman = NULL,
    avg_spend_toman = NULL,
    predicted_clv_toman = NULL
WHERE ci.total_spend_toman = 0
  AND ci.avg_spend_toman = 0
  AND ci.predicted_clv_toman = 0
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE mi.restaurant_id = ci.restaurant_id
      AND mi.is_active = true
      AND mi.price_toman > 0
  );

-- امتیازِ هوشِ مشتری ۳۵٪ وزنش از چارکِ مبلغی (ntile روی total_spend_toman)
-- می‌آید. وقتی مبلغ نامعلوم است آن چارک بی‌معناست، پس امتیازِ ساخته‌شده از آن
-- هم بی‌معناست و باید «محاسبه‌نشده» بماند تا اجرایِ بعدیِ RFM تصمیم بگیرد.
UPDATE customer_insights
SET intelligence_score = NULL, intelligence_tier = NULL
WHERE total_spend_toman IS NULL;
