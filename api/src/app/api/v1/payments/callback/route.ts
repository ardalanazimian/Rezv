import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPayment } from '@/lib/zarinpal';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { createLogger } from '@/lib/logger';
import { ApiError } from '@/lib/errors';
import { parseQuery, zReservationCode, z } from '@/lib/schemas';
import { appBase } from '@/lib/public-urls';

import { withApiMetrics } from '@/lib/api-metrics';

const log = createLogger('payments-callback');

// ⚠️ همگام‌سازی‌شده با DB زنده (migration 019_payments_deposit).
//
// این endpoint را مرورگرِ کاربر (نه فرانتِ ما با fetch) بعد از پرداخت در درگاه
// صدا می‌زند؛ یعنی auth ندارد (کاربر توکن API را در این لحظه در دسترس مرورگر
// ندارد) — امنیت از طریق تطبیقِ authority+reservation code+amount تأمین می‌شود،
// نه توکن. در انتها کاربر به اپِ مشتری ریدایرکت می‌شود.

// نشانه‌ی ماشین‌خوانِ «پولش گرفته شد ولی اعتبار داده نشد؛ باید عودت شود».
// عمداً پیشوندِ ثابت دارد تا با grep/کوئری روی `fail_reason` پیدا شود، و
// عمداً فارسی ادامه می‌دهد چون همین متن در پنل به اپراتور نشان داده می‌شود.
const REFUND_REQUIRED = 'REFUND_REQUIRED: پرداختِ تکراری — بیعانه‌ی این رزرو قبلاً پرداخت شده بود';

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

async function GET_impl(req: Request) {
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
      // ⚠️ باگِ رفع‌شده (کسرِ دوباره‌ی بیعانه): تنها خروجِ زودهنگامِ بالا
      // `payment.status === 'success'` بود — یعنی فقط *همین* authority. ولی
      // `reservations/[code]/pay` هر تلاشِ pendingِ قبلی را «جایگزین‌شده»
      // (failed) می‌کند و آن authorityِ کهنه در زرین‌پال همچنان قابلِ تکمیل
      // است. پس مسیرِ واقعی این بود: کاربر تلاشِ ۱ را باز می‌گذارد، تلاشِ ۲ را
      // می‌سازد و پرداخت می‌کند (رزرو `paid`)، بعد تلاشِ ۱ را هم تمام می‌کند —
      // این callback با یک ردیفِ `failed` می‌آمد، از خروجِ زودهنگام رد می‌شد،
      // verify می‌کرد و دوباره `depositStatus='paid'` می‌نوشت. نتیجه: دو
      // پرداختِ موفقِ واقعی برای یک رزرو، بدونِ هیچ ردی که بگوید کدام اضافه است.
      //
      // چرا تراکنشِ تعاملی و نه `$transaction([...])`ِ آرایه‌ای: تصمیم باید
      // *بعد از* خواندنِ وضعیتِ تازه گرفته شود. قفلِ ردیفِ رزرو (`FOR UPDATE`)
      // همان نقطه‌ی سریال‌سازیِ الگویِ `redeemPoints` در lib/loyalty.ts است —
      // دو callbackِ هم‌زمان (دو authority) پشتِ سرِ هم اجرا می‌شوند، نه موازی.
      const duplicate = await db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string; deposit_status: string }>>`
          SELECT id, deposit_status FROM reservations WHERE id = ${payment.reservationId}::uuid FOR UPDATE
        `;
        // ⚠️ رگرسیونِ بسته‌شده (۲۰۲۶-۰۹-۱۲، بازبینیِ همین شاخه): خروجِ
        // زودهنگامِ `payment.status === 'success'` بالا **بیرونِ قفل** است. دو
        // callbackِ هم‌زمان با **همان** authority (رفرشِ دوباره، پری‌فچِ
        // مرورگر، retryِ درگاه) هر دو آن را `pending` می‌بینند و هر دو verify
        // می‌کنند — و verifyِ دوم هم موفق است، چون زرین‌پال کدِ ۱۰۱
        // («قبلاً verify شده») را در `lib/zarinpal.ts` به `success` نگاشت
        // می‌کند. بعد برنده success+paid می‌نوشت و بازنده، که فقط
        // `deposit_status` را می‌دید، **ردیفِ خودش** را به `failed` +
        // REFUND_REQUIRED برمی‌گرداند: یک پرداختِ واقعیِ سالم، با آلارمِ
        // عودتِ دستی. پیش از پچِ ۰۰۰۵ این حالت بی‌ضرر بود (هر دو عیناً یک
        // چیز می‌نوشتند)، پس رگرسیونِ تازه بود نه باگِ قدیمی.
        //
        // بازخوانیِ خودِ ردیفِ پرداخت **داخلِ** قفل تفکیک را قطعی می‌کند:
        // اگر همین authority الان success است، این «پرداختِ تکراری» نیست —
        // همان یک پرداخت است که دو بار callback خورده.
        const fresh = await tx.payment.findUnique({
          where: { id: payment.id },
          select: { status: true },
        });
        if (fresh?.status === 'success') return false;

        if (locked[0]?.deposit_status === 'paid') {
          // ⚠️ اینجا پولِ واقعی از حسابِ کاربر کم شده و verify هم موفق بوده —
          // پس ردیف نباید بی‌صدا «ناموفق» شود. PaymentStatus مقدارِ «منتظرِ
          // عودت» ندارد (`pending|success|failed|refunded`) و `refunded` دروغ
          // است چون هنوز چیزی برنگشته؛ پس `failed` + نشانه‌ی ماشین‌خوان در
          // `failReason` (تنها فیلدِ متنِ آزادِ موجود) + `refId` که اپراتور
          // بدونش نمی‌تواند عودت بزند. مهاجرتِ تازه عمداً برایِ این حالت
          // ساخته نشد — رجوع کن به ۰۸۶ که وقوعِ *دومین* successـش را از اساس
          // غیرممکن می‌کند.
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'failed', refId: result.refId, verifiedAt: new Date(), failReason: REFUND_REQUIRED },
          });
          return true;
        }
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'success', refId: result.refId, verifiedAt: new Date() },
        });
        await tx.reservation.update({ where: { id: payment.reservationId }, data: { depositStatus: 'paid' } });
        return false;
      });
      if (duplicate) {
        // سطحِ error و نه warn: این یک وظیفه‌ی عملیاتیِ باز است (عودتِ دستی)،
        // نه یک رویدادِ گذرا. authority و refId هر دو لازم‌اند تا اپراتور
        // بتواند تراکنش را در پنلِ زرین‌پال پیدا و برگرداند.
        log.error('پرداختِ تکراریِ بیعانه — نیازِ عودتِ دستی', { code, authority, refId: result.refId });
      }
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

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/payments/callback', GET_impl);
