import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached } from '@/lib/cache';
import { errorResponse } from '@/lib/errors';
import { ACTIVE_RESERVATION_STATUSES } from '@/lib/reservation-status';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════
//  GET /api/v1/restaurants/live-stats — آمارِ زنده‌ی سراسری (عمومی)
//
//  هدف: تغذیه‌ی «نوارِ زنده»ی اپ مشتری با دادهٔ واقعی (نه عددِ ثابتِ hard-coded).
//   • openRestaurants   → تعداد رستوران‌های باز و آنلاین (همان گاردِ heartbeat لیست)
//   • activeReservations → تعداد رزروهای «فعال» با اسلاتِ پیش‌روی نزدیک (۶ ساعت آینده)
//   • fillingUp          → تعداد رستوران‌هایی که همین‌الان در حالِ پر شدن‌اند
//                          (≥۳ رزروِ فعالِ پیش‌رو)
//
//  همه از دیتابیس شمرده می‌شوند (dbRead/replica) و ۳۰ ثانیه کش می‌شوند تا بارِ
//  کوئری در ترافیک بالا کنترل شود. اگر داده‌ای نباشد، صفرهای صادقانه برمی‌گردد
//  (اپ مشتری در آن حالت نوار را نشان نمی‌دهد) — بدونِ هیچ عددِ جعلی.
//
//  نکته‌ی مسیر: سگمنتِ ثابتِ «live-stats» بر سگمنتِ داینامیکِ «[slug]» اولویت دارد،
//  پس این با GET /restaurants/[slug] تداخل ندارد.
// ═══════════════════════════════════════════════════════════

async function GET_impl() {
  try {
    const stats = await cached('live-stats:global', 30, async () => {
      const now = new Date();
      const horizon = new Date(now.getTime() + 6 * 60 * 60_000); // ۶ ساعتِ آینده
      const onlineThreshold = new Date(now.getTime() - 90_000);   // آستانه‌ی آنلاین‌بودن

      const activeWhere = {
        status: { in: ACTIVE_RESERVATION_STATUSES as any },
        slotStart: { gte: now, lt: horizon },
      };

      const [openRestaurants, activeReservations, fillingRows] = await Promise.all([
        db.restaurant.count({
          where: { isOpen: true, OR: [{ onlineGating: false }, { lastSeenAt: { gte: onlineThreshold } }] },
        }),
        db.reservation.count({ where: activeWhere }),
        db.reservation.groupBy({ by: ['restaurantId'], where: activeWhere, _count: true }),
      ]);

      const fillingUp = fillingRows.filter((r) => Number(r._count) >= 3).length;
      return { openRestaurants, activeReservations, fillingUp, at: now.toISOString() };
    });

    return NextResponse.json(stats);
  } catch (e) {
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/restaurants/live-stats', GET_impl);
