// ═══════════════════════════════════════════════════════════════════════
//  نسب‌نامه‌ی ردهٔ ریسکِ no-show — یک منبعِ حقیقت برای هر دو مصرف‌کننده
//
//  چرا این ماژول وجود دارد (یافته‌ی ۳ی ممیزیِ لایه‌ی هوش، ۲۰۲۶-۰۹-۰۴):
//  دو جا ردهٔ `high` را می‌شمردند و نتیجه را به کاربر نشان می‌دادند —
//  `/api/v1/restaurant/ai` و پاسخِ دستیار — هر دو زیرِ سطحی که «هوشمند»
//  خوانده می‌شود، و هیچ‌کدام نمی‌گفت عدد از یک مدلِ آموزش‌دیده آمده یا از یک
//  قاعده‌ی دستی. قراردادِ صداقت این را ممنوع می‌کند: چیزی AI برچسب نمی‌خورد
//  مگر مدلی تولیدش کرده باشد.
//
//  هر دو مصرف‌کننده حالا همین helper را صدا می‌زنند تا عبارتِ نمایشی یک‌جا
//  ساخته شود؛ دو کپیِ جدا از این منطق دیر یا زود از هم واگرا می‌شدند.
//
//  ⚠️ `unknown` (یعنی `no_show_risk_source IS NULL`) ردیف‌های پیش از مهاجرتِ
//  ۰۸۰ اند و منبعشان **واقعاً نامعلوم** است. هرگز به سطلِ `learned` اضافه
//  نمی‌شوند و هرگز «مدل گفته» گزارش نمی‌شوند — «نمی‌دانیم» ≠ «مدل».
// ═══════════════════════════════════════════════════════════════════════
// dbRead عمداً: هر دو مصرف‌کننده فقط می‌شمارند، و روتِ /restaurant/ai هم
// خودش روی replicaی خواندن است — بردنِ این شمارش روی کلاینتِ نوشتن یک
// رگرسیونِ بی‌سروصدا بود.
import { dbRead } from './db';

export type RiskProvenance = {
  total: number;
  learned: number;
  heuristic: number;
  /** ردیف‌های پیش از مهاجرتِ ۰۸۰ — منبع نامعلوم، نه heuristic. */
  unknown: number;
};

const UPCOMING_STATUSES = ['confirmed', 'auto_confirmed', 'pending'];

/** شمارشِ رزروهای پرریسکِ پیشِ‌رو، تفکیک‌شده بر اساسِ منبعِ امتیاز. */
export async function countUpcomingHighRiskByProvenance(
  restaurantId: string,
  withinHours = 48,
): Promise<RiskProvenance> {
  const now = new Date();
  const rows = await dbRead.reservation.groupBy({
    by: ['noShowRiskSource'],
    where: {
      restaurantId,
      status: { in: UPCOMING_STATUSES as never },
      slotStart: { gte: now, lte: new Date(now.getTime() + withinHours * 3600_000) },
      noShowRiskTier: 'high',
    },
    _count: { _all: true },
  });

  const out: RiskProvenance = { total: 0, learned: 0, heuristic: 0, unknown: 0 };
  for (const r of rows) {
    const n = r._count._all;
    out.total += n;
    if (r.noShowRiskSource === 'learned') out.learned += n;
    else if (r.noShowRiskSource === 'heuristic') out.heuristic += n;
    else out.unknown += n;
  }
  return out;
}

/**
 * عبارتِ فارسیِ صادقانه‌ی منبع، برای چسباندن به متنی که به کاربر نشان داده
 * می‌شود. هرگز ادعای «مدل» نمی‌کند مگر واقعاً ردیفِ learned وجود داشته باشد.
 */
export function provenanceLabel(p: RiskProvenance): string {
  if (p.total === 0) return '';
  if (p.learned === p.total) return 'منبع: مدلِ آموزش‌دیده‌ی این رستوران.';
  if (p.learned === 0) {
    // هیچ ردیفِ مدلی وجود ندارد: نباید هیچ بویی از «هوشِ مصنوعی» بدهد.
    // عمداً هیچ واژه‌ی مربوط به مدل در این دو متن نیست — حتی به شکلِ منفی.
    // یک جمله‌ی «از مدل نیامده» هم واژه‌ی مدل را کنارِ عدد می‌نشاند و هم
    // ادعای صداقت را غیرِقابلِسنجش می‌کند (تست نمی‌تواند اثبات از نفی را جدا کند).
    return p.unknown === p.total
      ? 'منبع: نامشخص — ردیف‌های پیش از ثبتِ نسب‌نامه.'
      : 'منبع: قاعده‌ی دستی بر پایه‌ی سابقه‌ی مهمان.';
  }
  const parts = [`${p.learned} مورد از مدلِ آموزش‌دیده`];
  if (p.heuristic > 0) parts.push(`${p.heuristic} مورد از قاعده‌ی دستی`);
  if (p.unknown > 0) parts.push(`${p.unknown} مورد با منبعِ نامشخص`);
  return `منبع: ${parts.join('، ')}.`;
}
