import { db } from './db';
import { getPointsBalance } from './loyalty';
import { getGuestProfile } from './guest-profile';
import { visitedStatusList } from './reservation-status';
import { hourInTz, dateInTz } from './hours';

// ═══════════════════════════════════════════════════════════════════════
//  وضعیتِ نمایشیِ وفاداری — سطح، پیشرفت، نشان‌ها
//
//  چرا این فایل: apps/customer/js/features/loyalty.js «سطحِ طلایی»،
//  «۱۶۰ امتیاز تا پلاتینیوم»، نوارِ پیشرفتِ ۶۸٪، و نشان‌های earned/locked را
//  همیشه ثابت (هاردکد) نشان می‌داد — مستقل از امتیازِ واقعیِ کاربر. این فایل
//  همه‌ی این‌ها را از رویِ دادهٔ واقعی محاسبه می‌کند تا فرانت چیزی جز نمایشِ
//  یک عددِ آماده کار نکند.
//
//  آستانه‌های سطح (پایین) یک مقیاسِ منطقیِ پیش‌فرض‌اند — هیچ داده‌ی
//  کسب‌وکاریِ قبلی برایِ اشتقاقشان وجود نداشت (هیچ ستون/جدولِ tier‌ای در
//  schema نبود). اگر عددهایِ دیگری مدِ نظر است، فقط همین چند ثابت را عوض کن.
// ═══════════════════════════════════════════════════════════════════════

export interface LoyaltyTier {
  key: 'bronze' | 'silver' | 'gold' | 'platinum';
  name: string;
  emoji: string;
  min: number;
}

export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  { key: 'bronze', name: 'برنزی', emoji: '🥉', min: 0 },
  { key: 'silver', name: 'نقره‌ای', emoji: '🥈', min: 300 },
  { key: 'gold', name: 'طلایی', emoji: '🥇', min: 800 },
  { key: 'platinum', name: 'پلاتینیوم', emoji: '💎', min: 2000 },
];

export function tierFromPoints(points: number): LoyaltyTier {
  let current = LOYALTY_TIERS[0];
  for (const t of LOYALTY_TIERS) if (points >= t.min) current = t;
  return current;
}

export interface TierProgress {
  tier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
  pointsToNext: number | null;
  progressPct: number; // ۰..۱۰۰ — پیشرفتِ داخلِ باندِ سطحِ فعلی؛ ۱۰۰ یعنی بالاترین سطح
}

/** پیشرفت تا سطحِ بعدی — منطقِ خالص، بدونِ DB، مستقیماً تست‌پذیر. */
export function tierProgress(points: number): TierProgress {
  const idx = LOYALTY_TIERS.findIndex((t) => t.key === tierFromPoints(points).key);
  const tier = LOYALTY_TIERS[idx];
  const nextTier = LOYALTY_TIERS[idx + 1] ?? null;
  if (!nextTier) return { tier, nextTier: null, pointsToNext: null, progressPct: 100 };
  const bandStart = tier.min, bandEnd = nextTier.min;
  const pct = Math.round(((points - bandStart) / (bandEnd - bandStart)) * 1000) / 10;
  return {
    tier, nextTier, pointsToNext: bandEnd - points,
    progressPct: Math.max(0, Math.min(100, pct)),
  };
}

// ── نشان‌ها ──

export interface BadgeDef { key: string; emoji: string; name: string; }
export interface BadgeStatus extends BadgeDef { earned: boolean; }

export const BADGE_DEFS: readonly BadgeDef[] = [
  { key: 'first_visit', emoji: '🍽️', name: 'اولین رزرو' },
  { key: 'streak5', emoji: '🔥', name: '۵ هفته پیاپی' },
  { key: 'gourmet', emoji: '⭐', name: 'گورمه' },
  { key: 'night_owl', emoji: '🌙', name: 'شب‌نشین' },
  { key: 'vip', emoji: '👑', name: 'VIP' },
  { key: 'explorer', emoji: '🗺️', name: 'کاشف' },
];

const GOURMET_MIN_RESTAURANTS = 3;
const EXPLORER_MIN_RESTAURANTS = 7;
const NIGHT_OWL_MIN_VISITS = 3;
const STREAK_BADGE_WEEKS = 5;

export interface BadgeInputs {
  globalVisits: number;
  restaurantsVisited: number;
  isVipAnywhere: boolean;
  streakWeeks: number;
  nightOwlVisits: number;
}

/** آیا هرکدام از ۶ نشان کسب شده؟ منطقِ خالص، بدونِ DB. */
export function computeBadges(input: BadgeInputs): BadgeStatus[] {
  const earnedByKey: Record<string, boolean> = {
    first_visit: input.globalVisits >= 1,
    streak5: input.streakWeeks >= STREAK_BADGE_WEEKS,
    gourmet: input.restaurantsVisited >= GOURMET_MIN_RESTAURANTS,
    night_owl: input.nightOwlVisits >= NIGHT_OWL_MIN_VISITS,
    vip: input.isVipAnywhere,
    explorer: input.restaurantsVisited >= EXPLORER_MIN_RESTAURANTS,
  };
  return BADGE_DEFS.map((def) => ({ ...def, earned: earnedByKey[def.key] ?? false }));
}

const TEHRAN_TZ = 'Asia/Tehran';

/**
 * تعدادِ بازدیدهایی که در بازه‌ی «شب‌نشینی» (۲۲:۰۰ تا ۰۴:۰۰ به‌وقتِ تهران)
 * بوده‌اند. با hourInTz، نه Date.getHours() خام — سرور UTC اجرا می‌شود.
 */
export function countNightOwlVisits(visitDates: readonly Date[], timezone = TEHRAN_TZ): number {
  return visitDates.filter((d) => {
    const h = hourInTz(d, timezone);
    return h >= 22 || h < 4;
  }).length;
}

/** شماره‌ی یکتا و یکنواختِ «هفته» برایِ یک تاریخِ تقویمی — فقط برایِ سنجشِ توالی؛
 *  لازم نیست با شماره‌گذاریِ رسمیِ ISO هفته یکی باشد. epoch (۱۹۷۰-۰۱-۰۱) پنجشنبه
 *  بود؛ +۴ هفته را از دوشنبه شروع می‌کند (بی‌اهمیت برایِ توالی، فقط برایِ ثبات). */
function weekIndex(y: number, m: number, day: number): number {
  const days = Math.floor(Date.UTC(y, m - 1, day) / 86_400_000);
  return Math.floor((days + 4) / 7);
}

/**
 * طولانی‌ترین رشته‌ی هفته‌های متوالی (به‌وقتِ تهران) که در آن‌ها حداقل یک
 * بازدید بوده — پایه‌ی نشانِ «۵ هفته پیاپی». چندبازدیدی در یک هفته یک‌بار
 * شمرده می‌شود.
 */
export function longestWeekStreak(visitDates: readonly Date[], timezone = TEHRAN_TZ): number {
  if (visitDates.length === 0) return 0;
  const weeks = new Set<number>();
  for (const d of visitDates) {
    const { y, m, day } = dateInTz(d, timezone);
    weeks.add(weekIndex(y, m, day));
  }
  const sorted = [...weeks].sort((a, b) => a - b);
  let longest = 1, current = 1;
  for (let i = 1; i < sorted.length; i++) {
    current = sorted[i] === sorted[i - 1] + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

// ── از اینجا به بعد: DB واقعی. در تستِ واحد صدا زده نمی‌شود. ──

/** زمانِ شروعِ بازدیدهایی که واقعاً اتفاق افتاده‌اند (در همه‌ی رستوران‌ها). */
async function fetchVisitTimestamps(userId: string): Promise<Date[]> {
  const rows = await db.reservation.findMany({
    where: { userId, status: { in: visitedStatusList() as any } },
    select: { slotStart: true },
  });
  return rows.map((r) => r.slotStart);
}

export interface LoyaltyStatusResult {
  points: number;
  tier: { key: string; name: string; emoji: string };
  next_tier: { key: string; name: string; emoji: string } | null;
  points_to_next: number | null;
  progress_pct: number;
  badges: BadgeStatus[];
}

/**
 * وضعیتِ کاملِ وفاداریِ یک کاربر — امتیاز، سطح، پیشرفت، نشان‌ها. همه از
 * دادهٔ واقعی (PointsLedger، GuestProfile، تاریخچه‌ی بازدید) — هیچ عددِ
 * ثابتی نیست.
 */
export async function getLoyaltyStatus(userId: string): Promise<LoyaltyStatusResult> {
  const [points, profile, visitDates] = await Promise.all([
    getPointsBalance(userId),
    getGuestProfile(userId),
    fetchVisitTimestamps(userId),
  ]);
  const progress = tierProgress(points);
  const badges = computeBadges({
    globalVisits: profile?.globalVisits ?? 0,
    restaurantsVisited: profile?.restaurantsVisited ?? 0,
    isVipAnywhere: profile?.isVipAnywhere ?? false,
    streakWeeks: longestWeekStreak(visitDates),
    nightOwlVisits: countNightOwlVisits(visitDates),
  });
  return {
    points,
    tier: { key: progress.tier.key, name: progress.tier.name, emoji: progress.tier.emoji },
    next_tier: progress.nextTier
      ? { key: progress.nextTier.key, name: progress.nextTier.name, emoji: progress.nextTier.emoji }
      : null,
    points_to_next: progress.pointsToNext,
    progress_pct: progress.progressPct,
    badges,
  };
}
