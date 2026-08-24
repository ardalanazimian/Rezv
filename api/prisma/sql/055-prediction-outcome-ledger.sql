-- ═══════════════════════════════════════════════════════════════════════
--  ۰۵۵ — دفترِ پیش‌بینی و دفترِ نتیجه (فازِ ۵ دستورِ Intelligence Engine)
--
--  مسئله‌ای که حل می‌کند: تا امروز مدل‌ها آموزش می‌دیدند و معیارِ *هولدآوت*
--  در model_training_runs ثبت می‌شد، ولی هیچ‌جا ثبت نمی‌شد که در تولید چه
--  پیش‌بینی‌ای برای چه چیزی شد و بعد واقعاً چه اتفاقی افتاد. یعنی حلقه‌ی
--  یادگیری (بندِ ۱۸) بسته نبود: می‌دانستیم مدل روی دادهٔ گذشته چقدر خوب بود،
--  ولی نمی‌دانستیم در عمل چقدر خوب است.
--
--  دو جدولِ جدا، عمداً — نه یک جدول با ستون‌های nullable:
--   • model_predictions فقط-افزودنی و تغییرناپذیر است (بندِ ۱۴: «هرگز
--     پیش‌بینیِ تاریخی را بازنویسی نکن»). یک پیش‌بینی سندی است از آنچه در آن
--     لحظه با آن مدل و آن ویژگی‌ها گفته شد.
--   • model_outcomes مشاهده است، نه پیش‌بینی. جداکردنشان یعنی ثبتِ نتیجه
--     هرگز رکوردِ پیش‌بینی را دست نمی‌زند، و یک پیش‌بینی می‌تواند بیش از یک
--     مشاهده داشته باشد (افق‌های مختلف).
--
--  نسخه‌ی مدل: model_run_id به model_training_runs(id) اشاره می‌کند — همان
--  رکوردِ فقط-افزودنیِ موجود. مدلِ heuristic اجرا اصلاً ندارد، پس آنجا NULL
--  است و model_source = 'heuristic' تفاوت را نگه می‌دارد. عمداً جدولِ
--  «رجیستریِ مدل»ِ تازه ساخته نشد (بندِ ۴۳: توسعه به‌جای تکرار).
--
--  ⚠️ ON DELETE CASCADE روی restaurant_id: با حذفِ رستوران، دفترش هم می‌رود.
--     پیش‌بینی بدونِ رستوران معنا ندارد و نگه‌داشتنش فقط دادهٔ یتیم می‌سازد.
--  ⚠️ entity_id عمداً TEXT است نه UUID: امروز شناسه‌ی رزرو است، ولی
--     پیش‌بینیِ تقاضا موجودیتش «رستوران×روز» است که UUID نیست.
--
--  idempotent: همه‌ی دستورها IF NOT EXISTS دارند.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS model_predictions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  tenant_id        UUID,                     -- زمینه‌ی تنانت برای ایزولاسیون/گزارش
  prediction_type  TEXT NOT NULL,            -- 'no_show' | 'demand' (بدونِ enum تا نوعِ جدید migration نخواهد)
  entity_type      TEXT NOT NULL,            -- 'reservation' | 'restaurant_day'
  entity_id        TEXT NOT NULL,
  model_source     TEXT NOT NULL,            -- 'learned' | 'heuristic'
  model_run_id     UUID REFERENCES model_training_runs(id) ON DELETE SET NULL,
  feature_version  TEXT NOT NULL,            -- نسخه‌ی قراردادِ بردارِ ویژگی
  predicted_value  DOUBLE PRECISION NOT NULL,-- احتمال (۰..۱) یا مقدارِ عددی
  confidence       TEXT NOT NULL,            -- high | medium | low | insufficient_data
  features         JSONB,                    -- ردِ ورودی (lineage) — همان چیزی که مدل دید
  generated_at     TIMESTAMP NOT NULL DEFAULT now(),
  horizon_at       TIMESTAMP                 -- کِی نتیجه معلوم می‌شود (برای no-show: slot_start)
);

-- «نتیجه‌ی هر پیش‌بینی چه شد» — کوئریِ اصلیِ ارزیابی.
CREATE INDEX IF NOT EXISTS model_predictions_lookup_idx
  ON model_predictions (restaurant_id, prediction_type, generated_at DESC);
-- یافتنِ پیش‌بینیِ یک موجودیت هنگامِ ثبتِ نتیجه.
CREATE INDEX IF NOT EXISTS model_predictions_entity_idx
  ON model_predictions (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS model_outcomes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id  UUID NOT NULL REFERENCES model_predictions(id) ON DELETE CASCADE,
  observed_value DOUBLE PRECISION NOT NULL,  -- ۰/۱ برای طبقه‌بندی، عدد برای رگرسیون
  squared_error  DOUBLE PRECISION NOT NULL,  -- (predicted − observed)² — جزءِ Brier
  absolute_error DOUBLE PRECISION NOT NULL,  -- |predicted − observed| — جزءِ MAE
  source         TEXT NOT NULL,              -- نتیجه از کجا آمد (مثلاً 'reservation_status')
  observed_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- یک پیش‌بینی نباید دوبار برای همان منبع نتیجه بگیرد (ثبتِ تکراری = آمارِ غلط).
CREATE UNIQUE INDEX IF NOT EXISTS model_outcomes_prediction_source_key
  ON model_outcomes (prediction_id, source);
