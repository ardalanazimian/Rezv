import { db } from './db';
import { sinceDays } from './staff-helpers';
import { computeStaticScoreFromFeatures, type RawFeatureInput } from './ml-core';
import { loadPriorHistory } from './no-show-features';
// ⚠️ عمداً static است، نه `await import()`: چرخه‌ی import با شکستنِ آن در
// ml-core.ts از بین رفت، و importِ پویا در این مسیر روی Node 20 واقعاً
// می‌شکست (جزئیات در ml-core.ts).
import { getLearnedNoShowModelWithRun, predictProba, buildFeatureVector } from './no-show-model';

// ═══════════════════════════════════════════════════════════
//  موتور پیش‌بینی No-Show و محاسبه‌ی CLV — رزرونو
//
//  بدون نیاز به ML infra: مدل امتیازدهی heuristic مبتنی بر
//  داده‌ی واقعی رفتار مشتری (سابقه‌ی no-show، نحوه‌ی رزرو، فاصله‌ی
//  زمانی رزرو تا الان). دقت کافی برای تصمیم عملیاتی (پیشنهاد بیعانه،
//  یادآوری SMS اضافه، overbook هوشمند) را دارد و کاملاً شفاف/قابل‌توضیح است
//  (در مقابل black-box ML که برای این مقیاس داده توجیه ندارد).
// ═══════════════════════════════════════════════════════════

export type NoShowInput = {
  userId: string | null;
  restaurantId: string;   // برای انتخاب مدلِ یادگرفته‌ی همین رستوران (اگر فعال باشد)
  partySize: number;
  slotStart: Date;
  createdAt: Date;     // زمان ثبت رزرو
  source: string;       // app | walk_in | phone ...
};

export type NoShowResult = {
  score: number;
  tier: 'low' | 'medium' | 'high';
  source: 'learned' | 'heuristic';
  /**
   * فازِ ۵ — ردِ ورودی برای دفترِ پیش‌بینی. اختیاری است تا صداکننده‌های
   * موجود (و stubهای تست) نشکنند، ولی مسیرِ تولید همیشه پُرش می‌کند.
   * `probability` عمداً جدا از `score` است: score عددِ ۰..۱۰۰ی نمایشی است،
   * probability احتمالِ خامِ ۰..۱ که Brier روی آن معنا دارد.
   */
  lineage?: {
    features: RawFeatureInput;
    probability: number;
    /** فازِ ۶ — اجرایِ آموزشی که این وزن‌ها را ساخت. heuristic ندارد → null. */
    modelRunId: string | null;
  };
};

// RawFeatureInput و computeStaticScoreFromFeatures به lib/ml-core.ts منتقل
// شدند تا چرخه‌ی importِ customer-insights ↔ no-show-model بشکند (توضیحِ کاملِ
// دلیل — و باگِ Node 20ی که لو داد — در خودِ ml-core.ts). این‌جا دوباره export
// می‌شوند چون مصرف‌کننده‌های موجود (تست‌ها، crm) از همین مسیر می‌خوانند و
// شکستنِ آن‌ها هیچ سودی نداشت.
export { computeStaticScoreFromFeatures };
export type { RawFeatureInput };

export function tierFromScore(score: number): 'low' | 'medium' | 'high' {
  return score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
}

/**
 * امتیاز ریسک no-show یک رزرو را در لحظه‌ی ثبت محاسبه می‌کند (۰..۱۰۰).
 *
 * اگر این رستوران مدلِ یادگرفته‌ی فعال داشته باشد (کالیبره‌شده از تاریخچه‌ی
 * خودش، نه فرمولِ سراسری) از آن استفاده می‌کند؛ وگرنه به همان heuristicِ
 * دستی برمی‌گردد. import پویا عمداً است: no-show-model.ts خودش این فایل را
 * import می‌کند (برای computeStaticScoreFromFeatures)، پس یک import ثابت
 * در این جهت یک وابستگیِ دوری واقعی در زمانِ اجرا می‌ساخت.
 */
export async function computeNoShowRisk(input: NoShowInput): Promise<NoShowResult> {
  // ── سابقه‌ی شخصی مشتری: قوی‌ترین سیگنال ──
  //
  // ⚠️ فازِ ۴: این محاسبه قبلاً همین‌جا دستی انجام می‌شد و با کوئریِ آموزش
  // اختلاف داشت (بدونِ فیلترِ رستوران، و بدونِ وضعیتِ `dining`) — یعنی مدل
  // ورودی‌ای می‌دید که رویش آموزش ندیده بود. حالا هر دو مسیر از یک تعریفِ
  // واحد در lib/no-show-features.ts می‌خوانند و تستِ برابری قفلش کرده.
  const { priorNoShows, priorTotal } = await loadPriorHistory({
    restaurantId: input.restaurantId,
    userId: input.userId ?? null,
    asOf: input.createdAt,
  });

  const features: RawFeatureInput = {
    hasUserId: !!input.userId,
    priorTotal,
    priorNoShowRate: priorTotal > 0 ? priorNoShows / priorTotal : 0,
    leadMinutes: (input.slotStart.getTime() - input.createdAt.getTime()) / 60000,
    partySize: input.partySize,
    source: input.source,
  };

  const learned = await getLearnedNoShowModelWithRun(input.restaurantId).catch(() => null);
  if (learned) {
    const probability = predictProba(learned.weights, buildFeatureVector(features));
    const score = Math.round(probability * 100);
    return {
      score, tier: tierFromScore(score), source: 'learned',
      // فازِ ۶: نسخه‌ی مدل هم در ردِ ورودی می‌آید تا دفترِ پیش‌بینی بتواند
      // نتیجه را به همان اجرایِ آموزش نسبت دهد. null یعنی مدلی است که پیش
      // از مهاجرتِ ۰۵۶ آموزش دیده — نسب‌نامه‌اش را جعل نمی‌کنیم.
      lineage: { features, probability, modelRunId: learned.runId },
    };
  }

  const score = computeStaticScoreFromFeatures(features);
  // heuristic احتمالِ واقعی نمی‌دهد؛ score/100 نزدیک‌ترین تفسیرِ صادقانه است
  // و همان چیزی است که در آموزش هم به‌عنوانِ baseline با Brier سنجیده می‌شود.
  // heuristic اجرایِ آموزش ندارد، پس modelRunId عمداً null است.
  return {
    score, tier: tierFromScore(score), source: 'heuristic',
    lineage: { features, probability: score / 100, modelRunId: null },
  };
}

// ───────────────────────────────────────────────────────────
//  CLV + سگمنت‌بندی — محاسبه‌ی per (رستوران × کاربر)
// ───────────────────────────────────────────────────────────

export async function recomputeCustomerInsight(restaurantId: string, userId: string) {
  const reservations = await db.reservation.findMany({
    where: { restaurantId, userId },
    select: { status: true, slotStart: true, createdAt: true, items: { select: { qty: true, menuItem: { select: { priceToman: true } } } } },
    orderBy: { slotStart: 'asc' },
  });
  if (reservations.length === 0) return null;

  const isVisit = (s: string) => ['completed', 'arrived', 'seated', 'dining'].includes(s);
  const visits = reservations.filter(r => isVisit(r.status));
  const noShows = reservations.filter(r => r.status === 'no_show').length;
  const cancels = reservations.filter(r => ['cancelled', 'cancelled_by_user', 'cancelled_by_restaurant', 'auto_cancelled'].includes(r.status)).length;

  // ⚠️ صفرِ تأییدشده در برابرِ نامعلوم (ممیزیِ ۲۰۲۶-۰۸-۱۹).
  // رزرونو POS-agnostic است و مبلغِ فاکتور را نمی‌بیند؛ تنها منبعِ مبلغ
  // پیش‌سفارش از منوست. اگر رستوران هیچ آیتمِ منویِ فعالِ قیمت‌دار نداشته باشد،
  // پیش‌سفارش اصلاً ممکن نیست — پس «۰ تومان» یک اندازه‌گیری نیست، یک آرتیفکت
  // است. در آن حالت NULL می‌نویسیم (= نامعلوم). اگر منو وجود دارد ولی مهمان
  // چیزی پیش‌سفارش نداده، ۰ یک واقعیتِ تأییدشده است و همان ۰ ذخیره می‌شود.
  const pricedMenuCount = await db.menuItem.count({
    where: { restaurantId, isActive: true, priceToman: { gt: 0 } },
  });
  const spendMeasurable = pricedMenuCount > 0;

  const totalVisits = visits.length;
  const totalSpend = spendMeasurable
    ? visits.reduce((sum, r) => sum + r.items.reduce((s, it) => s + it.qty * it.menuItem.priceToman, 0), 0)
    : null;
  const avgSpend = totalSpend === null ? null : (totalVisits ? Math.round(totalSpend / totalVisits) : 0);

  const firstVisit = visits[0]?.slotStart ?? null;
  const lastVisit = visits[totalVisits - 1]?.slotStart ?? null;

  let freqDays: number | null = null;
  if (firstVisit && lastVisit && totalVisits > 1) {
    const spanDays = (lastVisit.getTime() - firstVisit.getTime()) / 86_400_000;
    freqDays = spanDays / (totalVisits - 1);
  }

  // ── پیش‌بینی CLV ۱۲ ماه آینده: تعداد بازدید پیش‌بینی‌شده × میانگین هزینه ──
  // اگر فاصله‌ی بازدید نامعلوم (فقط ۱ بازدید)، فرض پایه‌ی محتاطانه: ۴ بازدید/سال در صورت بازگشت
  const visitsPerYear = freqDays ? Math.min(52, 365 / freqDays) : totalVisits === 1 ? 2 : 0;
  // بدونِ ورودیِ مبلغی، CLV یک پیش‌بینی نیست — حاصل‌ضرب در صفر است. به‌جایِ
  // تولیدِ «۰ تومان» به‌عنوانِ پیش‌بینی، صریحاً «نامعلوم» می‌ماند.
  const predictedClv = avgSpend === null ? null : Math.round(visitsPerYear * avgSpend);

  const totalAttempts = totalVisits + noShows;
  const noShowRatePct = totalAttempts ? Math.round((noShows / totalAttempts) * 100) : 0;

  // ── ریسک ریزش: چند روز از آخرین بازدید گذشته نسبت به فاصله‌ی معمول او ──
  // ⚠️ رفعِ باگ (پیدا‌شده هنگامِ ساختِ ویجتِ «مشتریانِ برتر» در پنلِ بیزنس):
  // قبلاً فقط سقفِ ۱۰۰ کلمپ می‌شد، نه کفِ صفر. اگر lastVisitAt به هر دلیلی
  // (مثلاً رزروِ امروز/آینده که هنوز واقعاً اتفاق نیفتاده ولی به‌عنوانِ
  // بازدید حساب شده) بعد از «الان» باشد، daysSince منفی می‌شد و churnRisk
  // منفی برمی‌گشت — که در UI به‌صورتِ «۱۰۱٪ بازگشت» (بیش از صد درصد) دیده
  // می‌شد. ریسکِ ریزش نمی‌تواند منفی باشد؛ حداقلش صفر است.
  let churnRisk = 0;
  if (lastVisit) {
    const daysSince = (Date.now() - lastVisit.getTime()) / 86_400_000;
    const expectedGap = freqDays ?? 45;
    churnRisk = Math.round(Math.max(0, Math.min(100, (daysSince / (expectedGap * 2)) * 100)));
  }

  let segment: 'new_customer' | 'active' | 'at_risk' | 'churned' | 'vip' = 'new_customer';
  if (totalVisits === 0) segment = 'new_customer';
  else if (churnRisk >= 75) segment = 'churned';
  else if (churnRisk >= 40) segment = 'at_risk';
  else segment = 'active';

  await db.customerInsight.upsert({
    where: { restaurantId_userId: { restaurantId, userId } },
    create: {
      restaurantId, userId, totalVisits, totalSpendToman: totalSpend, avgSpendToman: avgSpend,
      visitFrequencyDays: freqDays, predictedClvToman: predictedClv, firstVisitAt: firstVisit, lastVisitAt: lastVisit,
      noShowCount: noShows, cancelCount: cancels, completedCount: totalVisits, noShowRatePct, churnRiskScore: churnRisk,
      segment,
    },
    update: {
      totalVisits, totalSpendToman: totalSpend, avgSpendToman: avgSpend,
      visitFrequencyDays: freqDays, predictedClvToman: predictedClv, firstVisitAt: firstVisit, lastVisitAt: lastVisit,
      noShowCount: noShows, cancelCount: cancels, completedCount: totalVisits, noShowRatePct, churnRiskScore: churnRisk,
      segment,
    },
  });

  return { totalVisits, totalSpend, avgSpend, freqDays, predictedClv, noShowRatePct, churnRisk, segment };
}

/** پس از تعیین سگمنت‌ها، VIP = ۱۰٪ بالای CLV این رستوران (دهک برتر) — جداگانه فراخوانی می‌شود (سبک، یک کوئری).
 *
 *  ⚠️ باگ M11: قبلاً برای مشتریان بالای cutoff، segment را هم به 'vip' تغییر می‌داد
 *  (حتی اگر churned/at_risk بودند) و برای مشتریانی که از دهک برتر خارج می‌شدند فقط
 *  isVip را false می‌کرد ولی segment='vip' باقی می‌ماند → drift دائمی. حالا VIP فقط
 *  یک flag بولی است و segment (که از churn/recency محاسبه می‌شود) دست‌نخورده می‌ماند. */
export async function refreshVipFlags(restaurantId: string) {
  const count = await db.customerInsight.count({ where: { restaurantId } });
  if (count < 10) return; // برای رستوران‌های کوچک، VIP-بندی دهکی بی‌معنی است
  const vipCutoffIndex = Math.max(0, Math.floor(count * 0.1) - 1);
  const cutoffRow = await db.customerInsight.findMany({
    where: { restaurantId }, orderBy: { predictedClvToman: 'desc' }, skip: vipCutoffIndex, take: 1, select: { predictedClvToman: true },
  });
  const cutoff = cutoffRow[0]?.predictedClvToman ?? Infinity;
  // فقط flag بولی isVip را ست/ریست کن — segment را تغییر نده (drift رفع شد).
  await db.customerInsight.updateMany({ where: { restaurantId, predictedClvToman: { gte: cutoff } }, data: { isVip: true } });
  await db.customerInsight.updateMany({ where: { restaurantId, predictedClvToman: { lt: cutoff } }, data: { isVip: false } });
}

/** برای cron شبانه: همه‌ی کاربران فعال یک رستوران در ۱۸۰ روز اخیر را بازمحاسبه می‌کند. */
export async function recomputeAllForRestaurant(restaurantId: string) {
  const userIds = await db.reservation.findMany({
    where: { restaurantId, userId: { not: null }, createdAt: { gte: sinceDays(180) } },
    select: { userId: true }, distinct: ['userId'],
  });
  for (const { userId } of userIds) {
    if (userId) await recomputeCustomerInsight(restaurantId, userId);
  }
  await refreshVipFlags(restaurantId);
  return userIds.length;
}
