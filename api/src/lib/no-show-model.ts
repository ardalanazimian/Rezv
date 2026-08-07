import { db } from './db';
import { cached, cacheKey, invalidate } from './cache';
import { computeStaticScoreFromFeatures, type RawFeatureInput } from './customer-insights';

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

// ── ریاضیاتِ خالص — بدونِ هیچ وابستگی به دیتابیس، مستقیماً قابلِ تست ──

export function sigmoid(z: number): number {
  // حفاظ در برابرِ overflow برای |z| خیلی بزرگ (exp(710) بی‌نهایت می‌شود)
  if (z >= 40) return 1;
  if (z <= -40) return 0;
  return 1 / (1 + Math.exp(-z));
}

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export interface TrainOptions {
  learningRate?: number;
  iterations?: number;
  l2?: number; // regularization — بایاس (اندیسِ ۰) هرگز regularize نمی‌شود
}

/**
 * رگرسیونِ لجستیک با batch gradient descent. پیاده‌سازیِ دستی و ساده است چون
 * ابعاد کم است (۷ ویژگی) و دیتاست کوچک (چند صد ردیف) — کتابخانه‌ی ML برای
 * این مقیاس توجیهی ندارد و یک وابستگیِ سنگین اضافه می‌کرد.
 */
export function trainLogisticRegression(
  X: readonly (readonly number[])[],
  y: readonly number[],
  opts: TrainOptions = {},
): number[] {
  const { learningRate = 0.3, iterations = 800, l2 = 0.02 } = opts;
  const n = X.length;
  if (n === 0) throw new Error('trainLogisticRegression: دیتاست خالی است');
  const d = X[0].length;
  const w = new Array(d).fill(0);

  for (let it = 0; it < iterations; it++) {
    const grad = new Array(d).fill(0);
    for (let i = 0; i < n; i++) {
      const p = sigmoid(dot(w, X[i]));
      const err = p - y[i];
      for (let j = 0; j < d; j++) grad[j] += err * X[i][j];
    }
    for (let j = 0; j < d; j++) {
      const reg = j === 0 ? 0 : l2 * w[j];
      w[j] -= (learningRate / n) * (grad[j] + reg);
    }
  }
  return w;
}

/** پیش‌بینیِ احتمال (۰..۱) با وزن‌های داده‌شده. */
export function predictProba(weights: readonly number[], x: readonly number[]): number {
  return sigmoid(dot(weights, x));
}

/**
 * Brier score: میانگینِ (احتمالِ پیش‌بینی‌شده − برچسبِ واقعی)². پایین‌تر بهتر
 * است. برخلافِ accuracy، اعتمادبه‌نفسِ نادرست را هم جریمه می‌کند (پیش‌بینیِ
 * ۹۹٪ برای چیزی که اتفاق نمی‌افتد بدتر از ۶۰٪ است) — برای مقایسه‌ی دو مدلِ
 * احتمالاتی معیارِ درست‌تری از accuracy خام است، مخصوصاً وقتی کلاس‌ها
 * نامتوازن‌اند (no-show معمولاً اقلیت است).
 */
export function brierScore(predictions: readonly number[], labels: readonly number[]): number {
  if (predictions.length === 0) return 1; // بدترینِ ممکن — نباید در عمل رخ دهد
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) sum += (predictions[i] - labels[i]) ** 2;
  return sum / predictions.length;
}

export interface TrainingExample {
  features: RawFeatureInput;
  label: 0 | 1; // 1 = no_show
}

export interface ActivationDecision {
  isActive: boolean;
  reason: string;
}

const MIN_SAMPLE_SIZE = 40;
const MIN_POSITIVE_COUNT = 5;
/** بهبودِ نسبیِ حداقلی برای فعال‌کردنِ مدلِ یادگرفته — نوسانِ آماریِ کوچک
 *  نباید هر شب heuristic را با یک مدلِ تصادفاً کمی بهتر عوض کند. */
const MIN_RELATIVE_IMPROVEMENT = 0.05;

/** آیا مدلِ یادگرفته باید جایگزینِ heuristic شود؟ منطقِ خالص، بدونِ DB — مستقیماً تست‌پذیر. */
export function decideActivation(params: {
  sampleSize: number;
  positiveCount: number;
  learnedBrier: number;
  staticBrier: number;
}): ActivationDecision {
  const { sampleSize, positiveCount, learnedBrier, staticBrier } = params;
  if (sampleSize < MIN_SAMPLE_SIZE) {
    return { isActive: false, reason: `دادهٔ کافی نیست (${sampleSize} < ${MIN_SAMPLE_SIZE})` };
  }
  if (positiveCount < MIN_POSITIVE_COUNT) {
    return { isActive: false, reason: `تعدادِ no-show برای یادگیری کم است (${positiveCount} < ${MIN_POSITIVE_COUNT})` };
  }
  if (staticBrier <= 0) {
    return { isActive: false, reason: 'baseline نامعتبر' };
  }
  const improvement = (staticBrier - learnedBrier) / staticBrier;
  if (improvement < MIN_RELATIVE_IMPROVEMENT) {
    return { isActive: false, reason: `بهبود کافی نیست (${(improvement * 100).toFixed(1)}٪ < ${MIN_RELATIVE_IMPROVEMENT * 100}٪)` };
  }
  return { isActive: true, reason: `${(improvement * 100).toFixed(1)}٪ دقیق‌تر از heuristic روی هولدآوت` };
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
 * AND 1 PRECEDING یعنی فقط رزروهای *قبلِ* همین ردیف شمرده می‌شوند — دقیقاً
 * همان چیزی که در لحظه‌ی رزروِ واقعی معلوم بوده، نه چیزی که بعداً اتفاق افتاده.
 *
 * PARTITION BY COALESCE(user_id::text, id::text): برای رزروهای مهمان (بدون
 * حساب کاربری) user_id همه NULL است و Postgres در PARTITION BY همه‌ی NULLها
 * را یک گروه می‌بیند — بدونِ این fallback، سابقه‌ی مهمان‌های کاملاً متفاوت
 * با هم قاطی می‌شد. با id::text هر مهمان پارتیشنِ یک‌نفره‌ی خودش را می‌گیرد
 * (یعنی همیشه «بدونِ سابقه»، دقیقاً مثلِ heuristicِ فعلی).
 *
 * دامنه‌ی برچسب همان چیزی‌ست که recomputeCustomerInsight استفاده می‌کند:
 * completed/arrived/seated/dining = «آمد» (۰)، no_show = «نیامد» (۱).
 */
async function fetchTrainingRows(restaurantId: string): Promise<TrainingRow[]> {
  return db.$queryRaw<TrainingRow[]>`
    SELECT status, party_size, source,
           EXTRACT(EPOCH FROM (slot_start - created_at)) / 60.0 AS lead_minutes,
           (user_id IS NOT NULL) AS has_user_id,
           prior_no_shows, prior_completions
    FROM (
      SELECT
        id, user_id, status, party_size, source, slot_start, created_at,
        SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) OVER (
          PARTITION BY COALESCE(user_id::text, id::text) ORDER BY created_at
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ) AS prior_no_shows,
        SUM(CASE WHEN status IN ('completed','arrived','seated','dining') THEN 1 ELSE 0 END) OVER (
          PARTITION BY COALESCE(user_id::text, id::text) ORDER BY created_at
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ) AS prior_completions
      FROM reservations
      WHERE restaurant_id = ${restaurantId}::uuid
    ) sub
    WHERE status IN ('completed', 'no_show', 'arrived', 'seated', 'dining')
    ORDER BY created_at ASC
    LIMIT 500
  `;
}

function rowToExample(row: TrainingRow): TrainingExample {
  const priorTotal = row.prior_no_shows + row.prior_completions;
  return {
    features: {
      hasUserId: row.has_user_id,
      priorTotal,
      priorNoShowRate: priorTotal > 0 ? row.prior_no_shows / priorTotal : 0,
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

  await db.restaurantNoShowModel.upsert({
    where: { restaurantId },
    create: {
      restaurantId, weights, sampleSize: examples.length, positiveCount,
      learnedBrier, staticBrier, isActive: decision.isActive,
    },
    update: {
      weights, sampleSize: examples.length, positiveCount,
      learnedBrier, staticBrier, isActive: decision.isActive, trainedAt: new Date(),
    },
  });
  await invalidate(cacheKey('noshow-model', restaurantId));

  return {
    trained: true, sampleSize: examples.length, positiveCount,
    learnedBrier, staticBrier, isActive: decision.isActive, reason: decision.reason,
  };
}

/** خواندنِ مدلِ فعالِ یک رستوران (کش‌شده — این تابع در مسیرِ داغِ ثبتِ رزرو
 *  صدا زده می‌شود). null یعنی «چیزی فعال نیست، از heuristic استفاده کن». */
export async function getLearnedNoShowModel(restaurantId: string): Promise<number[] | null> {
  const cacheVal = await cached(cacheKey('noshow-model', restaurantId), 3600, async () => {
    const row = await db.restaurantNoShowModel.findUnique({ where: { restaurantId } });
    return row?.isActive ? row.weights : null;
  });
  return cacheVal;
}
