import { Prisma } from '@prisma/client';
import { db } from './db';
import { populationStabilityIndex, psiBand, type PsiBand } from './ml-core';
import { MIN_RESOLVED_FOR_ACCURACY } from './prediction-ledger';

// ═══════════════════════════════════════════════════════════════════════
//  فازِ ۷ — تشخیصِ رانش (drift)
//
//  فازِ ۵ دفتر را ساخت («چه گفتیم، بعد چه شد») و فازِ ۶ هر پیش‌بینی را به
//  نسخه‌ی مدلی که ساختش بست. با آن دو، رانش دیگر یک قابلیتِ جدید نیست —
//  فقط یک کوئری روی چیزی است که از قبل ثبت می‌شود. برای همین این ماژول
//  هیچ جدولِ جدید، هیچ سرویسِ جدید و هیچ زیرساختی اضافه نمی‌کند (بندِ
//  «بدونِ زیرساختِ جدید بدونِ نیازِ اثبات‌شده»).
//
//  دو نوع رانش که واقعاً قابلِ محاسبه‌اند و اندازه‌گیری می‌شوند:
//
//  ۱) رانشِ کارایی — Brierِ *تولید* در پنجره‌ی اخیر در برابرِ Brierِ همان مدل
//     روی هولدآوتِ آموزش. این صادقانه‌ترین سؤال است: مدلی که موقعِ ساخت
//     خوب بود، الان هم خوب است؟ تا پیش از فازِ ۵ اصلاً قابلِ پرسیدن نبود.
//
//  ۲) رانشِ توزیعِ خروجی — PSI بینِ احتمال‌هایی که مدل در پنجره‌ی پایه داد و
//     آن‌هایی که در پنجره‌ی اخیر می‌دهد. این حتی *پیش از* رسیدنِ نتیجه‌ها
//     هشدار می‌دهد، چون به outcome نیاز ندارد — یعنی زودتر از رانشِ کارایی
//     می‌تواند دیده شود.
//
//  ⚠️ آنچه عمداً اینجا نیست: رانشِ تک‌تکِ ویژگی‌ها با سطل‌بندیِ کوانتایل.
//  محاسبه‌اش شدنی است ولی نیازِ اثبات‌شده‌ای برایش وجود ندارد و آستانه‌هایش
//  باید per-feature کالیبره شوند — بدونِ آن، فقط عددهایی تولید می‌کرد که
//  کسی نمی‌تواند تفسیرشان کند. به‌جایش میانگینِ ویژگی‌هایِ عددی در دو پنجره
//  به‌عنوانِ «داده» برگردانده می‌شود، بدونِ حکم.
// ═══════════════════════════════════════════════════════════════════════

/** حداقلِ پیش‌بینی در هر پنجره برای اینکه PSI اصلاً معنا داشته باشد. */
export const MIN_SAMPLES_FOR_PSI = 30;

/**
 * چقدر بدترشدنِ نسبیِ Brier «رانش» حساب می‌شود.
 *
 * ۲۵٪ عمدی و محافظه‌کارانه است: Brierِ تولید ذاتاً نویزی‌تر از هولدآوت است
 * (ترکیبِ مشتری‌ها فرق می‌کند، فصل عوض می‌شود). آستانه‌ی کوچک‌تر یعنی هشدارِ
 * دائمی، و هشداری که همیشه روشن است هیچ‌کس نمی‌خواندش.
 */
export const PERFORMANCE_DRIFT_THRESHOLD = 0.25;

export type DriftVerdict = 'stable' | 'watch' | 'drifted' | 'insufficient_data';

export interface PerformanceDrift {
  verdict: DriftVerdict;
  modelRunId: string | null;
  /** Brierِ همان مدل روی هولدآوتِ زمانِ آموزش. */
  holdoutBrier: number | null;
  /** Brierِ واقعیِ تولید در پنجره‌ی اخیر. */
  productionBrier: number | null;
  /** (تولید − هولدآوت) / هولدآوت — مثبت یعنی بدتر شده. */
  relativeChange: number | null;
  resolvedCount: number;
  reason: string;
}

/**
 * رانشِ کاراییِ مدلِ فعالِ no-show یک رستوران.
 *
 * فقط پیش‌بینی‌هایی شمرده می‌شوند که *همان* نسخه‌ی فعال ساخته باشد — وگرنه
 * عدد مخلوطی از چند نسخه می‌شد و بدترشدنِ ظاهری می‌توانست صرفاً اثرِ عوض‌شدنِ
 * مدل باشد، نه رانشِ دنیا.
 */
export async function detectPerformanceDrift(params: {
  restaurantId: string;
  windowDays?: number;
}): Promise<PerformanceDrift> {
  const windowDays = params.windowDays ?? 30;
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const model = await db.restaurantNoShowModel.findUnique({
    where: { restaurantId: params.restaurantId },
    select: { isActive: true, activeRunId: true, learnedBrier: true },
  });

  if (!model?.isActive) {
    return {
      verdict: 'insufficient_data', modelRunId: null, holdoutBrier: null,
      productionBrier: null, relativeChange: null, resolvedCount: 0,
      reason: 'مدلِ یادگرفته‌ی فعالی وجود ندارد (سیستم روی heuristic است)',
    };
  }
  if (!model.activeRunId) {
    return {
      verdict: 'insufficient_data', modelRunId: null, holdoutBrier: model.learnedBrier,
      productionBrier: null, relativeChange: null, resolvedCount: 0,
      // صادقانه: این مدل پیش از مهاجرتِ ۰۵۶ آموزش دیده و نسب‌نامه ندارد.
      // نسبت‌دادنِ پیش‌بینی‌هایِ بی‌نسب به آن یعنی ساختنِ رابطه‌ای که وجود ندارد.
      reason: 'مدلِ فعال نسب‌نامه ندارد؛ پس از اولین بازآموزی قابلِ سنجش می‌شود',
    };
  }

  const rows = await db.$queryRaw<{ n: number; brier: number | null }[]>(Prisma.sql`
    SELECT COUNT(o.id)::int AS n, AVG(o.squared_error)::float8 AS brier
    FROM model_predictions p
    JOIN model_outcomes o ON o.prediction_id = p.id
    WHERE p.restaurant_id = ${params.restaurantId}::uuid
      AND p.prediction_type = 'no_show'
      AND p.model_run_id = ${model.activeRunId}::uuid
      AND p.generated_at >= ${since}
  `);
  const resolvedCount = Number(rows[0]?.n ?? 0);
  const productionBrier = rows[0]?.brier == null ? null : Number(rows[0].brier);

  if (resolvedCount < MIN_RESOLVED_FOR_ACCURACY || productionBrier === null) {
    return {
      verdict: 'insufficient_data', modelRunId: model.activeRunId,
      holdoutBrier: model.learnedBrier, productionBrier: null, relativeChange: null,
      resolvedCount,
      reason: `نتیجه‌ی کافی در ${windowDays} روزِ اخیر نیست (${resolvedCount} < ${MIN_RESOLVED_FOR_ACCURACY})`,
    };
  }

  const holdoutBrier = model.learnedBrier;
  if (!(holdoutBrier > 0)) {
    return {
      verdict: 'insufficient_data', modelRunId: model.activeRunId,
      holdoutBrier, productionBrier, relativeChange: null, resolvedCount,
      reason: 'Brierِ هولدآوت معتبر نیست، مقایسه ممکن نیست',
    };
  }

  const relativeChange = (productionBrier - holdoutBrier) / holdoutBrier;
  const verdict: DriftVerdict =
    relativeChange >= PERFORMANCE_DRIFT_THRESHOLD ? 'drifted'
    : relativeChange >= PERFORMANCE_DRIFT_THRESHOLD / 2 ? 'watch'
    : 'stable';

  const pct = (relativeChange * 100).toFixed(1);
  const reason = verdict === 'drifted'
    ? `در تولید ${pct}٪ بدتر از هولدآوتِ زمانِ آموزش — بازآموزی لازم است`
    : verdict === 'watch'
      ? `در تولید ${pct}٪ بدتر از هولدآوت — هنوز زیرِ آستانه، ولی زیرِ نظر`
      : `کاراییِ تولید با زمانِ آموزش هم‌خوان است (${pct}٪)`;

  return { verdict, modelRunId: model.activeRunId, holdoutBrier, productionBrier, relativeChange, resolvedCount, reason };
}

export interface OutputDrift {
  verdict: DriftVerdict;
  psi: number | null;
  band: PsiBand | null;
  baselineCount: number;
  recentCount: number;
  reason: string;
}

/**
 * رانشِ توزیعِ خروجیِ مدل — PSI بینِ پنجره‌ی پایه و پنجره‌ی اخیر.
 *
 * چرا این مکملِ رانشِ کارایی است و جایگزینش نیست: این‌جا به outcome نیازی
 * نیست، پس برای رزروهایی که هنوز رخ نداده‌اند هم کار می‌کند و زودتر هشدار
 * می‌دهد. ولی «توزیع عوض شده» لزوماً یعنی «مدل بد شده» نیست — مثلاً ترکیبِ
 * مشتری‌ها واقعاً عوض شده. برای همین حکمش watch است، نه drifted.
 */
export async function detectOutputDrift(params: {
  restaurantId: string;
  recentDays?: number;
  baselineDays?: number;
}): Promise<OutputDrift> {
  const recentDays = params.recentDays ?? 14;
  const baselineDays = params.baselineDays ?? 90;
  const recentSince = new Date(Date.now() - recentDays * 86_400_000);
  const baselineSince = new Date(Date.now() - baselineDays * 86_400_000);

  const rows = await db.$queryRaw<{ bucket: string; predicted_value: number }[]>(Prisma.sql`
    SELECT CASE WHEN p.generated_at >= ${recentSince} THEN 'recent' ELSE 'baseline' END AS bucket,
           p.predicted_value
    FROM model_predictions p
    WHERE p.restaurant_id = ${params.restaurantId}::uuid
      AND p.prediction_type = 'no_show'
      AND p.generated_at >= ${baselineSince}
  `);

  const baseline: number[] = [];
  const recent: number[] = [];
  for (const r of rows) {
    (r.bucket === 'recent' ? recent : baseline).push(Number(r.predicted_value));
  }

  if (baseline.length < MIN_SAMPLES_FOR_PSI || recent.length < MIN_SAMPLES_FOR_PSI) {
    return {
      verdict: 'insufficient_data', psi: null, band: null,
      baselineCount: baseline.length, recentCount: recent.length,
      reason: `هر پنجره دست‌کم ${MIN_SAMPLES_FOR_PSI} پیش‌بینی لازم دارد (پایه: ${baseline.length}، اخیر: ${recent.length})`,
    };
  }

  const psi = populationStabilityIndex(baseline, recent);
  if (!Number.isFinite(psi)) {
    return {
      verdict: 'insufficient_data', psi: null, band: null,
      baselineCount: baseline.length, recentCount: recent.length,
      reason: 'PSI قابلِ محاسبه نشد',
    };
  }
  const band = psiBand(psi);
  return {
    verdict: band === 'stable' ? 'stable' : 'watch',
    psi, band,
    baselineCount: baseline.length, recentCount: recent.length,
    reason: band === 'significant'
      ? `توزیعِ خروجیِ مدل به‌طورِ قابل‌توجه جابه‌جا شده (PSI=${psi.toFixed(3)}) — ورودی‌ها دیگر شبیهِ گذشته نیستند`
      : band === 'moderate'
        ? `جابه‌جاییِ متوسط در توزیعِ خروجی (PSI=${psi.toFixed(3)})`
        : `توزیعِ خروجی پایدار است (PSI=${psi.toFixed(3)})`,
  };
}

export interface PlatformDriftRow {
  restaurantId: string;
  restaurantName: string;
  modelRunId: string;
  holdoutBrier: number;
  productionBrier: number | null;
  relativeChange: number | null;
  resolvedCount: number;
  verdict: DriftVerdict;
}

/**
 * رانشِ کارایی برای *همه‌ی* رستوران‌هایِ دارایِ مدلِ فعال — با یک کوئری.
 *
 * ⚠️ عمداً batch است و نه حلقه‌ای روی detectPerformanceDrift: داشبوردِ شرکت
 * کلِ پلتفرم را می‌بیند و N+1 اینجا یعنی یک رفت‌وبرگشتِ دیتابیس به‌ازای هر
 * رستوران. همان منطقِ آستانه اعمال می‌شود تا دو مسیر هرگز دو حکمِ متفاوت
 * ندهند.
 */
export async function getPlatformPerformanceDrift(params: {
  windowDays?: number;
} = {}): Promise<PlatformDriftRow[]> {
  const windowDays = params.windowDays ?? 30;
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const rows = await db.$queryRaw<{
    restaurant_id: string; restaurant_name: string; model_run_id: string;
    holdout_brier: number; n: number; production_brier: number | null;
  }[]>(Prisma.sql`
    SELECT m.restaurant_id, r.name AS restaurant_name, m.active_run_id AS model_run_id,
           m.learned_brier::float8       AS holdout_brier,
           COUNT(o.id)::int              AS n,
           AVG(o.squared_error)::float8  AS production_brier
    FROM restaurant_no_show_models m
    JOIN restaurants r ON r.id = m.restaurant_id
    LEFT JOIN model_predictions p
      ON  p.restaurant_id  = m.restaurant_id
      AND p.model_run_id   = m.active_run_id
      AND p.prediction_type = 'no_show'
      AND p.generated_at   >= ${since}
    LEFT JOIN model_outcomes o ON o.prediction_id = p.id
    WHERE m.is_active = true AND m.active_run_id IS NOT NULL
    GROUP BY m.restaurant_id, r.name, m.active_run_id, m.learned_brier
    ORDER BY r.name
  `);

  return rows.map(r => {
    const resolvedCount = Number(r.n);
    const holdoutBrier = Number(r.holdout_brier);
    const productionBrier = r.production_brier == null ? null : Number(r.production_brier);
    if (resolvedCount < MIN_RESOLVED_FOR_ACCURACY || productionBrier === null || !(holdoutBrier > 0)) {
      return {
        restaurantId: r.restaurant_id, restaurantName: r.restaurant_name,
        modelRunId: r.model_run_id, holdoutBrier, productionBrier: null,
        relativeChange: null, resolvedCount, verdict: 'insufficient_data' as DriftVerdict,
      };
    }
    const relativeChange = (productionBrier - holdoutBrier) / holdoutBrier;
    const verdict: DriftVerdict =
      relativeChange >= PERFORMANCE_DRIFT_THRESHOLD ? 'drifted'
      : relativeChange >= PERFORMANCE_DRIFT_THRESHOLD / 2 ? 'watch'
      : 'stable';
    return {
      restaurantId: r.restaurant_id, restaurantName: r.restaurant_name,
      modelRunId: r.model_run_id, holdoutBrier, productionBrier, relativeChange,
      resolvedCount, verdict,
    };
  });
}
