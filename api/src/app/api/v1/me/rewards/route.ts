import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { getCustomerEconomyProfile } from '@/lib/economy';
import { listRewardItems } from '@/lib/rewards';
import { Err, errorResponse } from '@/lib/errors';
import { parseQuery, zUuid, z } from '@/lib/schemas';

const querySchema = z.object({ restaurant_id: zUuid.optional() });

/** GET /api/v1/me/rewards?restaurant_id=... — کاتالوگِ Reward Marketplace */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const { restaurant_id } = parseQuery(req, querySchema);
    const profile = await getCustomerEconomyProfile(db as any, auth.sub);
    const items = await listRewardItems(profile.reputationTier, restaurant_id);
    return NextResponse.json({ wallet_balance: profile.walletBalance, items });
  } catch (e) { return errorResponse(e); }
}
