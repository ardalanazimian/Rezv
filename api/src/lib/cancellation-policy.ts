import { db } from './db';
import { cached, cacheKey } from './cache';
import { forecastHoltWinters, type SeriesModelState } from './demand-forecast';
import type { ReputationTier } from './economy';

// ═══════════════════════════════════════════════════════════════════════
//  Cancellation Policy Engine — resolvePolicy()
//
//  الگوریتمِ لایه‌ای با «قفل»: هر لایه یه فیلد رو می‌تونه سخت‌گیرانه‌تر کنه
//  و اگه لازم بود قفلش کنه؛ لایه‌هایِ بعدی نمی‌تونن فیلدِ قفل‌شده رو باز کنن.
//  ترتیب (طراحیِ کاملِ جلسه‌ی محصول، ۲۰۲۶-۰۸-۱۲):
//    ۱) تقاضایِ دینامیک — فقط سخت‌گیرتر می‌کنه، بر اساسِ پیش‌بینیِ *خودِ*
//       رستوران (نسبت‌به میانگینِ اخیرش، نه یه درصدِ اشغالِ مطلق که نیازِ
//       ظرفیتِ فیزیکیِ دقیق داره و اینجا نداریم) — فقط وقتی مدلِ یادگرفته‌شده
//       واقعاً isActive باشه، وگرنه صرف‌نظر می‌شه (هیچ‌وقت رویِ پیش‌بینیِ
//       اثبات‌نشده تصمیمِ سخت‌گیرانه نمی‌گیریم — همون فلسفه‌ی no-show-model).
//    ۲) override رویدادِ ویژه‌یِ رستوران — همیشه قفل (تصمیمِ صریحِ رستوران).
//    ۳) تخفیفِ سطحِ اعتبارِ مشتری — فقط فیلدهایِ باز رو شل می‌کنه.
//    ۴) Abuse — همیشه آخر، صرف‌نظر از قفل، خودش رو دوباره تحمیل می‌کنه
//       (defense-in-depth، تا یه باگِ ترتیب نتونه abuse رو دور بزنه).
// ═══════════════════════════════════════════════════════════════════════

type LockableField<T> = { value: T; locked: boolean };

export interface ResolvedPolicy {
  freeCancelHours: number;
  partialPenaltyHours: number;
  partialPenaltyPct: number;
  depositRequired: boolean;
  autoConfirm: boolean;
  /** برایِ شفافیت/دیباگ — کدوم لایه‌ها واقعاً چیزی رو تغییر دادن. */
  appliedLayers: string[];
}

const DEFAULT_POLICY = {
  freeCancelHours: 24,
  partialPenaltyHours: 2,
  partialPenaltyPct: 50,
  depositRequired: false,
  autoConfirm: true,
};

/** نسبت‌هایِ تشخیصِ تقاضایِ بالا/حاد — نسبت‌به میانگینِ ۷روزه‌یِ اخیرِ همون رستوران. */
const HIGH_DEMAND_MULTIPLIER = 1.3;
const EXTREME_DEMAND_MULTIPLIER = 1.6;

export type SpecialEventOverride = Partial<{
  freeCancelHours: number;
  partialPenaltyHours: number;
  partialPenaltyPct: number;
  depositRequired: boolean;
  autoConfirm: boolean;
}>;

/**
 * هسته‌ی خالص (بدونِ I/O) — چهار لایه رو رویِ ورودی‌هایِ از‌قبل‌خونده‌شده اعمال
 * می‌کنه. جدا از resolvePolicy تا مستقیم و بدونِ DB قابلِ‌تست باشه (همون الگویِ
 * computeEventScore در economy.ts).
 */
export function computeResolvedPolicy(input: {
  basePolicy: { freeCancelHours: number; partialPenaltyHours: number; partialPenaltyPct: number; depositRequired: boolean; autoConfirm: boolean } | null;
  demandRatio: number | null; // از getDemandSignal — null یعنی این لایه صرف‌نظر می‌شه
  eventOverride: SpecialEventOverride | null;
  reputationTier: ReputationTier;
  strikeCount: number;
  hasActiveAbuseFlag: boolean;
}): ResolvedPolicy {
  const { basePolicy, demandRatio, eventOverride, reputationTier, strikeCount, hasActiveAbuseFlag } = input;
  const appliedLayers: string[] = [];

  const freeCancelHours: LockableField<number> = { value: basePolicy?.freeCancelHours ?? DEFAULT_POLICY.freeCancelHours, locked: false };
  let partialPenaltyHours = basePolicy?.partialPenaltyHours ?? DEFAULT_POLICY.partialPenaltyHours;
  let partialPenaltyPct = basePolicy?.partialPenaltyPct ?? DEFAULT_POLICY.partialPenaltyPct;
  const depositRequired: LockableField<boolean> = { value: basePolicy?.depositRequired ?? DEFAULT_POLICY.depositRequired, locked: false };
  const autoConfirm: LockableField<boolean> = { value: basePolicy?.autoConfirm ?? DEFAULT_POLICY.autoConfirm, locked: false };

  // ── لایه‌ی ۱: تقاضایِ دینامیک (فقط سخت‌گیرتر می‌کنه) ──
  if (demandRatio !== null) {
    if (demandRatio >= HIGH_DEMAND_MULTIPLIER) {
      depositRequired.value = true;
      freeCancelHours.value = Math.max(freeCancelHours.value, 48);
      appliedLayers.push('dynamic_demand_high');
    }
    if (demandRatio >= EXTREME_DEMAND_MULTIPLIER) {
      depositRequired.locked = true; // حتی Platinum هم رویِ کمیابیِ حاد معاف نمی‌شه
      appliedLayers.push('dynamic_demand_extreme_lock');
    }
  }

  // ── لایه‌ی ۲: override رویدادِ ویژه‌یِ رستوران (همیشه قفل) ──
  if (eventOverride) {
    if (eventOverride.freeCancelHours !== undefined) freeCancelHours.value = eventOverride.freeCancelHours;
    if (eventOverride.partialPenaltyHours !== undefined) partialPenaltyHours = eventOverride.partialPenaltyHours;
    if (eventOverride.partialPenaltyPct !== undefined) partialPenaltyPct = eventOverride.partialPenaltyPct;
    if (eventOverride.depositRequired !== undefined) depositRequired.value = eventOverride.depositRequired;
    if (eventOverride.autoConfirm !== undefined) autoConfirm.value = eventOverride.autoConfirm;
    freeCancelHours.locked = true;
    depositRequired.locked = true;
    autoConfirm.locked = true;
    appliedLayers.push('special_event_override');
  }

  // ── لایه‌ی ۳: تخفیفِ سطحِ اعتبار — فقط فیلدهایِ بازِ (unlocked) رو شل می‌کنه ──
  if (reputationTier === 'gold' || reputationTier === 'platinum') {
    if (!depositRequired.locked && depositRequired.value) {
      depositRequired.value = false;
      appliedLayers.push('tier_leniency_deposit_waived');
    }
  }
  if (reputationTier === 'platinum') {
    if (!freeCancelHours.locked) {
      freeCancelHours.value = Math.max(0, freeCancelHours.value - 12);
      appliedLayers.push('tier_leniency_shorter_window');
    }
  }

  // ── لایه‌ی ۴: Abuse — همیشه آخر، صرف‌نظر از قفلِ لایه‌هایِ قبلی ──
  if (hasActiveAbuseFlag || strikeCount >= 3) {
    depositRequired.value = true;
    autoConfirm.value = false;
    appliedLayers.push('abuse_override');
  }

  return {
    freeCancelHours: freeCancelHours.value,
    partialPenaltyHours,
    partialPenaltyPct,
    depositRequired: depositRequired.value,
    autoConfirm: autoConfirm.value,
    appliedLayers,
  };
}

export async function resolvePolicy(opts: {
  restaurantId: string;
  slotStart: Date;
  reputationTier: ReputationTier;
  strikeCount: number;
  hasActiveAbuseFlag: boolean;
}): Promise<ResolvedPolicy> {
  const { restaurantId, slotStart, reputationTier, strikeCount, hasActiveAbuseFlag } = opts;

  const basePolicy = await db.cancellationPolicy.findUnique({ where: { restaurantId } });
  const demand = await getDemandSignal(restaurantId, slotStart);

  // فیلترِ policyOverride غیرِ‌null رو تویِ JS چک می‌کنیم، نه تویِ WHERE — فیلترِ
  // JSON-not-null در Prisma نیازِ Prisma.JsonNull داره که پیچیدگیِ اضافه‌ست
  // برایِ یه کوئریِ کوچیک؛ رویدادهایِ این بازه‌ی زمانی معمولاً کمن.
  const event = await db.specialEvent.findFirst({
    where: {
      restaurantId,
      isPublished: true,
      startsAt: { lte: slotStart },
      OR: [{ endsAt: null }, { endsAt: { gte: slotStart } }],
    },
    orderBy: { startsAt: 'desc' },
  }).catch(() => null);

  return computeResolvedPolicy({
    basePolicy,
    demandRatio: demand?.ratio ?? null,
    eventOverride: (event?.policyOverride as SpecialEventOverride | null) ?? null,
    reputationTier,
    strikeCount,
    hasActiveAbuseFlag,
  });
}

/**
 * سیگنالِ تقاضایِ نسبی برایِ یه تاریخِ خاص — نسبتِ پیش‌بینیِ کاورهایِ اون روز
 * به میانگینِ ۷روزه‌یِ اخیرِ *همون رستوران*. عمداً از درصدِ اشغالِ مطلق
 * استفاده نمی‌کنه (نیازِ به مدل‌سازیِ دقیقِ ظرفیت/turnover داره که خارج از
 * دامنه‌یِ همین commit است) — فقط وقتی مدلِ یادگرفته‌شده isActive باشه
 * محاسبه می‌شه، وگرنه null (یعنی این لایه صرف‌نظر می‌شه، نه اینکه یه عددِ
 * حدسی جایگزینش بشه).
 */
async function getDemandSignal(restaurantId: string, slotStart: Date): Promise<{ ratio: number } | null> {
  const row = await cached(cacheKey('cancellation-policy-demand', restaurantId), 3600, () =>
    db.restaurantDemandForecast.findUnique({ where: { restaurantId }, select: { coversModel: true } }),
  );
  if (!row) return null;
  const state = row.coversModel as unknown as SeriesModelState;
  if (!state?.isActive || !state.lastValues?.length) return null;

  const daysAhead = Math.max(0, Math.round((slotStart.getTime() - Date.now()) / 86_400_000));
  const forecast = forecastHoltWinters(state.model, daysAhead + 1);
  const predicted = forecast[daysAhead];
  if (predicted === undefined) return null;

  const recentMean = state.lastValues.reduce((a, b) => a + b, 0) / state.lastValues.length;
  if (recentMean <= 0) return null;
  return { ratio: predicted / recentMean };
}
