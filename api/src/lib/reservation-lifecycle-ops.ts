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
//  ⚠️ `markLateNoShows` در ۲۰۲۶-۰۸-۲۰ **حذف شد** — تله بود، نه کدِ مرده‌ی
//  بی‌ضرر.
//
//  یافته: صفر صداکننده داشت (grep در کلِ ریپو: فقط تعریفِ خودش، یک
//  re-export در reservations.ts، و بандلـهای build). مسیرِ واقعیِ تولید
//  `/api/v1/maintenance/lifecycle` است که `autoMarkNoShow` از `lifecycle.ts`
//  را صدا می‌زند، نه این را.
//
//  چرا حذف بهتر از نگه‌داشتن بود: این تابع همان کار را **متفاوت** انجام
//  می‌داد. `autoMarkNoShow` فقط `running_late` را no_show می‌کند، ولی این
//  یکی `confirmed`/`auto_confirmed` را هم مستقیم no_show می‌کرد. هر دو
//  انتقال طبقِ TRANSITIONS مجازند، پس اگر کسی روزی این را — به‌گمانِ
//  هم‌ارزی — به cron وصل می‌کرد، مهمان **بدونِ عبور از `running_late`**
//  غایب ثبت می‌شد: یعنی بدونِ هیچ اعلانِ «شما دیر کرده‌اید»، و با دور زدنِ
//  طراحیِ دومرحله‌ایِ مهلتِ تأخیر. یک باگِ خاموش که فقط با خواندنِ دقیقِ هر
//  دو تابع دیده می‌شد.
//
//  همان الگویِ `redeemCouponAtomic`/`redeemCoupon` (PR #46): تابعی که
//  زنده به‌نظر می‌رسد ولی صداکننده ندارد و رفتارش با مسیرِ واقعی فرق دارد.
//  مسیرِ دومرحله‌ای (running_late → no_show) حالا در
//  `tests/lifecycle-cron.integration.test.mts` قفل شده است.
// ═══════════════════════════════════════════════════════════
