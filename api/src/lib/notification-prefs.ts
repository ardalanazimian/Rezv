// ═══════════════════════════════════════════════════════════════════════
//  رضایتِ اعلان‌رسانی — منبعِ واحد (پروتکل §۱۳ «communication preferences»
//  و §۱۷ «consent»)
//
//  قاعده‌ی کلیدی: **فقط انصرافِ صریح احترام دارد.** کلیدِ غایب یعنی کاربر
//  هرگز نظری نداده، نه اینکه انصراف داده — پس رفتارِ فعلی (دریافت) ادامه
//  می‌یابد. اگر غیبت را «انصراف» فرض کنیم، تمامِ کاربرانِ موجود بی‌صدا از
//  یادآوریِ رزروشان محروم می‌شوند، که خودش یک نقصِ محصولیِ بدتر است.
//
//  دسته‌ها عیناً همان‌هایی‌اند که اپِ مشتری نشان می‌دهد
//  (apps/customer/js/user-profile.js → NOTIF_CATS). اگر آن‌جا دسته‌ای اضافه
//  شد، این‌جا هم باید اضافه شود وگرنه PATCH آن را رد می‌کند.
// ═══════════════════════════════════════════════════════════════════════

export const NOTIFICATION_CATEGORIES = [
  'availability',  // میز خالی شد
  'offers',        // تخفیف و کش‌بک ویژه  ← تنها دسته‌ی «تبلیغاتی»
  'reminder',      // یادآوری رزرو        ← تراکنشی
  'loyalty',       // امتیاز و پاداش
  'dna',           // خلاصه‌ی DNA غذایی
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** دسته‌هایی که تبلیغاتی‌اند و انصراف باید حتماً رعایت شود. */
export const MARKETING_CATEGORIES: readonly NotificationCategory[] = ['offers', 'dna'];

export type NotificationPrefs = Record<string, boolean>;

/** خواندنِ امنِ ستونِ jsonb: هر چیزی جز boolean دور ریخته می‌شود. */
export function readNotificationPrefs(raw: unknown): NotificationPrefs {
  const out: NotificationPrefs = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'boolean' && (NOTIFICATION_CATEGORIES as readonly string[]).includes(k)) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * آیا این کاربر برایِ این دسته اجازه‌ی دریافت داده؟
 * فقط `false`ِ صریح مانع می‌شود (رجوع کن به توضیحِ بالا).
 */
export function allowsCategory(raw: unknown, category: NotificationCategory): boolean {
  const prefs = readNotificationPrefs(raw);
  return prefs[category] !== false;
}
