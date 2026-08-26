import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { redeemRewardItem } from '@/lib/rewards';
import { assertUserNotBanned } from '@/lib/ban';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { isFeatureEnabled, featureFlagLabel } from '@/lib/feature-flags';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ id: zUuid });

/** POST /api/v1/me/rewards/:id/redeem — خرجِ سکه برایِ یه آیتمِ فروشگاه
 *  ⚠️ رفع‌شده: بنِ سختِ پلتفرم قبلاً اینجا چک نمی‌شد. */
async function POST_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await assertUserNotBanned(auth.sub);
    await enforceRateLimit(clientIp(req), RULES.auth);
    // سوییچِ قابلیت (Company Control Plane، فازِ ۳)
    if (!(await isFeatureEnabled('reward_marketplace_enabled'))) throw Err.featureDisabled(featureFlagLabel('reward_marketplace_enabled'));
    const { id } = parseParams(await params, paramsSchema);
    const result = await redeemRewardItem(auth.sub, id);
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/me/rewards/[id]/redeem', POST_impl);
