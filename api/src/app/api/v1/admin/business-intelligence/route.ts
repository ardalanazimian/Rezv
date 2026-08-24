import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';

/**
 * GET /api/v1/admin/business-intelligence — هوش تجاری سطح پلتفرم (پنل شرکت).
 * RFM، CLV، GMV، و سگمنت‌ها را در کل رستوران‌ها تجمیع می‌کند.
 * این به CEO دید کلان از سلامت کسب‌وکار کل پلتفرم می‌دهد (نه یک رستوران).
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);

    const [guestStats, rfmDist, segmentDist, topRestaurantsByClv] = await Promise.all([
      // آمار کلان مهمانان سراسری
      // ⚠️ بدونِ COALESCE: sum() رویِ ستونی که همه‌اش NULL است NULL می‌دهد و
      // همان باید به کلاینت برسد. تبدیلِ آن به ۰ یعنی ادعایِ «ارزشِ پلتفرم صفر
      // است»، درحالی‌که واقعیت «هنوز قابلِ اندازه‌گیری نیست» است (هیچ رستوران
      // منویِ قیمت‌دار ندارد). measured_guests می‌گوید این جمع رویِ چند مهمانِ
      // دارایِ مبلغِ واقعی حساب شده — تا عدد بدونِ زمینه تفسیر نشود.
      db.$queryRaw<{ total_guests: bigint; total_clv: bigint | null; measured_guests: bigint; total_vips: bigint }[]>`
        SELECT count(*) AS total_guests,
               sum(global_clv_toman) AS total_clv,
               count(global_clv_toman) AS measured_guests,
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
      // همان اصل: رستورانی که مبلغش اندازه‌گیری‌ناپذیر است «ارزشِ صفر» ندارد.
      // NULLS LAST تا چنین رستورانی ته جدول بیفتد، ولی با «—» نه با «۰ تومان».
      db.$queryRaw<{ restaurant_id: string; name: string; total_clv: bigint | null; measured_customers: bigint; customers: bigint }[]>`
        SELECT r.id AS restaurant_id, r.name,
               sum(ci.predicted_clv_toman) AS total_clv,
               count(ci.predicted_clv_toman) AS measured_customers,
               count(ci.user_id) AS customers
        FROM restaurants r
        LEFT JOIN customer_insights ci ON ci.restaurant_id = r.id
        GROUP BY r.id, r.name
        ORDER BY total_clv DESC NULLS LAST
        LIMIT 10
      `,
    ]);

    const g = guestStats[0] ?? { total_guests: 0n, total_clv: null, measured_guests: 0n, total_vips: 0n };

    return NextResponse.json({
      guests: {
        total: Number(g.total_guests),
        // null = هیچ مهمانی مبلغِ اندازه‌گیری‌شده ندارد (نه «ارزش صفر است»).
        total_clv_toman: g.total_clv === null ? null : Number(g.total_clv),
        measured_guests: Number(g.measured_guests),
        vips: Number(g.total_vips),
      },
      rfm_distribution: rfmDist.map(r => ({ segment: r.rfm_segment, count: Number(r.count) })),
      behavior_segments: segmentDist.map(s => ({ segment: s.segment, count: Number(s.count) })),
      top_restaurants_by_value: topRestaurantsByClv.map(r => ({
        id: r.restaurant_id, name: r.name,
        total_clv_toman: r.total_clv === null ? null : Number(r.total_clv),
        measured_customers: Number(r.measured_customers),
        customers: Number(r.customers),
      })),
    });
  } catch (e) { return errorResponse(e); }
}
