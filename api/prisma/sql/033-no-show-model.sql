-- ═══════════════════════════════════════════════════════════════════════
--  ۰۳۳ — یادگیریِ per-restaurant برای ریسکِ no-show
--
--  computeStaticNoShowRisk تا امروز یک فرمولِ سراسری با ضرایبِ دستی بود —
--  هیچ‌وقت با نتیجه‌ی واقعی مقایسه نمی‌شد، هیچ‌وقت بهتر نمی‌شد. این جدول
--  نتیجه‌ی رگرسیونِ لجستیکِ per-restaurant را نگه می‌دارد که شبانه با
--  cronِ موجودِ customer-insights بازآموزی می‌شود (lib/no-show-model.ts).
--
--  is_active پیش‌فرضش false است و فقط با کدِ برنامه true می‌شود — تنها اگر
--  مدل روی دادهٔ نگه‌داشته‌شده واقعاً از heuristicِ فعلی بهتر باشد.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS restaurant_no_show_models (
  restaurant_id   uuid PRIMARY KEY REFERENCES restaurants(id),
  weights         double precision[] NOT NULL,
  sample_size     integer NOT NULL,
  positive_count  integer NOT NULL,
  learned_brier   double precision NOT NULL,
  static_brier    double precision NOT NULL,
  is_active       boolean NOT NULL DEFAULT false,
  trained_at      timestamptz NOT NULL DEFAULT now()
);
