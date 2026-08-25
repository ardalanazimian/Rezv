import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { listMissionsForUser } from '@/lib/missions';
import { Err, errorResponse } from '@/lib/errors';
import { parseQuery, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const querySchema = z.object({ restaurant_id: zUuid.optional() });

/** GET /api/v1/me/missions?restaurant_id=... — ماموریت‌هایِ فعال + پیشرفتِ همین کاربر */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const { restaurant_id } = parseQuery(req, querySchema);
    const missions = await listMissionsForUser(auth.sub, restaurant_id);
    return NextResponse.json({ missions });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/missions', GET_impl);
