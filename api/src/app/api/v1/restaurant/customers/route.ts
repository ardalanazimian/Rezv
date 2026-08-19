import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseQuery, zUuid, z } from '@/lib/schemas';

const querySchema = z.object({
  segment: z.enum(['new_customer', 'active', 'at_risk', 'churned', 'vip']).optional(),
  sort: z.enum(['clv', 'churn', 'visits', 'intelligence']).default('clv'),
  limit: z.number().int().min(1).max(50).default(24),
  cursor: zUuid.optional(),
});

// ═══════════════════════════════════════════════════════════
//  GET /restaurant/customers — لیست مشتریان با CLV، ریسک no-show، سگمنت
//  Query: ?segment=vip|at_risk|churned|active|new_customer&sort=clv|churn|visits|intelligence&cursor=&limit=24
//  (پس از ریفکتور معماری: auth/ratelimit/RBAC در withRestaurantAuth — این فایل فقط منطق خودش را دارد)
// ═══════════════════════════════════════════════════════════

export const GET = withRestaurantAuth({ permission: 'canViewAnalytics' }, async (req, ctx) => {
  const { segment, sort, limit, cursor } = parseQuery(req, querySchema);

  const orderBy = sort === 'churn' ? { churnRiskScore: 'desc' as const }
    : sort === 'visits' ? { totalVisits: 'desc' as const }
    // NULLS LAST صریح: مشتریانی که هنوز RFMِ شبانه برایشان اجرا نشده
    // (intelligenceScore=null) نباید بالای لیستِ «باارزش‌ترین‌ها» بیفتند —
    // پیش‌فرضِ Postgres برای DESC، NULLS FIRST است.
    : sort === 'intelligence' ? { intelligenceScore: { sort: 'desc' as const, nulls: 'last' as const } }
    // همان دلیلِ intelligenceScore بالا: predictedClvToman حالا nullable است
    // (مبلغ اندازه‌گیری‌ناپذیر → NULL)، و DESCِ Postgres پیش‌فرض NULLS FIRST
    // است — یعنی بدونِ این، مشتریانی که CLVشان اصلاً معلوم نیست بالایِ لیستِ
    // «باارزش‌ترین‌ها» می‌نشستند.
    : { predictedClvToman: { sort: 'desc' as const, nulls: 'last' as const } };

  const data = await cached(cacheKey('customers', ctx.restaurant.id, segment, sort, cursor), 60, async () => {
    const rows = await db.customerInsight.findMany({
      where: {
        restaurantId: ctx.restaurant.id,
        // M11: segment=vip از flag بولی isVip فیلتر می‌شود (نه مقدار segment).
        ...(segment === 'vip' ? { isVip: true } : segment ? { segment: segment as any } : {}),
      },
      orderBy,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { restaurantId_userId: { restaurantId: ctx.restaurant.id, userId: cursor } } } : {}),
      include: { user: { select: { firstName: true, lastName: true, phone: true, avatarUrl: true } } },
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(r => ({
      user_id: r.userId,
      name: [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || 'مشتری',
      phone: r.user.phone,
      avatar_url: r.user.avatarUrl,
      total_visits: r.totalVisits,
      avg_spend_toman: r.avgSpendToman,
      predicted_clv_toman: r.predictedClvToman,
      no_show_rate_pct: r.noShowRatePct,
      churn_risk_score: r.churnRiskScore,
      // امتیازِ هوشِ مشتری (فازِ ۲ AI) — null یعنی هنوز RFMِ شبانه اجرا نشده
      intelligence_score: r.intelligenceScore,
      intelligence_tier: r.intelligenceTier,
      segment: r.segment,
      is_vip: r.isVip,
      last_visit_at: r.lastVisitAt,
    }));
    return { items, next_cursor: hasMore ? rows[limit].userId : null };
  });

  return NextResponse.json(data);
});
