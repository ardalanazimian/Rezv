import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { getIncentivesForUser } from '@/lib/incentive-engine';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { Err, errorResponse } from '@/lib/errors';
import { parseQuery, zUuid, z } from '@/lib/schemas';

const querySchema = z.object({ restaurant_id: zUuid.optional() });

/**
 * GET /api/v1/me/incentives?restaurant_id=... — Smart Incentive Engine:
 * لیستِ رتبه‌بندی‌شده‌یِ «الان چیکار کنی» (حداکثر ۵ مورد) برایِ همین مشتری،
 * بر اساسِ segment/churnRiskScore، reliabilityScore/reputationTier،
 * و پیش‌بینیِ تقاضایِ رستوران (اگه restaurant_id داده بشه).
 */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    // سوییچِ قابلیت (Company Control Plane، فازِ ۳): این یک GETِ نمایشی است،
    // نه اقدامِ کاربر — پس به‌جایِ خطا، خاموش‌شدنِ بی‌صدا (فهرستِ خالی) صادقانه‌تره
    // (مثلِ همون الگویِ «هیچ ادعایی نکن» که در booking.js/discover.js استفاده شده).
    if (!(await isFeatureEnabled('ai_recommendations_enabled'))) {
      return NextResponse.json({ suggestions: [] });
    }
    const { restaurant_id } = parseQuery(req, querySchema);
    const suggestions = await getIncentivesForUser(auth.sub, restaurant_id);
    return NextResponse.json({
      suggestions: suggestions.map((s) => ({ kind: s.kind, ref_id: s.ref_id ?? null, title: s.title, reason: s.reason })),
    });
  } catch (e) { return errorResponse(e); }
}
