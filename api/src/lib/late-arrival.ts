// ═══════════════════════════════════════════════════════════════════════
//  مهلت‌های دیرکرد و عدمِ حضور — تنها تعریف (STATE M-13/M-17 · F001 · حکم‌های CEO D-18/D-20)
//
//  چرا این فایل هست: تا ۲۰۲۶-۰۹-۱۷ مهلت فقط `slotStart + lateGraceMinutes` بود و فقط cron آن را
//  می‌خواند. نتیجه‌ی اندازه‌گیری‌شده: مهمانِ ۱۷ دقیقه دیرکرده در **یک** تیک هم running_late شد هم
//  no_show (صفر پیامک پیش از آن)، و پرسنل می‌توانست رزرو را حتی **پیش** از ساعتش no_show کند.
//
//  حالا سه مصرف‌کننده، یک تعریف — تا از هم جدا نیفتند:
//    • cron (`autoMarkNoShow`)             → `autoNoShowDueAt`   (هشدارِ پذیرفته‌شده لازم است)
//    • پرسنل (`PATCH …/status`)            → `guestDeadline`     (هشدار لازم نیست؛ میز را می‌بیند)
//    • مهمان (`POST …/eta`، کارتِ رزرو، پیامکِ هشدار) → `guestDeadline`
//
//  ناوردا: `autoNoShowDueAt ≥ guestDeadline` همیشه. پس ساعتی که به مهمان گفته می‌شود («تا ۲۰:۱۵ صبر
//  می‌کنیم») زودترین لحظه‌ای است که **هر** مسیری می‌تواند او را غایب ثبت کند — هرگز زودتر.
// ═══════════════════════════════════════════════════════════════════════

/**
 * کمینه‌ی فاصله‌ی «پذیرشِ هشدار ← no_showِ خودکار» (D-20، «یک پنجره‌ی واقعی پس از سیگنال»).
 *
 * چرا ثابت و نه `lateGraceMinutes`: مهلت از ساعتِ رزرو شمرده می‌شود؛ این یکی از لحظه‌ی هشدار. اگر
 * cron یک ساعت خاموش بوده باشد، مهلتِ ۱۵ دقیقه‌ایِ رستوران مدت‌ها گذشته — بدونِ این کف، هشدار و
 * no_show دوباره در یک تیک می‌افتادند. ۱۰ دقیقه = کمینه‌ی مجازِ `lateGraceMinutes` (D-18)، پس هیچ
 * رستورانی پنجره‌ی پس از هشدار را کوتاه‌تر از کوتاه‌ترین مهلتِ مجاز نمی‌بیند.
 */
export const LATE_WARNING_MIN_WINDOW_MINUTES = 10;

/** بازه‌های D-18 — با CHECKهای مهاجرتِ ۰۹۲ یکی‌اند. */
export const LATE_GRACE_MINUTES_MIN = 10;
export const LATE_GRACE_MINUTES_MAX = 60;
export const LATE_EXTENSION_MINUTES_MAX = 30;

/** رزروهایی که هنوز «منتظرِ مهمان»اند — تنها وضعیت‌هایی که دیرکرد و «دیرتر می‌رسم» برایشان معنا دارد. */
export const AWAITING_GUEST_STATUSES = ['confirmed', 'auto_confirmed', 'preparing', 'running_late'] as const;

type LateFields = { slotStart: Date; lateExtensionMinutes: number | null | undefined };

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

/**
 * زودترین لحظه‌ای که مهمان می‌تواند غایب ثبت شود — همان ساعتی که به مهمان گفته می‌شود، و همان
 * مهلتی که پرسنل پیش از آن ۴۰۹ می‌گیرد (D-20c).
 */
export function guestDeadline(r: LateFields, lateGraceMinutes: number): Date {
  return addMinutes(r.slotStart, lateGraceMinutes + (r.lateExtensionMinutes ?? 0));
}

/**
 * لحظه‌ای که cron **مجاز** است no_show کند، یا null اگر هشداری پذیرفته نشده (D-20a).
 *
 * `max(slotStart + grace, lateWarnedAt + کف) + تمدید`: کف از لحظه‌ی هشدار شمرده می‌شود، پس یک
 * cronِ دیر یا خاموش هرگز هشدار و جریمه را در یک تیک نمی‌اندازد.
 */
export function autoNoShowDueAt(
  r: LateFields & { lateWarnedAt: Date | null | undefined },
  lateGraceMinutes: number,
): Date | null {
  if (!r.lateWarnedAt) return null;
  const fromSlot = r.slotStart.getTime() + lateGraceMinutes * 60_000;
  const fromWarning = r.lateWarnedAt.getTime() + LATE_WARNING_MIN_WINDOW_MINUTES * 60_000;
  return addMinutes(new Date(Math.max(fromSlot, fromWarning)), r.lateExtensionMinutes ?? 0);
}

/** تمدیدی که به مهمان داده می‌شود: درخواستش، محدود به سقفِ رستوران و سقفِ مطلقِ D-18. */
export function grantedExtension(requestedMinutes: number, restaurantCap: number): number {
  const cap = Math.max(0, Math.min(LATE_EXTENSION_MINUTES_MAX, restaurantCap));
  return Math.max(0, Math.min(cap, Math.floor(requestedMinutes)));
}
