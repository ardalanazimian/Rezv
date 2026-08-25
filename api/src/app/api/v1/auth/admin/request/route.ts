import { NextResponse } from 'next/server';
import { requestOtp } from '@/lib/otp';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { findPlatformAdmin } from '@/lib/platform-admin';

import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ phone: zPhone });

async function POST_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.otpVerify);
    const { phone } = await parseBody(req, schema);
    await findPlatformAdmin(phone);
    const result = await requestOtp(phone);
    return result.devCode ? NextResponse.json(result) : new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/admin/request', POST_impl);
