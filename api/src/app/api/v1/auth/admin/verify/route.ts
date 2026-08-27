import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { signAccess, signRefresh } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { ApiError, errorResponse } from '@/lib/errors';
import { parseBody, zPhone, zOtpCode, z } from '@/lib/schemas';
import { findPlatformAdmin } from '@/lib/platform-admin';
import { audit, maskPhone } from '@/lib/audit';

import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ phone: zPhone, code: zOtpCode });

async function POST_impl(req: Request) {
  const ip = clientIp(req);
  let phoneMasked: string | null = null;
  try {
    await enforceRateLimit(ip, RULES.otpVerify);
    const { phone, code } = await parseBody(req, schema);
    phoneMasked = maskPhone(phone);
    const admin = await findPlatformAdmin(phone);
    await verifyOtp(phone, code);
    const principal = { sub: admin.id, kind: 'staff' as const, tenantId: admin.tenantId, role: 'owner' as const };
    // بالاترین سطحِ دسترسیِ پلتفرم — ورودش حتماً باید ردِ audit داشته باشد.
    await audit({
      action: 'auth.login', actorId: admin.id, actorType: 'admin', ip,
      detail: { channel: 'platform-admin', tenant_id: admin.tenantId, phone_masked: phoneMasked },
    });
    return NextResponse.json({
      access: signAccess(principal),
      refresh: signRefresh(principal),
      admin: { id: admin.id, tenant_id: admin.tenantId, tenant_name: admin.tenant.name },
    });
  } catch (e) {
    await audit({
      action: 'auth.failure', actorType: 'admin', ip, success: false,
      detail: { channel: 'platform-admin', phone_masked: phoneMasked, reason: e instanceof ApiError ? e.code : 'INTERNAL' },
    });
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/admin/verify', POST_impl);
