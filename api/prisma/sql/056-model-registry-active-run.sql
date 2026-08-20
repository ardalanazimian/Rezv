-- ═══════════════════════════════════════════════════════════════════════
--  فازِ ۶ — رجیستریِ مدل: بستنِ پیش‌بینی به نسخه‌ی مدلی که تولیدش کرده
--
--  ممیزیِ پیش از پیاده‌سازی (۲۰۲۶-۰۸-۲۰) چه نشان داد:
--    • model_training_runs (مهاجرتِ ۰۴۲) از قبل تاریخچه‌ی append-only دارد.
--    • model_predictions.model_run_id (مهاجرتِ ۰۵۵) از قبل ستون و FK دارد.
--    • ولی هیچ صداکننده‌ای آن را پُر نمی‌کرد — grep در کلِ src/ فقط دو
--      ارجاع داد، هردو داخلِ خودِ prediction-ledger.ts. یعنی ستون همیشه
--      NULL بود.
--
--  اثرِ عملیِ آن خلأ: دفتر می‌گفت «مدلِ یادگرفته گفت ۰٫۷» ولی نمی‌گفت *کدام*
--  مدل. با هر بازآموزیِ شبانه وزن‌ها عوض می‌شوند، پس دقتِ تولید روی مخلوطی از
--  چند نسخه محاسبه می‌شد و قابلِ نسبت‌دادن به هیچ نسخه‌ای نبود — نه می‌شد
--  گفت «نسخه‌ی امروز بهتر از دیروز است»، نه می‌شد رانش را تشخیص داد.
--
--  حلقه‌ی گمشده همین یک ستون است: کدام اجرایِ آموزش وزن‌هایِ *فعالِ فعلی* را
--  ساخته. با آن، مسیرِ داغِ رزرو می‌تواند شناسه‌ی همان اجرا را در دفتر ثبت کند.
--
--  ON DELETE SET NULL عمدی است: تاریخچه‌ی آموزش ممکن است روزی هرس شود، و
--  آن نباید ردیفِ مدلِ فعال را با خودش ببرد. از دست‌رفتنِ نسبت‌دادن بد است،
--  از دست‌رفتنِ خودِ مدل بدتر.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE restaurant_no_show_models
  ADD COLUMN IF NOT EXISTS active_run_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_no_show_models_active_run_id_fkey'
  ) THEN
    ALTER TABLE restaurant_no_show_models
      ADD CONSTRAINT restaurant_no_show_models_active_run_id_fkey
      FOREIGN KEY (active_run_id) REFERENCES model_training_runs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- برایِ «کدام رستوران‌ها روی این نسخه‌اند» در داشبوردِ حاکمیت.
CREATE INDEX IF NOT EXISTS restaurant_no_show_models_active_run_id_idx
  ON restaurant_no_show_models (active_run_id);

-- ردیف‌هایِ موجود عمداً NULL می‌مانند: نمی‌دانیم وزن‌هایِ فعلی‌شان از کدام
-- اجرا آمده و حدس‌زدنش یعنی ساختنِ نسب‌نامه‌ی جعلی. اولین بازآموزیِ شبانه
-- مقدارِ درست را می‌گذارد.
