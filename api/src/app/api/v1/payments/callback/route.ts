import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPayment } from '@/lib/zarinpal';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { createLogger } from '@/lib/logger';
import { ApiError } from '@/lib/errors';
import { parseQuery, zReservationCode, z } from '@/lib/schemas';
import { appBase } from '@/lib/public-urls';

const log = createLogger('payments-callback');

// ⚠️ همگام‌سازی‌شده با DB زنده (migration 019_payments_deposit).
//
// این endpoint را مرورگرِ کاربر (نه فرانتِ ما با fetch) بعد از پرداخت در درگاه
// صدا می‌زند؛ یعنی auth ندارد (کاربر توکن API را در این لحظه در دسترس مرورگر
// ندارد) — امنیت از طریق تطبیقِ authority+reservation code+amount تأمین می‌شود،
// نه توکن. در انتها کاربر به اپِ مشتری ریدایرکت می‌شود.

const querySchema = z.object({
  code: zReservationCode,
  Authority: z.string().min(1).max(100),
  Status: z.enum(['OK', 'NOK']),
});

function redirectToApp(code: string, payment: 'paid' | 'failed'): NextResponse {
  return NextResponse.redirect(`${appBase()}/reservations/${code}?payment=${payment}`, 302);
}

function redirectToError(reason: string): NextResponse {
  return NextResponse.redirect(`${appBase()}/?payment=${reason}`, 302);
}

export async function GET(req: Request) {
  try {
    // رفعِ باگ: قبلاً .catch(()=>{}) خطای rate-limit-exceeded را هم بی‌صدا می‌بلعید
    // (یعنی rate-limit روی این endpoint عملاً هیچ اثری نداشت).
    await enforceRateLimit(clientIp(req), RULES.search);

    let parsed: { code: string; Authority: string; Status: 'OK' | 'NOK' };
    try {
      parsed = parseQuery(req, querySchema);
    } catch {
      return redirectToError('invalid');
    }
    const { code, Authority: authority, Status: status } = parsed;

    const payment = await db.payment.findUnique({
      where: { authority },
      select: { id: true, amountToman: true, status: true, reservationId: true, reservation: { select: { code: true } } },
    });
    if (!payment || payment.reservation.code !== code) {
      log.warn('callback با authority/code نامنطبق یا ناموجود', { code, authority });
      return redirectToApp(code, 'failed');
    }
    if (payment.status === 'success') {
      // idempotent: کاربر رفرش کرده یا دوبار callback آمده
      return redirectToApp(code, 'paid');
    }

    if (status !== 'OK') {
      // کاربر در درگاه انصراف داد — طبق مستندات زرین‌پال، verify نباید صدا زده شود
      await db.$transaction([
        db.payment.update({ where: { id: payment.id }, data: { status: 'failed', failReason: 'کاربر در درگاه انصراف داد' } }),
        db.reservation.update({ where: { id: payment.reservationId }, data: { depositStatus: 'failed' } }),
      ]);
      return redirectToApp(code, 'failed');
    }

    const result = await verifyPayment({ authority, amountToman: payment.amountToman });
    if (result.success) {
      await db.$transaction([
        db.payment.update({
          where: { id: payment.id },
          data: { status: 'success', refId: result.refId, verifiedAt: new Date() },
        }),
        db.reservation.update({ where: { id: payment.reservationId }, data: { depositStatus: 'paid' } }),
      ]);
      return redirectToApp(code, 'paid');
    }

    await db.$transaction([
      db.payment.update({ where: { id: payment.id }, data: { status: 'failed', failReason: 'تأیید زرین‌پال ناموفق بود' } }),
      db.reservation.update({ where: { id: payment.reservationId }, data: { depositStatus: 'failed' } }),
    ]);
    return redirectToApp(code, 'failed');
  } catch (e) {
    if (e instanceof ApiError && e.code === 'RATE_LIMITED') {
      return redirectToError('rate_limited');
    }
    log.error('خطای غیرمنتظره در callback پرداخت', e);
    return redirectToError('error');
  }
}
