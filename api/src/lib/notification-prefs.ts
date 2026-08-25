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
import { createLogger } from './logger';
import { metrics } from './metrics';
import { db } from './db';
import { normalizePhone } from './otp';

const log = createLogger('consent');

export const NOTIFICATION_CATEGORIES = [
  'availability',  // میز خالی شد
  'offers',        // تخفیف و کش‌بک ویژه  ← تنها دسته‌ی «تبلیغاتی»
  'reminder',      // یادآوری رزرو        ← تراکنشی
  'loyalty',       // امتیاز و پاداش
  'dna',           // خلاصه‌ی DNA غذایی
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/**
 * دسته‌هایی که **هرگز** گیت نمی‌شوند، برایِ ثبتِ صریحِ تصمیم.
 *
 * ⚠️ این فهرست عمداً «کد» نیست بلکه «قرارداد» است: هر پیامکی که نبودنش به
 * مشتری آسیبِ واقعی می‌زند (کدِ ورود، تأییدِ رزرو، لغو/ردِ رزرو، رسیدِ
 * چک‌این، تحویلِ کارتِ هدیه) بیرونِ سیستمِ رضایتِ تبلیغاتی است. اگر روزی
 * کسی وسوسه شد `booking_confirm` را پشتِ یک کلید ببرد، تستِ
 * `notification-consent-enforcement` جلویش را می‌گیرد.
 */
export const UNGATED_SMS_TEMPLATES = [
  'otp',              // امنیتی — کاربر بدونش اصلاً نمی‌تواند وارد شود
  'booking_confirm',  // تأییدِ رزرو
  'booking_waitlist', 'booking_preparing', 'booking_rejected',
  'booking_cancelled', 'booking_noshow', 'booking_thanks',   // چرخه‌ی حیات
  'welcome_visit',    // رسیدِ چک‌ین (شاملِ موجودیِ امتیاز)
  'waitlist_joined',  // رسیدِ پیوستن به صف — نتیجه‌ی مستقیمِ کنشِ خودِ مهمان
] as const;

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

// ═══════════════════════════════════════════════════════════════════════
//  اعمالِ رضایت در نقطه‌ی صدور + رصدپذیری
//
//  ⚠️ چرا این لایه لازم شد: خودِ `allowsCategory` از روزِ اول درست بود ولی
//  فقط در **دو نقطه** صدا زده می‌شد (هر دو در `restaurant/sms/route.ts` و
//  هر دو فقط برای `offers`). یعنی از پنج کلیدی که اپِ مشتری نشان می‌دهد و
//  سرور صادقانه ذخیره‌شان می‌کند، چهارتا هیچ اثری نداشتند: کاربر «امتیاز و
//  پاداش» را خاموش می‌کرد و همچنان پیامکِ تولد می‌گرفت.
//
//  ⚠️ و چرا گیت **داخلِ `enqueueSms`** گذاشته نشد (تصمیمِ آگاهانه):
//   ۱. `enqueueSms` فقط `to: string` دارد؛ برای پیدا کردنِ ترجیحات باید
//      به‌ازای **هر پیامک** یک کوئریِ `users.findUnique(phone)` می‌زد —
//      یعنی N+1 دقیقاً داخلِ حلقه‌های کمپین که صدها گیرنده دارند.
//   ۲. خطرناک‌تر: پیش‌فرض آن‌جا باید «گیت» می‌بود و یک تایپو در نگاشتِ
//      قالب→دسته می‌توانست OTP یا تأییدِ رزرو را خاموش کند.
//  به‌جایش هر نقطه‌ی صدور که از قبل داده‌ی کاربر را در دست دارد، ترجیحات را
//  در همان `select`ِ موجود می‌آورد (صفر کوئریِ اضافه) و این تابع را صدا
//  می‌زند. تصمیم همچنان یک‌جاست: `allowsCategory`.
// ═══════════════════════════════════════════════════════════════════════

/** بافتِ نقطه‌ی صدور — فقط برای لاگ/متریک، در تصمیم دخالتی ندارد. */
export interface ConsentContext {
  /** نامِ نقطه‌ی صدور، پایدار و کم‌کاردینالیتی (برچسبِ متریک). */
  site: string;
  template?: string;
  restaurantId?: string | null;
  userId?: string | null;
}

/**
 * آیا این پیامکِ **غیرِتراکنشی** ارسال شود؟ اگر نه، چرایش لاگ و متریک
 * می‌شود (نه سکوت — قاعده‌ی بخشِ ۹ CLAUDE.md).
 *
 * تصمیم عیناً همان `allowsCategory` است؛ این تابع قاعده‌ی دومی اضافه
 * نمی‌کند، فقط رصدپذیری را به آن می‌چسباند.
 */
export function smsAllowedForCategory(
  raw: unknown,
  category: NotificationCategory,
  ctx: ConsentContext,
): boolean {
  if (allowsCategory(raw, category)) return true;
  metrics.smsSuppressed.inc({ category, site: ctx.site });
  log.info('پیامک ارسال نشد — انصرافِ صریحِ کاربر', {
    category,
    site: ctx.site,
    template: ctx.template ?? null,
    restaurantId: ctx.restaurantId ?? null,
    userId: ctx.userId ?? null,
  });
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
//  یافتنِ کاربرِ پشتِ یک شماره — فقط برای تصمیمِ رضایت
//
//  ⚠️ چرا این‌جا و نه در هر call site: بینِ دو فرمتِ شماره یک شکافِ واقعی
//  هست که گاردِ رضایت را بی‌صدا بی‌اثر می‌کرد.
//   • `users.phone` همیشه نرمال است (`+989…`) چون تنها نویسنده‌اش
//     `verifyOtp`/`upsert`های بعد از `normalizePhone` است.
//   • ولی `reservations.guest_phone` **خام** ذخیره می‌شود
//     (`lib/reservations.ts` → `input.guest?.phone` بدونِ نرمال‌سازی) و
//     پنل هم همان خام را به `POST /restaurant/sms` پس می‌دهد.
//  پس یک `where: { phone: <خام> }` برایِ کاربری که با `09…` ثبت شده هیچ
//  ردیفی برنمی‌گرداند ⇒ «کاربر پیدا نشد» ⇒ «انصرافی ثبت نشده» ⇒ پیامک
//  می‌رود. یعنی انصراف محترم شمرده نمی‌شد و هیچ‌کس هم خبردار نمی‌شد.
//
//  جهتِ خطا هم مهم است: گشاد کردنِ جست‌وجو فقط می‌تواند انصرافِ **بیشتری**
//  را پیدا کند، هرگز پیامکِ تراکنشی‌ای را خاموش نمی‌کند.
// ═══════════════════════════════════════════════════════════════════════

/** شکل‌های محتملِ ذخیره‌ی یک شماره (خام + نرمال). همیشه ≥۱ عضو دارد. */
export function phoneLookupVariants(raw: string): string[] {
  const out = new Set<string>([raw]);
  try { out.add(normalizePhone(raw)); } catch { /* شماره‌ی غیرِایرانی/نامعتبر — همان خام می‌ماند */ }
  return [...out];
}

export interface ConsentUser { id: string; phone: string; notificationPrefs: unknown }

/** یک شماره → کاربر (یا null). برای فهرست از `findUsersByPhonesForConsent` استفاده کن. */
export async function findUserByPhoneForConsent(raw: string): Promise<ConsentUser | null> {
  const rows = await db.user.findMany({
    where: { phone: { in: phoneLookupVariants(raw) } },
    select: { id: true, phone: true, notificationPrefs: true },
    take: 1,
  });
  return rows[0] ?? null;
}

/**
 * فهرستِ شماره‌ها → نگاشتِ «شماره‌ی همان‌طور که داده شد» → کاربر.
 *
 * ⚠️ **یک** کوئری برای کلِ فهرست، نه یکی به‌ازای هر شماره: این تابع دقیقاً
 * برایِ حلقه‌های کمپین (تا ۵۰۰ گیرنده) نوشته شده و N+1 نمی‌سازد.
 */
export async function findUsersByPhonesForConsent(phones: string[]): Promise<Map<string, ConsentUser>> {
  const out = new Map<string, ConsentUser>();
  if (phones.length === 0) return out;
  const variantsOf = new Map<string, string[]>();
  const all = new Set<string>();
  for (const p of phones) {
    const v = phoneLookupVariants(p);
    variantsOf.set(p, v);
    for (const x of v) all.add(x);
  }
  const rows = await db.user.findMany({
    where: { phone: { in: [...all] } },
    select: { id: true, phone: true, notificationPrefs: true },
  });
  const byStored = new Map(rows.map((r) => [r.phone, r]));
  for (const p of phones) {
    for (const v of variantsOf.get(p) ?? []) {
      const hit = byStored.get(v);
      if (hit) { out.set(p, hit); break; }
    }
  }
  return out;
}
