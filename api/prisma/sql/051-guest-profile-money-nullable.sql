-- ═══════════════════════════════════════════════════════════════════════
--  ۰۵۱ — انتشارِ معناشناسیِ «صفرِ تأییدشده در برابرِ نامعلوم» به guest_profiles
--
--  باگِ واقعی (پیدا شده در ممیزیِ زنده‌ی پنلِ کمپانی، ۲۰۲۶-۰۸-۱۹):
--  migrationِ ۰۴۶ ستون‌هایِ مبلغیِ customer_insights را nullable کرد، ولی
--  rollupِ سراسری (lib/guest-profile.ts → rebuildGuestProfiles) به‌روز نشد.
--  آن کوئری `sum(total_spend_toman)` و `sum(predicted_clv_toman)` می‌گیرد؛
--  در SQL اگر همه‌ی ردیف‌هایِ یک گروه NULL باشند، sum() هم NULL می‌دهد.
--  ولی مقصد (guest_profiles) هنوز NOT NULL DEFAULT 0 بود.
--
--  نتیجه: **یک** مهمان که تنها رستورانش منویِ قیمت‌دار ندارد، کلِ INSERT را
--  با خطایِ not-null می‌شکست — و چون INSERT ... SELECT یک statement است،
--  *هیچ‌کدام* از پروفایل‌ها نوشته نمی‌شد. در دیتابیسِ تست: ۳۹ کاربر در
--  customer_insights، ۰ ردیف در guest_profiles.
--
--  پنلِ کمپانی همه‌ی معیارهایِ سراسری‌اش (مهمانان، VIPها، CLVِ پلتفرم) را از
--  همین جدول می‌خواند، پس همگی صفر نشان داده می‌شدند — نه چون داده صفر بود،
--  بلکه چون جدول خالی مانده بود. یعنی شکستِ کامل، به‌شکلِ «دادهٔ صفر».
--
--  اصلاح: مقصد همان قرارداد مبدأ را می‌گیرد —
--     NULL = اندازه‌گیری‌ناپذیر (هیچ رستورانِ این مهمان منویِ قیمت‌دار ندارد)
--     0    = واقعاً صفر، درحالی‌که امکانِ اندازه‌گیری بوده
--
--  ایمنیِ تولید: DROP NOT NULL / DROP DEFAULT فقط قفلِ کوتاهِ
--  ACCESS EXCLUSIVE می‌گیرند و جدول را بازنویسی نمی‌کنند.
--  هیچ backfillی لازم نیست: ردیف‌هایِ موجود مقدارِ عددیِ معتبر دارند و
--  اجرایِ بعدیِ rebuildGuestProfiles آن‌ها را با معناشناسیِ درست بازمی‌نویسد.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE guest_profiles ALTER COLUMN global_spend_toman DROP NOT NULL;
ALTER TABLE guest_profiles ALTER COLUMN global_spend_toman DROP DEFAULT;
ALTER TABLE guest_profiles ALTER COLUMN global_clv_toman   DROP NOT NULL;
ALTER TABLE guest_profiles ALTER COLUMN global_clv_toman   DROP DEFAULT;
