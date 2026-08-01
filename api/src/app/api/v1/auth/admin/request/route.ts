import { NextResponse } from 'next/server';
import { requestOtp } from '@/lib/otp';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { findPlatformAdmin } from '@/lib/platform-admin';

const schema = z.object({ phone: zPhone });

export async function POST(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.otpVerify);
    const { phone } = await parseBody(req, schema);
    await findPlatformAdmin(phone);
    const result = await requestOtp(phone);
    return result.devCode ? NextResponse.json(result) : new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}