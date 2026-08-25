import { NextResponse } from 'next/server';
import { requestOtp } from '@/lib/otp';
import { errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ phone: zPhone });

async function POST_impl(req: Request) {
  try {
    const { phone } = await parseBody(req, schema);
    const r = await requestOtp(phone);
    return r.devCode ? NextResponse.json(r) : new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/otp/request', POST_impl);
