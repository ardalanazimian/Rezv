import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { assertUserNotBanned } from '@/lib/ban';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { ApiError, Err, errorResponse } from '@/lib/errors';
import { parseBody, zUuid, z } from '@/lib/schemas';

// نمره‌ی ۱ تا ۵ — هم‌راستا با ستون‌های rating/food_rating/... در جدولِ reviews (SmallInt).
const zStars = z.number().int().min(1).max(5);

const bodySchema = z.object({
  restaurant_id: zUuid,
  reservation_id: zUuid.optional(),
  rating: zStars,
  food_rating: zStars.optional(),
  service_rating: zStars.optional(),
  atmosphere_rating: zStars.optional(),
  body: z.string().max(1000).trim().optional(),
});

/**
 * POST /api/v1/me/reviews — ثبتِ نظرِ مشتری برایِ یک رستوران (فقط با JWTِ مشتری).
 *
 * قانونِ کسب‌وکار (ضدِ نظرِ ساختگی/بدونِ بازدید): نظر فقط بعد از یک رزروِ واقعاً
 * «انجام‌شده» (status='completed') از همین کاربر در همین رستوران پذیرفته می‌شود:
 *   • اگر reservation_id داده شده: باید متعلق به همین کاربر/رستوران و completed
 *     باشد، و قبلاً برایش نظری ثبت نشده باشد (یک نظر به‌ازای هر رزرو).
 *   • اگر داده نشده: آخرین رزروِ completedِ همین کاربر در این رستوران که هنوز
 *     نظر نگرفته پیدا و به آن وصل می‌شود؛ اگر چنین رزروی نبود، رد می‌شود
 *     (نه سکوت، نه نظرِ بی‌ارجاع).
 *
 * یکتاییِ «یک نظر برای هر رزرو» در سطحِ اپلیکیشن چک می‌شود (نه constraint دیتابیس)؛
 * پنجره‌ی رقابتِ هم‌زمان برایِ این فیچرِ کم‌خطر (غیرِمالی) قابل‌قبول است.
 */
export async function POST(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await assertUserNotBanned(auth.sub); // ⚠️ رفع‌شده: قبلاً اینجا چک نمی‌شد
    await enforceRateLimit(clientIp(req), RULES.auth);
    const b = await parseBody(req, bodySchema);

    const restaurant = await db.restaurant.findUnique({ where: { id: b.restaurant_id }, select: { id: true } });
    if (!restaurant) throw Err.notFound('رستوران');

    let reservationId: string;
    if (b.reservation_id) {
      const reservation = await db.reservation.findUnique({
        where: { id: b.reservation_id },
        select: { id: true, userId: true, restaurantId: true, status: true },
      });
      if (!reservation || reservation.userId !== auth.sub || reservation.restaurantId !== b.restaurant_id) {
        throw Err.notFound('رزرو');
      }
      if (reservation.status !== 'completed') {
        throw Err.validation('فقط بعد از انجام‌شدنِ رزرو می‌تونی نظر بدی');
      }
      const already = await db.review.findFirst({ where: { reservationId: reservation.id }, select: { id: true } });
      if (already) throw new ApiError('ALREADY_REVIEWED', 'برایِ این رزرو قبلاً نظر ثبت شده', 409);
      reservationId = reservation.id;
    } else {
      // بدونِ ارجاعِ صریح: آخرین بازدیدِ completedِ همین کاربر در این رستوران که هنوز نظر نگرفته
      const reservation = await db.reservation.findFirst({
        where: { userId: auth.sub, restaurantId: b.restaurant_id, status: 'completed', reviews: { none: {} } },
        orderBy: { slotStart: 'desc' },
        select: { id: true },
      });
      if (!reservation) {
        throw Err.validation('برایِ ثبتِ نظر باید حداقل یک بازدیدِ تکمیل‌شده و بدونِ نظرِ قبلی در این رستوران داشته باشی');
      }
      reservationId = reservation.id;
    }

    const review = await db.review.create({
      data: {
        restaurantId: b.restaurant_id,
        userId: auth.sub,
        reservationId,
        rating: b.rating,
        foodRating: b.food_rating ?? null,
        serviceRating: b.service_rating ?? null,
        atmosphereRating: b.atmosphere_rating ?? null,
        body: b.body || null,
      },
      select: { id: true, rating: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, review }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
