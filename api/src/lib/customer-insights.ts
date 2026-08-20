import { db } from './db';
import { sinceDays } from './staff-helpers';
import { NO_SHOW_HEURISTIC_VERSION } from './prediction-ledger';

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
  score: number;                              // ۰..۱۰۰ — همان چیزی که UI/DB نشان می‌دهد
  tier: 'low' | 'medium' | 'high';
  source: 'learned' | 'heuristic';
  // ── نسبِ پیش‌بینی (lineage) برایِ دفترِ پیش‌بینی ───────────────────────
  // این سه فیلد تا ۲۰۲۶-۰۸-۲۰ اصلاً وجود نداشتند و حتی خودِ source هم سرِ
  // راه به DB دور ریخته می‌شد — یعنی نمی‌شد فهمید کدام امتیاز را مدل داده و
  // کدام را heuristic. بدونِ آن، سنجشِ تولیدیِ مدل در برابرِ baseline
  // غیرممکن بود. رجوع کن به lib/prediction-ledger.ts.
  /** احتمالِ خامِ ۰..۱ — قبل از گِردکردن به امتیازِ صحیح. Brier و
   *  کالیبراسیون باید روی همین حساب شوند، نه روی score/100 که دقتش را
   *  از دست داده است. */
  probability: number;
  /** شناسه‌ی تغییرناپذیرِ نسخه‌ی مدل: ISOیِ trainedAt برایِ مدلِ یادگرفته،
   *  NO_SHOW_HEURISTIC_VERSION برایِ heuristic. */
  modelVersion: string;
  /** بردارِ ویژگیِ ورودی — همان چیزی که مدل واقعاً دید (بدونِ PII). */
  features: RawFeatureInput;
};

/**
 * ویژگی‌های خامی که هم فرمولِ heuristic و هم مدلِ یادگرفته از رویشان
 * ساخته می‌شوند — تنها جایی که «سابقه‌ی مشتری» و «زمان‌بندیِ رزرو» به عدد
 * تبدیل می‌شوند. no-show-model.ts هم همین تایپ را (فقط به‌عنوانِ type،
 * بدونِ وابستگیِ اجرایی) import می‌کند تا دو مسیر از یک تعریف بخوانند.
 */
export type RawFeatureInput = {
  hasUserId: boolean;
  priorTotal: number;        // تعداد رزروهای حل‌شده‌ی قبلیِ همین کاربر (تکمیل‌شده + no-show)
  priorNoShowRate: number;   // noShows / priorTotal — فقط اگر priorTotal > 0 معنا دارد
  leadMinutes: number;
  partySize: number;
  source: string;
};

/**
 * فرمولِ heuristicِ دستی — بدونِ هیچ دسترسیِ DB، فقط از رویِ ویژگی‌های خام.
 * این تابع هم مسیرِ زنده‌ی fallback را تغذیه می‌کند (از computeNoShowRisk)
 * و هم baselineِ مقایسه در آموزشِ مدلِ یادگرفته را (از no-show-model.ts) —
 * منبعِ واحد، تا این دو مسیر روزی از هم جدا نیفتند.
 */
export function computeStaticScoreFromFeatures(f: RawFeatureInput): number {
  let score = 15; // پایه‌ی ریسک برای مهمان ناشناس (بدون سابقه)

  if (f.hasUserId) {
    if (f.priorTotal === 0) {
      score = 25; // کاربر شناخته‌شده ولی بدون سابقه‌ی حضور قطعی
    } else {
      score = Math.round(f.priorNoShowRate * 90) + 5; // نگاشت نرخ no-show به امتیاز
      if (f.priorTotal >= 5 && f.priorNoShowRate === 0) score = Math.max(2, score - 5); // مشتری وفادار با سابقه‌ی پاک
    }
  }

  // ── lead time: رزرو دقیقه‌ی ۹۰ام (last-minute) ریسک بیشتری دارد ──
  if (f.leadMinutes < 30) score += 12;
  else if (f.leadMinutes > 7 * 24 * 60) score += 6; // رزرو خیلی زودهنگام هم کمی ریسک بیشتر دارد (فراموشی)

  // ── گروه بزرگ بدون پیش‌سفارش/تأیید، ریسک سازمانی بیشتر دارد ──
  if (f.partySize >= 6) score += 8;

  // ── منبع رزرو: تماس تلفنی/walk-in نسبت به اپ کمی نامطمئن‌تر (داده‌ی تماس کمتر دقیق) ──
  if (f.source === 'phone') score += 5;

  return Math.max(0, Math.min(100, score));
}

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
  let priorTotal = 0, priorNoShows = 0;

  // ── سابقه‌ی شخصی مشتری: قوی‌ترین سیگنال ──
  if (input.userId) {
    const hist = await db.reservation.groupBy({
      by: ['status'],
      where: { userId: input.userId, status: { in: ['completed', 'no_show', 'arrived', 'seated'] } },
      _count: { _all: true },
    });
    const completed = hist.find(h => h.status === 'completed' || h.status === 'arrived' || h.status === 'seated')?._count._all ?? 0;
    priorNoShows = hist.find(h => h.status === 'no_show')?._count._all ?? 0;
    priorTotal = completed + priorNoShows;
  }

  const features: RawFeatureInput = {
    hasUserId: !!input.userId,
    priorTotal,
    priorNoShowRate: priorTotal > 0 ? priorNoShows / priorTotal : 0,
    leadMinutes: (input.slotStart.getTime() - input.createdAt.getTime()) / 60000,
    partySize: input.partySize,
    source: input.source,
  };

  const { getActiveNoShowModel, predictProba, buildFeatureVector } = await import('./no-show-model');
  const active = await getActiveNoShowModel(input.restaurantId).catch(() => null);
  if (active) {
    const probability = predictProba(active.weights, buildFeatureVector(features));
    const score = Math.round(probability * 100);
    return {
      score, tier: tierFromScore(score), source: 'learned',
      probability, modelVersion: active.trainedAt.toISOString(), features,
    };
  }

  const score = computeStaticScoreFromFeatures(features);
  return {
    score, tier: tierFromScore(score), source: 'heuristic',
    // heuristic ذاتاً امتیازِ صحیحِ ۰..۱۰۰ می‌دهد، پس احتمالش همان score/100
    // است — برخلافِ مسیرِ یادگرفته اینجا دقتی از دست نمی‌رود.
    probability: score / 100, modelVersion: NO_SHOW_HEURISTIC_VERSION, features,
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
