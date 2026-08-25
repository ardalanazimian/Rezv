import { db } from './db';
import { invalidateAvailability } from './availability-cache';
import { Err } from './errors';
import { enqueueSms, type SmsJob } from './sms';
import { processReservationEconomyEvent } from './economy';
import { createLogger } from './logger';
import { dateKeyInTz } from './hours';
import { activeStatusList } from './reservation-status';
import { recordOutcome } from './prediction-ledger';

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
}): Promise<{ id: string; status: RStatus; changed: boolean }> {
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

    // ⚠️ رقابتِ «دو بار انتقال» (فازِ ۲ — با تستِ واقعی پیدا شد، نه فرض).
    //
    // خواندنِ بالا هیچ قفلی نمی‌گیرد. زیرِ READ COMMITTED دو فراخوانیِ هم‌زمان
    // هردو `from = 'confirmed'` می‌خواندند، هردو canTransition را رد می‌کردند،
    // و `update` بی‌قید هردو را می‌نوشت — یعنی هردو `changed: true` برمی‌گرداندند.
    // پیامد فقط یک ردیفِ اضافیِ audit نبود: هر عارضه‌ی «یک‌بارمصرف»ی که به
    // `changed` گره خورده (SMS، رویدادِ اقتصاد، امتیازِ باشگاه، آزادسازیِ میز)
    // دو بار اجرا می‌شد.
    //
    // راهِ حل بدونِ قفلِ صریح: compare-and-set. شرطِ `status: from` داخلِ خودِ
    // UPDATE می‌رود؛ Postgres در READ COMMITTED پشتِ قفلِ ردیف صبر می‌کند و پس
    // از commitِ رقیب شرط را رویِ نسخه‌ی *جدید* دوباره می‌سنجد — که دیگر
    // نمی‌خورد، پس count صفر می‌شود. بازنده صادقانه `changed: false` می‌گیرد.
    const claimed = await tx.reservation.updateMany({
      where: { id: reservationId, status: from as any },
      data: { status: to as any },
    });
    if (claimed.count === 0) {
      const current = await tx.reservation.findUnique({ where: { id: reservationId } });
      return { resv: current ?? resv, changed: false, from, timezone };
    }
    const updated = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } });

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

    // ── فازِ ۵: ثبتِ نتیجه‌ی واقعی در دفترِ نتیجه ──
    // این همان نقطه‌ای است که حلقه‌ی یادگیری بسته می‌شود: تا امروز مدل
    // پیش‌بینی می‌کرد و هیچ‌کس نمی‌سنجید درست بود یا نه.
    //
    // فقط وضعیت‌هایِ *نهایی* شمرده می‌شوند. حالت‌هایِ میانی (checked_in،
    // seated، …) هنوز نتیجه نیستند؛ اگر آن‌ها را ثبت می‌کردیم، یک رزروِ
    // موفق چند بار و با برچسبِ غلط وارد آمار می‌شد.
    //
    // کنسلی عمداً نتیجه نیست: مدل «آمد یا نیامد» را پیش‌بینی می‌کند، و
    // رزروی که کنسل شده اصلاً به آن سؤال نرسیده. شمردنش به‌عنوانِ «آمد»
    // آمار را به نفعِ مدل منحرف می‌کرد.
    const OUTCOME_LABELS: Record<string, number> = {
      no_show: 1,
      completed: 0, arrived: 0, seated: 0, dining: 0,
    };
    const observed = OUTCOME_LABELS[result.resv.status];
    if (observed !== undefined) {
      // ⚠️ importِ static (نه `await import()`) و catchِ صریح — یافته‌ی واقعیِ
      // ۲۰۲۶-۰۸-۲۰: importِ پویا اینجا روی Node 20 با
      // ERR_UNSUPPORTED_RESOLVE_REQUEST می‌شکست و چون داخلِ یک voidِ بی‌catch
      // بود، بی‌صدا هیچ نتیجه‌ای ثبت نمی‌شد (توضیحِ کامل در ml-core.ts).
      void recordOutcome({
        entityType: 'reservation',
        entityId: result.resv.id,
        observedValue: observed,
        source: 'reservation_status',
      }).catch((e) => {
        log.warn('ثبتِ نتیجه در دفترِ مدل ناموفق (رزرو خودش commit شد)', {
          reservationId: result.resv.id, error: (e as Error).message,
        });
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
  }

  // ⚠️ اصلاحِ ساختاری (فازِ ۲): این بلوک قبلاً **داخلِ** شرطِ `notify` بود.
  //
  // یعنی هر فراخوانی با `notify: false` — که یک انتخابِ کاملاً مشروع برایِ
  // مسیرهایِ خودکار است — باطل‌سازیِ کشِ availability را هم بی‌صدا رد می‌کرد.
  // اعلان و یکپارچگیِ داده دو نگرانیِ متفاوت‌اند و نباید به یک پرچم گره بخورند.
  //
  // این را تستِ آزادسازیِ میز پیدا کرد: تست با `notify:false` صدا می‌زد و
  // میز آزاد نمی‌شد، چون کلِ بلوک رد می‌شد.
  if (result.changed) {
    // باطل‌کردن کش availability اگر وضعیت روی ظرفیت اثر دارد (H3: pattern-based)
    if (['cancelled', 'auto_cancelled', 'rejected', 'expired', 'no_show', 'completed'].includes(to)) {
      // کلیدِ کش با تاریخِ محلیِ رستوران ساخته می‌شه (نه UTC) — وگرنه نزدیکِ
      // نیمه‌شبِ تهران، باطل‌سازی روی کلیدِ اشتباه می‌زد و کش واقعی دست‌نخورده می‌موند.
      const dateKey = dateKeyInTz(result.resv.slotStart, result.timezone);
      await invalidateAvailability(result.resv.restaurantId, dateKey).catch(() => {});

      // ⚠️ رفعِ «میزی که هرگز آزاد نمی‌شود» (فازِ ۲، پروتکل §۶).
      //
      // Table.state یک ستونِ جدا با مجموعه‌ی نویسنده‌ی بسیار کوچک‌تری از
      // reservation.status است: فقط setTableState (دستیِ پرسنل)، واک‌ین و
      // QR check-in آن را 'occupied' می‌کنند — و **هیچ‌کس** آن را هنگامِ
      // پایانِ رزرو به 'free' برنمی‌گرداند. هیچ jobِ آشتی‌دهنده‌ای هم نیست.
      //
      // چرا این فقط یک ایرادِ نمایشی نیست: `promoteNext` در waitlist.ts
      // میزهایِ کاندید را با `state: 'free'` فیلتر می‌کند. پس هر میزی که
      // یک‌بار واک‌ین/چک‌این گرفته، **برایِ همیشه** از ترفیعِ لیستِ انتظار
      // کنار می‌رود — یعنی قابلیتِ صف به‌مرور و بی‌صدا از کار می‌افتد.
      // (مسیرِ availabilityِ مشتری متأثر نیست: آن‌جا فقط 'maintenance' فیلتر
      //  می‌شود و تداخلِ واقعی را کانسترینتِ EXCLUDE تضمین می‌کند.)
      //
      // این‌جا درست‌ترین نقطه است چون transitionReservation تنها نویسنده‌ی
      // مجازِ وضعیت است و همین بلوک از قبل «وضعیتِ پایانی» را می‌شناسد.
      //
      // ایمنی: آزادسازی فقط اگر **هیچ رزروِ فعالِ دیگری همین حالا** آن میز را
      // اشغال نکرده باشد — وگرنه لغوِ یک رزروِ آینده می‌توانست میزی را که
      // مهمانِ دیگری سرش نشسته «آزاد» علامت بزند.
      if (result.resv.tableId) {
        try {
          const now = new Date();
          const stillBusy = await db.reservation.count({
            where: {
              tableId: result.resv.tableId,
              id: { not: result.resv.id },
              status: { in: activeStatusList() as any },
              slotStart: { lte: now },
              slotEnd: { gte: now },
            },
          });
          if (stillBusy === 0) {
            await db.table.updateMany({
              where: { id: result.resv.tableId, state: { in: ['occupied', 'reserved'] } },
              data: { state: 'free' },
            });
          }
        } catch (e) {
          // آزادسازیِ میز نباید جریانِ اصلیِ تغییرِ وضعیت را بشکند — همان
          // قاعده‌ای که برایِ اعلان/اقتصاد در همین تابع رعایت شده.
          log.warn('آزادسازیِ میز پس از وضعیتِ پایانی ناموفق', {
            reservationId: result.resv.id, error: (e as Error).message,
          });
        }
      }
    }
  }

  // `changed` بیرون داده می‌شود چون تنها منبعِ *اتمیکِ* «آیا این فراخوانی واقعاً
  // وضعیت را جابه‌جا کرد» همین تراکنش است. صداکننده‌هایی که عارضه‌ی یک‌بارمصرف
  // دارند (امتیاز، SMS) نباید با یک read قبل از فراخوانی تصمیم بگیرند — دو
  // فراخوانیِ هم‌زمان هردو «هنوز نرسیده» می‌بینند و عارضه دوبار اجرا می‌شود.
  return { id: result.resv.id, status: result.resv.status as RStatus, changed: result.changed };
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
