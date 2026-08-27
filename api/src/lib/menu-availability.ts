import { Err } from '@/lib/errors';
import { weekdayInTz, dateKeyInTz, timeKeyInTz } from '@/lib/hours';

// ═══════════════════════════════════════════════════════════════════════
//  پنجره‌ی دسترسیِ آیتمِ منو (SPEC-A فاز ۲ / ۰۷۸)
//
//  شکل: { days: int[], start_min: int, end_min: int } — NULL = همیشه.
//  شماره‌گذاریِ روز همان قراردادِ hours.ts است: ۰=یکشنبه … ۶=شنبه
//  (خروجیِ weekdayInTz)؛ پنل با همین قرارداد چک‌باکس می‌سازد.
//
//  دو مصرف‌کننده با دو «زمان»ِ متفاوت — عمداً:
//   • endpointهای عمومی: «اکنون» در تایم‌زونِ رستوران، و **پس از** خواندنِ کش
//     (کش منویِ کامل را نگه می‌دارد؛ فیلترِ داخلِ کش تا سررسیدِ TTL دروغ می‌گفت).
//   • pre-order در رزرو: «slotStart» — پیش‌سفارش برای زمانِ رزرو است، نه لحظه‌ی
//     ثبت؛ آیتمِ صبحانه برای رزروِ شام باید رد شود حتی اگر الان صبح باشد.
// ═══════════════════════════════════════════════════════════════════════

export type MenuAvailability = { days: number[]; start_min: number; end_min: number };

/**
 * اعتبارسنجیِ ورودیِ پنل. null/undefined = «همیشه» (مجاز).
 * خطاها Err.validation با پیامِ فارسیِ دقیق‌اند — نه رد شدنِ بی‌صدا.
 */
export function parseAvailability(x: unknown): MenuAvailability | null {
  if (x === null || x === undefined) return null;
  if (typeof x !== 'object' || Array.isArray(x)) {
    throw Err.validation('پنجره‌ی دسترسی باید یک شیء با days/start_min/end_min باشد');
  }
  const o = x as Record<string, unknown>;
  const days = o.days;
  if (!Array.isArray(days) || days.length === 0 || days.length > 7) {
    throw Err.validation('روزهای پنجره باید فهرستی ناخالی از ۰ (یکشنبه) تا ۶ (شنبه) باشد');
  }
  const seen = new Set<number>();
  for (const d of days) {
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6) {
      throw Err.validation('روزِ پنجره باید عددِ صحیحِ ۰ تا ۶ باشد');
    }
    if (seen.has(d)) throw Err.validation('روزِ تکراری در پنجره‌ی دسترسی');
    seen.add(d);
  }
  const start = o.start_min, end = o.end_min;
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || start > 1439) {
    throw Err.validation('شروعِ پنجره باید بینِ ۰ تا ۱۴۳۹ دقیقه باشد');
  }
  if (typeof end !== 'number' || !Number.isInteger(end) || end < 1 || end > 1439) {
    throw Err.validation('پایانِ پنجره باید بینِ ۱ تا ۱۴۳۹ دقیقه باشد');
  }
  if (start >= end) throw Err.validation('شروعِ پنجره باید قبل از پایانش باشد');
  return { days: [...seen].sort((a, b) => a - b), start_min: start, end_min: end };
}

/** دقیقه‌ی دیواریِ محلیِ یک لحظه در تایم‌زونِ داده‌شده (۰..۱۴۳۹). */
function minutesInTz(at: Date, timezone: string): number {
  const [h, m] = timeKeyInTz(at, timezone).split(':').map(Number);
  return h * 60 + m;
}

/** آیا آیتم با این پنجره در لحظه‌ی `at` (به وقتِ رستوران) در دسترس است؟ */
export function isAvailableAt(av: unknown, timezone: string, at: Date): boolean {
  if (av === null || av === undefined) return true;
  // دیتای DB است نه ورودیِ کاربر؛ اگر شکلش خراب بود (دستکاریِ خام)، امنِ
  // محافظه‌کارانه: «در دسترس» — آیتمِ رستوران نباید به‌خاطرِ jsonِ بد غیب شود.
  const o = av as Partial<MenuAvailability>;
  if (!Array.isArray(o.days) || typeof o.start_min !== 'number' || typeof o.end_min !== 'number') return true;
  const day = weekdayInTz(dateKeyInTz(at, timezone), timezone);
  if (!o.days.includes(day)) return false;
  const min = minutesInTz(at, timezone);
  return min >= o.start_min && min < o.end_min;
}

/** فیلترِ پس-از-کشِ endpointهای عمومی: فقط آیتم‌های در-دسترسِ «اکنون». */
export function filterAvailableNow<T extends { availability?: unknown }>(items: T[], timezone: string): T[] {
  const now = new Date();
  return items.filter(i => isAvailableAt(i.availability, timezone, now));
}
