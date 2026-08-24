import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';

/**
 * GET /api/v1/admin/business-intelligence — هوش تجاری سطح پلتفرم (پنل شرکت).
 * RFM، CLV، GMV، و سگمنت‌ها را در کل رستوران‌ها تجمیع می‌کند.
 * این به CEO دید کلان از سلامت کسب‌وکار کل پلتفرم می‌دهد (نه یک رستوران).
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);

    const [guestStats, rfmDist, segmentDist, topRestaurantsByClv] = await Promise.all([
      // آمار کلان مهمانان سراسری
      db.$queryRaw<{ total_guests: bigint; total_clv: bigint; total_vips: bigint }[]>`
        SELECT count(*) AS total_guests,
               COALESCE(sum(global_clv_toman),0) AS total_clv,
               count(*) FILTER (WHERE is_vip_anywhere) AS total_vips
        FROM guest_profiles
      `,
      // توزیع سگمنت RFM در کل پلتفرم
      db.$queryRaw<{ rfm_segment: string; count: bigint }[]>`
        SELECT rfm_segment, count(*) AS count FROM customer_insights
        WHERE rfm_segment IS NOT NULL GROUP BY rfm_segment ORDER BY count DESC
      `,
      // توزیع سگمنت رفتاری
      db.$queryRaw<{ segment: string; count: bigint }[]>`
        SELECT segment::text, count(*) AS count FROM customer_insights GROUP BY segment ORDER BY count DESC
      `,
      // رستوران‌های برتر بر اساس CLV مجموع مشتریانشان (ارزش واقعی برای پلتفرم)
      db.$queryRaw<{ restaurant_id: string; name: string; total_clv: bigint; customers: bigint }[]>`
        SELECT r.id AS restaurant_id, r.name,
               COALESCE(sum(ci.predicted_clv_toman),0) AS total_clv,
               count(ci.user_id) AS customers
        FROM restaurants r
        LEFT JOIN customer_insights ci ON ci.restaurant_id = r.id
        GROUP BY r.id, r.name
        ORDER BY total_clv DESC
        LIMIT 10
      `,
    ]);

    const g = guestStats[0] ?? { total_guests: 0n, total_clv: 0n, total_vips: 0n };

    return NextResponse.json({
      guests: {
        total: Number(g.total_guests),
        total_clv_toman: Number(g.total_clv),
        vips: Number(g.total_vips),
      },
      rfm_distribution: rfmDist.map(r => ({ segment: r.rfm_segment, count: Number(r.count) })),
      behavior_segments: segmentDist.map(s => ({ segment: s.segment, count: Number(s.count) })),
      top_restaurants_by_value: topRestaurantsByClv.map(r => ({
        id: r.restaurant_id, name: r.name,
        total_clv_toman: Number(r.total_clv), customers: Number(r.customers),
      })),
    });
  } catch (e) { return errorResponse(e); }
}
