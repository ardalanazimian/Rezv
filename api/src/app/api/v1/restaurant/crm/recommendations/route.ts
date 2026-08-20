import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { rankCrmRecommendations, type CrmCustomerSignal } from '@/lib/crm-recommendations';
import {
  getOutreachStatsBySource, ATTRIBUTION_WINDOW_DAYS, MIN_RESOLVED_FOR_RATE,
} from '@/lib/outreach-ledger';

const CANDIDATE_LIMIT = 200; // کاندیدهای بالقوه که از DB می‌آیند، قبلِ رتبه‌بندی
const RESULT_LIMIT = 20;     // چیزی که واقعاً به کلاینت برمی‌گردد

/**
 * تا این تعداد روز پس از یک تماسِ ثبت‌شده، همان مشتری دوباره توصیه نمی‌شود.
 *
 * ⚠️ این نیمه‌ی *عمل‌کننده‌ی* حلقه‌ی بازخورد است. بدونِ آن، ثبتِ تماس فقط یک
 * آمارِ تماشایی می‌شد: رستوران‌دار فردا دوباره همان اسم را می‌دید و دوباره
 * زنگ می‌زد. حلقه وقتی بسته است که بازخورد *رفتار* را عوض کند، نه فقط
 * گزارش را.
 */
const RECONTACT_COOLDOWN_DAYS = 7;

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

    // مشتریانی که به‌تازگی با آن‌ها تماس گرفته شده از فهرست حذف می‌شوند.
    // ⚠️ فقط تماس‌های *همین رستوران* — دفتر per-restaurant خوانده می‌شود، پس
    // تماسِ رستورانِ دیگر با همین مشتری اینجا اثری ندارد.
    const cooldownSince = new Date(Date.now() - RECONTACT_COOLDOWN_DAYS * 86_400_000);
    const recentlyContacted = new Set(
      (await db.outreachLog.findMany({
        where: {
          restaurantId,
          source: 'crm_recommendation',
          sentAt: { gte: cooldownSince },
          userId: { not: null },
        },
        select: { userId: true },
      })).map(o => o.userId as string),
    );

    const now = Date.now();
    const signals: CrmCustomerSignal[] = rows
      .filter(r => !recentlyContacted.has(r.userId))
      .map((r) => ({
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

    // اثربخشیِ *سنجیده‌شده‌ی* خودِ همین توصیه‌ها (فازِ ۸). تا پیش از این،
    // توصیه تولید و نمایش داده می‌شد و برای همیشه ناسنجیده می‌ماند.
    // ⚠️ زیرِ کفِ نمونه عمداً null است، نه صفر — همان قاعده‌ای که در
    // lib/outreach-ledger.ts توضیح داده شده.
    const eff = (await getOutreachStatsBySource({
      restaurantId, source: 'crm_recommendation',
    })).get(null);

    return {
      items: recommendations.map(({ priority: _priority, ...rest }) => rest),
      effectiveness: {
        contacted_count: eff?.sentCount ?? 0,
        resolved_count: eff?.resolvedCount ?? 0,
        converted_count: eff?.convertedCount ?? 0,
        conversion_rate_pct: eff?.ratePct ?? null,
        conversion_status: eff?.status ?? 'insufficient_data',
        window_days: ATTRIBUTION_WINDOW_DAYS,
        min_resolved: MIN_RESOLVED_FOR_RATE,
      },
      cooldown_days: RECONTACT_COOLDOWN_DAYS,
      suppressed_count: recentlyContacted.size,
    };
  });

  return NextResponse.json(data);
});
