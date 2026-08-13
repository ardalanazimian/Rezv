import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { redeemRewardItem } from '@/lib/rewards';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { isFeatureEnabled, featureFlagLabel } from '@/lib/feature-flags';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ id: zUuid });

/** POST /api/v1/me/rewards/:id/redeem — خرجِ سکه برایِ یه آیتمِ فروشگاه */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await enforceRateLimit(clientIp(req), RULES.auth);
    // سوییچِ قابلیت (Company Control Plane، فازِ ۳)
    if (!(await isFeatureEnabled('reward_marketplace_enabled'))) throw Err.featureDisabled(featureFlagLabel('reward_marketplace_enabled'));
    const { id } = parseParams(await params, paramsSchema);
    const result = await redeemRewardItem(auth.sub, id);
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
