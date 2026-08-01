import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { signAccess, signRefresh } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, zPhone, zOtpCode, z } from '@/lib/schemas';
import { findPlatformAdmin } from '@/lib/platform-admin';

const schema = z.object({ phone: zPhone, code: zOtpCode });

export async function POST(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.otpVerify);
    const { phone, code } = await parseBody(req, schema);
    const admin = await findPlatformAdmin(phone);
    await verifyOtp(phone, code);
    const principal = { sub: admin.id, kind: 'staff' as const, tenantId: admin.tenantId, role: 'owner' as const };
    return NextResponse.json({
      access: signAccess(principal),
      refresh: signRefresh(principal),
      admin: { id: admin.id, tenant_id: admin.tenantId, tenant_name: admin.tenant.name },
    });
  } catch (e) { return errorResponse(e); }
}