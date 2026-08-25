import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { getCustomerEconomyProfile } from '@/lib/economy';
import { listRewardItems } from '@/lib/rewards';
import { Err, errorResponse } from '@/lib/errors';
import { parseQuery, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const querySchema = z.object({ restaurant_id: zUuid.optional() });

/** GET /api/v1/me/rewards?restaurant_id=... — کاتالوگِ Reward Marketplace */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const { restaurant_id } = parseQuery(req, querySchema);
    const profile = await getCustomerEconomyProfile(db as any, auth.sub);
    const items = await listRewardItems(profile.reputationTier, restaurant_id);
    return NextResponse.json({ wallet_balance: profile.walletBalance, items });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/rewards', GET_impl);
