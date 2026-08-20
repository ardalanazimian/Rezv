import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { computeSubscriptionStatus } from '@/lib/subscription';

/** GET — آمار کلی پلتفرم (داشبورد پنل شرکت) */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);
    const [totalRestaurants, activeRestaurants, totalMembers, totalReservations, topRestaurants, platformValue, systemHealth, tenants] = await Promise.all([
      db.restaurant.count(),
      db.restaurant.count({ where: { isOpen: true } }),
      db.clubMember.count(),
      db.reservation.count(),
      db.restaurant.findMany({
        take: 5, orderBy: { reservations: { _count: 'desc' } },
        select: { id: true, name: true, slug: true, _count: { select: { reservations: true, members: true } } },
      }),
      // ارزش پلتفرم: CLV کل + تعداد VIP (از GuestProfile سراسری)
      db.$queryRaw<{ total_clv: bigint; total_vips: bigint; total_guests: bigint }[]>`
        SELECT COALESCE(sum(global_clv_toman),0) AS total_clv,
               count(*) FILTER (WHERE is_vip_anywhere) AS total_vips,
               count(*) AS total_guests
        FROM guest_profiles
      `,
      // سلامت سریع صف (برای نشانگر بالای داشبورد)
      db.$queryRaw<{ failed: bigint; dead: bigint }[]>`
        SELECT count(*) FILTER (WHERE status='failed') AS failed,
               count(*) FILTER (WHERE status='dead') AS dead
        FROM jobs
      `,
      // برای محاسبه‌ی واقعی وضعیت اشتراک هر تنانت (نه ساختگی)
      db.tenant.findMany({ select: { plan: true, planExpiresAt: true, trialEndsAt: true } }),
    ]);

    const value = platformValue[0] ?? { total_clv: 0n, total_vips: 0n, total_guests: 0n };
    const health = systemHealth[0] ?? { failed: 0n, dead: 0n };

    const subCounts = { active: 0, expiring: 0, expired: 0, trial: 0, trial_expired: 0 };
    for (const t of tenants) {
      const sub = computeSubscriptionStatus(t.plan, t.planExpiresAt, t.trialEndsAt);
      subCounts[sub.status]++;
    }

    return NextResponse.json({
      total_restaurants: totalRestaurants,
      active_restaurants: activeRestaurants,
      total_members: totalMembers,
      total_reservations: totalReservations,
      // KPIهای جدید سطح پلتفرم
      platform_clv_toman: Number(value.total_clv),
      total_vips: Number(value.total_vips),
      total_guests: Number(value.total_guests),
      system_health: Number(health.dead) > 0 ? 'critical' : Number(health.failed) > 10 ? 'warning' : 'healthy',
      // وضعیت واقعی اشتراک‌ها (دیگر ساختگی نیست)
      subscription_breakdown: subCounts,
      top_restaurants: topRestaurants.map(r => ({
        id: r.id, name: r.name, reservations: r._count.reservations, members: r._count.members,
      })),
    });
  } catch (e) { return errorResponse(e); }
}
