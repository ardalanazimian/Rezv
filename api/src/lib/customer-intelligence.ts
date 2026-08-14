// ═══════════════════════════════════════════════════════════════════════
//  امتیازِ هوشِ مشتری (Customer Intelligence Score) — نقشه‌راهِ AI، فازِ ۲
//
//  این یک مدلِ یادگرفته‌ی جدید نیست — ترکیبِ وزن‌دارِ چهار سیگنالِ از‌قبل
//  محاسبه‌شده و قابلِ‌اعتماد که همین الان در customer_insights/rfm.ts
//  هستند: ارزشِ خرج (mScore، صدکیِ RFM)، وفاداری/فرکانس (fScore)، ریسکِ
//  ریزش (churnRiskScore) و قابلیتِ‌اعتمادِ حضور (noShowRatePct). خروجی یک
//  عددِ ۰..۱۰۰ + یک ردیفِ ساده (low/medium/high) است — کاملاً شفاف و
//  قابلِ‌محاسبه‌ی دستی، نه black-box.
//
//  چرا این‌جا: طبقِ همون قرارداد در docs/ML_CONTRACT.md — قابل‌توضیح‌بودن
//  اولویتِ اول است. این فایل تنها منبعِ فرمول است؛ نسخه‌ی SQLِ آن (در
//  lib/rfm.ts، برای کارآییِ محاسبه‌ی هم‌زمانِ کلِ کوهورت در یک کوئری) باید
//  دقیقاً همین وزن‌ها و آستانه‌ها را منعکس کند — اگر این فایل عوض شد،
//  rfm.ts هم باید عوض شود (تستِ واحدِ این فایل قفلِ فرمول است).
// ═══════════════════════════════════════════════════════════════════════

export interface IntelligenceSignals {
  /** صدکِ RFM برایِ مبلغِ خرج، ۱..۵ (بیشتر=بهتر) — null یعنی هنوز RFM محاسبه نشده. */
  mScore: number | null;
  /** صدکِ RFM برایِ فرکانسِ بازدید، ۱..۵ (بیشتر=بهتر). */
  fScore: number | null;
  /** ریسکِ ریزش، ۰..۱۰۰ (بیشتر=بدتر). */
  churnRiskScore: number;
  /** نرخِ عدم‌حضور، ۰..۱۰۰ (بیشتر=بدتر). */
  noShowRatePct: number;
}

export type IntelligenceTier = 'low' | 'medium' | 'high';

export interface IntelligenceResult {
  score: number;
  tier: IntelligenceTier;
}

/** وزن‌ها جمعشان ۱ است — هرکدام تغییر کرد، بقیه باید هم‌زمان بازتنظیم شوند. */
const WEIGHT_VALUE = 0.35;   // mScore
const WEIGHT_LOYALTY = 0.25; // fScore
const WEIGHT_CHURN = 0.25;   // معکوسِ churnRiskScore
const WEIGHT_RELIABILITY = 0.15; // معکوسِ noShowRatePct

const TIER_HIGH_THRESHOLD = 70;
const TIER_MEDIUM_THRESHOLD = 40;

/**
 * وقتی RFM هنوز محاسبه نشده (مشتریِ خیلی تازه، قبل از اولین اجرایِ شبانه‌ی
 * rfm.ts)، mScore/fScore را با مقدارِ خنثی (۳ از ۵ — نه خوب نه بد) جایگزین
 * می‌کنیم، نه صفر — یک مشتریِ ناشناخته را نباید به‌اشتباه «کم‌ارزش» زد.
 */
const NEUTRAL_RFM_SCORE = 3;

export function computeIntelligenceScore(signals: IntelligenceSignals): IntelligenceResult {
  const m = signals.mScore ?? NEUTRAL_RFM_SCORE;
  const f = signals.fScore ?? NEUTRAL_RFM_SCORE;
  const churn = Math.max(0, Math.min(100, signals.churnRiskScore));
  const noShow = Math.max(0, Math.min(100, signals.noShowRatePct));

  const raw =
    WEIGHT_VALUE * (m * 20) +
    WEIGHT_LOYALTY * (f * 20) +
    WEIGHT_CHURN * (100 - churn) +
    WEIGHT_RELIABILITY * (100 - noShow);

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const tier: IntelligenceTier =
    score >= TIER_HIGH_THRESHOLD ? 'high' : score >= TIER_MEDIUM_THRESHOLD ? 'medium' : 'low';

  return { score, tier };
}
