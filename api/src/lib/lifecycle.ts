import { db } from './db';
import { invalidateAvailability } from './availability-cache';
import { Err } from './errors';
import { enqueueSms, type SmsJob } from './sms';
import { processReservationEconomyEvent } from './economy';
import { recordOutcome, noShowOutcomeLabel } from './prediction-ledger';
import { createLogger } from './logger';
import { dateKeyInTz } from './hours';

const log = createLogger('lifecycle');

// ═══════════════════════════════════════════════════════════
//  چرخه‌ی حیات رزرو رزرونو — state machine + اعلان + audit log
//
//  این سرویس تنها نقطه‌ی مجاز تغییر وضعیت رزرو است.
//  هر تغییر: (۱) اعتبارسنجی انتقال، (۲) ثبت در audit log،
//  (۳) ارسال اعلان مرتبط (SMS)، همه اتمیک در یک transaction.
// ═══════════════════════════════════════════════════════════

export type RStatus =
  | 'pending' | 'waitlisted' | 'confirmed' | 'auto_confirmed'
  | 'preparing' | 'checked_in' | 'running_late' | 'seated'
  | 'dining' | 'completed' | 'no_show' | 'rejected'
  | 'expired' | 'cancelled' | 'auto_cancelled'
  // قدیمی (سازگاری):
  | 'arrived' | 'cancelled_by_user' | 'cancelled_by_restaurant';

export type Actor = string; // 'system' | 'customer' | 'staff:{id}' | 'cron'

// ── انتقال‌های مجاز چرخه‌ی حیات (state machine) ──
// کلید = وضعیت فعلی، مقدار = وضعیت‌های مجاز بعدی.
const TRANSITIONS: Record<string, RStatus[]> = {
  pending:        ['confirmed', 'auto_confirmed', 'waitlisted', 'rejected', 'cancelled', 'auto_cancelled', 'expired'],
  waitlisted:     ['confirmed', 'auto_confirmed', 'cancelled', 'auto_cancelled', 'expired'],
  confirmed:      ['preparing', 'checked_in', 'running_late', 'no_show', 'cancelled', 'auto_cancelled'],
  auto_confirmed: ['preparing', 'checked_in', 'running_late', 'no_show', 'cancelled', 'auto_cancelled'],
  preparing:      ['checked_in', 'running_late', 'no_show', 'cancelled'],
  checked_in:     ['seated', 'cancelled'],
  running_late:   ['checked_in', 'seated', 'no_show', 'cancelled'],
  seated:         ['dining', 'completed', 'cancelled'],
  dining:         ['completed'],
  // وضعیت‌های پایانی (terminal) — خروج ندارند:
  completed:      [],
  no_show:        [],
  rejected:       [],
  expired:        [],
  cancelled:      [],
  auto_cancelled: [],
  // قدیمی → معادل جدید:
  arrived:        ['seated', 'cancelled'],
  cancelled_by_user: [],
  cancelled_by_restaurant: [],
};

// ── اعلان مرتبط با هر وضعیت (قالب SMS) — null یعنی اعلانی ندارد ──
const NOTIFY: Partial<Record<RStatus, { template: SmsJob['template']; label: string }>> = {
  confirmed:      { template: 'booking_confirm', label: 'رزرو شما تأیید شد' },
  auto_confirmed: { template: 'booking_confirm', label: 'رزرو شما تأیید شد' },
  waitlisted:     { template: 'booking_waitlist', label: 'در لیست انتظار قرار گرفتید' },
  preparing:      { template: 'booking_preparing', label: 'میز شما در حال آماده‌سازی است' },
  rejected:       { template: 'booking_rejected', label: 'متأسفانه رزرو شما تأیید نشد' },
  cancelled:      { template: 'booking_cancelled', label: 'رزرو شما لغو شد' },
  auto_cancelled: { template: 'booking_cancelled', label: 'رزرو شما لغو شد' },
  no_show:        { template: 'booking_noshow', label: 'عدم حضور ثبت شد' },
  completed:      { template: 'booking_thanks', label: 'از حضور شما متشکریم' },
};

/** آیا انتقال از from به to مجاز است؟ */
export function canTransition(from: RStatus, to: RStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * تغییر وضعیت رزرو — تنها نقطه‌ی مجاز.
 * اعتبارسنجی + audit log + اعلان، همه اتمیک.
 */
export async function transitionReservation(opts: {
  reservationId: string;
  to: RStatus;
  actor: Actor;
  reason?: string;
  isAutomatic?: boolean;
  notify?: boolean; // پیش‌فرض true
}): Promise<{ id: string; status: RStatus }> {
  const { reservationId, to, actor, reason, isAutomatic = false, notify = true } = opts;

  const result = await db.$transaction(async (tx) => {
    const resv = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { restaurant: { select: { timezone: true } } },
    });
    if (!resv) throw Err.notFound('رزرو');
    const from = resv.status as RStatus;
    const timezone = resv.restaurant.timezone ?? 'Asia/Tehran';

    if (from === to) return { resv, changed: false, from, timezone };
    if (!canTransition(from, to)) throw Err.invalidTransition(from, to);

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: to as any },
    });

    // ثبت در audit log
    await tx.reservationEvent.create({
      data: {
        reservationId,
        fromStatus: from as any,
        toStatus: to as any,
        actor,
        reason: reason ?? null,
        isAutomatic,
      },
    });

    return { resv: updated, changed: true, from, timezone };
  });

  // بعد از commit: اقتصادِ یکپارچه‌ی مشتری (economy.ts) — دقیقاً همون الگویِ
  // enqueueSms زیر: هیچ‌وقت نباید جریانِ اصلیِ تغییرِ وضعیت رو بشکنه، پس
  // خارج از تراکنش و با catch صدا زده می‌شه.
  if (result.changed) {
    await processReservationEconomyEvent({
      reservationId: result.resv.id,
      restaurantId: result.resv.restaurantId,
      userId: result.resv.userId,
      guestPhone: result.resv.guestPhone,
      fromStatus: result.from,
      toStatus: result.resv.status,
      actor,
      slotStart: result.resv.slotStart,
    }).catch((e) => {
      log.error('پردازشِ اقتصادِ مشتری ناموفق (رزرو خودش commit شد)', {
        reservationId: result.resv.id, error: (e as Error).message,
      });
    });
  }

  // ── دفترِ نتیجه: واقعیت، کنارِ پیش‌بینی‌ای که قبلاً ثبت شده بود ──
  //
  // این‌جا تنها نقطه‌ی مجازِ تغییرِ وضعیتِ رزرو در کلِ سیستم است، پس تنها
  // جایی‌ست که می‌شود مطمئن بود هیچ نتیجه‌ای از قلم نمی‌افتد — چه انتقال از
  // پنلِ رستوران آمده باشد، چه از cronِ markLateNoShows، چه از API مشتری.
  //
  // فقط وضعیت‌های پایانیِ *معنادار برای مدلِ no-show* برچسب می‌گیرند
  // (noShowOutcomeLabel تصمیم می‌گیرد؛ لغو/انقضا برچسب نمی‌گیرند چون مدل
  // درباره‌شان ادعایی نکرده بود). بدونِ await و با catch — مثلِ economy و
  // SMS بالا، ثبتِ تحلیلی هرگز نباید تغییرِ وضعیت را بشکند.
  if (result.changed) {
    const label = noShowOutcomeLabel(result.resv.status);
    if (label !== null) {
      void recordOutcome({
        restaurantId: result.resv.restaurantId,
        predictionType: 'no_show',
        subjectType: 'reservation',
        subjectId: result.resv.id,
        outcomeLabel: label,
        outcomeStatus: result.resv.status,
      });
    }
  }

  // بعد از commit: اعلان (خارج از transaction تا تراکنش را کند نکند)
  if (result.changed && notify) {
    const n = NOTIFY[to];
    if (n && result.resv.guestPhone) {
      await enqueueSms({
        to: result.resv.guestPhone,
        template: n.template,
        tokens: [result.resv.guestName ?? 'مهمان', result.resv.code, n.label],
        restaurantId: result.resv.restaurantId,  // C6: کسر از موجودی SMS رستوران
      }).catch(() => { /* اعلان نباید جریان اصلی را بشکند */ });
    }
    // باطل‌کردن کش availability اگر وضعیت روی ظرفیت اثر دارد (H3: pattern-based)
    if (['cancelled', 'auto_cancelled', 'rejected', 'expired', 'no_show', 'completed'].includes(to)) {
      // کلیدِ کش با تاریخِ محلیِ رستوران ساخته می‌شه (نه UTC) — وگرنه نزدیکِ
      // نیمه‌شبِ تهران، باطل‌سازی روی کلیدِ اشتباه می‌زد و کش واقعی دست‌نخورده می‌موند.
      const dateKey = dateKeyInTz(result.resv.slotStart, result.timezone);
      await invalidateAvailability(result.resv.restaurantId, dateKey).catch(() => {});
    }
  }

  return { id: result.resv.id, status: result.resv.status as RStatus };
}

// ═══════════════════════════════════════════════════════════
//  انتقال‌های خودکار (توسط cron/کارگر پس‌زمینه)
// ═══════════════════════════════════════════════════════════

/**
 * علامت‌گذاری خودکار «دیرکرده» (running_late):
 * رزروهای confirmed/auto_confirmed که زمان شروعشان گذشته ولی هنوز check-in نکرده‌اند.
 */
export async function autoMarkRunningLate(restaurantId: string): Promise<number> {
  const now = new Date();
  const due = await db.reservation.findMany({
    where: {
      restaurantId,
      status: { in: ['confirmed', 'auto_confirmed', 'preparing'] },
      slotStart: { lt: now },
    },
    select: { id: true },
  });
  let n = 0;
  for (const r of due) {
    try {
      await transitionReservation({ reservationId: r.id, to: 'running_late', actor: 'cron', isAutomatic: true });
      n++;
    } catch { /* انتقال نامعتبر را رد کن */ }
  }
  return n;
}

/**
 * علامت‌گذاری خودکار «عدم حضور» (no_show):
 * رزروهای running_late که از مهلت تأخیر (lateGraceMinutes) هم گذشته‌اند.
 */
export async function autoMarkNoShow(restaurantId: string): Promise<number> {
  const r = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { lateGraceMinutes: true } });
  const grace = r?.lateGraceMinutes ?? 15;
  const cutoff = new Date(Date.now() - grace * 60_000);
  const due = await db.reservation.findMany({
    where: { restaurantId, status: 'running_late', slotStart: { lt: cutoff } },
    select: { id: true },
  });
  let n = 0;
  for (const x of due) {
    try {
      await transitionReservation({ reservationId: x.id, to: 'no_show', actor: 'cron', isAutomatic: true });
      n++;
    } catch { /* */ }
  }
  return n;
}

/**
 * تکمیل خودکار (completed):
 * رزروهای seated/dining که زمان پایانشان (slotEnd) گذشته.
 */
export async function autoComplete(restaurantId: string): Promise<number> {
  const now = new Date();
  const due = await db.reservation.findMany({
    where: { restaurantId, status: { in: ['seated', 'dining'] }, slotEnd: { lt: now } },
    select: { id: true },
  });
  let n = 0;
  for (const x of due) {
    try {
      await transitionReservation({ reservationId: x.id, to: 'completed', actor: 'cron', isAutomatic: true });
      n++;
    } catch { /* */ }
  }
  return n;
}

/** خواندن تاریخچه‌ی رویدادهای یک رزرو (audit log). */
export async function getReservationEvents(reservationId: string) {
  return db.reservationEvent.findMany({
    where: { reservationId },
    orderBy: { createdAt: 'asc' },
  });
}
