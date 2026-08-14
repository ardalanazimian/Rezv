-- ═══════════════════════════════════════════════════════════════════════
--  ۰۴۳ — امتیازِ هوشِ مشتری (نقشه‌راهِ AI، فازِ ۲)
--
--  شماره‌گذاری: ۰۴۳ عمداً است — ۰۴۱ (waitlist-guest-token) و ۰۴۲
--  (model-training-runs) هر دو روی برنچ‌هایِ دیگری (PR #13 و PR #14، هنوز
--  مرج‌نشده) claim شده‌اند. این برنچ مستقیماً از origin/main گرفته شده که
--  فقط تا ۰۴۰ دارد.
--
--  intelligence_score یک مدلِ یادگرفته‌ی جدید نیست — ترکیبِ وزن‌دارِ چهار
--  سیگنالِ از‌قبل‌محاسبه‌شده‌ی همین جدول (predictedClvToman → mScore،
--  totalVisits → fScore، churnRiskScore، noShowRatePct) است. جزئیاتِ کامل
--  در lib/customer-intelligence.ts. هر دو ستون nullable هستند — مشتریِ
--  بدونِ RFM هنوز محاسبه نشده (rfm.ts شبانه اجرا می‌شود، جدا از این).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE customer_insights
  ADD COLUMN IF NOT EXISTS intelligence_score integer,
  ADD COLUMN IF NOT EXISTS intelligence_tier text;

CREATE INDEX IF NOT EXISTS customer_insights_restaurant_intelligence_idx
  ON customer_insights (restaurant_id, intelligence_score DESC);
