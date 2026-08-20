import { db } from './db';
import { createLogger } from './logger';

const log = createLogger('rfm');

// ═══════════════════════════════════════════════════════════════════════
//  RFM Scoring — Recency, Frequency, Monetary
//
//  چرا کوهورتی: RFM ذاتاً نسبی است — امتیاز یک مشتری به توزیع کل مشتریان
//  آن رستوران بستگی دارد. پس باید کل کوهورت با هم با ntile(5) امتیازدهی
//  شوند (نه per-customer). تست‌شده روی PostgreSQL واقعی: ntile صدک‌ها را
//  به ۵ سطح درست تقسیم می‌کند.
//
//  امتیازها:
//   • R (Recency): اخیرترین بازدید = ۵ (بهترین)
//   • F (Frequency): بیشترین بازدید = ۵
//   • M (Monetary): بیشترین خرج = ۵
//
//  سگمنت‌ها از ترکیب R/F/M (الگوی استاندارد CRM).
// ═══════════════════════════════════════════════════════════════════════

/**
 * RFM را برای کل مشتریان یک رستوران محاسبه و ذخیره می‌کند.
 * با ntile(5) امتیاز نسبی می‌دهد و سگمنت RFM را تعیین می‌کند.
 * نیازمند داده‌ی موجود در customer_insights (lastVisitAt, totalVisits, totalSpendToman).
 */
export async function recomputeRfmForRestaurant(restaurantId: string): Promise<{ scored: number }> {
  // یک کوئری: امتیازدهی صدکی + تعیین سگمنت + امتیازِ هوشِ مشتری (فازِ ۲ AI،
  // lib/customer-intelligence.ts — همین فرمول، فقط به SQL برای کارآیی)
  // + به‌روزرسانی، همه با هم. فقط مشتریانی که حداقل یک بازدید دارند
  // (lastVisitAt غیر null) امتیاز می‌گیرند.
  //
  // ⚠️ وزن‌های زیر (۰.۳۵/۰.۲۵/۰.۲۵/۰.۱۵) باید دقیقاً با
  // computeIntelligenceScore در customer-intelligence.ts یکی بمانند —
  // اگر آن‌جا عوض شد، این‌جا هم باید عوض شود (تستِ واحدِ آن فایل قفلِ
  // فرمول است، این‌جا فقط بازپیاده‌سازیِ SQLِ همان فرمول برایِ کوهورت است).
  const result = await db.$executeRaw`
    WITH scored AS (
      SELECT user_id,
        ntile(5) OVER (ORDER BY last_visit_at ASC NULLS FIRST)   AS r,
        ntile(5) OVER (ORDER BY total_visits ASC)                AS f,
        -- ⚠️ صفرِ تأییدشده در برابرِ نامعلوم (ممیزیِ ۲۰۲۶-۰۸-۱۹):
        -- total_spend_toman حالا می‌تواند NULL باشد (رستوران منویِ قیمت‌دار
        -- ندارد، پس پیش‌سفارش و در نتیجه مبلغ اندازه‌گیری‌ناپذیر است).
        -- ntile رویِ ستونی که همه‌اش NULL (یا همه‌اش صفر) است چارکِ بی‌معنا
        -- تولید می‌کند و چون وزنش ۰٫۳۵ است — بزرگ‌ترین وزنِ فرمول — امتیاز را
        -- از نویز می‌ساخت. حالا فقط ردیف‌هایِ دارایِ مبلغِ واقعی چارک می‌گیرند.
        CASE WHEN total_spend_toman IS NULL THEN NULL
             ELSE ntile(5) OVER (PARTITION BY (total_spend_toman IS NULL)
                                 ORDER BY total_spend_toman ASC) END AS m,
        churn_risk_score, no_show_rate_pct
      FROM customer_insights
      WHERE restaurant_id = ${restaurantId}::uuid
        AND last_visit_at IS NOT NULL
    ),
    combined AS (
      SELECT user_id, r, f, m,
        -- بدونِ چارکِ مبلغی، ۳۵٪ از ورودیِ فرمول غایب است. به‌جایِ جایگزینیِ
        -- صفر (که امتیاز را مصنوعاً پایین می‌آورد) امتیاز «محاسبه‌نشده»
        -- می‌ماند — همان کنوانسیونی که این ستون از قبل با NULL داشت.
        CASE WHEN m IS NULL THEN NULL ELSE
          LEAST(100, GREATEST(0, ROUND(
            0.35 * (m * 20) + 0.25 * (f * 20) +
            0.25 * (100 - churn_risk_score) + 0.15 * (100 - no_show_rate_pct)
          )))::int END AS intelligence_score
      FROM scored
    )
    UPDATE customer_insights ci
    SET r_score = c.r,
        f_score = c.f,
        m_score = c.m,
        -- وقتی m نامعلوم است، دو شاخه‌ی وابسته به مبلغ (champions/cant_lose)
        -- به‌درستی رد می‌شوند (مقایسه با NULL نتیجه‌اش NULL است) و سگمنت فقط
        -- از r و f — که دادهٔ مشاهده‌شده‌ی واقعی‌اند — ساخته می‌شود. یعنی
        -- «قهرمان» بودن هرگز بدونِ شواهدِ مبلغی ادعا نمی‌شود؛ کاربر در بدترین
        -- حالت 'loyal' می‌گیرد که با همان r/f قابلِ دفاع است.
        rfm_segment = CASE
          WHEN c.r >= 4 AND c.f >= 4 AND c.m >= 4 THEN 'champions'
          WHEN c.r >= 4 AND c.f >= 2              THEN 'loyal'
          WHEN c.r >= 4 AND c.f <= 2              THEN 'new_promising'
          WHEN c.r = 3                            THEN 'needs_attention'
          WHEN c.r <= 2 AND c.f >= 3              THEN 'at_risk'
          WHEN c.r <= 2 AND c.f <= 2 AND c.m >= 4 THEN 'cant_lose'
          ELSE 'hibernating'
        END,
        intelligence_score = c.intelligence_score,
        -- NULL باید NULL بماند: بدونِ این شاخه، امتیازِ محاسبه‌نشده به ELSE
        -- می‌افتاد و ردهٔ 'low' می‌گرفت — یعنی «کم‌ارزش» به مشتری‌ای نسبت داده
        -- می‌شد که اصلاً ارزیابی نشده بود.
        intelligence_tier = CASE
          WHEN c.intelligence_score IS NULL THEN NULL
          WHEN c.intelligence_score >= 70 THEN 'high'
          WHEN c.intelligence_score >= 40 THEN 'medium'
          ELSE 'low'
        END
    FROM combined c
    WHERE ci.user_id = c.user_id AND ci.restaurant_id = ${restaurantId}::uuid
  `;
  log.info('RFM محاسبه شد', { restaurantId, scored: result });
  return { scored: result };
}

/** توزیع سگمنت‌های RFM یک رستوران (برای داشبورد). */
export async function getRfmDistribution(restaurantId: string): Promise<{ segment: string; count: number }[]> {
  const rows = await db.$queryRaw<{ rfm_segment: string | null; count: bigint }[]>`
    SELECT rfm_segment, count(*) AS count
    FROM customer_insights
    WHERE restaurant_id = ${restaurantId}::uuid AND rfm_segment IS NOT NULL
    GROUP BY rfm_segment
    ORDER BY count DESC
  `;
  return rows.map((r) => ({ segment: r.rfm_segment ?? 'unknown', count: Number(r.count) }));
}
