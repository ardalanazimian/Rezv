-- ═══════════════════════════════════════════════════════════════════════
--  ۰۸۴ — چهار قیدِ CHECKِ نمره‌ی نظر که در CI هرگز ساخته نمی‌شدند
--
--  ⚠️ این یک قیدِ *تازه* نیست. این چهار قید از مهاجرتِ ۰۱۵ در **تولید** وجود
--  دارند و در **CI وجود ندارند** — و هیچ گاردی نمی‌توانست ببیندش.
--
--  سازوکار، اندازه‌گیری‌شده روی دو دیتابیسِ واقعی (نه استنتاج از خواندنِ کد):
--
--    مسیرِ تولید:  prisma migrate deploy (0_init) + apply-sql.sh
--                  0_init جدولِ `reviews` را **نمی‌سازد** (grep روی
--                  migrations/0_init/migration.sql → صفر ارجاع)، پس
--                  `CREATE TABLE IF NOT EXISTS reviews (...)` در ۰۱۵ واقعاً
--                  اجرا می‌شود و چهار قیدِ inline با آن ساخته می‌شوند.
--
--    مسیرِ CI:     prisma db push + apply-sql.sh   (ci.yml:120-124)
--                  `db push` جدولِ `reviews` را از schema.prisma **جلوتر**
--                  می‌سازد، پس `IF NOT EXISTS` در ۰۱۵ به no-op تبدیل می‌شود
--                  و چهار قید **هرگز ساخته نمی‌شوند**.
--
--  شمارشِ واقعی روی دو دیتابیسِ ساخته‌شده از همین HEAD:
--      مسیرِ تولید → ۱۳ قیدِ CHECK
--      مسیرِ CI     →  ۹ قیدِ CHECK
--      اختلاف       →  دقیقاً همین چهار تا، و در جهتِ دیگر صفر
--
--  ⚠️ چرا این «فقط یک تفاوتِ آرایشی» نیست: تولید **سخت‌گیرتر** از CI است.
--  یعنی مسیری که نمره‌ی خارج از ۱..۵ بنویسد تمامِ تست‌ها را سبز رد می‌کند و
--  در تولید با ۲۳۵۱۴ کلِ تراکنش را برمی‌گرداند — همان کلاسِ «CI سبز، تولید
--  خراب» که کلِ check-schema-drift برایش نوشته شده، فقط روی محوری که آن
--  اسکریپت اصلاً نگاه نمی‌کرد.
--
--  ⚠️ امروز قابلِ بهره‌برداری **نیست** و این را صریح می‌گویم تا کسی شدت را
--  اشتباه نخواند: لایه‌ی اپلیکیشن نمره را با Zod به ۱..۵ محدود می‌کند
--  (`app/api/v1/me/reviews/route.ts:12` — `z.number().int().min(1).max(5)`).
--  پس هیچ درخواستی امروز به دیتابیس نمی‌رسد که قید را بشکند. چیزی که از بین
--  رفته **دفاعِ آخر** است — دقیقاً همان چیزی که ۰۶۴ درباره‌ی موجودی‌های پولی
--  نوشت: «اگر فردا مسیرِ تازه‌ای شرط را جا بیندازد، امروز هیچ‌چیز جلویش را
--  نمی‌گیرد.» و بدتر: چون CI آن قید را ندارد، **هیچ تستی نمی‌تواند آن
--  رگرسیون را بگیرد**.
--
--  چرا نام‌ها صریح‌اند و چرا **دقیقاً** همین نام‌ها:
--  در تولید این قیدها را Postgres خودش نام‌گذاری کرده
--  (`<جدول>_<ستون>_check`). با همان نام‌ها می‌نویسمشان تا:
--    • در تولید شرطِ `IF NOT EXISTS` برقرار باشد و **قیدِ تکراری ساخته نشود**
--    • در CI با همان نام و همان تعریف ساخته شوند
--  نتیجه: هر دو مسیر به ۱۳ قیدِ **یکسان** می‌رسند، نه ۱۳ و ۱۷.
--  اندازه‌گیری‌شده روی مسیرِ تولید:
--      reviews_rating_check · reviews_food_rating_check
--      reviews_service_rating_check · reviews_atmosphere_rating_check
--
--  `BETWEEN 1 AND 5` عمداً حفظ شد چون Postgres آن را به
--  `((x >= 1) AND (x <= 5))` نرمال می‌کند — یعنی تعریفِ ذخیره‌شده با آنچه ۰۱۵
--  در تولید ساخته بایت‌به‌بایت یکی می‌شود و مقایسه‌ی گارد صفر اختلاف می‌دهد.
--
--  سه ستونِ nullable (`food_/service_/atmosphere_rating`) بدونِ تغییر
--  nullable می‌مانند: NULL در CHECK به `unknown` ارزیابی می‌شود و رد نمی‌شود.
--
--  idempotent، و روی جدولی که ممکن است اصلاً وجود نداشته باشد امن است.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'reviews' AND relnamespace = 'public'::regnamespace) THEN
    RAISE NOTICE 'جدولِ reviews وجود ندارد — رد شد';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_rating_check') THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_food_rating_check') THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_food_rating_check CHECK (food_rating BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_service_rating_check') THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_service_rating_check CHECK (service_rating BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_atmosphere_rating_check') THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_atmosphere_rating_check CHECK (atmosphere_rating BETWEEN 1 AND 5);
  END IF;
END $$;
