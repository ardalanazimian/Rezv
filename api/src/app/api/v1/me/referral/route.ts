import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { getReferralStats, createReferral } from '@/lib/loyalty';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const inviteSchema = z.object({ phone: zPhone });

/** GET — آمار و کد دعوت کاربر */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    return NextResponse.json(await getReferralStats(auth.sub));
  } catch (e) { return errorResponse(e); }
}

/** POST — دعوت دوست با شماره. بدنه: { phone } */
async function POST_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const { phone } = await parseBody(req, inviteSchema);
    return NextResponse.json(await createReferral(auth.sub, phone));
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/referral', GET_impl);
export const POST = withApiMetrics('/api/v1/me/referral', POST_impl);
