// ═══════════════════════════════════════════════════════════════════════
//  «این رستوران الان رزروِ آنلاین می‌پذیرد؟» — یک تعریف برای مسیرهای availability
//
//  همان شرطِ گاردِ ثبتِ رزرو (lib/reservations.ts: isOpen، و برای onlineGating
//  آخرین heartbeat در ۹۰ ثانیه‌ی اخیر). مسیرِ تکیِ availability این را از
//  ۲۰۲۶-۰۸-۲۵ داشت؛ مسیرِ گروهیِ چیپ‌های کارت (`/restaurants/availability`)
//  نداشت، پس کارتِ رستورانی که پنلش بسته شده بود هنوز ساعتِ «آزاد» نشان می‌داد
//  و `quickBook` کاربر را مستقیم به ثبت می‌برد که با RESTAURANT_OFFLINE رد
//  می‌شد — همان بن‌بستی که مسیرِ تکی برایش گارد گرفت (ممیزیِ قراردادِ
//  فرانت↔بک، ۲۰۲۶-۰۹-۱۳). حالا هر دو مسیر از همین تابع می‌خوانند.
// ═══════════════════════════════════════════════════════════════════════

export const ONLINE_WINDOW_MS = 90_000;

export type BookableStatus = 'online' | 'offline' | 'closed';

export function bookableStatus(
  r: { isOpen: boolean; onlineGating: boolean; lastSeenAt: Date | null },
  now: number = Date.now(),
): BookableStatus {
  if (!r.isOpen) return 'closed';
  if (!r.onlineGating) return 'online';
  return r.lastSeenAt != null && now - new Date(r.lastSeenAt).getTime() < ONLINE_WINDOW_MS ? 'online' : 'offline';
}
