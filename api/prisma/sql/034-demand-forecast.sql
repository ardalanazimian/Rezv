-- ═══════════════════════════════════════════════════════════════════════
--  ۰۳۴ — پیش‌بینیِ تقاضا (شبیه‌سازیِ روزهای آینده) — per-restaurant
--
--  lib/demand-forecast.ts شبانه با cronِ موجودِ customer-insights یک مدلِ
--  Holt-Winters (سطح+روند+فصلیِ هفتگی) روی تاریخچه‌ی رزروهای خودِ هر
--  رستوران می‌سازد — برای «تعدادِ رزرو در روز» و «مجموعِ کاورها در روز»
--  جداگانه. مثلِ restaurant_no_show_models، فقط اگر روی هولدآوتِ زمانی
--  واقعاً از baseline (پیش‌بینیِ فصلیِ ساده) بهتر باشد فعال می‌شود؛ وگرنه
--  fallback شفاف به همان baseline (نه سکوت، نه ادعای کاذب).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS restaurant_demand_forecasts (
  restaurant_id  uuid PRIMARY KEY REFERENCES restaurants(id),
  history_days   integer NOT NULL,
  count_model    jsonb NOT NULL,
  covers_model   jsonb NOT NULL,
  trained_at     timestamptz NOT NULL DEFAULT now()
);
