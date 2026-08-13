import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { claimMission } from '@/lib/missions';
import { assertUserNotBanned } from '@/lib/ban';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { isFeatureEnabled, featureFlagLabel } from '@/lib/feature-flags';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ id: zUuid });

/** POST /api/v1/me/missions/:id/claim — دریافتِ جایزه‌ی ماموریتِ تکمیل‌شده
 *  ⚠️ رفع‌شده: بنِ سختِ پلتفرم قبلاً فقط رویِ verify/refresh/POST reservations
 *  اجرا می‌شد — یعنی کاربرِ بن‌شده‌ای که توکنِ معتبر (از قبل صادرشده) داشت
 *  همچنان می‌تونست XP/سکه کسب کنه. حالا اینجا هم چک می‌شه. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await assertUserNotBanned(auth.sub);
    await enforceRateLimit(clientIp(req), RULES.auth);
    // سوییچِ قابلیت (Company Control Plane، فازِ ۳)
    if (!(await isFeatureEnabled('missions_claim_enabled'))) throw Err.featureDisabled(featureFlagLabel('missions_claim_enabled'));
    const { id } = parseParams(await params, paramsSchema);
    const result = await claimMission(auth.sub, id);
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
