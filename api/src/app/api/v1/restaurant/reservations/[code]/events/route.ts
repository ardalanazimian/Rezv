import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getReservationEvents } from '@/lib/lifecycle';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseParams, zReservationCode, z } from '@/lib/schemas';

const paramsSchema = z.object({ code: zReservationCode });

/**
 * GET /api/v1/restaurant/reservations/:code/events — تاریخچه‌ی تغییر وضعیت (audit log)
 *
 * ⚠️ رفعِ نشتِ شعبه (فازِ ۲، پروتکل §۷): این route با `authFromRequest` دستی کار
 * می‌کرد و فقط `restaurant.tenantId === auth.tenantId` را چک می‌کرد — یعنی
 * `staff.restaurantId` (قفلِ شعبه) اصلاً دیده نمی‌شد. در یک تنانتِ چندشعبه‌ای،
 * کارمندِ قفل‌شده به شعبه‌ی A می‌توانست تاریخچه‌ی کاملِ رزروِ شعبه‌ی B را
 * بخواند. ضمناً این یکی از معدود routeهایی بود که **هیچ ریت‌لیمیتی نداشت**،
 * پس فضایِ کدِ ۸ کاراکتری قابلِ پیمایش بود.
 *
 * حالا از همان wrapperِ استانداردِ خواهرش (.../status) رد می‌شود:
 * withRestaurantAuth هم‌زمان auth، محدوده‌ی شعبه، ریت‌لیمیت، تریس و پوششِ خطا
 * را می‌آورد — بدونِ اختراعِ چیزِ تازه (§۲۲).
 */
export const GET = withRestaurantAuth({ rateLimit: 'search' }, async (_req, ctx, rawParams: { code: string }) => {
  const { code } = parseParams(rawParams, paramsSchema);
  const resv = await db.reservation.findUnique({
    where: { code },
    select: { id: true, restaurantId: true },
  });
  // ۴۰۴ (نه ۴۰۳) تا وجود/عدمِ وجودِ کدِ رزروِ شعبه‌ی دیگر لو نرود.
  if (!resv || resv.restaurantId !== ctx.restaurant.id) throw Err.notFound('رزرو');
  const events = await getReservationEvents(resv.id);
  return NextResponse.json({ events });
});
