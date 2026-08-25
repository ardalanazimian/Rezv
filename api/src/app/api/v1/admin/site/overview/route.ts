import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/admin/site/overview — نمای یک‌نگاهِ سایت (پنلِ شرکت + استودیو)
//
//  همان چیزی که «اعلانِ اپِ شرکت» را واقعی می‌کند: شمارشِ درخواست‌های در
//  انتظارِ فعال‌سازی، دموهای اخیر، پیام‌های بازنشده، و وضعیتِ محتوا
//  (منتشرشده/پیش‌نویس) برای نشانِ کنارِ منو.
// ═══════════════════════════════════════════════════════════════════════

export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);

    const since30d = new Date(Date.now() - 30 * 86_400_000);

    const [
      pendingPurchases, contactedPurchases, activatedPurchases,
      trials30d, openInquiries,
      draftPages, draftArticles, publishedArticles, activePlans,
      revenueRows, recent,
    ] = await Promise.all([
      db.siteOrder.count({ where: { kind: 'purchase', status: 'pending' } }),
      db.siteOrder.count({ where: { kind: 'purchase', status: 'contacted' } }),
      db.siteOrder.count({ where: { kind: 'purchase', status: 'activated' } }),
      db.siteOrder.count({ where: { kind: 'trial', createdAt: { gte: since30d } } }),
      db.siteInquiry.count({ where: { status: 'open' } }),
      db.sitePage.count({ where: { status: 'draft' } }),
      db.siteArticle.count({ where: { status: 'draft' } }),
      db.siteArticle.count({ where: { status: 'published' } }),
      db.sitePlan.count({ where: { status: 'published' } }),
      // ارزشِ فعال‌شده‌ی ۳۰ روزِ اخیر — عددِ واقعی از اسنپ‌شاتِ سفارش‌ها.
      db.siteOrder.aggregate({
        where: { kind: 'purchase', status: 'activated', activatedAt: { gte: since30d } },
        _sum: { amountToman: true }, _count: true,
      }),
      db.siteOrder.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true, code: true, kind: true, status: true, businessName: true,
          planName: true, amountToman: true, createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      funnel: {
        pending_purchases: pendingPurchases,
        contacted_purchases: contactedPurchases,
        activated_purchases: activatedPurchases,
        trials_30d: trials30d,
        open_inquiries: openInquiries,
        // مجموعِ کاری که همین حالا روی میزِ تیمِ شرکت است (نشانِ منو)
        action_required: pendingPurchases + openInquiries,
      },
      revenue_30d: {
        activated_count: revenueRows._count,
        amount_toman: revenueRows._sum.amountToman ?? 0,
      },
      content: {
        draft_pages: draftPages,
        draft_articles: draftArticles,
        published_articles: publishedArticles,
        active_plans: activePlans,
      },
      recent: recent.map((r) => ({
        id: r.id, code: r.code, kind: r.kind, status: r.status,
        business_name: r.businessName, plan_name: r.planName,
        amount_toman: r.amountToman, created_at: r.createdAt,
      })),
    });
  } catch (e) { return errorResponse(e); }
}
