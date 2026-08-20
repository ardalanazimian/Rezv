import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transitionReservation, type RStatus } from '@/lib/lifecycle';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseParams, zReservationCode, z } from '@/lib/schemas';

const RSTATUS = [
  'pending', 'waitlisted', 'confirmed', 'auto_confirmed',
  'preparing', 'checked_in', 'running_late', 'seated',
  'dining', 'completed', 'no_show', 'rejected',
  'expired', 'cancelled', 'auto_cancelled',
  'arrived', 'cancelled_by_user', 'cancelled_by_restaurant',
] as const;
const paramsSchema = z.object({ code: zReservationCode });
const bodySchema = z.object({ status: z.enum(RSTATUS), reason: z.string().max(500).optional() });

/**
 * PATCH /api/v1/restaurant/reservations/:code/status — staff وضعیت رزرو را تغییر می‌دهد.
 * بدنه: { status, reason? }
 *
 * ⚠️ باگ H6: قبلاً این route با authFromRequest دستی نوشته شده بود؛ نه rate-limit
 * داشت و نه چک مجوز (RBAC). یعنی هر کارمندی — حتی با نقش محدود staff — می‌توانست
 * هر رزروی را completed/no_show/cancelled کند (که پیامد مالی و آنالیتیکس دارد) و
 * چون rate-limit نبود، امکان سوءاستفاده‌ی انبوه هم وجود داشت. حالا از wrapper
 * مشترک با permission='canManageReservations' و rateLimit='auth' استفاده می‌شود.
 */
export const PATCH = withRestaurantAuth(
  { rateLimit: 'auth', permission: 'canManageReservations' },
  async (req, ctx, rawParams: { code: string }) => {
    const { code } = parseParams(rawParams, paramsSchema);
    const b = await parseBody(req, bodySchema);

    // رزرو باید به همین رستوران (tenant احرازشده) تعلق داشته باشد.
    const resv = await db.reservation.findUnique({
      where: { code },
      select: { id: true, restaurantId: true },
    });
    if (!resv || resv.restaurantId !== ctx.restaurant.id) throw Err.notFound('رزرو');

    const result = await transitionReservation({
      reservationId: resv.id,
      to: b.status as RStatus,
      actor: `staff:${ctx.auth.sub}`,
      reason: b.reason,
      isAutomatic: false,
    });
    return NextResponse.json(result);
  },
);
