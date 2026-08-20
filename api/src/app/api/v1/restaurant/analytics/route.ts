import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { sinceDays } from '@/lib/staff-helpers';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';

// ═══════════════════════════════════════════════════════════
//  GET /restaurant/analytics — آمار رفتار مشتری (مهاجرت‌شده به wrapper)
//  بهینه: cache 5 دقیقه + کوئری تجمیعی روی replica (dbRead).
//  wrapper حالا rate-limit/auth/metric/trace را خودکار اعمال می‌کند.
// ═══════════════════════════════════════════════════════════
export const GET = withRestaurantAuth(
  { permission: 'canViewAnalytics', rateLimit: 'search' },
  async (_req, ctx) => {
    const restaurant = ctx.restaurant;
    const data = await cached(cacheKey('analytics', restaurant.id), 300, async () => {
      const visitCounts = await db.reservation.groupBy({
        by: ['userId'],
        where: { restaurantId: restaurant.id, userId: { not: null }, status: { in: ['confirmed', 'arrived', 'seated', 'completed'] } },
        _count: { _all: true },
      });
      const totalCustomers = visitCounts.length;
      let returning = 0;
      const visitCountDist = { once: 0, few: 0, loyal: 0 };
      for (const v of visitCounts) {
        const n = v._count._all;
        if (n > 1) returning++;
        if (n === 1) visitCountDist.once++;
        else if (n <= 4) visitCountDist.few++;
        else visitCountDist.loyal++;
      }
      const returnRate = totalCustomers ? Math.round((returning / totalCustomers) * 100) : 0;

      const hourRows = await db.$queryRaw<{ hour: number; cnt: bigint }[]>`
        SELECT EXTRACT(HOUR FROM slot_start)::int AS hour, COUNT(*)::bigint AS cnt
        FROM reservations
        WHERE restaurant_id = ${restaurant.id}::uuid
          AND status IN ('confirmed','arrived','seated','completed')
        GROUP BY hour ORDER BY cnt DESC LIMIT 5
      `;
      const peakHours = hourRows.map(r => ({ hour: r.hour, count: Number(r.cnt) }));

      // ── نقشه‌ی حرارتیِ اشغال: روزِ هفته × ساعت (برای دیدنِ الگوهای شلوغی) ──
      // DOW در Postgres: 0=یکشنبه..6=شنبه. ساعت‌های سرویس معمولاً ۱۲..۲۴.
      const heatRows = await db.$queryRaw<{ dow: number; hour: number; cnt: bigint }[]>`
        SELECT EXTRACT(DOW FROM slot_start)::int AS dow,
               EXTRACT(HOUR FROM slot_start)::int AS hour,
               COUNT(*)::bigint AS cnt
        FROM reservations
        WHERE restaurant_id = ${restaurant.id}::uuid
          AND slot_start >= ${sinceDays(90)}
          AND status IN ('confirmed','arrived','seated','completed')
        GROUP BY dow, hour
      `;
      const heatmap = heatRows.map(r => ({ dow: r.dow, hour: r.hour, count: Number(r.cnt) }));

      const since28 = sinceDays(28);
      const weekRows = await db.$queryRaw<{ wk: number; cnt: bigint }[]>`
        SELECT FLOOR(EXTRACT(EPOCH FROM (now() - slot_start)) / (7*86400))::int AS wk, COUNT(*)::bigint AS cnt
        FROM reservations
        WHERE restaurant_id = ${restaurant.id}::uuid
          AND slot_start >= ${since28}
          AND status IN ('confirmed','arrived','seated','completed')
        GROUP BY wk
      `;
      const weekly = [0, 0, 0, 0];
      for (const r of weekRows) {
        const w = r.wk;
        if (w >= 0 && w < 4) weekly[3 - w] = Number(r.cnt);
      }
      return {
        total_customers: totalCustomers,
        new_customers: totalCustomers - returning,
        returning_customers: returning,
        return_rate_pct: returnRate,
        visit_distribution: visitCountDist,
        weekly_reservations: weekly,
        peak_hours: peakHours,
        heatmap,
      };
    });
    return NextResponse.json(data);
  },
);
