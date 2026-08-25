import { NextResponse } from 'next/server';
import { requestOtp, normalizePhone } from '@/lib/otp';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ phone: zPhone });

/** POST — درخواست کد ورود کارمند (فقط شماره‌های ثبت‌شده در جدول Staff) */
async function POST_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.otpVerify);
    const { phone } = await parseBody(req, schema);
    const normalized = normalizePhone(phone);
    const staff = await db.staff.findFirst({ where: { phone: normalized } });
    if (!staff) throw Err.forbidden('این شماره دسترسی پنل رستوران ندارد');
    if (!staff.isActive) throw Err.forbidden('این حساب غیرفعال شده است');
    const r = await requestOtp(normalized);
    return r.devCode ? NextResponse.json(r) : new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/staff/request', POST_impl);
