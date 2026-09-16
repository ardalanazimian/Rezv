import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { dbRead as db } from '@/lib/db';
import { Err, errorResponse } from '@/lib/errors';
import { STRIKE_DECAY_PERIOD_DAYS } from '@/lib/economy';
import { CASHBACK_REVERSAL_KEY_PREFIX } from '@/lib/loyalty';

import { withApiMetrics } from '@/lib/api-metrics';

type NoShowOutcome = {
  recordedAt: string | null;
  byRestaurant: boolean;
  cashbackReversedPoints: number;
  strikeRecorded: boolean;
  strikeDecayDays: number;
};

/**
 * واقعیت‌های ثبت‌شده‌ی هر عدم‌حضور — تا اپ همان چیزی را بگوید که سرور کرد (STATE M-15).
 *
 * چرا: پیامکِ `booking_noshow` می‌گفت «عدم حضور ثبت شد» و کارتِ اپ «لغوشده»، در حالی که
 * همان انتقال کش‌بک را برگردانده و strike ثبت کرده بود. هر فیلد از منبعِ اجرایی‌اش خوانده
 * می‌شود، نه از قاعده‌ای که کلاینت حدس بزند:
 *   recordedAt/byRestaurant ← `reservation_events` (toStatus = no_show)
 *   cashbackReversedPoints  ← ردیفِ جبرانیِ `points_ledger` (`reverseReservationCashback`)
 *   strikeRecorded          ← `economy_ledger_entries` (source = reservation_no_show)
 * سه کوئریِ `IN` روی حداکثر ۵۰ ردیف، و فقط وقتی دست‌کم یک no_show هست.
 */
async function noShowOutcomes(ids: string[]): Promise<Map<string, NoShowOutcome>> {
  const out = new Map<string, NoShowOutcome>();
  if (!ids.length) return out;
  const [events, reversals, strikes] = await Promise.all([
    db.reservationEvent.findMany({
      where: { reservationId: { in: ids }, toStatus: 'no_show' },
      orderBy: { createdAt: 'asc' },
      select: { reservationId: true, createdAt: true, actor: true },
    }),
    db.pointsLedger.findMany({
      where: { idempotencyKey: { in: ids.map((id) => `${CASHBACK_REVERSAL_KEY_PREFIX}${id}`) } },
      select: { idempotencyKey: true, delta: true },
    }),
    db.economyLedgerEntry.findMany({
      where: { reservationId: { in: ids }, kind: 'reliability_event', source: 'reservation_no_show' },
      select: { reservationId: true },
    }),
  ]);
  const struck = new Set(strikes.map((s) => s.reservationId));
  const reversed = new Map(reversals.map((x) => [x.idempotencyKey, Math.abs(x.delta)]));
  for (const id of ids) {
    const ev = events.find((e) => e.reservationId === id);
    out.set(id, {
      recordedAt: ev ? ev.createdAt.toISOString() : null,
      byRestaurant: ev ? ev.actor.startsWith('staff:') : false,
      cashbackReversedPoints: reversed.get(`${CASHBACK_REVERSAL_KEY_PREFIX}${id}`) ?? 0,
      strikeRecorded: struck.has(id),
      strikeDecayDays: STRIKE_DECAY_PERIOD_DAYS,
    });
  }
  return out;
}

/** GET — تاریخچه برای «رزرو مجدد» */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const list = await db.reservation.findMany({
      where: { userId: auth.sub },
      orderBy: { slotStart: 'desc' },
      take: 50,
      include: {
        restaurant: {
          select: {
            name: true, slug: true,
            cancellationPolicy: { select: { freeCancelHours: true } },
          },
        },
        items: { include: { menuItem: { select: { name: true } } } },
      },
    });
    // ⚠️ قراردادِ این route یک **آرایه‌ی خامِ ردیف‌های Prisma** است (نه `{items}`)
    // و چند تستِ E2E همان را پین کرده‌اند — پس فقط فیلد اضافه می‌شود، شکل نه.
    // `slotStart` از قبل با spread می‌آید و کلاینت برایِ محاسبه‌ی «دیرهنگام
    // بودنِ لغو» به آن نیاز دارد.
    //
    // چرا `freeCancelHours` این‌جا مسطح می‌شود و پیش‌فرضش سمتِ سرور است:
    // پنجره‌ی لغو یک قاعده‌ی **اجراشونده** است (economy.ts:111 امتیاز و strike
    // را از رویش می‌سازد). اگر کلاینت پیش‌فرضِ خودش را داشته باشد، روزی که
    // سرور عوض شود کلاینت عددِ کهنه را به مهمان نشان می‌دهد — یعنی همان
    // «جریمه‌ی اعلام‌نشده» از یک مسیرِ تازه. عددِ ۲۴ عمداً با
    // `economy.ts:154` و `restaurants/[slug]/route.ts:135` یکی است.
    //
    // `noShow` برای **همه‌ی** ردیف‌ها حاضر است (null برای غیرِ no_show) تا نبودنِ فیلد
    // هرگز با «عدم‌حضوری نبوده» یکی خوانده نشود.
    const outcomes = await noShowOutcomes(list.filter((r) => r.status === 'no_show').map((r) => r.id));
    return NextResponse.json(list.map(r => ({
      ...r,
      restaurant: r.restaurant && {
        name: r.restaurant.name,
        slug: r.restaurant.slug,
        freeCancelHours: r.restaurant.cancellationPolicy?.freeCancelHours ?? 24,
      },
      noShow: outcomes.get(r.id) ?? null,
    })));
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/reservations', GET_impl);
