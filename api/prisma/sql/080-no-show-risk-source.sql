-- ═══════════════════════════════════════════════════════════════════════
-- ۰۸۰ — نسب‌نامه‌ی امتیازِ ریسکِ no-show روی خودِ ردیفِ رزرو
--
-- مشکلی که می‌بندد (یافته‌ی ۳ی ممیزیِ لایه‌ی هوش، ۲۰۲۶-۰۹-۰۴):
-- `reservations` امتیاز و ردهٔ ریسک را نگه می‌دارد (`no_show_risk_score`,
-- `no_show_risk_tier`) ولی **منبع** را نه. پیش‌بینی‌کننده منبع را می‌داند
-- (`NoShowResult.source: 'learned' | 'heuristic'` در lib/customer-insights.ts:36)
-- و آن را در دفترِ پیش‌بینی هم می‌نویسد (`model_predictions.model_source`،
-- lib/reservations.ts:448) — ولی موقعِ ساختِ ردیفِ رزرو دور ریخته می‌شد
-- (lib/reservations.ts:521-522 فقط score و tier را کپی می‌کرد).
--
-- چرا این یک مسئله‌ی صداقت است و نه فقط یک ستونِ گم‌شده: هر دو مصرف‌کننده‌ی
-- این رده (`/api/v1/restaurant/ai` و پاسخِ دستیار) آن را به‌عنوانِ دانش
-- نمایش می‌دهند، زیرِ سطحی که «هوشمند» برچسب خورده — بدونِ اینکه بشود گفت
-- عددْ از یک مدلِ آموزش‌دیده آمده یا از یک قاعده‌ی دستی. پیوستن به دفترِ
-- پیش‌بینی ممکن بود ولی هیچ مصرف‌کننده‌ای این کار را نمی‌کرد، و یک نسب‌نامه‌ای
-- که کسی دنبالش نمی‌رود عملاً وجود ندارد.
--
-- چرا NULL مجاز است: ردیف‌های تاریخیِ پیش از این مهاجرت منبعشان **واقعاً
-- نامعلوم** است. پُرکردنشان با 'heuristic' یک حدس را به داده تبدیل می‌کرد.
-- NULL یعنی «نمی‌دانیم» و مصرف‌کننده‌ها باید همان‌طور با آن رفتار کنند —
-- «نمی‌دانیم» هرگز نباید «مدل گفته» گزارش شود.
--
-- idempotent است (IF NOT EXISTS + CHECK با گاردِ duplicate_object).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS no_show_risk_source TEXT;

-- مقادیرِ مجاز دقیقاً همان اتحادِ TypeScript اند. NULL = نامعلوم (ردیفِ تاریخی).
DO $$ BEGIN
  ALTER TABLE reservations
    ADD CONSTRAINT reservations_no_show_risk_source_check
    CHECK (no_show_risk_source IS NULL OR no_show_risk_source IN ('learned', 'heuristic'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- مصرفِ واقعی: «چند رزروِ پرریسکِ آینده، و از کدام منبع» — هر دو مصرف‌کننده
-- روی (restaurant_id, tier, slot_start) فیلتر می‌کنند و حالا source هم لازم
-- دارند. ⚠️ این ایندکس باید در schema.prisma هم اعلام شود وگرنه
-- `prisma db push` روی DBی که این مهاجرت را خورده DROPش می‌کند
-- (گاردِ schema-drift.integration.test.mts دقیقاً همین را می‌گیرد).
CREATE INDEX IF NOT EXISTS reservations_risk_source_idx
  ON reservations (restaurant_id, no_show_risk_tier, no_show_risk_source);
