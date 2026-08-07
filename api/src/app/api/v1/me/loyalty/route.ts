import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { getLoyaltyStatus } from '@/lib/loyalty-status';
import { Err, errorResponse } from '@/lib/errors';

/**
 * GET /api/v1/me/loyalty — سطح، پیشرفت تا سطحِ بعدی، و نشان‌های واقعیِ کاربر.
 * جایگزینِ اعدادِ ثابتِ قبلیِ فرانت (loyalty.js) — همه از دادهٔ واقعی.
 */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const status = await getLoyaltyStatus(auth.sub);
    return NextResponse.json(status);
  } catch (e) { return errorResponse(e); }
}
