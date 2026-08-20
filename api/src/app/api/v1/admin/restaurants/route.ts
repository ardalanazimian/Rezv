import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { computeSubscriptionStatus } from '@/lib/subscription';

/** GET — همه‌ی رستوران‌های پلتفرم با آمار (پنل شرکت) */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);
    const restaurants = await db.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, plan: true, planExpiresAt: true, trialEndsAt: true } },
        _count: { select: { members: true, reservations: true } },
      },
    });
    return NextResponse.json({
      restaurants: restaurants.map(r => {
        const sub = computeSubscriptionStatus(r.tenant.plan, r.tenant.planExpiresAt, r.tenant.trialEndsAt);
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
