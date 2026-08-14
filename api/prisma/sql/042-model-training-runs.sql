-- ═══════════════════════════════════════════════════════════════════════
--  ۰۴۲ — تاریخچه‌ی append-only آموزشِ مدل‌ها (فازِ ۱ نقشه‌راهِ AI)
--
--  شماره‌گذاری: عمداً ۰۴۲ (نه ۰۴۱) — ۰۴۱-waitlist-guest-token.sql روی برنچِ
--  دیگری (claude/booking-integrity-hardening، هنوز مرج‌نشده) قبلاً claim شده؛
--  این برنچ مستقیماً از origin/main گرفته شده که فقط تا ۰۴۰ دارد.
--
--  restaurant_no_show_models و restaurant_demand_forecasts (۰۳۳/۰۳۴) تک‌ردیفی
--  هستند و هرشب overwrite می‌شوند — مسیرِ داغِ خواندنِ مدلِ فعال دقیقاً همان‌ها
--  را می‌خواند و بدونِ تغییر می‌ماند. این جدولِ جدید کنارِ آن‌ها، نه به‌جایِ
--  آن‌ها، هر بار که trainAndCalibrateNoShowModel یا trainAndCalibrateDemandForecast
--  اجرا می‌شود یک ردیفِ append-only اضافه می‌کند — چه مدل فعال شده باشد چه نه
--  (تا تاریخچه‌ی «امتحان‌شد ولی بهتر از heuristic نبود» هم دیده شود، برایِ
--  داشبوردِ سلامتِ مدل در پنلِ شرکت و برایِ تستِ بایاس). هیچ UPDATE/DELETE‌ای
--  رویِ این جدول نمی‌شود — دقیقاً همان الگویِ economy_ledger_entries (۰۳۸).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS model_training_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  -- 'no_show' | 'demand_forecast' — بدونِ enumِ Postgres تا افزودنِ نوعِ
  -- مدلِ جدید (مثلاً fraud/incentive در فازِ ۲) نیازِ به migration نداشته باشد.
  kind           text NOT NULL,
  sample_size    integer NOT NULL,
  -- no_show: {learnedBrier, staticBrier} — demand_forecast: {mae, baselineMae}
  metrics        jsonb NOT NULL,
  is_active      boolean NOT NULL,
  reason         text,
  trained_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_training_runs_restaurant_kind_idx
  ON model_training_runs (restaurant_id, kind, trained_at DESC);
