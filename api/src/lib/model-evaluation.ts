import { Prisma } from '@prisma/client';
import { dbRead as db } from './db';
import { brierScore } from './ml-core';

// ═══════════════════════════════════════════════════════════════════════
//  سنجشِ تولیدیِ مدل — «در عمل چقدر درست درآمد»، نه «موقعِ آموزش چقدر خوب بود»
//
//  تفاوتِ حیاتی با چیزی که از قبل وجود داشت:
//    restaurant_no_show_models.learned_brier و model_training_runs.metrics
//    هردو روی هولدآوتِ *لحظه‌ی آموزش* حساب می‌شوند. آن عدد می‌گوید مدل روی
//    دادهٔ دیشب چقدر خوب بود — نه اینکه پیش‌بینی‌هایی که واقعاً به مشتری/
//    رستوران تحویل داده شد چقدر درست از آب درآمد.
//
//    این ماژول عددِ دوم را می‌سازد: join دفترِ پیش‌بینی و دفترِ نتیجه
//    (migration 055). فقط جفت‌های کامل شمرده می‌شوند — پیش‌بینیِ بدونِ
//    نتیجه (هنوز معلوم نشده) و نتیجه‌ی بدونِ پیش‌بینی (رزروِ قبل از این
//    migration) در آمار نمی‌آیند.
//
//  اصلِ صداقت (§۲۰ نقشه‌راه): وقتی دادهٔ کافی نیست، «insufficient_data»
//  برگردانده می‌شود — نه یک عددِ بی‌معنا با ظاهرِ دقیق. یک Brier که روی ۳
//  نمونه حساب شده باشد بدتر از هیچ است، چون قابلِ‌باور به‌نظر می‌رسد.
// ═══════════════════════════════════════════════════════════════════════

/** حداقلِ جفتِ (پیش‌بینی، نتیجه) برای اینکه اصلاً عددی گزارش شود. */
export const MIN_EVAL_SAMPLE = 30;

/** یک جفتِ کاملِ پیش‌بینی و نتیجه — واحدِ ورودیِ همه‌ی محاسباتِ این فایل. */
export interface EvaluationPair {
  /** احتمالِ پیش‌بینی‌شده، ۰..۱ */
  probability: number;
  /** برچسبِ واقعی، ۰ یا ۱ */
  label: number;
}

// ── کالیبراسیون ────────────────────────────────────────────────────────

export interface CalibrationBucket {
  /** کرانِ پایینِ سطل (شاملِ) — مثلاً ۰٫۲ برایِ سطلِ ۲۰٪..۳۰٪ */
  lowerBound: number;
  upperBound: number;
  count: number;
  /** میانگینِ احتمالِ پیش‌بینی‌شده در این سطل */
  meanPredicted: number;
  /** نرخِ واقعیِ رخدادن در این سطل */
  observedRate: number;
}

/**
 * منحنیِ کالیبراسیون به‌صورتِ سطل‌بندی‌شده: «وقتی مدل می‌گوید ۷۰٪، واقعاً
 * چند درصدِ مواقع رخ می‌دهد؟» مدلِ خوب‌کالیبره یعنی meanPredicted ≈
 * observedRate در هر سطل.
 *
 * چرا مهم است: Brierِ خوب لزوماً یعنی کالیبراسیونِ خوب نیست. مدلی که همیشه
 * نزدیکِ نرخِ پایه پیش‌بینی می‌کند Brierِ آبرومندی می‌گیرد ولی هیچ‌وقت
 * «ریسکِ بالا» را از «ریسکِ پایین» جدا نمی‌کند — و دقیقاً همان تفکیک است
 * که رستوران بر اساسش تصمیم می‌گیرد (بیعانه بگیرد یا نه).
 *
 * سطل‌هایِ خالی برگردانده نمی‌شوند (count صفر معنایِ آماری ندارد).
 */
export function calibrationBuckets(
  pairs: readonly EvaluationPair[],
  bucketCount = 10,
): CalibrationBucket[] {
  if (bucketCount < 1) return [];
  const acc = Array.from({ length: bucketCount }, () => ({ n: 0, sumP: 0, sumY: 0 }));

  for (const { probability, label } of pairs) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) continue;
    // احتمالِ دقیقاً ۱ باید در آخرین سطل بیفتد، نه در سطلِ خیالیِ bucketCount.
    const idx = Math.min(bucketCount - 1, Math.floor(probability * bucketCount));
    acc[idx].n += 1;
    acc[idx].sumP += probability;
    acc[idx].sumY += label;
  }

  const out: CalibrationBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const b = acc[i];
    if (b.n === 0) continue;
    out.push({
      lowerBound: i / bucketCount,
      upperBound: (i + 1) / bucketCount,
      count: b.n,
      meanPredicted: b.sumP / b.n,
      observedRate: b.sumY / b.n,
    });
  }
  return out;
}

/**
 * Expected Calibration Error — میانگینِ وزنیِ |میانگینِ پیش‌بینی − نرخِ واقعی|
 * روی سطل‌ها. صفر یعنی کاملاً کالیبره. برخلافِ Brier فقط «آیا احتمال‌ها
 * راست می‌گویند» را می‌سنجد، نه قدرتِ تفکیک را — پس مکملِ Brier است، نه
 * جایگزینش.
 */
export function expectedCalibrationError(buckets: readonly CalibrationBucket[]): number {
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return 0;
  let err = 0;
  for (const b of buckets) err += (b.count / total) * Math.abs(b.meanPredicted - b.observedRate);
  return err; // وزن‌ها (count/total) از قبل جمعشان ۱ است
}

// ── سلامتِ مدل در تولید ────────────────────────────────────────────────

export type ModelHealthStatus =
  | 'insufficient_data'  // هنوز نمی‌شود قضاوت کرد — عددی گزارش نمی‌شود
  | 'normal'
  | 'warning'
  | 'degraded'
  | 'critical';

export interface HealthClassificationInput {
  sampleSize: number;
  /** Brierِ تولیدیِ مدلِ فعال روی همین جفت‌ها. */
  productionBrier: number;
  /**
   * Brierِ یک baselineِ ساده روی همان جفت‌ها: پیش‌بینیِ ثابتِ «نرخِ پایه»
   * (میانگینِ برچسب‌ها). این سخت‌گیرانه‌ترین معیارِ منصفانه است — مدلی که
   * از «همیشه نرخِ متوسط را بگو» بهتر نباشد، هیچ اطلاعاتی اضافه نکرده.
   */
  baselineBrier: number;
  minSample?: number;
}

/**
 * طبقه‌بندیِ سلامتِ مدل در تولید بر اساسِ بهبودِ نسبی نسبت به baselineِ
 * نرخِ پایه. آستانه‌ها عمداً با MIN_RELATIVE_IMPROVEMENT (۵٪) در
 * lib/no-show-model.ts هم‌خانواده‌اند: مدلی که سرِ آموزش با ۵٪ بهبود فعال
 * شده، اگر در تولید به زیرِ صفر برسد یعنی واقعاً افت کرده، نه اینکه معیار
 * عوض شده باشد.
 *
 *   بهبود ≥ ۵٪            → normal
 *   ۰٪ ≤ بهبود < ۵٪        → warning   (بهتر از baseline، ولی حاشیه‌ی نازک)
 *   −۱۰٪ < بهبود < ۰٪      → degraded  (از baseline بدتر شده)
 *   بهبود ≤ −۱۰٪           → critical  (به‌طورِ معنادار بدتر از baseline)
 *
 * هیچ‌کدام از این‌ها به‌تنهایی مدل را غیرفعال نمی‌کند — تصمیمِ فعال/غیرفعال
 * همچنان سرِ آموزشِ شبانه و با هولدآوت گرفته می‌شود (§۱۹: «هرگز بی‌صدا
 * بازآموزی و جایگزین نکن»). این فقط سیگنالِ دیده‌شدن است.
 */
export function classifyModelHealth(input: HealthClassificationInput): {
  status: ModelHealthStatus;
  relativeImprovement: number | null;
  reason: string;
} {
  const minSample = input.minSample ?? MIN_EVAL_SAMPLE;
  if (input.sampleSize < minSample) {
    return {
      status: 'insufficient_data',
      relativeImprovement: null,
      reason: `دادهٔ سنجشِ کافی نیست (${input.sampleSize} < ${minSample} جفتِ پیش‌بینی/نتیجه)`,
    };
  }
  if (!(input.baselineBrier > 0)) {
    // baselineِ صفر یعنی همه‌ی برچسب‌ها یکسان‌اند (هیچ no-showی، یا همه
    // no-show). بهبودِ نسبی در این حالت تعریف‌نشده است — عددِ ساختگی نمی‌سازیم.
    return {
      status: 'insufficient_data',
      relativeImprovement: null,
      reason: 'baselineِ تولیدی معتبر نیست (تنوعِ نتیجه صفر است)',
    };
  }

  const improvement = (input.baselineBrier - input.productionBrier) / input.baselineBrier;
  const pct = (improvement * 100).toFixed(1);
  if (improvement >= 0.05) {
    return { status: 'normal', relativeImprovement: improvement, reason: `${pct}٪ بهتر از نرخِ پایه در تولید` };
  }
  if (improvement >= 0) {
    return { status: 'warning', relativeImprovement: improvement, reason: `فقط ${pct}٪ بهتر از نرخِ پایه — حاشیه‌ی نازک` };
  }
  if (improvement > -0.10) {
    return { status: 'degraded', relativeImprovement: improvement, reason: `${pct}٪ بدتر از نرخِ پایه در تولید` };
  }
  return { status: 'critical', relativeImprovement: improvement, reason: `${pct}٪ به‌طورِ معنادار بدتر از نرخِ پایه` };
}

/**
 * Brierِ baselineِ «نرخِ پایه»: اگر برایِ همه‌ی موارد همان میانگینِ واقعیِ
 * برچسب‌ها را پیش‌بینی می‌کردیم، خطا چقدر می‌شد؟
 *
 * این baseline عمداً in-sample است (نرخِ پایه از خودِ همین جفت‌ها می‌آید) و
 * همین آن را *سخت‌گیرانه* می‌کند، نه سهل‌گیر: به baseline امتیازِ اضافه
 * می‌دهد، پس هر بهبودی که مدل نشان دهد واقعی است.
 */
export function baseRateBrier(pairs: readonly EvaluationPair[]): number {
  if (pairs.length === 0) return 0;
  const rate = pairs.reduce((s, p) => s + p.label, 0) / pairs.length;
  return brierScore(pairs.map(() => rate), pairs.map((p) => p.label));
}

// ── گزارشِ کامل (خالص — بدونِ DB، مستقیماً تست‌پذیر) ─────────────────────

export interface ProductionEvaluation {
  status: ModelHealthStatus;
  sampleSize: number;
  /** null وقتی دادهٔ کافی نیست — عمداً null و نه ۰، تا UI «۰» را «عالی» نخواند. */
  productionBrier: number | null;
  baselineBrier: number | null;
  relativeImprovement: number | null;
  calibrationError: number | null;
  calibration: CalibrationBucket[];
  observedRate: number | null;
  reason: string;
}

/**
 * گزارشِ کاملِ سنجشِ تولیدی از رویِ جفت‌ها. تابعِ خالص است تا بدونِ Postgres
 * تست شود؛ لایه‌ی DB جدا در evaluateNoShowProduction است.
 */
export function evaluatePairs(pairs: readonly EvaluationPair[]): ProductionEvaluation {
  const valid = pairs.filter(
    (p) => Number.isFinite(p.probability) && p.probability >= 0 && p.probability <= 1
      && (p.label === 0 || p.label === 1),
  );
  const sampleSize = valid.length;

  if (sampleSize < MIN_EVAL_SAMPLE) {
    return {
      status: 'insufficient_data', sampleSize,
      productionBrier: null, baselineBrier: null, relativeImprovement: null,
      calibrationError: null, calibration: [], observedRate: null,
      reason: `دادهٔ سنجشِ کافی نیست (${sampleSize} < ${MIN_EVAL_SAMPLE} جفتِ پیش‌بینی/نتیجه)`,
    };
  }

  const productionBrier = brierScore(valid.map((p) => p.probability), valid.map((p) => p.label));
  const baselineBrier = baseRateBrier(valid);
  const buckets = calibrationBuckets(valid);
  const health = classifyModelHealth({ sampleSize, productionBrier, baselineBrier });

  return {
    status: health.status,
    sampleSize,
    productionBrier,
    baselineBrier,
    relativeImprovement: health.relativeImprovement,
    calibrationError: expectedCalibrationError(buckets),
    calibration: buckets,
    observedRate: valid.reduce((s, p) => s + p.label, 0) / sampleSize,
    reason: health.reason,
  };
}

// ── لایه‌ی DB ──────────────────────────────────────────────────────────

interface PairRow { probability: number; label: number; model_source: string; model_version: string }

/**
 * جفت‌هایِ کاملِ (پیش‌بینی، نتیجه) برایِ no-show.
 *
 * INNER JOIN عمدی: فقط پیش‌بینی‌هایی که نتیجه‌شان معلوم شده. پیش‌بینیِ
 * بدونِ نتیجه یعنی «هنوز رخ نداده»، نه «مدل اشتباه کرد» — شمردنش به‌عنوانِ
 * ۰ کلِ آمار را به نفعِ مدل تقلب می‌کرد.
 *
 * restaurantId اختیاری است: بدونِ آن نمایِ کلِ پلتفرم (پنلِ شرکت) و با آن
 * نمایِ یک رستوران. فراخوان‌کننده مسئولِ کنترلِ دسترسی است — این تابع خودش
 * هیچ اجازه‌ای را فرض نمی‌کند.
 */
export async function fetchNoShowPairs(opts: {
  restaurantId?: string;
  sinceDays?: number;
  limit?: number;
} = {}): Promise<Array<EvaluationPair & { modelSource: string; modelVersion: string }>> {
  // کران‌بندیِ دوطرفه. فقط Math.min کافی نیست: مقدارِ منفی به
  // `LIMIT -5` ترجمه می‌شود و Postgres خطا می‌دهد — یعنی کلِ داشبورد به‌خاطرِ
  // یک عددِ بد ۵۰۰ می‌شد. امروز هیچ ورودیِ کاربری به این دو نمی‌رسد، ولی
  // تابع export شده و فراخوانِ بعدی ممکن است این را فرض نگیرد.
  const sinceDays = Math.min(Math.max(Math.trunc(opts.sinceDays ?? 90) || 90, 1), 3650);
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 5000) || 5000, 1), 20000);

  // شرطِ اختیاریِ رستوران با Prisma.sql/Prisma.empty ساخته می‌شود (نه با
  // چسباندنِ رشته) — پارامتر همچنان bind می‌شود، پس جایی برایِ SQL injection
  // نمی‌ماند حتی اگر restaurantId از ورودیِ کاربر بیاید.
  const restaurantFilter = opts.restaurantId
    ? Prisma.sql`AND p.restaurant_id = ${opts.restaurantId}::uuid`
    : Prisma.empty;

  const rows = await db.$queryRaw<PairRow[]>`
    SELECT p.probability::double precision AS probability,
           o.outcome_label::double precision AS label,
           p.model_source, p.model_version
    FROM model_predictions p
    JOIN model_outcomes o
      ON o.prediction_type = p.prediction_type
     AND o.subject_type    = p.subject_type
     AND o.subject_id      = p.subject_id
    WHERE p.prediction_type = 'no_show'
      AND p.predicted_at >= now() - make_interval(days => ${sinceDays}::int)
      ${restaurantFilter}
    ORDER BY p.predicted_at DESC
    LIMIT ${limit}::int
  `;
  return rows.map((r) => ({
    probability: Number(r.probability),
    label: Number(r.label),
    modelSource: r.model_source,
    modelVersion: r.model_version,
  }));
}
