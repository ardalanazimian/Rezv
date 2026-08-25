import { Prisma } from '@prisma/client';
import { db } from './db';
import { createLogger } from './logger';
import { NO_SHOW_FEATURE_VERSION as NO_SHOW_FEATURE_VECTOR_VERSION } from './no-show-model';

const log = createLogger('ml');

// ═══════════════════════════════════════════════════════════════════════
//  دفترِ پیش‌بینی و نتیجه — بستنِ حلقه‌ی یادگیری (فازِ ۵)
//
//  پیش از این، model_training_runs می‌گفت مدل روی هولدآوتِ *گذشته* چقدر خوب
//  بود. این ماژول چیزِ دیگری را ثبت می‌کند: در تولید چه گفتیم، و بعد واقعاً
//  چه شد. تفاوت مهم است — مدلی که روی هولدآوت عالی است می‌تواند در تولید
//  بی‌ارزش باشد (نمونه‌اش همان نشتِ زمانیِ رفع‌شده در مهاجرتِ قبل).
//
//  ⚠️ قاعده‌ی حاکم بر کلِ این فایل (بندِ ۴۶ دستور): هوش هرگز نباید مسیرِ
//  بحرانیِ رزرو را بشکند. پس هر تابعِ نوشتن اینجا fail-open است: خطا لاگ
//  می‌شود و undefined برمی‌گردد، هرگز throw نمی‌کند. از دست‌رفتنِ یک ردیفِ
//  دفتر بی‌اهمیت است؛ از دست‌رفتنِ یک رزرو نیست.
// ═══════════════════════════════════════════════════════════════════════

/**
 * نسخه‌ی قراردادِ بردارِ ویژگیِ no-show.
 *
 * ⚠️ اگر NO_SHOW_FEATURE_NAMES در lib/no-show-model.ts عوض شد، این هم باید
 * بالا برود — وگرنه پیش‌بینی‌هایی با معنایِ متفاوتِ ویژگی زیرِ یک نسخه قاطی
 * می‌شوند و مقایسه‌ی تاریخی بی‌معنا می‌شود. تستِ
 * tests/prediction-ledger.test.mts این هم‌ترازی را قفل کرده است.
 */
// ⚠️ مشتق است، نه هاردکد — و این رفعِ یک باگِ واقعی است (۲۰۲۶-۰۸-۲۵):
// اینجا قبلاً یک ثابتِ **موازی** با همان نام بود (`'no_show/v2'`). وقتی
// بردارِ ویژگی در no-show-model.ts عوض شد، این یکی دست‌نخورده ماند — پس
// پیش‌بینی‌هایِ بردارِ تازه با همان برچسبِ قدیمی ثبت می‌شدند و در آمارِ دقتِ
// تولید با پیش‌بینی‌هایِ بردارِ قبلی قاطی می‌شدند. یعنی دقیقاً همان چیزی که
// خودِ این ثابت قرار بود جلویش را بگیرد، و کاملاً بی‌صدا.
//
// تاریخچه‌ی برچسب: no_show/v1 · no_show/v2 (معنیِ تازه‌ی priorTotal، فازِ ۴)
// · no_show/v3 (بردارِ ۱۲تایی).
export const NO_SHOW_FEATURE_VERSION = `no_show/${NO_SHOW_FEATURE_VECTOR_VERSION}`;

export type PredictionConfidence = 'high' | 'medium' | 'low' | 'insufficient_data';

/**
 * اطمینان از روی شواهد، نه از روی خودِ عدد.
 *
 * بندِ ۲۰ دستور: «اگر شواهد کافی نیست، insufficient_data برگردان؛ هرگز
 * قطعیت نساز». یک heuristic بدونِ هیچ سابقه‌ای ذاتاً حدس است، هرچقدر هم
 * عددش قاطع به‌نظر برسد.
 */
export function confidenceFor(params: {
  modelSource: 'learned' | 'heuristic';
  priorTotal: number;
}): PredictionConfidence {
  const { modelSource, priorTotal } = params;
  if (modelSource === 'learned') {
    // مدلِ یادگرفته از گیتِ فعال‌سازی رد شده (روی هولدآوت از baseline بهتر
    // بوده)، پس پایه‌اش محکم است؛ سابقه‌ی شخصیِ مشتری آن را بالاتر می‌برد.
    return priorTotal >= 3 ? 'high' : 'medium';
  }
  if (priorTotal >= 3) return 'low';       // heuristic ولی دست‌کم سابقه‌ای هست
  return 'insufficient_data';               // heuristic و بدونِ سابقه = حدس
}

export interface RecordPredictionInput {
  restaurantId: string;
  tenantId?: string | null;
  predictionType: 'no_show' | 'demand';
  entityType: 'reservation' | 'restaurant_day';
  entityId: string;
  modelSource: 'learned' | 'heuristic';
  modelRunId?: string | null;
  featureVersion: string;
  /** احتمالِ ۰..۱ برای طبقه‌بندی، یا مقدارِ عددی برای رگرسیون. */
  predictedValue: number;
  confidence: PredictionConfidence;
  /** ردِ ورودی — همان چیزی که مدل واقعاً دید. */
  features?: unknown;
  /** کِی نتیجه معلوم می‌شود (no-show: slot_start). */
  horizonAt?: Date | null;
}

/**
 * ثبتِ یک پیش‌بینیِ تولید. fail-open — رجوع کن به توضیحِ بالای فایل.
 * شناسه‌ی پیش‌بینی برمی‌گردد تا صداکننده بتواند بعداً نتیجه را به آن ببندد.
 */
export async function recordPrediction(input: RecordPredictionInput): Promise<string | undefined> {
  try {
    const row = await db.modelPrediction.create({
      data: {
        restaurantId: input.restaurantId,
        tenantId: input.tenantId ?? null,
        predictionType: input.predictionType,
        entityType: input.entityType,
        entityId: input.entityId,
        modelSource: input.modelSource,
        modelRunId: input.modelRunId ?? null,
        featureVersion: input.featureVersion,
        predictedValue: input.predictedValue,
        confidence: input.confidence,
        features: (input.features ?? undefined) as never,
        horizonAt: input.horizonAt ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (e) {
    log.warn('prediction-ledger: ثبتِ پیش‌بینی شکست خورد (مسیرِ اصلی ادامه می‌یابد)', {
      entityType: input.entityType, entityId: input.entityId, error: (e as Error).message,
    });
    return undefined;
  }
}

/**
 * ثبتِ نتیجه‌ی واقعیِ یک موجودیت.
 *
 * عمداً با entityType/entityId کار می‌کند، نه با predictionId: صداکننده
 * (چرخه‌ی حیاتِ رزرو) شناسه‌ی پیش‌بینی را در دست ندارد و نباید مجبور شود
 * نگهش دارد. اینجا آخرین پیش‌بینیِ آن موجودیت پیدا و به نتیجه بسته می‌شود.
 *
 * ایندکسِ یکتای (prediction_id, source) در مهاجرتِ ۰۵۵ ثبتِ تکراری را
 * بی‌صدا بی‌اثر می‌کند — بدونِ آن، یک انتقالِ وضعیتِ تکراری آمار را خراب
 * می‌کرد. fail-open.
 */
export async function recordOutcome(params: {
  entityType: 'reservation' | 'restaurant_day';
  entityId: string;
  observedValue: number;
  source: string;
}): Promise<'recorded' | 'duplicate' | 'no_prediction' | 'failed'> {
  try {
    const prediction = await db.modelPrediction.findFirst({
      where: { entityType: params.entityType, entityId: params.entityId },
      orderBy: { generatedAt: 'desc' },
      select: { id: true, predictedValue: true },
    });
    if (!prediction) return 'no_prediction';

    const diff = prediction.predictedValue - params.observedValue;
    try {
      await db.modelOutcome.create({
        data: {
          predictionId: prediction.id,
          observedValue: params.observedValue,
          squaredError: diff * diff,
          absoluteError: Math.abs(diff),
          source: params.source,
        },
      });
      return 'recorded';
    } catch {
      // نقضِ کلیدِ یکتا = قبلاً ثبت شده. این خطا نیست، بی‌اثر است.
      return 'duplicate';
    }
  } catch (e) {
    log.warn('prediction-ledger: ثبتِ نتیجه شکست خورد', {
      entityType: params.entityType, entityId: params.entityId, error: (e as Error).message,
    });
    return 'failed';
  }
}

export interface ProductionAccuracy {
  predictionType: string;
  modelSource: string;
  /** تعدادِ پیش‌بینی‌هایی که نتیجه‌شان واقعاً مشاهده شده. */
  resolvedCount: number;
  /** Brier روی نتایجِ *تولید* — نه هولدآوتِ آموزش. */
  brier: number | null;
  mae: number | null;
}

/**
 * دقتِ واقعیِ تولید — همان چیزی که تا امروز قابلِ‌محاسبه نبود.
 *
 * فقط پیش‌بینی‌هایی شمرده می‌شوند که نتیجه‌ی مشاهده‌شده دارند؛ پیش‌بینیِ
 * بدونِ نتیجه (هنوز رخ نداده) در آمار نمی‌آید — وگرنه عدد به‌طورِ سیستماتیک
 * به نفعِ رزروهایِ آینده منحرف می‌شود.
 */
export async function getProductionAccuracy(params: {
  restaurantId: string;
  predictionType?: string;
  sinceDays?: number;
}): Promise<ProductionAccuracy[]> {
  const since = new Date(Date.now() - (params.sinceDays ?? 90) * 86_400_000);
  // Prisma.empty برای شرطِ اختیاری — رشته‌چسبانیِ دستی اینجا یک درِ بازِ
  // SQL injection می‌شد، حتی با ورودیِ ظاهراً امنِ داخلی.
  const typeFilter = params.predictionType
    ? Prisma.sql`AND p.prediction_type = ${params.predictionType}`
    : Prisma.empty;

  const rows = await db.$queryRaw<{
    prediction_type: string; model_source: string;
    n: number; brier: number | null; mae: number | null;
  }[]>(Prisma.sql`
    SELECT p.prediction_type, p.model_source,
           COUNT(*)::int                 AS n,
           AVG(o.squared_error)::float8  AS brier,
           AVG(o.absolute_error)::float8 AS mae
    FROM model_predictions p
    JOIN model_outcomes  o ON o.prediction_id = p.id
    WHERE p.restaurant_id = ${params.restaurantId}::uuid
      AND p.generated_at >= ${since}
      ${typeFilter}
    GROUP BY p.prediction_type, p.model_source
    ORDER BY p.prediction_type, p.model_source
  `);
  return rows.map(r => ({
    predictionType: r.prediction_type,
    modelSource: r.model_source,
    // ⚠️ Number(...) لازم است: COUNT/AVG در Postgres bigint/numeric برمی‌گردانند
    // و Prisma آن‌ها را BigInt/Decimal map می‌کند، نه number — جنریکِ بالا فقط
    // assertion است، نه تضمینِ زمانِ اجرا. (درسِ مستندشده‌ی همین ریپو.)
    resolvedCount: Number(r.n),
    brier: r.brier === null ? null : Number(r.brier),
    mae: r.mae === null ? null : Number(r.mae),
  }));
}

/**
 * کف‌ِ نمونه برای اینکه عددِ دقت اصلاً *گزارش* شود.
 *
 * بندِ ۲۰ دستور: هرگز قطعیتِ ساختگی نساز. Brier روی ۳ نتیجه یک عددِ واقعی
 * است ولی یک ادعایِ بی‌معنا؛ نمایشش در داشبورد دقیقاً همان «کارایی مدلِ
 * جعلی» است که ممنوع شده. زیرِ این کف، بک‌اند عدد را null می‌دهد و صریحاً
 * می‌گوید داده کافی نیست — تصمیمِ آستانه اینجاست، نه در UI، تا هر مصرف‌کننده
 * (پنل، گزارش، آینده) یک قانون داشته باشد.
 */
export const MIN_RESOLVED_FOR_ACCURACY = 20;

export interface LedgerHealth {
  predictionType: string;
  modelSource: string;
  /** پیش‌بینی‌هایی که نتیجه‌شان مشاهده شده. */
  resolvedCount: number;
  /** هنوز رخ نداده — انتظارِ طبیعی، نه مشکل. */
  pendingCount: number;
  /**
   * افق‌شان گذشته ولی نتیجه‌ای ثبت نشده.
   *
   * ⚠️ این تنها عددِ این داشبورد است که «خرابی» را نشان می‌دهد: یعنی رزرو
   * به وضعیتِ نهایی نرسیده یا ثبتِ نتیجه شکست خورده. اگر بالا برود، حلقه‌ی
   * یادگیری نشت دارد و آمارِ دقت به‌مرور روی زیرمجموعه‌ی سوگیرانه‌ای از
   * رزروها محاسبه می‌شود.
   */
  overdueCount: number;
  /** null اگر resolvedCount زیرِ MIN_RESOLVED_FOR_ACCURACY باشد. */
  brier: number | null;
  mae: number | null;
}

export interface RunAccuracy {
  /** null = پیش‌بینی‌هایِ heuristic یا مدل‌هایِ پیش از مهاجرتِ ۰۵۶ (بدونِ نسب‌نامه). */
  modelRunId: string | null;
  modelSource: string;
  featureVersion: string;
  resolvedCount: number;
  brier: number | null;
  firstAt: Date | null;
  lastAt: Date | null;
}

/**
 * دقتِ تولید به تفکیکِ *نسخه‌ی مدل* (فازِ ۶).
 *
 * این همان چیزی است که getLedgerHealth نمی‌تواند بگوید: آیا نسخه‌ی امشب بهتر
 * از نسخه‌ی دیشب است؟ بدونِ model_run_id، همه‌ی بازآموزی‌هایِ شبانه در یک
 * عددِ واحد قاطی می‌شدند و مقایسه‌ی نسخه‌ها ناممکن بود.
 *
 * همان کفِ MIN_RESOLVED_FOR_ACCURACY اعمال می‌شود — یک نسخه با ۳ نتیجه
 * عددِ دقت نمی‌گیرد، هرچقدر هم آن ۳ تا خوب بوده باشند.
 */
export async function getAccuracyByModelRun(params: {
  restaurantId: string;
  predictionType?: string;
  sinceDays?: number;
}): Promise<RunAccuracy[]> {
  const since = new Date(Date.now() - (params.sinceDays ?? 180) * 86_400_000);
  const typeFilter = params.predictionType
    ? Prisma.sql`AND p.prediction_type = ${params.predictionType}`
    : Prisma.empty;

  const rows = await db.$queryRaw<{
    model_run_id: string | null; model_source: string; feature_version: string;
    n: number; brier: number | null; first_at: Date | null; last_at: Date | null;
  }[]>(Prisma.sql`
    SELECT p.model_run_id, p.model_source, p.feature_version,
           COUNT(o.id)::int              AS n,
           AVG(o.squared_error)::float8  AS brier,
           MIN(p.generated_at)           AS first_at,
           MAX(p.generated_at)           AS last_at
    FROM model_predictions p
    JOIN model_outcomes o ON o.prediction_id = p.id
    WHERE p.restaurant_id = ${params.restaurantId}::uuid
      AND p.generated_at >= ${since}
      ${typeFilter}
    GROUP BY p.model_run_id, p.model_source, p.feature_version
    ORDER BY MAX(p.generated_at) DESC
  `);

  return rows.map(r => {
    const resolvedCount = Number(r.n);
    return {
      modelRunId: r.model_run_id,
      modelSource: r.model_source,
      featureVersion: r.feature_version,
      resolvedCount,
      brier: resolvedCount >= MIN_RESOLVED_FOR_ACCURACY && r.brier !== null ? Number(r.brier) : null,
      firstAt: r.first_at,
      lastAt: r.last_at,
    };
  });
}

/**
 * سلامتِ دفتر در سطحِ پلتفرم — همان چیزی که داشبوردِ شرکت نشان می‌دهد.
 *
 * عمداً یک کوئریِ گروه‌بندی‌شده است، نه یک حلقه روی رستوران‌ها: پنلِ شرکت
 * همه‌ی رستوران‌ها را می‌بیند و N+1 اینجا یعنی صدها رفت‌وبرگشت.
 *
 * چرا LEFT JOIN و نه JOIN: باید پیش‌بینیِ بدونِ نتیجه هم شمرده شود، وگرنه
 * «حلقه‌ی شکسته» نامرئی می‌ماند — دقیقاً همان چیزی که باید دیده شود.
 */
export async function getLedgerHealth(params: {
  restaurantId?: string;
  predictionType?: string;
  sinceDays?: number;
} = {}): Promise<LedgerHealth[]> {
  const since = new Date(Date.now() - (params.sinceDays ?? 90) * 86_400_000);
  const restaurantFilter = params.restaurantId
    ? Prisma.sql`AND p.restaurant_id = ${params.restaurantId}::uuid`
    : Prisma.empty;
  const typeFilter = params.predictionType
    ? Prisma.sql`AND p.prediction_type = ${params.predictionType}`
    : Prisma.empty;

  const rows = await db.$queryRaw<{
    prediction_type: string; model_source: string;
    resolved: number; pending: number; overdue: number;
    brier: number | null; mae: number | null;
  }[]>(Prisma.sql`
    SELECT p.prediction_type, p.model_source,
           COUNT(o.id)::int AS resolved,
           COUNT(*) FILTER (
             WHERE o.id IS NULL AND (p.horizon_at IS NULL OR p.horizon_at > now())
           )::int AS pending,
           COUNT(*) FILTER (
             WHERE o.id IS NULL AND p.horizon_at IS NOT NULL AND p.horizon_at <= now()
           )::int AS overdue,
           AVG(o.squared_error)::float8  AS brier,
           AVG(o.absolute_error)::float8 AS mae
    FROM model_predictions p
    LEFT JOIN model_outcomes o ON o.prediction_id = p.id
    WHERE p.generated_at >= ${since}
      ${restaurantFilter}
      ${typeFilter}
    GROUP BY p.prediction_type, p.model_source
    ORDER BY p.prediction_type, p.model_source
  `);

  return rows.map(r => {
    const resolvedCount = Number(r.resolved);
    const enough = resolvedCount >= MIN_RESOLVED_FOR_ACCURACY;
    return {
      predictionType: r.prediction_type,
      modelSource: r.model_source,
      resolvedCount,
      pendingCount: Number(r.pending),
      overdueCount: Number(r.overdue),
      // زیرِ کف عمداً null — نه عددِ کوچک‌شمار، نه صفر. صفر یعنی «مدل بی‌نقص»
      // که بدترین دروغِ ممکن در این جدول است.
      brier: enough && r.brier !== null ? Number(r.brier) : null,
      mae: enough && r.mae !== null ? Number(r.mae) : null,
    };
  });
}
