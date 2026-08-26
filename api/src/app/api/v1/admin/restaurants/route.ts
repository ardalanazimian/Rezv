import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { computeSubscriptionStatus } from '@/lib/subscription';

import { withApiMetrics } from '@/lib/api-metrics';

/** GET — همه‌ی رستوران‌های پلتفرم با آمار (پنل شرکت) */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const restaurants = await db.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, plan: true, planExpiresAt: true, trialEndsAt: true } },
        _count: { select: { members: true, reservations: true } },
      },
    });
    return NextResponse.json({
      restaurants: restaurants.map(r => {
        const sub = computeSubscriptionStatus(r.tenant.planExpiresAt, r.tenant.trialEndsAt);
        return {
          id: r.id, name: r.name, slug: r.slug, cuisine: r.cuisine,
          tenant_id: r.tenant.id, plan: r.tenant.plan, is_open: r.isOpen,
          members: r._count.members, reservations: r._count.reservations,
          sms_balance: r.smsBalance, sms_total_sent: r.smsTotalSent,
          joined_at: r.createdAt,
          // وضعیت واقعی اشتراک — دیگر ساختگی نیست
          subscription_status: sub.status,
          days_left: sub.daysLeft,
          plan_expires_at: r.tenant.planExpiresAt,
          trial_ends_at: r.tenant.trialEndsAt,
        };
      }),
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/restaurants', GET_impl);
