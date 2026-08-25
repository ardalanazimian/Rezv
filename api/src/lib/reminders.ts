// ═══════════════════════════════════════════════════════════════════════
//  یادآوریِ پیامکیِ رزرو — تحققِ وعده‌ای که اپ می‌داد و کد نمی‌داد
//
//  ⚠️ چرا این فایل وجود دارد: اپِ مشتری در پروفایل صریحاً می‌گوید
//  «قبل از رزروت یادت می‌ندازیم (تا فراموش نکنی)» و دو جای دیگر
//  «یادآوری‌ها پیامکی می‌آید» (apps/customer/js/user-profile.js:17,87,104).
//  قالبِ `rezervno-reminder` هم از روزِ اول در TEMPLATE_MAP بود.
//  ولی در کلِ کدبیس **صفر** فراخوانِ `enqueueSms({template:'reminder'})`
//  وجود داشت و هیچ jobی در crontab نبود. یک وعده‌ی اعلام‌شده که هرگز
//  تحویل نمی‌شد.
// ═══════════════════════════════════════════════════════════════════════
import { db } from './db';
import { enqueueSms } from './sms';
import { allowsCategory } from './notification-prefs';
import { createLogger } from './logger';

const log = createLogger('reminders');

/**
 * چقدر پیش از سانس یادآوری برود.
 *
 * ⚠️ عدد انتخابی است، نه کشف‌شده — و دلیلش را می‌نویسم تا بعداً آگاهانه
 * عوض شود: ۳ ساعت آن‌قدر هست که مهمان بتواند برنامه‌اش را تنظیم کند یا
 * لغو کند (پس میز آزاد می‌شود و به درد رستوران هم می‌خورد)، و آن‌قدر
 * نزدیک هست که تا شب فراموش نشود. یادآوریِ ۲۴ ساعته برای رستوران زود است
 * و یادآوریِ ۳۰ دقیقه‌ای دیر.
 */
export const REMINDER_LEAD_MS = 3 * 60 * 60_000;

/**
 * وضعیت‌هایی که یادآوری برایشان معنا دارد.
 * عمداً `pending` نیست: رزروی که هنوز تأیید نشده «یادآوری» ندارد — اگر
 * رستوران ردش کند، پیامکِ یادآوری یک دروغِ تمام‌عیار می‌شود.
 */
const REMINDABLE = ['confirmed', 'auto_confirmed', 'preparing'] as const;

export interface ReminderRunResult {
  scanned: number;
  sent: number;
  skipped_no_consent: number;
  skipped_late_booking: number;
  skipped_no_phone: number;
}

/**
 * یادآوریِ همه‌ی رزروهایی که سانسشان داخلِ پنجره‌ی پیشِ‌رو است.
 *
 * سه لایه‌ی جلوگیری از ارسالِ تکراری:
 *  ۱. `reminderSentAt IS NULL` در خودِ کوئری
 *  ۲. `updateMany` با همان شرط — یعنی اگر دو نمونه‌ی cron هم‌زمان اجرا شوند،
 *     فقط یکی `count === 1` می‌گیرد (compare-and-set اتمیک)، دیگری صفر و
 *     پیامک نمی‌فرستد
 *  ۳. `idempotencyKey` روی خودِ job (لایه‌ی صف)
 * لایه‌ی ۲ مهم‌ترین است: **اول علامت بزن، بعد بفرست.** ترتیبِ برعکس یعنی
 * اگر بینِ ارسال و علامت‌زدن کرش شود، اجرای بعدی دوباره می‌فرستد.
 */
export async function sendDueReminders(
  now: Date = new Date(),
  /**
   * قلابِ تست — دقیقاً پیش از compare-and-set صدا زده می‌شود.
   * ⚠️ چرا لازم شد: گاردِ همزمانی فقط وقتی اثر دارد که دو مدعی **واقعاً**
   * درهم بروند، و دو فراخوانِ `Promise.all` روی این تابع درهم نمی‌روند
   * (اندازه‌گیری شد: scanned شد ۳ و ۴، یعنی سریال اجرا شدند). بدونِ این
   * قلاب، حذفِ گارد در جهش‌آزمایی **نامرئی** می‌ماند — یعنی تست چیزی را
   * قفل نکرده. همان الگویِ تزریقِ `acquireSlotLock` در createReservation.
   */
  onBeforeClaim?: (reservationId: string) => Promise<void>,
): Promise<ReminderRunResult> {
  const horizon = new Date(+now + REMINDER_LEAD_MS);
  const out: ReminderRunResult = {
    scanned: 0, sent: 0, skipped_no_consent: 0, skipped_late_booking: 0, skipped_no_phone: 0,
  };

  const due = await db.reservation.findMany({
    where: {
      reminderSentAt: null,
      slotStart: { gt: now, lte: horizon },
      status: { in: REMINDABLE as unknown as string[] as never },
    },
    select: {
      id: true, code: true, slotStart: true, createdAt: true,
      guestPhone: true, guestName: true,
      restaurant: { select: { id: true, name: true, timezone: true } },
      user: { select: { notificationPrefs: true } },
    },
    take: 500,   // سقفِ هر اجرا؛ cron هر ۱۵ دقیقه می‌آید پس عقب نمی‌ماند
  });
  out.scanned = due.length;

  for (const r of due) {
    if (!r.guestPhone) { out.skipped_no_phone++; continue; }

    // رزروی که **بعد از** نقطه‌ی یادآوری ثبت شده، یادآوری نمی‌خواهد:
    // مهمان همین الان خودش رزرو کرده و یادش هست. بدونِ این شرط، هر رزروِ
    // «برای امشب» بلافاصله یک پیامکِ «یادآوری» می‌گرفت که بی‌معنا و
    // آزاردهنده است (و پولِ پیامک را هم می‌سوزاند).
    if (+r.createdAt > +r.slotStart - REMINDER_LEAD_MS) {
      out.skipped_late_booking++;
      continue;
    }

    // رضایت: فقط انصرافِ صریح مانع می‌شود (قاعده‌ی notification-prefs.ts).
    // مهمانِ بدونِ حساب `user` ندارد ⇒ prefs غایب ⇒ مجاز، که درست است:
    // او شماره‌اش را برای همین رزرو داده.
    if (!allowsCategory(r.user?.notificationPrefs, 'reminder')) {
      out.skipped_no_consent++;
      // سکوت ممنوع (CLAUDE.md §۹): نرساندنِ پیام باید قابلِ ردیابی باشد.
      log.debug('یادآوری به‌خاطرِ انصرافِ کاربر ارسال نشد', { code: r.code });
      continue;
    }

    // ⚠️ اول علامت، بعد ارسال — و علامت با شرطِ `reminderSentAt: null` تا
    // دو cronِ هم‌زمان نتوانند هر دو بفرستند.
    if (onBeforeClaim) await onBeforeClaim(r.id);
    const claimed = await db.reservation.updateMany({
      where: { id: r.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count !== 1) continue;   // نمونه‌ی دیگری زودتر برداشتش

    const time = new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: r.restaurant.timezone || 'Asia/Tehran',
    }).format(r.slotStart);

    try {
      await enqueueSms({
        to: r.guestPhone,
        template: 'reminder',
        // ⚠️ دقیقاً سه توکن — سقفِ MAX_SMS_TOKENS. کدِ رزرو عمداً اینجا
        // نیست: در یادآوری، «کجا و ساعتِ چند» چیزی است که مهمان لازم دارد،
        // و کد را از قبل در پیامکِ تأیید و در اپ دارد. چهارتا فرستادن یعنی
        // یکی بی‌صدا دور ریخته شود (همان باگی که در booking_confirm هست).
        tokens: [r.guestName ?? 'مهمان', r.restaurant.name, time],
        restaurantId: r.restaurant.id,
        idempotencyKey: `reminder:${r.id}`,
      });
      out.sent++;
    } catch (e) {
      // صف نپذیرفت ⇒ علامت را پس بگیر تا اجرای بعدی دوباره تلاش کند.
      // بدونِ این، یک خطای گذرا یعنی آن مهمان **هرگز** یادآوری نمی‌گیرد.
      await db.reservation.updateMany({
        where: { id: r.id }, data: { reminderSentAt: null },
      }).catch(() => {});
      log.error('صف‌بندیِ یادآوری شکست خورد', { code: r.code, err: String(e) });
    }
  }

  if (out.sent || out.skipped_no_consent) log.info('اجرای یادآوری', out as unknown as Record<string, unknown>);
  return out;
}
