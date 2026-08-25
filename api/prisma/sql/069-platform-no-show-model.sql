-- ═══════════════════════════════════════════════════════════════════════
--  069 — مدلِ no-showِ سراسریِ پلتفرم (رفعِ سرمای شروع)
--
--  ⚠️ مسئله‌ای که حل می‌کند — بزرگ‌ترین مانعِ عملیِ ML این محصول:
--  گیتِ فعال‌سازی به‌ازای **هر رستوران** ۴۰ نمونه و ۵ no-show می‌خواهد
--  (MIN_SAMPLE_SIZE / MIN_POSITIVE_COUNT در lib/no-show-model.ts). برای
--  پلتفرمی که تازه لانچ می‌کند یعنی **تقریباً هیچ رستورانی هرگز مدل
--  نمی‌گیرد** و همه تا ماه‌ها روی heuristicِ ثابت می‌مانند — هرچقدر هم که
--  کلِ پلتفرم داده جمع کند.
--
--  با مدلِ سراسری، رستورانِ شماره‌ی ۵۰۰ از روزِ اول از تجربه‌ی ۴۹۹ رستورانِ
--  قبلی بهره می‌برد، و به‌محضِ اینکه دادهٔ خودش کافی شد، مدلِ اختصاصی‌اش
--  جایگزین می‌شود.
--
--  چرا جدولِ جدا و نه nullable کردنِ restaurant_id در جدولِ موجود:
--  `restaurant_no_show_models.restaurant_id` هم **کلیدِ اصلی** است و هم FK.
--  nullable کردنش PK را می‌شکند و null-handling را به هر کوئریِ موجود
--  تحمیل می‌کند. یک جدولِ تک‌ردیفیِ جدا هیچ‌کدام از این ریسک‌ها را ندارد.
--
--  ⚠️ ویژگی‌ها عمداً همان NO_SHOW_FEATURE_NAMES می‌مانند — هیچ ویژگیِ
--  «هویتِ رستوران» اضافه نمی‌شود. مدل باید **رفتار** را یاد بگیرد
--  (last-minute، اندازه‌ی گروه، سابقه)، نه اینکه کدام رستوران است؛ وگرنه
--  همان بایاسِ کانالی است که checkChannelBias جلویش را می‌گیرد.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "platform_no_show_models" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "weights"           DOUBLE PRECISION[] NOT NULL,
  "sample_size"       INTEGER NOT NULL,
  "positive_count"    INTEGER NOT NULL,
  -- چند رستوران در این آموزش سهیم بودند. عددِ پایین یعنی «سراسری» ادعای
  -- بزرگی است برای دادهٔ کمِ چند رستوران — در داشبورد دیده می‌شود.
  "restaurant_count"  INTEGER NOT NULL,
  "learned_brier"     DOUBLE PRECISION NOT NULL,
  "static_brier"      DOUBLE PRECISION NOT NULL,
  "learned_auc"       DOUBLE PRECISION,
  "is_active"         BOOLEAN NOT NULL DEFAULT FALSE,
  "activation_reason" TEXT,
  "trained_at"        TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- خواندنِ مسیرِ داغ همیشه «آخرین مدلِ فعال» است.
CREATE INDEX IF NOT EXISTS "platform_no_show_models_is_active_trained_at_idx"
  ON "platform_no_show_models" ("is_active", "trained_at" DESC);
