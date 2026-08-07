// ═══════════════════════════════════════════════════════════
//  منبع واحد حقیقت برای مجموعه‌های وضعیت رزرو
//
//  چرا این فایل وجود دارد (باگ بحرانی C1):
//  قبلاً لیست «وضعیت‌های فعالِ اشغال‌کننده‌ی میز» به‌صورت
//  ('pending','confirmed','arrived','seated') در چند جا کپی شده بود
//  (EXCLUDE constraint، ایندکس GiST، کوئری تداخل موتور رزرو، availability،
//   merge، گارد حذف میز). اما enum وضعیت‌ها شامل وضعیت‌های فعالِ دیگری هم
//  هست (auto_confirmed, preparing, checked_in, running_late, dining) که در
//  آن لیست نبودند → یک میز می‌توانست در آن وضعیت‌ها دوباره رزرو شود (double-booking).
//
//  حالا تنها یک لیست تعریف می‌شود و همه‌جا از همین استفاده می‌کنند.
//  هر تغییر در چرخه‌ی حیات فقط اینجا اعمال می‌شود.
// ═══════════════════════════════════════════════════════════

/**
 * وضعیت‌هایی که یعنی رزرو «زنده» است و میز را در بازه‌ی زمانی‌اش اشغال می‌کند.
 * این مجموعه باید با WHERE کانسترینت EXCLUDE در دیتابیس کاملاً یکی باشد
 * (به prisma/sql/016 و prisma/sql/026 مراجعه شود؛ 026 نسخه‌ی canonical است).
 *
 * شامل وضعیت‌های قدیمی (arrived) برای سازگاری با داده‌ی موجود.
 */
export const ACTIVE_RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'auto_confirmed',
  'preparing',
  'checked_in',
  'running_late',
  'arrived',        // قدیمی = معادل checked_in
  'seated',
  'dining',
] as const;

export type ActiveReservationStatus = (typeof ACTIVE_RESERVATION_STATUSES)[number];

/** همان مجموعه به‌صورت رشته‌ی SQL برای استفاده در $queryRaw: 'a','b','c' */
export const ACTIVE_STATUSES_SQL = ACTIVE_RESERVATION_STATUSES.map((s) => `'${s}'`).join(',');

/** آرایه‌ی قابل‌استفاده در Prisma `status: { in: [...] }` (کپی تازه تا mutate نشود). */
export function activeStatusList(): string[] {
  return [...ACTIVE_RESERVATION_STATUSES];
}

/**
 * وضعیت‌هایی که یعنی مهمان واقعاً آمده است.
 *
 * جدا از ACTIVE_* است و عمداً کوچک‌تر: آن مجموعه «میز را اشغال می‌کند» را
 * جواب می‌دهد و pending و confirmed را هم دارد — رزروهایی که هنوز اتفاق
 * نیفتاده‌اند. برای سیگنالِ اجتماعی («این هفته چند نفر اینجا بودند») شمردنِ
 * آن‌ها یعنی بزرگ‌نماییِ عدد. no_show و expired و rejected هم به‌همین دلیل
 * بیرون‌اند.
 *
 * arrived و checked_in هم بیرون‌اند: رسیدن هنوز نشستن نیست و اگر مهمان
 * برگردد، حضور کامل نبوده.
 */
export const VISITED_RESERVATION_STATUSES = [
  'seated',
  'dining',
  'completed',
] as const;

export type VisitedReservationStatus = (typeof VISITED_RESERVATION_STATUSES)[number];

/** آرایه‌ی قابل‌استفاده در Prisma `status: { in: [...] }`. */
export function visitedStatusList(): string[] {
  return [...VISITED_RESERVATION_STATUSES];
}

/**
 * وضعیت‌هایی که یعنی «تقاضایِ واقعی» بوده — مشتری واقعاً قصدِ حضور داشته،
 * چه در نهایت آمده باشد (seated/dining/completed) چه نیامده (no_show).
 * برایِ تحلیل‌های آینده‌نگر/گذشته‌نگرِ حجمِ تقاضا استفاده می‌شود (lib/
 * demand-forecast.ts، lib/restaurant-manager.ts) — بر خلافِ VISITED_*
 * (که فقط «واقعاً آمد» را می‌شمارد)، اینجا no_show هم تقاضایِ واقعی حساب
 * می‌شود چون رزرو ثبت شده بود، فقط محقق نشد.
 *
 * بیرون: pending/waitlisted (هنوز تثبیت نشده)، rejected/expired/cancelled*
 * (تقاضایی که تبخیر شده و تکرارپذیر نیست).
 */
export const DEMAND_RESERVATION_STATUSES = [
  'confirmed',
  'auto_confirmed',
  'preparing',
  'checked_in',
  'running_late',
  'arrived',
  'seated',
  'dining',
  'completed',
  'no_show',
] as const;

export type DemandReservationStatus = (typeof DEMAND_RESERVATION_STATUSES)[number];

/** همان مجموعه به‌صورت رشته‌ی SQL برای استفاده در $queryRaw: 'a','b','c' */
export const DEMAND_STATUSES_SQL = DEMAND_RESERVATION_STATUSES.map((s) => `'${s}'`).join(',');

/** آرایه‌ی قابل‌استفاده در Prisma `status: { in: [...] }`. */
export function demandStatusList(): string[] {
  return [...DEMAND_RESERVATION_STATUSES];
}
