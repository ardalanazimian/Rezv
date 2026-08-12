import { db } from './db';
import { getCustomerEconomyProfile } from './economy';
import { listMissionsForUser } from './missions';
import { listRewardItems } from './rewards';
import { forecastHoltWinters, type SeriesModelState } from './demand-forecast';

// ═══════════════════════════════════════════════════════════════════════
//  Smart Incentive Engine
//
//  یه لایه‌ی تصمیمِ محض (نه یه مدلِ DB جدید) که سیگنال‌هایی رو که قبلاً در
//  زیرسیستم‌هایِ دیگه محاسبه شده‌ن (CustomerInsight.segment/churnRiskScore،
//  CustomerEconomyProfile.reliabilityScore/reputationTier،
//  RestaurantDemandForecast) می‌خونه و ازشون یه لیستِ رتبه‌بندی‌شده از
//  پیشنهادهایِ «الان چیکار کنی» برایِ مشتری می‌سازه (کدوم ماموریت رو کامل
//  کنه، کدوم جایزه براش باز شده، کِی کم‌ازدحامه).
//
//  عمداً روی lib/automation.ts (اجراکننده‌یِ SMSِ trigger-based) سوار
//  نمی‌شه که جایگزینش کنه — این یه سطحِ دیگه‌ست: automation.ts «پیام‌رسانِ
//  بیرونی» (SMS با قالبِ ثابت) رو اداره می‌کنه، این فایل «توصیه‌گرِ داخلِ‌اپ»
//  (چیزی که مشتری وقتی اپ رو باز می‌کنه می‌بینه) رو. دو مسیرِ مستقل با
//  دیتایِ منبعِ مشترک — دقیقاً همون معماریِ Reliability/Economy که چند تا
//  زیرسیستمِ مستقل (missions/rewards/cancellation-policy) رویِ یه پروفایلِ
//  مشترک سوارن.
//
//  ⚠️ صداقت: off_peak_nudge فقط یه *توصیه*‌ست («این رستوران این روز خلوت‌تره»)
//  نه یه قولِ پاداشِ تضمین‌شده — چون فعلاً هیچ مکانیزمِ backendی برایِ
//  پاداش‌دادنِ واقعیِ رزروِ ساعتِ خلوت وجود نداره (اضافه‌کردنش خارج از
//  دامنه‌یِ این commit است). هرگز ادعا نکن که XP/سکه‌ی تضمینی می‌ده.
// ═══════════════════════════════════════════════════════════════════════

/** نسبتِ تقاضا زیرِ این آستانه یعنی «روزِ کم‌ازدحام» — همون آستانه‌یِ محافظه‌کارانه. */
const LOW_DEMAND_THRESHOLD = 0.7;

export type IncentiveKind = 'mission' | 'reward' | 'off_peak_nudge';

export interface IncentiveSuggestion {
  kind: IncentiveKind;
  ref_id?: string;
  title: string;
  reason: string;
  /** بالاتر = مهم‌تر (فقط برایِ مرتب‌سازی، به کلاینت نشت نمی‌کنه). */
  priority: number;
}

export interface RankIncentivesInput {
  segment: string; // CustomerSegment یا 'new_customer' برایِ مشتریِ بدونِ insight
  churnRiskScore: number; // 0..100
  reliabilityScore: number; // 0..100 — فقط داخلی/تصمیم‌گیری، هرگز مستقیم به کلاینت برنمی‌گرده
  reputationTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  hasActiveAbuseFlag: boolean;
  lowDemandDay: { date: string; ratio: number } | null;
  missions: { id: string; title: string; kind: string; progress: number; targetCount: number; completed: boolean; claimed: boolean }[];
  rewardItems: { id: string; title: string; costCoins: number; minTier: string; unlocked: boolean; inStock: boolean }[];
}

/**
 * هسته‌ی خالص (بدونِ I/O) — دقیقاً همون الگویِ computeResolvedPolicy/
 * computeEventScore: قابلِ‌تستِ مستقیم بدونِ DB.
 *
 * قوانین به‌ترتیبِ اولویت:
 *  ۱) ماموریتِ کامل‌شده‌یِ claim‌نشده — همیشه بالاترین (جایزه‌یِ رایگانِ منتظر).
 *  ۲) اگه hasActiveAbuseFlag: همینجا برمی‌گرده — هیچ nudge/تشویقِ جدیدی
 *     برایِ کاربرِ فلگ‌دار پیشنهاد نمی‌شه (فقط جایزه‌یِ از‌قبل‌کامل‌شده، اگه
 *     بالا اضافه شده باشه).
 *  ۳) مشتریِ new_customer: ماموریتِ onboarding.
 *  ۴) ریسکِ ریزشِ بالا/segmentِ at_risk|churned: نزدیک‌ترین ماموریتِ ناتمام
 *     به تکمیل (کمترین تلاشِ باقی‌مونده = بیشترین احتمالِ اقدام).
 *  ۵) اعتبارِ بالا (gold/platinum + reliabilityScore>=85): گرون‌ترین جایزه‌یِ
 *     unlocked رو highlight کن (حسِ VIP، نه یه پیشنهادِ خرید).
 *  ۶) روزِ کم‌ازدحام: nudge (فقط توصیه).
 *  ۷) بقیه‌یِ ماموریت‌هایِ فعالِ ناتمام، با اولویتِ کمتر و بر اساسِ پیشرفت.
 */
export function rankIncentives(input: RankIncentivesInput): IncentiveSuggestion[] {
  const out: IncentiveSuggestion[] = [];
  const usedMissionIds = new Set<string>();

  const readyToClaim = input.missions.filter((m) => m.completed && !m.claimed);
  for (const m of readyToClaim) {
    out.push({ kind: 'mission', ref_id: m.id, title: m.title, reason: 'یه ماموریت رو کامل کردی — جایزه‌ات منتظره', priority: 100 });
    usedMissionIds.add(m.id);
  }

  if (input.hasActiveAbuseFlag) {
    return out.sort((a, b) => b.priority - a.priority).slice(0, 5);
  }

  if (input.segment === 'new_customer') {
    const onboarding = input.missions.find((m) => m.kind === 'onboarding' && !m.completed && !m.claimed);
    if (onboarding) {
      out.push({ kind: 'mission', ref_id: onboarding.id, title: onboarding.title, reason: 'اولین قدم رو بردار و XP بگیر', priority: 90 });
      usedMissionIds.add(onboarding.id);
    }
  }

  if (input.churnRiskScore >= 60 || input.segment === 'at_risk' || input.segment === 'churned') {
    const candidates = input.missions
      .filter((m) => !m.completed && !m.claimed && !usedMissionIds.has(m.id))
      .sort((a, b) => b.progress / b.targetCount - a.progress / a.targetCount);
    if (candidates[0]) {
      out.push({ kind: 'mission', ref_id: candidates[0].id, title: candidates[0].title, reason: 'یه قدم دیگه تا جایزه‌ی بعدی', priority: 85 });
      usedMissionIds.add(candidates[0].id);
    }
  }

  if ((input.reputationTier === 'gold' || input.reputationTier === 'platinum') && input.reliabilityScore >= 85) {
    const bestUnlocked = input.rewardItems
      .filter((r) => r.unlocked && r.inStock)
      .sort((a, b) => b.costCoins - a.costCoins)[0];
    if (bestUnlocked) {
      out.push({ kind: 'reward', ref_id: bestUnlocked.id, title: bestUnlocked.title, reason: 'به‌عنوانِ مهمانِ معتبر، این جایزه برایِ تو باز شده', priority: 70 });
    }
  }

  if (input.lowDemandDay) {
    out.push({
      kind: 'off_peak_nudge',
      title: 'رزروِ ساعاتِ خلوت',
      reason: `این رستوران رویِ ${input.lowDemandDay.date} ظرفیتِ بیشتری داره`,
      priority: 50,
    });
  }

  for (const m of input.missions) {
    if (m.completed || m.claimed || usedMissionIds.has(m.id)) continue;
    const progressPct = m.targetCount > 0 ? m.progress / m.targetCount : 0;
    out.push({ kind: 'mission', ref_id: m.id, title: m.title, reason: 'ماموریتِ فعال', priority: 30 + Math.round(progressPct * 10) });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

/**
 * نزدیک‌ترین روزِ کم‌ازدحامِ رستوران در ۷ روزِ آینده — فقط وقتی مدلِ
 * یادگرفته‌شده isActive باشه (همون انضباطِ resolvePolicy/getDemandSignal:
 * هیچ‌وقت رویِ پیش‌بینیِ اثبات‌نشده تصمیم نمی‌گیریم).
 */
async function findLowDemandDay(restaurantId: string): Promise<{ date: string; ratio: number } | null> {
  const row = await db.restaurantDemandForecast.findUnique({ where: { restaurantId }, select: { coversModel: true } });
  if (!row) return null;
  const state = row.coversModel as unknown as SeriesModelState;
  if (!state?.isActive || !state.lastValues?.length) return null;

  const recentMean = state.lastValues.reduce((a, b) => a + b, 0) / state.lastValues.length;
  if (recentMean <= 0) return null;

  const forecast = forecastHoltWinters(state.model, 7);
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  let best: { date: string; ratio: number } | null = null;
  forecast.forEach((v, h) => {
    const ratio = v / recentMean;
    if (ratio < LOW_DEMAND_THRESHOLD && (!best || ratio < best.ratio)) {
      const d = new Date(base);
      d.setDate(d.getDate() + h + 1);
      best = { date: d.toISOString().slice(0, 10), ratio: Math.round(ratio * 100) / 100 };
    }
  });
  return best;
}

/** wrapperِ DB-touching — همه‌ی سیگنال‌ها رو می‌خونه و به rankIncentives پاس می‌ده. */
export async function getIncentivesForUser(userId: string, restaurantId?: string): Promise<IncentiveSuggestion[]> {
  const [insight, profile, missions, lowDemandDay] = await Promise.all([
    restaurantId ? db.customerInsight.findUnique({ where: { restaurantId_userId: { restaurantId, userId } } }) : Promise.resolve(null),
    getCustomerEconomyProfile(db as any, userId),
    listMissionsForUser(userId, restaurantId),
    restaurantId ? findLowDemandDay(restaurantId) : Promise.resolve(null),
  ]);
  const rewardItems = await listRewardItems(profile.reputationTier, restaurantId);

  return rankIncentives({
    segment: insight?.segment ?? 'new_customer',
    churnRiskScore: insight?.churnRiskScore ?? 0,
    reliabilityScore: profile.reliabilityScore,
    reputationTier: profile.reputationTier as RankIncentivesInput['reputationTier'],
    hasActiveAbuseFlag: profile.hasActiveAbuseFlag,
    lowDemandDay,
    missions: missions.map((m) => ({
      id: m.id, title: m.title, kind: m.kind, progress: m.progress,
      targetCount: m.target_count, completed: m.completed, claimed: m.claimed,
    })),
    rewardItems: rewardItems.map((r) => ({
      id: r.id, title: r.title, costCoins: r.cost_coins, minTier: r.min_tier, unlocked: r.unlocked, inStock: r.in_stock,
    })),
  });
}
