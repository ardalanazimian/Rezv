import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { getPointsBalance, getPointsHistory } from '@/lib/loyalty';
import { Err, errorResponse } from '@/lib/errors';

/** GET /api/v1/me/points — موجودی و تاریخچه‌ی امتیاز */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const [balance, history] = await Promise.all([
      getPointsBalance(auth.sub), getPointsHistory(auth.sub),
    ]);
    return NextResponse.json({ balance, history });
  } catch (e) { return errorResponse(e); }
}
