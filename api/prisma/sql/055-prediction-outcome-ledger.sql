-- ═══════════════════════════════════════════════════════════════════════
--  ۰۵۵ — دفترِ پیش‌بینی و دفترِ نتیجه (Prediction Ledger / Outcome Ledger)
--
--  چرا این دو جدول لازم شدند (یافته‌یِ ممیزیِ ۲۰۲۶-۰۸-۲۰، با ردیابیِ کد نه
--  از رویِ مستندات):
--
--  امروز *همه‌ی* اعدادِ کیفیتِ مدل در این ریپو مربوط به «لحظه‌ی آموزش» است:
--  restaurant_no_show_models.learned_brier / static_brier و
--  model_training_runs.metrics همگی روی هولدآوتِ همان شبِ آموزش حساب
--  می‌شوند. یعنی داشبوردِ سلامتِ مدل به این سؤال جواب می‌دهد: «دیشب موقعِ
--  آموزش، رویِ دادهٔ کنارگذاشته‌شده چقدر خوب بود؟» — و به این سؤال هیچ
--  جوابی ندارد: «در تولید، رویِ رزروهایِ واقعی، چقدر درست درآمد؟»
--
--  بدتر: امتیازِ ریسکی که سرِ ثبتِ رزرو حساب می‌شود در
--  reservations.no_show_risk_score ذخیره می‌شود ولی *منبعش* (مدلِ یادگرفته
--  یا heuristic) دور ریخته می‌شد — predictNoShowRisk فیلدِ source را
--  برمی‌گرداند ولی createReservation آن را به {score, tier} تنگ می‌کرد.
--  نتیجه: حتی با داشتنِ تاریخچه‌ی کاملِ رزروها هم نمی‌شد فهمید کدام امتیاز
--  را مدل داده و کدام را heuristic — پس مقایسه‌ی تولیدیِ این دو غیرممکن بود.
--
--  این دو جدول همان حلقه‌ی باز را می‌بندند:
--    پیش‌بینی (با نسخه‌ی مدل + بردارِ ویژگی) → نتیجه‌ی واقعی → سنجش.
--
--  اصولِ طراحی (هم‌راستا با economy_ledger_entries در ۰۳۸ و
--  model_training_runs در ۰۴۲):
--   • append-only — هیچ UPDATE/DELETEای در مسیرِ اپلیکیشن نمی‌خورد. یک
--     پیش‌بینیِ ثبت‌شده هرگز بازنویسی نمی‌شود؛ حتی وقتی مدلِ جدید همان رزرو
--     را دوباره امتیاز بدهد، ردیفِ تازه اضافه می‌شود نه جایگزین.
--   • هر ردیف نسخه‌ی مدل و بردارِ ویژگیِ ورودی را با خودش نگه می‌دارد
--     (lineage) — تا بعداً بشود گفت «این عدد را دقیقاً کدام مدل با چه
--     ورودی‌ای ساخت»، نه فقط «چه عددی بود».
--   • بدونِ PII: ستونِ features فقط ویژگی‌هایِ رفتاریِ عددی/بولیِ همان
--     بردارِ آموزش را نگه می‌دارد (سابقه، فاصله‌ی زمانی، اندازه‌ی گروه،
--     کانال) — نه نام، نه شماره‌ی تماس. عمدی: دادهٔ کمینه‌یِ لازم برایِ
--     بازتولیدِ پیش‌بینی، نه یک کپیِ دیگر از پروفایلِ مشتری.
-- ═══════════════════════════════════════════════════════════════════════

-- ── دفترِ پیش‌بینی ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_predictions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id),
  -- 'no_show' فعلاً تنها مقدار. text نه enum — تا افزودنِ نوعِ پیش‌بینیِ
  -- بعدی (demand/churn/recommendation) migration لازم نداشته باشد.
  prediction_type  text NOT NULL,
  -- موضوعِ پیش‌بینی: فعلاً همیشه 'reservation'. جدا از subject_id نگه
  -- داشته می‌شود تا وقتی موضوع «مشتری» یا «رستوران» شد، کلیدِ یکتا نشکند.
  subject_type     text NOT NULL,
  subject_id       uuid NOT NULL,
  -- 'learned' | 'heuristic' — همان چیزی که تا امروز دور ریخته می‌شد.
  model_source     text NOT NULL,
  -- شناسه‌ی تغییرناپذیرِ نسخه‌ی مدل. برایِ مدلِ یادگرفته: ISOیِ trained_at
  -- (هر آموزش یک نسخه‌ی جدید). برایِ heuristic: یک برچسبِ ثابتِ نسخه‌دار.
  model_version    text NOT NULL,
  -- نسخه‌ی *ساختارِ* بردارِ ویژگی. اگر ترتیب/معنایِ ویژگی‌ها عوض شد این
  -- عدد بالا می‌رود تا ردیف‌های قدیمی اشتباه تفسیر نشوند.
  feature_version  integer NOT NULL DEFAULT 1,
  features         jsonb NOT NULL,
  -- احتمالِ ۰..۱ (نه امتیازِ ۰..۱۰۰) — واحدِ مشترکِ همه‌ی مدل‌های احتمالاتی،
  -- تا Brier/کالیبراسیون بدونِ تبدیل قابلِ‌محاسبه باشد.
  probability      double precision NOT NULL,
  predicted_at     timestamptz NOT NULL DEFAULT now(),
  -- زمانی که نتیجه‌ی واقعی «قابلِ‌دانستن» می‌شود (برایِ no-show: شروعِ اسلات).
  -- برایِ جداکردنِ «هنوز معلوم نیست» از «معلوم شد ولی نتیجه ثبت نشده».
  horizon_at       timestamptz,
  CONSTRAINT model_predictions_probability_range CHECK (probability >= 0 AND probability <= 1)
);

-- یکتاییِ (نوع، موضوع، نسخه‌ی مدل): نوشتنِ دوباره‌ی همان پیش‌بینی توسطِ
-- همان نسخه‌ی مدل (retry) بی‌اثر می‌شود، ولی امتیازدهیِ دوباره با نسخه‌ی
-- *جدیدِ* مدل یک ردیفِ تازه می‌سازد — یعنی idempotency بدونِ قربانی‌کردنِ
-- قاعده‌ی «تاریخچه هرگز بازنویسی نمی‌شود».
CREATE UNIQUE INDEX IF NOT EXISTS model_predictions_subject_version_uidx
  ON model_predictions (prediction_type, subject_type, subject_id, model_version);

CREATE INDEX IF NOT EXISTS model_predictions_restaurant_type_idx
  ON model_predictions (restaurant_id, prediction_type, predicted_at DESC);

-- ── دفترِ نتیجه ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_outcomes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id),
  prediction_type  text NOT NULL,
  subject_type     text NOT NULL,
  subject_id       uuid NOT NULL,
  -- ۱ = رویداد رخ داد (no_show)، ۰ = رخ نداد (مهمان آمد). double precision
  -- نه boolean: نتیجه‌ی مدل‌های رگرسیونیِ بعدی (تقاضا) هم همین‌جا جا می‌شود.
  outcome_label    double precision NOT NULL,
  -- وضعیتِ پایانیِ واقعی که برچسب از آن ساخته شد — برایِ بازرسی‌پذیری،
  -- تا بعداً بشود فهمید ۱/۰ از کجا آمد.
  outcome_status   text NOT NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now()
);

-- هر موضوع دقیقاً یک نتیجه‌ی واقعی دارد (وضعیت‌های پایانیِ رزرو در
-- lib/lifecycle.ts خروجی ندارند)، پس یکتاییِ بدونِ نسخه‌ی مدل درست است:
-- نتیجه واقعیتِ بیرونی‌ست و به مدل ربطی ندارد. اولین ثبت برنده است
-- (ON CONFLICT DO NOTHING) — نتیجه هرگز بازنویسی نمی‌شود.
CREATE UNIQUE INDEX IF NOT EXISTS model_outcomes_subject_uidx
  ON model_outcomes (prediction_type, subject_type, subject_id);

CREATE INDEX IF NOT EXISTS model_outcomes_restaurant_type_idx
  ON model_outcomes (restaurant_id, prediction_type, occurred_at DESC);

-- ── RLS (هم‌راستا با ۰۳۷: فقط ENABLE، بدونِ policy = deny-by-default) ──
-- بک‌اند با نقشِ owner وصل می‌شود و RLS را دور می‌زند؛ این لایه‌ی
-- defense-in-depthِ سطحِ DB است، نه کنترلِ دسترسیِ اپلیکیشن.
ALTER TABLE model_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_outcomes    ENABLE ROW LEVEL SECURITY;
