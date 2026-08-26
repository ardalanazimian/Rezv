import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { getPointsBalance, getPointsHistory } from '@/lib/loyalty';
import { Err, errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/** GET /api/v1/me/points — موجودی و تاریخچه‌ی امتیاز */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const [balance, history] = await Promise.all([
      getPointsBalance(auth.sub), getPointsHistory(auth.sub),
    ]);
    return NextResponse.json({ balance, history });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/points', GET_impl);
