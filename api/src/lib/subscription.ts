/**
 * subscription.ts — وضعیت واقعی اشتراک یک tenant.
 *
 * قبلاً «فعال/رو‌به‌اتمام/منقضی/آزمایشی» و «روزهای باقی‌مانده» در پنل شرکت
 * کاملاً ساختگی بود (از یک آرایه‌ی ثابت در فرانت‌اند). این فایل وضعیت واقعی
 * را از روی tenant.plan_expires_at / tenant.trial_ends_at محاسبه می‌کند —
 * بدون فیلد وضعیت تکراری در دیتابیس (که می‌تواند out-of-sync شود).
 */

export type SubscriptionStatus = 'active' | 'expiring' | 'expired' | 'trial' | 'trial_expired';

const EXPIRING_SOON_DAYS = 14;

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  daysLeft: number | null; // مثبت = روز باقی‌مانده، منفی = روز از انقضا گذشته، null = بدون انقضا
}

/**
 * ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۲): تصمیمِ «منقضی شده یا نه» رویِ عددِ **گِردشده**
 * گرفته می‌شد، و همین یک پنجره‌ی ۲۴ ساعته‌ی نامرئی می‌ساخت.
 *
 *   `Math.ceil(-0.5) === -0`  و در جاوااسکریپت  `-0 < 0` **نادرست** است.
 *
 * یعنی اشتراکی که هر لحظه‌ای در **۲۴ ساعتِ گذشته** منقضی شده بود، از شرطِ
 * `diffDays < 0` رد می‌شد و بعد در دامِ `<= ۱۴` می‌افتاد — پس در پنلِ شرکت
 * «رو به اتمام» با «۰ روز باقی‌مانده» نمایش داده می‌شد، نه «منقضی»
 * (`-0` در JSON هم `0` سریالایز می‌شود، پس حتی نشانه‌ای هم باقی نمی‌ماند).
 *
 * اثرش گزارشی است نه دسترسی — هیچ گاردی به این وضعیت تکیه نمی‌کند — ولی
 * دقیقاً همان «گزارشِ وضعیتی که واقعی نیست» است: مدیرِ پلتفرم که فهرستِ
 * تمدید را از همین صفحه برمی‌دارد، هر تنانتی را که در روزِ اولِ انقضا بود
 * از قلم می‌انداخت.
 *
 * رفع: تصمیم رویِ **اختلافِ خامِ میلی‌ثانیه** گرفته می‌شود (بدونِ گِردکردن) و
 * گِردکردن فقط برای *نمایش* می‌ماند. `-0` هم به `0` نرمال می‌شود تا
 * ناسازگاریِ `Object.is` به بیرون درز نکند.
 *
 * ℹ️ پارامترِ `plan` حذف شد: در بدنه‌ی تابع هیچ‌وقت خوانده نمی‌شد. یک
 * پارامترِ مرده‌ی بامعنا-به‌نظر گمراه‌کننده است (خواننده فرض می‌کند نوعِ پلن
 * روی وضعیت اثر دارد، در حالی که ندارد). هر دو فراخوان‌کننده به‌روز شدند.
 */
export function computeSubscriptionStatus(
  planExpiresAt: Date | null,
  trialEndsAt: Date | null,
): SubscriptionInfo {
  const now = Date.now();

  /** گِردکردن فقط برای نمایش؛ `-0` را به `0` نرمال می‌کند. */
  const toDays = (ms: number): number => {
    const d = Math.ceil(ms / 86_400_000);
    return d === 0 ? 0 : d;
  };

  if (planExpiresAt) {
    const ms = planExpiresAt.getTime() - now;
    if (ms < 0) return { status: 'expired', daysLeft: toDays(ms) };
    const diffDays = toDays(ms);
    if (diffDays <= EXPIRING_SOON_DAYS) return { status: 'expiring', daysLeft: diffDays };
    return { status: 'active', daysLeft: diffDays };
  }

  if (trialEndsAt) {
    const ms = trialEndsAt.getTime() - now;
    if (ms < 0) return { status: 'trial_expired', daysLeft: toDays(ms) };
    return { status: 'trial', daysLeft: toDays(ms) };
  }

  // بدون هیچ تاریخ انقضایی → اشتراک نامحدود (مثلاً تنظیم دستی تیم)
  return { status: 'active', daysLeft: null };
}
