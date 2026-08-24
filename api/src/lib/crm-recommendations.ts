// ═══════════════════════════════════════════════════════════════════════
//  موتورِ توصیه‌یِ CRM — نقشه‌راهِ AI، فازِ ۲
//
//  یه لایه‌ی تصمیمِ محض (بدونِ I/O)، دقیقاً هم‌الگو با
//  incentive-engine.ts/rankIncentives: سیگنال‌هایی که قبلاً در
//  CustomerInsight محاسبه شده‌ن (churnRiskScore، segment، intelligenceScore
//  از customer-intelligence.ts، noShowRatePct) رو می‌خونه و به یه لیستِ
//  رتبه‌بندی‌شده از «با کی، چرا، از چه کانالی تماس بگیر» تبدیل می‌کنه —
//  نه یه چت‌بات، نه یه مدلِ یادگرفته‌ی جدید؛ قانون‌محور و کاملاً شفاف
//  (هر توصیه دلیلِ عددی‌اش رو نشون می‌ده).
//
//  کانال فقط دو حالت دارد چون فقط همین دوتا واقعاً در رزرونو وصل‌اند:
//  'sms' (کمپینِ پیامکی، lib/sms.ts) و 'call' (تماسِ دستیِ کارکنان، دکمه‌ی
//  callCustomer در پنلِ بیزنس). هیچ کانالِ فرضی (push/email) پیشنهاد
//  نمی‌شود چون سمتِ رستوران چنین چیزی به مشتری وصل نیست.
// ═══════════════════════════════════════════════════════════════════════

export type ContactChannel = 'call' | 'sms';
export type ContactUrgency = 'high' | 'medium' | 'low';

export interface CrmCustomerSignal {
  userId: string;
  name: string;
  phone: string | null;
  isVip: boolean;
  segment: string;
  churnRiskScore: number;      // 0..100
  noShowRatePct: number;       // 0..100
  totalVisits: number;
  // NULL = مبلغ اندازه‌گیری‌ناپذیر است (رستوران منویِ قیمت‌دار ندارد)، نه «صفر».
  // مقایسه‌هایِ عددی رویِ null در JS false می‌دهند، پس توصیه‌ای که به آستانه‌ی
  // مبلغی وابسته است روی دادهٔ نامعلوم فعال نمی‌شود — همان رفتارِ درست.
  predictedClvToman: number | null;
  intelligenceTier: 'low' | 'medium' | 'high' | null;
  daysSinceLastVisit: number | null;
}

export interface CrmRecommendation {
  user_id: string;
  name: string;
  phone: string | null;
  reason: string;
  channel: ContactChannel;
  urgency: ContactUrgency;
  /** فقط برایِ مرتب‌سازیِ داخلی — به کلاینت نشت نمی‌کند. */
  priority: number;
}

const URGENCY_PRIORITY: Record<ContactUrgency, number> = { high: 100, medium: 50, low: 10 };

/**
 * برایِ یک مشتری، بهترین توصیه‌ی تماس را برمی‌گرداند (یا null اگر اقدامی
 * لازم نیست) — قوانین به‌ترتیبِ اولویت:
 *
 *  ۱) VIP + churnRiskScore>=40: تماسِ شخصی، فوری — ارزشمندترین سگمنت.
 *  ۲) از‌دست‌رفته (segment=churned) با ارزشِ سابقاً بالا (intelligenceTier
 *     high یا predictedClv بالا): پیامکِ بازگشت، متوسط.
 *  ۳) در‌خطرِ‌ریزش (segment=at_risk یا churnRiskScore در بازه‌ی [40,75)):
 *     پیامکِ یادآوری، متوسط.
 *  ۴) الگویِ عدم‌حضورِ تکرارشونده (noShowRatePct>=40 با حداقل ۳ بازدید —
 *     یعنی نه یک اتفاقِ تصادفی): تماسِ تأییدِ دستی، متوسط.
 *  ۵) تازه‌وارد با فقط یک بازدید، هنوز پیگیری نشده: پیامِ خوش‌آمد، کم.
 */
export function recommendContact(c: CrmCustomerSignal): CrmRecommendation | null {
  if (c.isVip && c.churnRiskScore >= 40) {
    return {
      user_id: c.userId, name: c.name, phone: c.phone,
      reason: `مشتریِ VIP با ریسکِ ریزشِ ${c.churnRiskScore}٪ — یه تماسِ شخصی از طرفِ مدیر معمولاً اثرش از کمپینِ عمومی بیشتره.`,
      channel: 'call', urgency: 'high', priority: URGENCY_PRIORITY.high + c.churnRiskScore,
    };
  }

  // CLVِ نامعلوم (null) نباید آستانه را فعال کند: «نمی‌دانیم چقدر ارزش داشت»
  // دلیلِ ادعایِ «قبلاً مشتریِ باارزشی بود» نیست. صریح نوشته شده تا آینده
  // به‌اشتباه با `?? 0` پر نشود (که همان جعلِ صفر را برمی‌گرداند).
  const clvAboveThreshold = c.predictedClvToman !== null && c.predictedClvToman >= 500_000;
  if (c.segment === 'churned' && (c.intelligenceTier === 'high' || clvAboveThreshold)) {
    return {
      user_id: c.userId, name: c.name, phone: c.phone,
      reason: 'قبلاً مشتریِ باارزشی بود، الان از دست رفته — یه کدِ تخفیفِ بازگشتی می‌تونه برش گردونه.',
      channel: 'sms', urgency: 'medium', priority: URGENCY_PRIORITY.medium + 20,
    };
  }

  if (c.segment === 'at_risk' || (c.churnRiskScore >= 40 && c.churnRiskScore < 75)) {
    return {
      user_id: c.userId, name: c.name, phone: c.phone,
      reason: `${c.daysSinceLastVisit != null ? `${c.daysSinceLastVisit} روزه` : 'مدتیه'} نیومده — یه یادآوریِ پیامکی می‌تونه قبل از ریزشِ کامل برش گردونه.`,
      channel: 'sms', urgency: 'medium', priority: URGENCY_PRIORITY.medium + c.churnRiskScore / 10,
    };
  }

  if (c.noShowRatePct >= 40 && c.totalVisits >= 3) {
    return {
      user_id: c.userId, name: c.name, phone: c.phone,
      reason: `نرخِ عدم‌حضورِ ${c.noShowRatePct}٪ روی ${c.totalVisits} رزروِ گذشته — الگوئه، نه اتفاق؛ تماسِ تأییدِ دستی قبل از رزروهایِ بعدی نرخِ no-show رو کم می‌کنه.`,
      channel: 'call', urgency: 'medium', priority: URGENCY_PRIORITY.medium + c.noShowRatePct / 10,
    };
  }

  if (c.totalVisits === 1 && c.daysSinceLastVisit != null && c.daysSinceLastVisit <= 30) {
    return {
      user_id: c.userId, name: c.name, phone: c.phone,
      reason: 'اولین بازدیدش بوده و هنوز پیگیری نشده — یه پیامِ خوش‌آمد شانسِ تبدیل‌شدن به مشتریِ ثابت رو بالا می‌بره.',
      channel: 'sms', urgency: 'low', priority: URGENCY_PRIORITY.low,
    };
  }

  return null;
}

/** برایِ یک لیست از مشتری‌ها، توصیه‌های واقعی (غیرِnull) را می‌سازد و بر
 *  اساسِ اولویت مرتب می‌کند — بالاترین اولویت اول. */
export function rankCrmRecommendations(customers: CrmCustomerSignal[]): CrmRecommendation[] {
  return customers
    .map(recommendContact)
    .filter((r): r is CrmRecommendation => r !== null)
    .sort((a, b) => b.priority - a.priority);
}
