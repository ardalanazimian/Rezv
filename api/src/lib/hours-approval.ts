// ═══════════════════════════════════════════════════════════════════════
//  hours-approval — قواعدِ تأییدِ ساعتِ کاری (Part 3، ۲۰۲۶-۰۸-۱۴)
//
//  آینه‌یِ photo-moderation.ts: منطقِ خالص و تست‌پذیر، مشترک بینِ routeِ
//  business (که پیشنهاد می‌دهد) و routeِ company (که تأیید/رد می‌کند) —
//  تا هر دو پنل دقیقاً یک‌جور در موردِ وضعیت حرف بزنند.
//
//  برخلافِ عکس (که وضعیتِ نهاییِ approved را ذخیره می‌کند)، اینجا تأیید یعنی
//  «اعمال و پاک‌کردنِ صف» — چیزی به‌نامِ approved روی رکورد نمی‌ماند (خودِ
//  openingHours زنده‌شدنِ تأیید را نشان می‌دهد). این طراحیِ عمدی است: یک
//  رستوران در هر لحظه حداکثر یک پیشنهادِ درِ دستِ بررسی دارد، نه تاریخچه‌ای
//  از پیشنهادهای قبلی (آن تاریخچه در audit_logs هست، نه اینجا — محدودیتِ
//  شناخته‌شده، نه miss).
// ═══════════════════════════════════════════════════════════════════════

export type HoursChangeStatus = 'pending' | 'rejected';

export const HOURS_STATUS_LABEL: Record<HoursChangeStatus, string> = {
  pending: 'در انتظارِ تأییدِ شرکت',
  rejected: 'ردشده',
};

/** آیا این رکورد الان چیزی برایِ بررسیِ شرکت دارد؟ */
export function hasPendingHoursChange(status: string | null | undefined): status is 'pending' {
  return status === 'pending';
}

/**
 * آیا شرکت الان مجاز به تأیید/ردِ این رستوران است؟
 * فقط از pending — چیزی که از قبل رد شده باید دوباره توسطِ رستوران پیشنهاد
 * شود (وگرنه شرکت می‌تواند پیشنهادِ کهنه‌ای را که رستوران‌دار دیگر
 * نمی‌خواهد تأیید کند).
 */
export function canReviewHoursChange(status: string | null | undefined): boolean {
  return status === 'pending';
}
