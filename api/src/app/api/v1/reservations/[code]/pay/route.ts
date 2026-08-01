import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { requestPayment } from '@/lib/zarinpal';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, zReservationCode, z } from '@/lib/schemas';

// ⚠️ همگام‌سازی‌شده با DB زنده (migration 019_payments_deposit).
// این روت قبلاً اصلاً وجود نداشت — جدول payments و فیلدهای deposit_* روی DB
// بودند ولی هیچ endpointـی برای شروعِ واقعیِ پرداخت نبود.

const paramsSchema = z.object({ code: zReservationCode });

/** POST /api/v1/reservations/:code/pay — شروعِ پرداختِ بیعانه؛ خروجی: آدرسِ ریدایرکت به درگاه */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const auth = authFromRequest(req);
    const { code } = parseParams(await params, paramsSchema);

    const resv = await db.reservation.findUnique({
      where: { code },
      select: {
        id: true, userId: true, guestPhone: true, partySize: true,
        depositRequested: true, depositAmountToman: true, depositStatus: true,
        restaurant: { select: { name: true, paymentEnabled: true } },
      },
    });
    if (!resv) throw Err.notFound('رزرو');

    // مجوز: فقط مشتریِ صاحبِ رزرو (رزروهای دستیِ staff فعلاً از این مسیر پرداخت نمی‌شوند)
    if (auth.kind !== 'customer' || resv.userId !== auth.sub) throw Err.forbidden();

    if (!resv.restaurant.paymentEnabled) throw Err.validation('پرداخت آنلاین برای این رستوران فعال نیست');
    if (!resv.depositRequested || !resv.depositAmountToman) throw Err.validation('این رزرو نیازی به بیعانه ندارد');
    if (resv.depositStatus === 'paid') throw Err.validation('بیعانه‌ی این رزرو قبلاً پرداخت شده است');

    const callbackUrl = new URL('/api/v1/payments/callback', req.url);
    callbackUrl.searchParams.set('code', code);

    const { authority, redirectUrl } = await requestPayment({
      amountToman: resv.depositAmountToman,
      description: `بیعانه‌ی رزرو ${code} — ${resv.restaurant.name}`,
      callbackUrl: callbackUrl.toString(),
      mobile: resv.guestPhone ?? undefined,
    });

    await db.$transaction([
      db.payment.create({
        data: { reservationId: resv.id, authority, amountToman: resv.depositAmountToman, status: 'pending' },
      }),
      db.reservation.update({ where: { id: resv.id }, data: { depositStatus: 'pending' } }),
    ]);

    return NextResponse.json({ redirect_url: redirectUrl });
  } catch (e) { return errorResponse(e); }
}
