import { db } from './db';
import { createLogger } from './logger';

const log = createLogger('guest-profile');

// ═══════════════════════════════════════════════════════════════════════
//  GuestProfile سراسری — نمای cross-restaurant مشتری
//
//  شکاف ساختاری که حل می‌کند: CustomerInsight per-restaurant است، پس هیچ
//  نمای واحدی از یک مهمان در کل پلتفرم نبود. این لایه همه‌ی insightهای یک
//  کاربر را در رستوران‌های مختلف تجمیع می‌کند → CLV کل، رستوران ترجیحی،
//  VIP در هر جا. (الگوی SevenRooms: یک مهمان، یک پروفایل.)
//
//  تست‌شده روی PostgreSQL واقعی: sum/bool_or/array_agg درست کار می‌کنند.
// ═══════════════════════════════════════════════════════════════════════

/**
 * پروفایل سراسری همه‌ی مهمانان را از CustomerInsightها بازمی‌سازد (upsert).
 * با یک کوئری تجمیعی + ON CONFLICT. توسط cron روزانه (بعد از insights) صدا زده می‌شود.
 */
export async function rebuildGuestProfiles(): Promise<{ profiles: number }> {
  const result = await db.$executeRaw`
    INSERT INTO guest_profiles (
      user_id, global_visits, global_spend_toman, global_clv_toman,
      restaurants_visited, last_visit_anywhere, is_vip_anywhere,
      preferred_restaurant_id, updated_at
    )
    SELECT
      user_id,
      sum(total_visits),
      sum(total_spend_toman),
      sum(predicted_clv_toman),
      count(DISTINCT restaurant_id),
      max(last_visit_at),
      bool_or(is_vip),
      (array_agg(restaurant_id ORDER BY total_visits DESC))[1],  -- رستوران با بیشترین بازدید
      now()
    FROM customer_insights
    GROUP BY user_id
    ON CONFLICT (user_id) DO UPDATE SET
      global_visits = EXCLUDED.global_visits,
      global_spend_toman = EXCLUDED.global_spend_toman,
      global_clv_toman = EXCLUDED.global_clv_toman,
      restaurants_visited = EXCLUDED.restaurants_visited,
      last_visit_anywhere = EXCLUDED.last_visit_anywhere,
      is_vip_anywhere = EXCLUDED.is_vip_anywhere,
      preferred_restaurant_id = EXCLUDED.preferred_restaurant_id,
      updated_at = now()
  `;
  log.info('پروفایل‌های سراسری بازسازی شد', { profiles: result });
  return { profiles: result };
}

/** پروفایل سراسری یک مهمان (نمای ۳۶۰ درجه). */
export async function getGuestProfile(userId: string) {
  const profile = await db.guestProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  // رستوران‌های بازدیدشده برای نمای کامل
  const breakdown = await db.customerInsight.findMany({
    where: { userId },
    select: {
      restaurantId: true, totalVisits: true, totalSpendToman: true,
      lastVisitAt: true, isVip: true, rfmSegment: true,
    },
    orderBy: { totalVisits: 'desc' },
  });
  return { ...profile, restaurants: breakdown };
}

// ═══════════════════════════════════════════════════════════════════════
//  درصدِ واقعیِ «بهتر از چند درصدِ مردم» — apps/customer/js/features/food-dna.js
//  (DNA غذایی) قبلاً این عدد را از یک جدولِ ثابتِ حدسی می‌ساخت
//  (dnaPercentile: visits>=30→95، visits>=20→88، ...) — یعنی حتی برای
//  کاربرِ واقعی، «بهتر از ۹۵٪ مردم» ادعایی بدونِ هیچ مقایسه‌ی واقعی بود.
//  اینجا واقعاً در بینِ همه‌ی GuestProfileها رتبه‌بندی می‌شود.
// ═══════════════════════════════════════════════════════════════════════

/** حداقلِ جمعیتِ مقایسه برایِ معنادار بودنِ درصد — کمتر از این، عدد نویز است. */
const MIN_COHORT_FOR_PERCENTILE = 20;

/** محاسبه‌ی خالص از رویِ دو شمارشِ خام — بدونِ DB، مستقیماً تست‌پذیر. */
export function computePercentile(totalProfiles: number, profilesWithFewerVisits: number): number | null {
  if (totalProfiles < MIN_COHORT_FOR_PERCENTILE) return null;
  return Math.round((profilesWithFewerVisits / totalProfiles) * 100);
}

/**
 * درصدِ کاربرانی که بازدیدِ کمتری از این کاربر دارند. اگر جامعه‌ی مقایسه
 * خیلی کوچک باشد null برمی‌گرداند — فرانت در این حالت اصلاً این آماره را
 * نشان نمی‌دهد، به‌جایِ یک عددِ بی‌معنا (مثلاً «بهتر از ۱۰۰٪ مردم» وقتی فقط
 * ۳ کاربر در کل پلتفرم هست).
 */
export async function getVisitPercentile(userId: string): Promise<number | null> {
  const rows = await db.$queryRaw<{ total: bigint; below: bigint }[]>`
    SELECT
      (SELECT COUNT(*) FROM guest_profiles)::bigint AS total,
      (SELECT COUNT(*) FROM guest_profiles gp2
        WHERE gp2.global_visits < (SELECT global_visits FROM guest_profiles WHERE user_id = ${userId}::uuid)
      )::bigint AS below
  `;
  const row = rows[0];
  if (!row) return null;
  return computePercentile(Number(row.total), Number(row.below));
}
