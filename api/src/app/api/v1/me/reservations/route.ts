import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { dbRead as db } from '@/lib/db';
import { Err, errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/** GET — تاریخچه برای «رزرو مجدد» */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const list = await db.reservation.findMany({
      where: { userId: auth.sub },
      orderBy: { slotStart: 'desc' },
      take: 50,
      include: {
        restaurant: { select: { name: true, slug: true } },
        items: { include: { menuItem: { select: { name: true } } } },
      },
    });
    return NextResponse.json(list);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/reservations', GET_impl);
