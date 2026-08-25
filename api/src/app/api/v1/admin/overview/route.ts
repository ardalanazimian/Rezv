import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { computeSubscriptionStatus } from '@/lib/subscription';

import { withApiMetrics } from '@/lib/api-metrics';

/** GET — آمار کلی پلتفرم (داشبورد پنل شرکت) */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
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
      //
      // ⚠️ رفعِ تناقضِ دو صفحه‌ی یک پنل (فازِ ۲، `docs/ML_CONTRACT.md`):
      // این کوئری `COALESCE(sum(global_clv_toman),0)` داشت، پس روی همان DB و
      // همان ستونی که `/admin/business-intelligence` صادقانه `null` +
      // `measured_guests: 0` گزارش می‌کرد، این‌جا «۰ تومان» می‌آمد و پنلِ شرکت
      // «ارزش مهمانان پلتفرم: ۰ تومان» می‌نوشت. صفر یعنی «اندازه گرفتیم و هیچ
      // بود» — ادعایی که نداریم؛ واقعیت «هنوز اندازه‌گیری‌ناپذیر است» بود
      // (هیچ رستوران منویِ قیمت‌دار ندارد).
      // COALESCE برداشته شد و `measured_guests` — دقیقاً با همان `count(col)`ِ
      // آن route — اضافه شد تا هر دو صفحه یک جواب بدهند.
      db.$queryRaw<{ total_clv: bigint | null; total_vips: bigint; total_guests: bigint; measured_guests: bigint }[]>`
        SELECT sum(global_clv_toman) AS total_clv,
               count(global_clv_toman) AS measured_guests,
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

    const value = platformValue[0] ?? { total_clv: null, total_vips: 0n, total_guests: 0n, measured_guests: 0n };
    const health = systemHealth[0] ?? { failed: 0n, dead: 0n };

    const subCounts = { active: 0, expiring: 0, expired: 0, trial: 0, trial_expired: 0 };
    for (const t of tenants) {
      const sub = computeSubscriptionStatus(t.planExpiresAt, t.trialEndsAt);
      subCounts[sub.status]++;
    }

    return NextResponse.json({
      total_restaurants: totalRestaurants,
      active_restaurants: activeRestaurants,
      total_members: totalMembers,
      total_reservations: totalReservations,
      // KPIهای جدید سطح پلتفرم
      // null = هیچ مهمانی مبلغِ اندازه‌گیری‌شده ندارد (نه «ارزش صفر است»).
      // `platform_clv_status` صریح است تا کلاینت نتواند «نمی‌دانیم» را به «۰»
      // ترجمه کند — همان قراردادی که `/admin/business-intelligence` و
      // `outreach-ledger` (`conversion_status`) از قبل دارند.
      platform_clv_toman: value.total_clv === null ? null : Number(value.total_clv),
      platform_clv_status: value.total_clv === null ? 'insufficient_data' : 'measured',
      measured_guests: Number(value.measured_guests),
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

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/overview', GET_impl);
