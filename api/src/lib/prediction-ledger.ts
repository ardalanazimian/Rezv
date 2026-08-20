import { db } from './db';
import { createLogger } from './logger';

const log = createLogger('prediction-ledger');

// ═══════════════════════════════════════════════════════════════════════
//  دفترِ پیش‌بینی و دفترِ نتیجه — بستنِ حلقه‌ی یادگیری
//
//  چرا (یافته‌یِ ممیزیِ ۲۰۲۶-۰۸-۲۰): تا امروز هر عددِ کیفیتِ مدل در این
//  پروژه مربوط به «هولدآوتِ لحظه‌ی آموزش» بود (learned_brier/static_brier در
//  ۰۳۳ و metrics در ۰۴۲). هیچ‌جا ثبت نمی‌شد که در تولید چه پیش‌بینی‌ای شد و
//  بعداً واقعاً چه اتفاقی افتاد — پس «مدل در عمل چقدر خوب است» اصلاً
//  قابلِ‌محاسبه نبود، فقط «مدل دیشب روی دادهٔ خودش چقدر خوب بود».
//
//  این ماژول همان دو نیمه‌ی گم‌شده را می‌نویسد:
//    recordPrediction — لحظه‌ی تصمیم، با نسخه‌ی مدل و بردارِ ویژگی.
//    recordOutcome    — لحظه‌ی معلوم‌شدنِ واقعیت.
//  سنجش از join همین دو در lib/model-evaluation.ts می‌آید.
//
//  ⚠️ قاعده‌ی سختِ این فایل: هیچ‌کدام از این توابع هرگز throw نمی‌کنند.
//  دقیقاً همان الگویِ lib/platform-events.ts — ثبتِ ناموفق یعنی یک ردیفِ
//  تحلیلی از دست رفت، نه اینکه رزروِ مشتری بشکند. هوش هیچ‌وقت نباید نقطه‌ی
//  شکستِ مسیرِ رزرو شود (اصلِ §۴۶ نقشه‌راه).
// ═══════════════════════════════════════════════════════════════════════

/** نوعِ پیش‌بینی. فعلاً فقط no-show؛ رشته است تا نوعِ بعدی migration نخواهد. */
export type PredictionType = 'no_show';
export type SubjectType = 'reservation';
/** مدلِ یادگرفته یا heuristicِ دستی — همان تفکیکی که تا امروز دور ریخته می‌شد. */
export type ModelSource = 'learned' | 'heuristic';

/** نسخه‌ی heuristicِ no-show. اگر ضرایبِ computeStaticScoreFromFeatures عوض
 *  شد این را بالا ببر، وگرنه پیش‌بینی‌های دو heuristicِ متفاوت در سنجشِ
 *  تولیدی با هم قاطی می‌شوند و میانگین بی‌معنا می‌شود. */
export const NO_SHOW_HEURISTIC_VERSION = 'heuristic-v1';

/** نسخه‌ی *ساختارِ* بردارِ ویژگیِ no-show — با NO_SHOW_FEATURE_NAMES در
 *  lib/no-show-model.ts هم‌تراز است. هر تغییر در ترتیب/معنایِ ویژگی‌ها این
 *  را بالا می‌برد تا ردیف‌های قدیمی اشتباه تفسیر نشوند. */
export const NO_SHOW_FEATURE_VERSION = 1;

export interface RecordPredictionInput {
  restaurantId: string;
  predictionType: PredictionType;
  subjectType: SubjectType;
  subjectId: string;
  modelSource: ModelSource;
  modelVersion: string;
  featureVersion: number;
  features: Record<string, unknown>;
  /** احتمالِ ۰..۱ — نه امتیازِ ۰..۱۰۰. */
  probability: number;
  /** کِی نتیجه قابلِ‌دانستن می‌شود (برایِ no-show: شروعِ اسلات). */
  horizonAt?: Date | null;
}

/**
 * ثبتِ یک پیش‌بینیِ تولیدی. اگر همین موضوع با همین نسخه‌ی مدل قبلاً ثبت
 * شده باشد (retry)، بی‌صدا رد می‌شود — ایندکسِ یکتایِ ۰۵۵ این را تضمین
 * می‌کند و اینجا هیچ UPDATEای در کار نیست: تاریخچه بازنویسی نمی‌شود.
 */
export async function recordPrediction(input: RecordPredictionInput): Promise<void> {
  const p = clamp01(input.probability);
  if (p === null) {
    // احتمالِ NaN/خارج از بازه یعنی باگِ بالادست — ثبتش دادهٔ سنجش را مسموم
    // می‌کند، پس رد می‌شود و لاگ می‌ماند (سکوتِ کامل بدترین کار است).
    log.warn('پیش‌بینی با احتمالِ نامعتبر ثبت نشد', {
      subjectId: input.subjectId, probability: input.probability,
    });
    return;
  }
  try {
    await db.modelPrediction.create({
      data: {
        restaurantId: input.restaurantId,
        predictionType: input.predictionType,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        modelSource: input.modelSource,
        modelVersion: input.modelVersion,
        featureVersion: input.featureVersion,
        features: input.features as object,
        probability: p,
        horizonAt: input.horizonAt ?? null,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return; // همان پیش‌بینی، همان نسخه — تکراری
    log.warn('ثبتِ پیش‌بینی ناموفق', {
      subjectId: input.subjectId, type: input.predictionType, error: (err as Error).message,
    });
  }
}

export interface RecordOutcomeInput {
  restaurantId: string;
  predictionType: PredictionType;
  subjectType: SubjectType;
  subjectId: string;
  /** ۱ = رویداد رخ داد (no_show)، ۰ = رخ نداد. */
  outcomeLabel: number;
  /** وضعیتِ پایانیِ واقعی که برچسب از آن ساخته شد — برایِ بازرسی‌پذیری. */
  outcomeStatus: string;
  occurredAt?: Date;
}

/**
 * ثبتِ نتیجه‌ی واقعی. هر موضوع دقیقاً یک نتیجه دارد؛ اولین ثبت برنده است و
 * ثبت‌های بعدی بی‌صدا رد می‌شوند (نتیجه واقعیتِ بیرونی‌ست، بازنویسی نمی‌شود).
 *
 * نکته: نتیجه حتی وقتی پیش‌بینی‌ای در دفتر نباشد هم ثبت می‌شود — مثلاً
 * رزروهایی که قبل از این migration ساخته شده‌اند. سنجش با INNER JOIN فقط
 * جفت‌های کامل را می‌شمارد، پس نتیجه‌ی بی‌پیش‌بینی آمار را خراب نمی‌کند.
 */
export async function recordOutcome(input: RecordOutcomeInput): Promise<void> {
  try {
    await db.modelOutcome.create({
      data: {
        restaurantId: input.restaurantId,
        predictionType: input.predictionType,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        outcomeLabel: input.outcomeLabel,
        outcomeStatus: input.outcomeStatus,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return; // نتیجه قبلاً ثبت شده — اولین ثبت برنده
    log.warn('ثبتِ نتیجه ناموفق', {
      subjectId: input.subjectId, type: input.predictionType, error: (err as Error).message,
    });
  }
}

// ── کمکی‌هایِ خالص (بدونِ DB — مستقیماً تست‌پذیر) ──────────────────────

/**
 * وضعیتِ پایانیِ رزرو → برچسبِ no-show، یا null اگر این وضعیت اصلاً نتیجه‌ی
 * معتبری برایِ مدلِ no-show نیست.
 *
 * دامنه عمداً *دقیقاً* همان چیزی‌ست که fetchTrainingRows در
 * lib/no-show-model.ts به‌عنوانِ دادهٔ آموزش می‌خواند:
 *   no_show                                  → ۱ (نیامد)
 *   completed / arrived / seated / dining    → ۰ (آمد)
 * هر چیزِ دیگر (cancelled*, expired, rejected, و وضعیت‌های میانی) → null.
 *
 * چرا لغوشده null است و نه ۰: مدل «آیا مهمانی که رزروش پابرجا ماند سرِ قرار
 * می‌آید؟» را پیش‌بینی می‌کند. لغوِ به‌موقع نه no-show است نه حضور — شمردنش
 * به‌عنوانِ ۰ (آمد) دقتِ تولیدی را به‌طورِ ساختگی بالا نشان می‌دهد، چون
 * لغوها معمولاً زیادند و مدل هیچ ادعایی درباره‌شان نکرده بود. اگر اینجا با
 * آموزش هم‌دامنه نبود، Brierِ تولیدی و Brierِ هولدآوت دو چیزِ متفاوت را
 * می‌سنجیدند و مقایسه‌شان بی‌معنا می‌شد.
 */
export function noShowOutcomeLabel(status: string): number | null {
  if (status === 'no_show') return 1;
  if (status === 'completed' || status === 'arrived' || status === 'seated' || status === 'dining') return 0;
  return null;
}

/** احتمالِ معتبرِ ۰..۱ یا null اگر NaN/بی‌نهایت/خارج از بازه باشد. */
function clamp01(v: number): number | null {
  if (!Number.isFinite(v)) return null;
  if (v < 0 || v > 1) return null;
  return v;
}

/** خطای نقضِ ایندکسِ یکتا در Prisma (P2002) — بدونِ importِ نوعِ Prisma. */
function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'P2002';
}
