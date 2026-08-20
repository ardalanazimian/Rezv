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

export function computeSubscriptionStatus(
  plan: string,
  planExpiresAt: Date | null,
  trialEndsAt: Date | null,
): SubscriptionInfo {
  const now = Date.now();

  if (planExpiresAt) {
    const diffDays = Math.ceil((planExpiresAt.getTime() - now) / 86_400_000);
    if (diffDays < 0) return { status: 'expired', daysLeft: diffDays };
    if (diffDays <= EXPIRING_SOON_DAYS) return { status: 'expiring', daysLeft: diffDays };
    return { status: 'active', daysLeft: diffDays };
  }

  if (trialEndsAt) {
    const diffDays = Math.ceil((trialEndsAt.getTime() - now) / 86_400_000);
    if (diffDays < 0) return { status: 'trial_expired', daysLeft: diffDays };
    return { status: 'trial', daysLeft: diffDays };
  }

  // بدون هیچ تاریخ انقضایی → اشتراک نامحدود (مثلاً تنظیم دستی تیم)
  return { status: 'active', daysLeft: null };
}
