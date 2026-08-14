import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { rankCrmRecommendations, type CrmCustomerSignal } from '@/lib/crm-recommendations';

const CANDIDATE_LIMIT = 200; // کاندیدهای بالقوه که از DB می‌آیند، قبلِ رتبه‌بندی
const RESULT_LIMIT = 20;     // چیزی که واقعاً به کلاینت برمی‌گردد

/**
 * GET /restaurant/crm/recommendations — «با کدوم مشتری، چرا، از چه کانالی
 * تماس بگیر» (نقشه‌راهِ AI، فازِ ۲). قانون‌محور و شفاف — رجوع کن به
 * lib/crm-recommendations.ts. فقط کاندیدهایِ محتمل (VIP یا at_risk/churned
 * یا no-showِ بالا یا تک‌بازدیدِ تازه) از DB خوانده می‌شوند تا رتبه‌بندی
 * روی کل پایگاه‌مشتریِ رستوران‌های بزرگ کند نشود.
 */
export const GET = withRestaurantAuth({ permission: 'canViewAnalytics' }, async (_req, ctx) => {
  const restaurantId = ctx.restaurant.id;
  const data = await cached(cacheKey('crm-recs', restaurantId), 300, async () => {
    const rows = await db.customerInsight.findMany({
      where: {
        restaurantId,
        OR: [
          { isVip: true, churnRiskScore: { gte: 40 } },
          { segment: 'churned' },
          { segment: 'at_risk' },
          { noShowRatePct: { gte: 40 }, totalVisits: { gte: 3 } },
          { totalVisits: 1 },
        ],
      },
      take: CANDIDATE_LIMIT,
      orderBy: { churnRiskScore: 'desc' },
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    });

    const now = Date.now();
    const signals: CrmCustomerSignal[] = rows.map((r) => ({
      userId: r.userId,
      name: [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || 'مشتری',
      phone: r.user.phone,
      isVip: r.isVip,
      segment: r.segment,
      churnRiskScore: r.churnRiskScore,
      noShowRatePct: r.noShowRatePct,
      totalVisits: r.totalVisits,
      predictedClvToman: r.predictedClvToman,
      intelligenceTier: (r.intelligenceTier as 'low' | 'medium' | 'high' | null) ?? null,
      daysSinceLastVisit: r.lastVisitAt ? Math.floor((now - r.lastVisitAt.getTime()) / 86_400_000) : null,
    }));

    const recommendations = rankCrmRecommendations(signals).slice(0, RESULT_LIMIT);
    return { items: recommendations.map(({ priority: _priority, ...rest }) => rest) };
  });

  return NextResponse.json(data);
});
