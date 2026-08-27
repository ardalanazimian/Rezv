import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { getLoyaltyStatus } from '@/lib/loyalty-status';
import { Err, errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/**
 * GET /api/v1/me/loyalty — سطح، پیشرفت تا سطحِ بعدی، و نشان‌های واقعیِ کاربر.
 * جایگزینِ اعدادِ ثابتِ قبلیِ فرانت (loyalty.js) — همه از دادهٔ واقعی.
 */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const status = await getLoyaltyStatus(auth.sub);
    return NextResponse.json(status);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/loyalty', GET_impl);
