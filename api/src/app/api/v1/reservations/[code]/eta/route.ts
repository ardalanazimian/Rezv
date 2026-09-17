import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zReservationCode, z } from '@/lib/schemas';
import { audit } from '@/lib/audit';
import {
  AWAITING_GUEST_STATUSES, LATE_EXTENSION_MINUTES_MAX, grantedExtension, guestDeadline,
} from '@/lib/late-arrival';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ code: zReservationCode });
const bodySchema = z.object({ minutes: z.number().int().min(1).max(LATE_EXTENSION_MINUTES_MAX) });

/**
 * POST /api/v1/reservations/:code/eta — «دیرتر می‌رسم» (STATE M-13 · F001 · حکمِ CEO D-20).
 * بدنه: { minutes } (۱..۳۰). پاسخ: { code, extension_minutes, capped, deadline }.
 *
 * چرا: مهمانِ دیرکرده هیچ راهی نداشت به رستوران بگوید در راه است — نه دکمه، نه route، نه شماره‌ی
 * رستوران (مدلِ Restaurant فیلدِ تلفن ندارد) — و cron پس از ۱۵ دقیقه بی‌بازگشت no_showش می‌کرد.
 *
 * قواعد (هر کدام با تست):
 *  • فقط `kind === 'customer'` — توکنِ پرسنل و ادمینِ پلتفرم (هر دو `kind: 'staff'`) رد می‌شوند؛
 *    درسِ V5: بررسیِ نوع صریح است، نه «هر چیزی که staff نیست».
 *  • رزرو باید مالِ همان کاربر باشد — کدِ رزرو نیمه‌محرمانه است، نه مجوز.
 *  • یک‌بار برای هر رزرو، فقط پیش از `guestDeadline`، فقط وقتی رزرو هنوز منتظرِ مهمان است.
 *  • تمدید = min(درخواست، سقفِ رستوران ۰..۳۰). سقفِ ۰ مجاز است (D-18): سیگنال ثبت می‌شود، تمدید ۰.
 *  • خودِ سیگنال یعنی مهمان **می‌داند** — `late_warned_at` اگر خالی است همین لحظه ست می‌شود.
 *  • ثبت با `audit(...)`، نه `reservation_events`: آن جدول دفترِ انتقالِ وضعیت و زیرلایه‌ی ML است
 *    (مهاجرتِ ۰۸۲) و این سیگنال وضعیتی را عوض نمی‌کند.
 */
async function POST_impl(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden('فقط خودِ مهمان می‌تواند خبر بدهد');
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { code } = parseParams(await params, paramsSchema);
    const { minutes } = await parseBody(req, bodySchema);

    const resv = await db.reservation.findUnique({
      where: { code },
      select: {
        id: true, userId: true, restaurantId: true, status: true, slotStart: true,
        lateExtensionMinutes: true, lateEtaSignaledAt: true,
        restaurant: { select: { lateGraceMinutes: true, maxLateExtensionMinutes: true } },
      },
    });
    if (!resv) throw Err.notFound('رزرو');
    if (resv.userId !== auth.sub) throw Err.forbidden('این رزرو مالِ تو نیست');
    if (!(AWAITING_GUEST_STATUSES as readonly string[]).includes(resv.status)) {
      throw Err.lateSignalClosed('not_awaiting_guest');
    }
    if (resv.lateEtaSignaledAt) throw Err.lateSignalAlreadySent();
    const grace = resv.restaurant.lateGraceMinutes;
    if (Date.now() >= guestDeadline(resv, grace).getTime()) throw Err.lateSignalClosed('deadline_passed');

    const cap = resv.restaurant.maxLateExtensionMinutes;
    const extension = grantedExtension(minutes, cap);
    const now = new Date();

    // یک دستورِ اتمیک: «یک‌بار» و «هنوز منتظرِ مهمان» در WHERE، پس دو درخواستِ هم‌زمان دو تمدید نمی‌سازند.
    const claimed = await db.$executeRaw`
      UPDATE reservations
      SET late_eta_signaled_at = ${now},
          late_extension_minutes = ${extension},
          late_warned_at = COALESCE(late_warned_at, ${now})
      WHERE id = ${resv.id}::uuid
        AND late_eta_signaled_at IS NULL
        AND status::text = ANY(${[...AWAITING_GUEST_STATUSES]}::text[])`;
    if (claimed === 0) throw Err.lateSignalAlreadySent();

    const deadline = guestDeadline({ slotStart: resv.slotStart, lateExtensionMinutes: extension }, grace);
    await audit({
      action: 'reservation.late_signal', actorId: auth.sub, actorType: 'customer',
      targetId: resv.id, restaurantId: resv.restaurantId, ip: clientIp(req),
      detail: { code, requested_minutes: minutes, granted_minutes: extension, cap, deadline: deadline.toISOString() },
    });

    return NextResponse.json({
      code,
      extension_minutes: extension,
      capped: extension < minutes,
      deadline: deadline.toISOString(),
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
export const POST = withApiMetrics('/api/v1/reservations/[code]/eta', POST_impl);
