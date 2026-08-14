import { NextResponse } from 'next/server';
import { markArrival } from '@/lib/reservations';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseParams, zReservationCode, z } from '@/lib/schemas';

const paramsSchema = z.object({ code: zReservationCode });

/**
 * POST — staff می‌زند «رسید» → وضعیت checked_in + امتیاز + SMS خوش‌آمد.
 * منطق در لایه‌ی سرویس (lib/reservations.ts → markArrival) است؛ این route لاغر است.
 *
 * ⚠️ رفع‌شده (بازبینیِ چرخه‌یِ حیات، ۲۰۲۶-۰۸-۱۳): قبلاً این route با
 * authFromRequest دستیِ سطحِ tenant نوشته شده بود — نه rate-limit داشت، نه
 * چکِ RBAC (permission)، و مالکیت رو فقط در سطحِ tenant می‌سنجید (نه
 * restaurant) — یعنی در یک tenant با چند شعبه، پرسنلِ شعبه‌یِ A می‌تونست
 * برایِ رزروِ شعبه‌یِ B «رسید» بزنه. این دقیقاً همون کلاسِ باگی بود که برایِ
 * routeِ خواهرِ .../status (H6) قبلاً رفع شده بود. حالا از همون wrapperِ
 * مشترک (withRestaurantAuth) استفاده می‌کنه: rate-limit + RBAC
 * (canManageReservations) + resolveStaffRestaurant (قفلِ شعبه‌ای).
 */
export const POST = withRestaurantAuth(
  { rateLimit: 'auth', permission: 'canManageReservations' },
  async (req, ctx, rawParams: { code: string }) => {
    if (!rawParams) throw Err.validation('کد رزرو الزامی است');
    const { code } = parseParams(rawParams, paramsSchema);
    const result = await markArrival({ code, restaurantId: ctx.restaurant.id, actorStaffId: ctx.auth.sub });
    return NextResponse.json(result);
  },
);
