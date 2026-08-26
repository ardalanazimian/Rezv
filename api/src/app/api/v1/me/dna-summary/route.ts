import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { Err, errorResponse } from '@/lib/errors';
import { db } from '@/lib/db';
import { buildDnaMonthlySummary, lastCompletedJalaliMonth } from '@/lib/dna-summary';
import { inAppAllowedForCategory } from '@/lib/notification-prefs';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';

import { withApiMetrics } from '@/lib/api-metrics';

/**
 * GET /api/v1/me/dna-summary — خلاصه‌ی ماهانه‌ی DNA غذایی (درون‌اپ).
 *
 * ⚠️ این endpoint دسته‌ی `dna` را **واقعاً** اعمال می‌کند. تا پیش از این،
 * کلیدِ «خلاصه‌ی DNA غذایی» در تنظیماتِ اپ نمایش داده و ذخیره می‌شد ولی هیچ
 * مصرف‌کننده‌ای نداشت — یعنی خاموش‌کردنش هیچ اثری نداشت چون اصلاً چیزی
 * صادر نمی‌شد. حالا هم صادر می‌شود و هم انصراف محترم است.
 *
 * پاسخ همیشه ۲۰۰ است، حتی وقتی خلاصه‌ای نیست:
 *   { available: false, reason: 'opted_out' | 'no_visits_this_month', ... }
 * ⚠️ عمداً ۴۰۳ نیست — «انصراف داده‌ام» خطا نیست، یک تنظیمِ عادیِ کاربر است،
 * و کلاینت نباید برایش مسیرِ خطا اجرا کند یا به کاربر «دسترسی ندارید» بگوید.
 */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);

    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();

    const user = await db.user.findUnique({
      where: { id: auth.sub },
      select: { notificationPrefs: true },
    });
    if (!user) throw Err.forbidden();

    const allowed = inAppAllowedForCategory(user.notificationPrefs, 'dna', {
      site: 'me/dna-summary', userId: auth.sub,
    });
    if (!allowed) {
      // بازه هم برگردانده می‌شود تا کلاینت بتواند بدونِ حدس‌زدنِ تقویمِ شمسی
      // همان کلیدِ ماه را برایِ حالتِ خاموش هم داشته باشد.
      const month = lastCompletedJalaliMonth(new Date());
      return NextResponse.json({
        available: false, reason: 'opted_out',
        period_key: month.key, period_label: month.label,
      });
    }

    const summary = await buildDnaMonthlySummary(auth.sub);

    if (!summary.available) {
      return NextResponse.json({
        available: false, reason: summary.reason,
        period_key: summary.periodKey, period_label: summary.periodLabel,
      });
    }

    // snake_case در مرزِ API — همان قراردادِ بقیه‌ی /me/* (visit_percentile و …).
    return NextResponse.json({
      available: true,
      period_key: summary.periodKey,
      period_label: summary.periodLabel,
      visits: summary.visits,
      previous_visits: summary.previousVisits,
      restaurants_visited: summary.restaurantsVisited,
      new_restaurants: summary.newRestaurants,
      spend_toman: summary.spendToman,
      points_earned: summary.pointsEarned,
      top_restaurant: summary.topRestaurant,
      top_cuisine: summary.topCuisine,
      lifetime_visit_percentile: summary.lifetimeVisitPercentile,
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/dna-summary', GET_impl);
