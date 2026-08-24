// ═══════════════════════════════════════════════════════════
//  Reservation Lifecycle Ops — عملیاتِ پس‌زمینه‌ی چرخه‌ی حیاتِ رزرو
//
//  جدا از reservation-engine (نوشتنِ رزرو) چون این‌ها cron/maintenance اند،
//  نه بخشی از تراکنشِ رزرو. جداسازی برای خوانایی و کاهشِ merge-conflict در تیم.
//
//   • expireStaleHolds — هولدهای pending منقضی‌شده → expired (آزادسازیِ میز)
//   • markLateNoShows  — مهمانِ دیرکرده → no_show (از طریق state machine)
// ═══════════════════════════════════════════════════════════
import { db } from './db';
import { invalidateAvailability } from './availability-cache';
import { dateKeyInTz } from './hours';
import { transitionReservation } from './lifecycle';
import { createLogger } from './logger';

const log = createLogger('reservation-lifecycle-ops');

/**
 * هولدهای pending که مهلتشان گذشته → expired.
 *
 * قبلاً با یک updateMany مستقیم انجام می‌شد — یعنی نه reservation_event
 * (audit) ثبت می‌شد، نه فرآیندِ اقتصاد/اعلانِ لایه‌ی lifecycle اجرا می‌شد،
 * و state machine (TRANSITIONS) کاملاً دور زده می‌شد. حالا هر ردیف از
 * طریقِ transitionReservation (تنها نویسنده‌ی مجازِ وضعیتِ رزرو) منتقل
 * می‌شه؛ انتقالِ نامعتبر (اگر بینِ خواندنِ لیست و اجرا وضعیتِ رزرو عوض شده
 * باشه) امن رد می‌شه، نه کرش.
 */
export async function expireStaleHolds(): Promise<number> {
  const stale = await db.reservation.findMany({
    where: { status: 'pending', holdExpiresAt: { lt: new Date() } },
    select: { id: true, restaurantId: true, slotStart: true },
  });
  if (stale.length === 0) return 0;

  // تایم‌زونِ رستوران‌هایِ متأثر رو یک‌جا بگیر (نه یک کوئری به‌ازایِ هر رزرو).
  const restaurantIds = [...new Set(stale.map(s => s.restaurantId))];
  const restaurants = await db.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    select: { id: true, timezone: true },
  });
  const tzById = new Map(restaurants.map(r => [r.id, r.timezone ?? 'Asia/Tehran']));

  let count = 0;
  const seen = new Set<string>();
  for (const s of stale) {
    try {
      await transitionReservation({ reservationId: s.id, to: 'expired', actor: 'cron', isAutomatic: true });
      count++;
    } catch (e) {
      // انتقالِ نامعتبر (مثلاً بینِ خواندنِ لیست و اجرا، رزرو دستی cancel شده) — امن رد شو.
      log.warn('expireStaleHolds: انتقال ناموفق برایِ یک رزرو', { reservationId: s.id, error: (e as Error).message });
      continue;
    }
    // transitionReservation خودش برایِ وضعیت‌هایِ terminal (از جمله expired) کش رو
    // باطل می‌کنه — این خط اضافیه فقط برایِ محافظه‌کاری (اگر آینده notify:false
    // صدا زده بشه، این cron همچنان کش رو باطل کنه). تکراری بی‌ضرره (idempotent).
    const dateKey = dateKeyInTz(s.slotStart, tzById.get(s.restaurantId) ?? 'Asia/Tehran');
    const key = `${s.restaurantId}:${dateKey}`;
    if (!seen.has(key)) {
      seen.add(key);
      await invalidateAvailability(s.restaurantId, dateKey).catch(() => {});
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════════════
//  علامت‌زدن مهمانان دیرکرده به‌عنوان no_show (نیاز ۱۰)
//  رزروهایی که زمان شروع + مهلت تأخیر گذشته و هنوز نرسیده‌اند.
//
//  به‌جای updateMany مستقیم (که audit/notification را دور می‌زد)، هر رزرو
//  از طریق state machine چرخه‌ی حیات منتقل می‌شود تا رویداد audit ثبت و در صورت
//  لزوم اعلان ارسال شود. انتقال‌های نامعتبر امن نادیده گرفته می‌شوند.
// ═══════════════════════════════════════════════════════════
export async function markLateNoShows(restaurantId: string): Promise<number> {
  const r = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { lateGraceMinutes: true, timezone: true } });
  const grace = r?.lateGraceMinutes ?? 15;
  const timezone = r?.timezone ?? 'Asia/Tehran';
  const cutoff = new Date(Date.now() - grace * 60_000);
  const candidates = await db.reservation.findMany({
    where: {
      restaurantId,
      status: { in: ['pending', 'confirmed', 'auto_confirmed', 'running_late'] },
      slotStart: { lt: cutoff },
    },
    select: { id: true, slotStart: true },
  });
  if (candidates.length === 0) return 0;
  let count = 0;
  const seenDates = new Set<string>();
  for (const c of candidates) {
    try {
      await transitionReservation({ reservationId: c.id, to: 'no_show', actor: 'cron', isAutomatic: true });
      count++;
      // کلیدِ تاریخِ محلیِ رستوران (نه UTC) — همون رفعِ باگی که در lifecycle.ts انجام شد.
      const date = dateKeyInTz(c.slotStart, timezone);
      if (!seenDates.has(date)) { seenDates.add(date); await invalidateAvailability(restaurantId, date); }
    } catch {
      // انتقال نامعتبر (مثلاً قبلاً seated/completed شده) — امن رد شو.
    }
  }
  return count;
}
