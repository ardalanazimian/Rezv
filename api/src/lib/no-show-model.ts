import { Prisma } from '@prisma/client';
import { db } from './db';
import { cached, cacheKey, invalidate } from './cache';
import {
  sigmoid, trainLogisticRegression, predictProba, brierScore, decideModelActivation,
  computeStaticScoreFromFeatures, type RawFeatureInput,
  type ActivationDecision,
} from './ml-core';

// ═══════════════════════════════════════════════════════════════════════
//  یادگیریِ ریسکِ no-show — کالیبراسیونِ واقعی، نه یک عدد ثابت برای همیشه
//
//  computeStaticNoShowRisk (در customer-insights.ts) یک heuristic با ضرایبِ
//  دستی‌ست: «last-minute یعنی +۱۲، گروهِ بزرگ یعنی +۸». همان اعداد برای
//  رستورانِ لوکسِ رزرو-هفته‌ها-قبل و فست‌فودِ walk-in-محور یکسان اعمال
//  می‌شدند و هیچ‌وقت با نتیجه‌ی واقعی سنجیده نمی‌شدند — یعنی نه یاد
//  می‌گرفتند، نه می‌شد فهمید غلط‌اند.
//
//  اینجا یک رگرسیونِ لجستیکِ ساده (gradient descent، بدونِ کتابخانه‌ی ML)
//  شبانه روی تاریخچه‌ی خودِ هر رستوران آموزش می‌بیند. کاملاً شفاف است — فقط
//  چند عدد (weight) که می‌شود نشانشان داد، نه یک مدلِ black-box.
//
//  ریاضیاتِ خالص (sigmoid، gradient descent، Brier، قاعده‌ی ایمنیِ فعال‌سازی)
//  در lib/ml-core.ts است — این‌جا فقط دوباره export می‌شوند تا کدِ موجود
//  (تست‌ها، customer-insights.ts) نشکند. هرچه اینجا مانده مخصوصِ no-show
//  است: بردارِ ویژگی، آستانه‌های ایمنی، و کوئریِ آموزش از دیتابیس.
//
//  قاعده‌ی ایمنی: مدلِ یادگرفته فقط وقتی جایگزینِ heuristic می‌شود که روی
//  دادهٔ نگه‌داشته‌شده (زمانی بعد از دادهٔ آموزش — نه split تصادفی، که برای
//  دادهٔ زمانی نشتِ اطلاعات ایجاد می‌کند) واقعاً از آن دقیق‌تر باشد. اگر
//  رستوران تازه‌کار باشد یا یادگیری بهتر از heuristic نباشد، سیستم بی‌صدا
//  روی heuristic می‌ماند — هیچ‌وقت مدلِ بدتر جایگزین نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

/** ترتیبِ ثابتِ بُعدها در وزن‌ها — بایاس همیشه اندیسِ ۰. باید با کامنتِ
 *  ستونِ weights در schema.prisma هم‌تراز بماند. */
export const NO_SHOW_FEATURE_NAMES = [
  'bias',
  'knownUser',        // کاربر دارای حساب (نه رزروِ مهمان)
  'priorNoShowRate',
  'lastMinute',       // < 30 دقیقه تا شروعِ اسلات
  'veryEarlyBooking', // > 7 روز تا شروعِ اسلات
  'largeParty',       // >= 6 نفر
  'phoneSource',
] as const;

const MIN_LEAD_MINUTES_RISKY = 30;
const MAX_LEAD_MINUTES_SAFE = 7 * 24 * 60;
const LARGE_PARTY_SIZE = 6;

/**
 * بردارِ ویژگی برای مدلِ یادگرفته — از همان RawFeatureInputِ تعریف‌شده در
 * customer-insights.ts می‌سازد (تنها به‌عنوانِ type import می‌شود، پس
 * وابستگیِ دوریِ اجرایی نمی‌سازد). فرمول‌بندی‌اش لزوماً با شاخه‌بندیِ
 * computeStaticScoreFromFeatures یکی نیست — این یک مدلِ جدید و مستقل است
 * که خودش وزن‌هایش را از داده یاد می‌گیرد، نه کپیِ heuristic.
 */
export function buildFeatureVector(input: RawFeatureInput): number[] {
  const hasHistory = input.hasUserId && input.priorTotal > 0;
  return [
    1, // بایاس
    input.hasUserId ? 1 : 0,
    hasHistory ? input.priorNoShowRate : 0,
    input.leadMinutes < MIN_LEAD_MINUTES_RISKY ? 1 : 0,
    input.leadMinutes > MAX_LEAD_MINUTES_SAFE ? 1 : 0,
    input.partySize >= LARGE_PARTY_SIZE ? 1 : 0,
    input.source === 'phone' ? 1 : 0,
  ];
}

// ── ریاضیاتِ خالصِ عمومی از lib/ml-core.ts — این‌جا re-export می‌شود تا
//    importهای موجود (تست‌ها، customer-insights.ts) بدونِ تغییر کار کنند. ──
export { sigmoid, trainLogisticRegression, predictProba, brierScore };

export interface TrainingExample {
  features: RawFeatureInput;
  label: 0 | 1; // 1 = no_show
}

export type { ActivationDecision };

const MIN_SAMPLE_SIZE = 40;
const MIN_POSITIVE_COUNT = 5;
/** بهبودِ نسبیِ حداقلی برای فعال‌کردنِ مدلِ یادگرفته — نوسانِ آماریِ کوچک
 *  نباید هر شب heuristic را با یک مدلِ تصادفاً کمی بهتر عوض کند. */
const MIN_RELATIVE_IMPROVEMENT = 0.05;

/**
 * آیا مدلِ یادگرفته باید جایگزینِ heuristic شود؟ منطقِ خالص، بدونِ DB —
 * مستقیماً تست‌پذیر. قاعده‌ی ایمنیِ عمومی در decideModelActivation
 * (lib/ml-core.ts) پیاده شده؛ اینجا فقط آستانه‌های مخصوصِ no-show
 * (MIN_SAMPLE_SIZE/MIN_POSITIVE_COUNT/MIN_RELATIVE_IMPROVEMENT) و گیتِ
 * اضافیِ «تعدادِ no-show کافی» را روی آن پیاده می‌کنیم.
 */
export function decideActivation(params: {
  sampleSize: number;
  positiveCount: number;
  learnedBrier: number;
  staticBrier: number;
}): ActivationDecision {
  const { sampleSize, positiveCount, learnedBrier, staticBrier } = params;
  return decideModelActivation({
    sampleSize,
    minSampleSize: MIN_SAMPLE_SIZE,
    learnedError: learnedBrier,
    baselineError: staticBrier,
    minRelativeImprovement: MIN_RELATIVE_IMPROVEMENT,
    baselineLabel: 'heuristic',
    extraGate: positiveCount < MIN_POSITIVE_COUNT
      ? { ok: false, reason: `تعدادِ no-show برای یادگیری کم است (${positiveCount} < ${MIN_POSITIVE_COUNT})` }
      : { ok: true, reason: '' },
  });
}

/** حداکثرِ تفاوتِ مجازِ احتمالِ پیش‌بینی‌شده که فقط از تغییرِ کانالِ رزرو
 *  (نه رفتارِ واقعی) ناشی می‌شود — ۲۰ درصدِ احتمال. */
const MAX_CHANNEL_BIAS_GAP = 0.2;

export interface BiasCheckResult {
  biased: boolean;
  /** احتمال(مهمان) − احتمال(کاربرِ ثبت‌نامی)، با همه‌ی عواملِ رفتاریِ دیگر یکسان و در حالتِ ریسکِ صفر. */
  knownUserGap: number;
  /** احتمال(رزروِ تلفنی) − احتمال(رزروِ غیرتلفنی)، همان شرایط. */
  phoneSourceGap: number;
  reason: string;
}

/**
 * تستِ سادهِ بایاسِ کانالی (نقشه‌راهِ AI، فازِ ۱) — آیا مدلِ یادگرفته صرفاً
 * به‌خاطرِ اینکه رزرو مهمان است یا از طریقِ تلفن ثبت شده (نه به‌خاطرِ
 * رفتارِ واقعیِ ریسک‌زا: last-minute، سابقه‌ی no-show، گروهِ بزرگ) امتیازِ
 * ریسک را به‌طرزِ نامتناسبی بالا/پایین می‌برد؟
 *
 * روش: یک بردارِ «ریسکِ صفر» می‌سازیم (بدونِ last-minute/very-early/
 * large-party/سابقه‌ی بد) و فقط یک ویژگیِ هویتی/کانالی را در هر بار
 * تغییر می‌دهیم. اگر تفاوتِ احتمالِ پیش‌بینی‌شده از MAX_CHANNEL_BIAS_GAP
 * بیشتر شود، یعنی مدل دارد بر اساسِ «کی هستی/چطور رزرو کردی» تبعیض
 * می‌گذارد، نه بر اساسِ رفتار — چنین مدلی نباید فعال شود، حتی اگر روی
 * Brier کلی از heuristic بهتر باشد.
 */
export function checkChannelBias(weights: number[]): BiasCheckResult {
  // ترتیب: [bias, knownUser, priorNoShowRate, lastMinute, veryEarlyBooking, largeParty, phoneSource]
  const registeredZeroRisk = [1, 1, 0, 0, 0, 0, 0];
  const guestZeroRisk = [1, 0, 0, 0, 0, 0, 0];
  const phoneZeroRisk = [1, 1, 0, 0, 0, 0, 1];

  const pRegistered = predictProba(weights, registeredZeroRisk);
  const pGuest = predictProba(weights, guestZeroRisk);
  const pPhone = predictProba(weights, phoneZeroRisk);

  const knownUserGap = pGuest - pRegistered;
  const phoneSourceGap = pPhone - pRegistered;
  const biased = Math.abs(knownUserGap) > MAX_CHANNEL_BIAS_GAP || Math.abs(phoneSourceGap) > MAX_CHANNEL_BIAS_GAP;
  const reason = biased
    ? `مدل صرفاً بر اساسِ کانالِ رزرو (نه رفتار) تفاوتِ زیادی در امتیاز می‌دهد — گپِ مهمان: ${(knownUserGap * 100).toFixed(1)}٪، گپِ تلفنی: ${(phoneSourceGap * 100).toFixed(1)}٪`
    : 'بدون بایاسِ کانالیِ قابل‌توجه';
  return { biased, knownUserGap, phoneSourceGap, reason };
}

/** ساختِ X,y از فهرستی از مثال‌ها — کمکیِ خالص برای تست و برای trainAndCalibrate. */
export function toMatrix(examples: readonly TrainingExample[]): { X: number[][]; y: number[] } {
  return {
    X: examples.map((e) => buildFeatureVector(e.features)),
    y: examples.map((e) => e.label),
  };
}

// ── از اینجا به بعد: DB واقعی. در تستِ واحد صدا زده نمی‌شود (نیاز به Postgres دارد). ──

interface TrainingRow {
  status: string;
  party_size: number;
  source: string;
  lead_minutes: number;
  has_user_id: boolean;
  prior_no_shows: number;
  prior_completions: number;
}

/**
 * تاریخچه‌ی رزروهای این رستوران را با ویژگیِ «سابقه‌ی مشتری در لحظه‌ی ثبت»
 * برمی‌گرداند — با window function، نه N کوئریِ جدا.
 *
 * نکته‌ی حیاتی برای جلوگیری از نشتِ زمانی: ROWS BETWEEN UNBOUNDED PRECEDING
 * ⚠️ این توضیح در ۲۰۲۶-۰۸-۲۰ بازنویسی شد: پیاده‌سازیِ قبلی window function
 * با `ORDER BY created_at ... 1 PRECEDING` بود و همین‌جا ادعا می‌کرد «دقیقاً
 * همان چیزی که در لحظه‌ی رزرو معلوم بوده». آن ادعا غلط بود — جزئیات و
 * سناریویِ اثبات در خودِ کوئریِ پایین. حالا شرطِ نقطه-در-زمان صریح است:
 * `h.slot_start < r.created_at`.
 *
 * COALESCE(user_id::text, id::text): برای رزروهای مهمان (بدون حساب کاربری)
 * user_id همه NULL است و NULL = NULL هرگز true نمی‌شود؛ بدونِ این fallback
 * هیچ مهمانی با خودش هم مطابقت نمی‌کرد. با id::text هر مهمان گروهِ
 * یک‌نفره‌ی خودش را می‌گیرد (یعنی همیشه «بدونِ سابقه»، دقیقاً مثلِ
 * heuristicِ فعلی) و سابقه‌ی مهمان‌های متفاوت با هم قاطی نمی‌شود.
 *
 * دامنه‌ی برچسب همان چیزی‌ست که recomputeCustomerInsight استفاده می‌کند:
 * completed/arrived/seated/dining = «آمد» (۰)، no_show = «نیامد» (۱).
 */
async function fetchTrainingRows(restaurantId: string): Promise<TrainingRow[]> {
  return db.$queryRaw<TrainingRow[]>`
    SELECT r.status, r.party_size, r.source,
           EXTRACT(EPOCH FROM (r.slot_start - r.created_at)) / 60.0 AS lead_minutes,
           (r.user_id IS NOT NULL) AS has_user_id,
           -- ⚠️ ::int صریح لازم است: COUNT/SUM در Postgres نوعِ bigint
           -- برمی‌گرداند، و Prisma bigint را به BigInt جاوااسکریپت map می‌کند،
           -- نه number — با اینکه TrainingRow زیر «number» اعلام شده (تایپ‌چک
           -- این دروغِ زمانِ اجرا را نمی‌بیند، چون $queryRaw فقط assertion است).
           -- بدونِ این cast، هر رستورانی که حتی یک مشتریِ تکراری داشته باشد
           -- (priorTotal>0) در dot() با «Cannot mix BigInt and other types»
           -- کرش می‌کرد — با تستِ واقعی روی Postgres پیدا شد.
           p.prior_no_shows::int   AS prior_no_shows,
           p.prior_completions::int AS prior_completions
    FROM reservations r
    CROSS JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE h.status = 'no_show') AS prior_no_shows,
        COUNT(*) FILTER (WHERE h.status IN ('completed','arrived','seated','dining')) AS prior_completions
      FROM reservations h
      WHERE h.restaurant_id = r.restaurant_id
        AND COALESCE(h.user_id::text, h.id::text) = COALESCE(r.user_id::text, r.id::text)
        AND h.id <> r.id
        AND h.status IN ('completed','no_show','arrived','seated','dining')
        -- ⚠️ رفعِ نشتِ زمانی (P0، ممیزیِ ۲۰۲۶-۰۸-۲۰): شرطِ زیر عمداً
        -- slot_start است، نه created_at.
        --
        -- نسخه‌ی قبلی یک window function با
        -- ORDER BY created_at ROWS ... 1 PRECEDING بود. آن ترتیب «کدام رزرو
        -- زودتر *ثبت* شد» را می‌سنجید، ولی نتیجه‌ی یک رزرو در لحظه‌ی
        -- *برگزاری* معلوم می‌شود، نه لحظه‌ی ثبت. پس رزروی که زودتر ثبت شده
        -- ولی دیرتر برگزار می‌شود، وضعیتِ no_showِ آینده‌اش وارد ویژگیِ
        -- رزروهایی می‌شد که قبل از آن برگزار شده بودند.
        --
        -- با سناریوی کنترل‌شده روی همین کوئری اثبات شد:
        --   A: ثبت ۲۰۲۶-۰۱-۰۱، برگزاری ۲۰۲۶-۰۳-۰۱، no_show
        --   B: ثبت ۲۰۲۶-۰۲-۰۱، برگزاری ۲۰۲۶-۰۲-۰۲، completed
        -- نسخه‌ی قبلی برای B مقدارِ prior_no_shows = 1 می‌داد — یعنی مدل از
        -- اتفاقی که یک ماه بعد می‌افتاد «یاد می‌گرفت». این دقیقاً همان چیزی
        -- است که مدل را در ارزیابی خوب و در تولید بی‌ارزش می‌کند.
        --
        -- حالا فقط سابقه‌ای شمرده می‌شود که نتیجه‌اش پیش از *ثبتِ* رزروِ
        -- هدف قطعی شده بود.
        AND h.slot_start < r.created_at
    ) p
    WHERE r.restaurant_id = ${restaurantId}::uuid
      AND r.status IN ('completed', 'no_show', 'arrived', 'seated', 'dining')
    ORDER BY r.created_at ASC
    LIMIT 500
  `;
}

function rowToExample(row: TrainingRow): TrainingExample {
  // Number(...) دفاعِ لایه‌ی دوم است: کوئری بالا صریحاً ::int می‌زند، ولی
  // اگر آن cast روزی سهواً حذف شود، Postgres باز به bigint/BigInt برمی‌گردد
  // و بدونِ این خط، dot() در ml-core.ts با «Cannot mix BigInt and other
  // types» کرش می‌کند (دقیقاً همان باگی که با تستِ واقعی روی Postgres پیدا
  // شد) — اینجا مطمئن می‌شویم صرفِ‌نظر از نوعِ خام، همیشه number خالص برسد.
  const priorNoShows = Number(row.prior_no_shows);
  const priorCompletions = Number(row.prior_completions);
  const priorTotal = priorNoShows + priorCompletions;
  return {
    features: {
      hasUserId: row.has_user_id,
      priorTotal,
      priorNoShowRate: priorTotal > 0 ? priorNoShows / priorTotal : 0,
      leadMinutes: row.lead_minutes,
      partySize: row.party_size,
      source: row.source,
    },
    label: row.status === 'no_show' ? 1 : 0,
  };
}

export interface TrainResult {
  trained: boolean;
  reason?: string;
  sampleSize: number;
  positiveCount: number;
  learnedBrier?: number;
  staticBrier?: number;
  isActive?: boolean;
}

/**
 * آموزشِ شبانه برای یک رستوران. از cronِ maintenance/customer-insights صدا
 * زده می‌شود (همان جایی که CLV/سگمنت هم شبانه بازمحاسبه می‌شوند).
 *
 * split زمانی است نه تصادفی: ۸۰٪ قدیمی‌تر برای آموزش، ۲۰٪ جدیدتر برای
 * سنجش. split تصادفی برای دادهٔ زمانی نشتِ اطلاعات ایجاد می‌کند (مدل از
 * چیزی که هنوز اتفاق نیفتاده یاد می‌گیرد) و دقتِ روی هولدآوت را کاذب بالا
 * نشان می‌دهد.
 */
export async function trainAndCalibrateNoShowModel(restaurantId: string): Promise<TrainResult> {
  const rows = await fetchTrainingRows(restaurantId);
  const examples = rows.map(rowToExample);
  const positiveCount = examples.filter((e) => e.label === 1).length;

  const splitAt = Math.floor(examples.length * 0.8);
  const trainSet = examples.slice(0, splitAt);
  const holdout = examples.slice(splitAt);

  if (holdout.length === 0 || trainSet.length === 0) {
    return { trained: false, reason: 'دادهٔ کافی برای split نیست', sampleSize: examples.length, positiveCount };
  }

  const { X: trainX, y: trainY } = toMatrix(trainSet);
  const { X: holdoutX, y: holdoutY } = toMatrix(holdout);

  const weights = trainLogisticRegression(trainX, trainY);
  const learnedPreds = holdoutX.map((x) => predictProba(weights, x));
  const learnedBrier = brierScore(learnedPreds, holdoutY);

  // baseline: همان heuristicِ فعلی، روی همان هولدآوت — برای مقایسه‌ی منصفانه
  const staticPreds = holdout.map((e) => computeStaticScoreFromFeatures(e.features) / 100);
  const staticBrier = brierScore(staticPreds, holdoutY);

  const decision = decideActivation({ sampleSize: examples.length, positiveCount, learnedBrier, staticBrier });

  // گیتِ ایمنیِ اضافی: حتی اگر مدل روی Brierِ کلی از heuristic بهتر باشد،
  // اگر صرفاً بر اساسِ کانالِ رزرو (مهمان/تلفنی) تبعیض بگذارد فعال نمی‌شود —
  // دقیقاً همان انضباطِ «مدلِ مشکوک هیچ‌وقت جایگزین نمی‌شود» که در
  // decideModelActivation هست، این‌بار برای بایاس نه فقط دقت.
  const biasCheck = checkChannelBias(weights);
  const isActive = decision.isActive && !biasCheck.biased;
  const reason = biasCheck.biased ? biasCheck.reason : decision.reason;

  // تاریخچه‌ی append-only (migration 042) — هیچ‌وقت overwrite نمی‌شود تا
  // داشبوردِ سلامتِ مدل بتواند «امتحان‌شد ولی فعال نشد» را هم ببیند، نه فقط
  // آخرین وضعیت. شکستِ این نوشتن نباید آموزشِ اصلی را خراب کند.
  //
  // ⚠️ ترتیب عمداً عوض شد (فازِ ۶): این create حالا *پیش از* upsert است، چون
  // شناسه‌اش باید در ردیفِ مدلِ فعال ذخیره شود تا پیش‌بینی‌هایِ تولید به همین
  // نسخه بسته شوند. اگر create شکست بخورد، runId می‌ماند null و مدل مثلِ قبل
  // ذخیره می‌شود — یعنی نسب‌نامه از دست می‌رود ولی آموزش سالم می‌ماند. همان
  // مصالحه‌ی قبلی، فقط جابه‌جا شده.
  const run = await db.modelTrainingRun.create({
    data: {
      restaurantId, kind: 'no_show', sampleSize: examples.length,
      metrics: {
        learnedBrier, staticBrier,
        knownUserGap: biasCheck.knownUserGap, phoneSourceGap: biasCheck.phoneSourceGap,
      } as unknown as Prisma.InputJsonValue,
      isActive, reason,
    },
    select: { id: true },
  }).catch(() => null);

  // activeRunId فقط وقتی به این اجرا اشاره می‌کند که همین اجرا واقعاً فعال
  // شده باشد. اگر گیتِ ایمنی ردش کرده، مدلِ فعالِ قبلی (اگر بود) سرِ جایش
  // می‌ماند و نسب‌نامه‌اش هم نباید به اجرایِ ردشده منتقل شود.
  const runIdIfActive = isActive ? (run?.id ?? null) : undefined;

  await db.restaurantNoShowModel.upsert({
    where: { restaurantId },
    create: {
      restaurantId, weights, sampleSize: examples.length, positiveCount,
      learnedBrier, staticBrier, isActive,
      activeRunId: isActive ? (run?.id ?? null) : null,
    },
    update: {
      weights, sampleSize: examples.length, positiveCount,
      learnedBrier, staticBrier, isActive, trainedAt: new Date(),
      ...(runIdIfActive !== undefined ? { activeRunId: runIdIfActive } : {}),
    },
  });
  await invalidate(cacheKey('noshow-model', restaurantId));

  return {
    trained: true, sampleSize: examples.length, positiveCount,
    learnedBrier, staticBrier, isActive, reason,
  };
}

/** خواندنِ مدلِ فعالِ یک رستوران (کش‌شده — این تابع در مسیرِ داغِ ثبتِ رزرو
 *  صدا زده می‌شود). null یعنی «چیزی فعال نیست، از heuristic استفاده کن». */
export async function getLearnedNoShowModel(restaurantId: string): Promise<number[] | null> {
  const m = await getLearnedNoShowModelWithRun(restaurantId);
  return m ? m.weights : null;
}

/**
 * همان مدلِ فعال، به‌علاوه‌ی شناسه‌ی اجرایِ آموزشی که ساختش (فازِ ۶).
 *
 * ⚠️ چرا دو تابع و نه تغییرِ امضایِ قبلی: getLearnedNoShowModel جای دیگری هم
 * صدا زده می‌شود و قراردادش «وزن‌ها یا null» است. شکستنِ آن برایِ یک فیلدِ
 * اضافه، تغییرِ بی‌دلیل در مسیرهایی است که به نسب‌نامه کاری ندارند.
 *
 * runId می‌تواند null باشد و این حالتِ صادقانه‌ای است: مدل‌هایی که پیش از
 * مهاجرتِ ۰۵۶ آموزش دیده‌اند نسب‌نامه ندارند و نباید برایشان یکی جعل شود.
 */
export async function getLearnedNoShowModelWithRun(
  restaurantId: string,
): Promise<{ weights: number[]; runId: string | null } | null> {
  // شکلِ کش عمداً عوض شد؛ کلید هم باید عوض می‌شد وگرنه یک کشِ گرمِ قدیمی
  // (آرایه‌ی خام) به‌عنوانِ آبجکت خوانده می‌شد و بی‌صدا undefined می‌داد.
  return cached(cacheKey('noshow-model-v2', restaurantId), 3600, async () => {
    const row = await db.restaurantNoShowModel.findUnique({
      where: { restaurantId },
      select: { isActive: true, weights: true, activeRunId: true },
    });
    return row?.isActive ? { weights: row.weights, runId: row.activeRunId } : null;
  });
}
