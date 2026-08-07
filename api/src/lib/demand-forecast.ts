import { Prisma } from '@prisma/client';
import { db } from './db';
import { cached, cacheKey, invalidate } from './cache';
import { meanAbsoluteError, decideModelActivation } from './ml-core';

// ═══════════════════════════════════════════════════════════════════════
//  پیش‌بینیِ تقاضا — «شبیه‌سازیِ روزهای آینده» از رویِ تاریخچه‌ی خودِ رستوران
//
//  تا امروز هیچ پیش‌بینیِ آینده‌ای در رزرونو وجود نداشت — فقط گزارش‌های
//  گذشته‌نگر (چند رزرو داشتیم، کدام روز کم‌تردد بود و...). این ماژول اولین
//  پیش‌بینیِ رو-به-جلوست: «هفته‌ی آینده چقدر تقاضا داریم؟» — برای برنامه‌ریزیِ
//  نیرو، خرید موادِ اولیه و ظرفیت.
//
//  روش: Holt-Winters جمعی (level + trend + فصلیِ هفتگی، period=7) — دقیقاً
//  همان انضباطِ lib/no-show-model.ts، این‌بار برای رگرسیونِ سری‌زمانی به‌جای
//  طبقه‌بندی:
//   ۱) یادگیری per-restaurant، از رویِ تاریخچه‌ی خودِ همان رستوران.
//   ۲) سنجش روی هولدآوتِ *زمانی* (۲۰٪ انتهاییِ سری) — نه split تصادفی.
//   ۳) baseline صادقانه: «پیش‌بینیِ فصلیِ ساده» یعنی فرضِ اینکه هر روز دقیقاً
//      مثلِ همان‌روزِ هفته‌ی قبل می‌شود (از رویِ دادهٔ واقعی، نه بازگشتی).
//   ۴) فقط اگر Holt-Winters روی هولدآوت واقعاً از این baseline بهتر باشد
//      فعال می‌شود (decideModelActivation در lib/ml-core.ts)؛ وگرنه بی‌صدا
//      همان پیش‌بینیِ فصلیِ ساده (برچسب‌خورده به‌عنوانِ «naive») نمایش داده
//      می‌شود — هیچ‌وقت به کاربر عددِ بی‌پایه‌ی «هوش مصنوعی» نشان داده نمی‌شود.
//
//  دو سریِ مستقل آموزش می‌بینند: تعدادِ رزرو در روز، و مجموعِ کاورها
//  (نفرات) در روز. مستقل‌اند چون ممکن است یکی سیگنالِ کافی داشته باشد و
//  دیگری نه (مثلاً رستورانی با گروه‌های نامنظم: تعدادِ رزرو قابل‌پیش‌بینی
//  ولی کاورها نویزی).
// ═══════════════════════════════════════════════════════════════════════

const DEMAND_PERIOD = 7; // فصلیِ هفتگی — چرخه‌ی طبیعیِ تقاضای رستوران
/** حداقلِ مطلقِ سازه‌ای برای اینکه اصلاً بشود Holt-Winters را fit کرد
 *  (۸۰٪ برایِ آموزش باید حداقل دو دوره‌ی کامل باشد) — این گیت جدا از
 *  MIN_SAMPLE_SIZE_DAYS است: آن یکی «واقعاً کافی» را می‌سنجد، این یکی فقط
 *  از کرش‌کردنِ ریاضی جلوگیری می‌کند. */
const MIN_STRUCTURAL_DAYS = DEMAND_PERIOD * 2;
/** آستانه‌ی «داده‌ی واقعاً کافی» برای فعال‌شدنِ مدلِ یادگرفته — ۶ هفته، تا
 *  چند چرخه‌ی کاملِ هفتگی برای یادگیریِ فصلی وجود داشته باشد. */
const MIN_SAMPLE_SIZE_DAYS = 42;
/** چند روزِ تاریخچه واکشی شود — سقفِ بالا تا کوئری روی رستوران‌های خیلی
 *  قدیمی سنگین نشود؛ ۶ ماه برای یادگیریِ فصلیِ هفتگی بیش از کافی است. */
const LOOKBACK_DAYS = 180;

// ── ریاضیاتِ خالص Holt-Winters — بدونِ هیچ وابستگی به DB، مستقیماً قابلِ تست ──

export interface HoltWintersModel {
  level: number;
  trend: number;
  seasonal: number[]; // طولش = period
  period: number;
  /** فازِ اولین گامِ پیش‌بینی = (طولِ سریِ آموزشی) mod period. چون سری
   *  بدونِ شکاف و روزبه‌روز است، t mod period همیشه به یک روزِ هفته‌ی
   *  ثابت اشاره می‌کند — نیازی به دانستنِ کدام روزِ هفته نیست، فقط باید
   *  با همین offset ادامه پیدا کند. */
  phaseOffset: number;
}

export interface HoltWintersOptions {
  alpha?: number; // وزنِ به‌روزرسانیِ سطح (level)
  beta?: number;  // وزنِ به‌روزرسانیِ روند (trend)
  gamma?: number; // وزنِ به‌روزرسانیِ فصلی (seasonal)
}

const DEFAULT_ALPHA = 0.3;
const DEFAULT_BETA = 0.1;
const DEFAULT_GAMMA = 0.3;

/**
 * برازشِ Holt-Winters جمعی (additive). به‌جای کتابخانه‌ی سری‌زمانی، پیاده‌سازیِ
 * دستیِ استاندارد — برای ۷ فازِ فصلی و چند صد نقطه، الگوریتمِ کلاسیک کافی
 * است و هیچ وابستگیِ سنگینی لازم ندارد.
 *
 * مقداردهیِ اولیه: میانگینِ اولین دوره برای level، شیبِ میانگینِ بین
 * دوره‌های متوالی برای trend، و انحرافِ میانگینِ هر فاز از میانگینِ دوره‌اش
 * برای seasonal — دقیقاً روشِ استانداردِ کتاب‌های پیش‌بینی (Holt-Winters
 * classic initialization)، نه یک تقریبِ اختیاری.
 */
export function fitHoltWinters(
  y: readonly number[],
  period: number,
  opts: HoltWintersOptions = {},
): HoltWintersModel {
  const { alpha = DEFAULT_ALPHA, beta = DEFAULT_BETA, gamma = DEFAULT_GAMMA } = opts;
  const n = y.length;
  if (period < 2) throw new Error('fitHoltWinters: period باید حداقل ۲ باشد');
  if (n < period * 2) {
    throw new Error(`fitHoltWinters: حداقل ${period * 2} نقطه لازم است (دو دوره‌ی کامل)، ${n} داده شد`);
  }

  const numSeasons = Math.floor(n / period);
  const seasonAvg: number[] = [];
  for (let k = 0; k < numSeasons; k++) {
    let sum = 0;
    for (let i = 0; i < period; i++) sum += y[k * period + i];
    seasonAvg.push(sum / period);
  }

  let trend = 0;
  for (let k = 0; k < numSeasons - 1; k++) trend += (seasonAvg[k + 1] - seasonAvg[k]) / period;
  trend /= numSeasons - 1;

  const seasonal = new Array(period).fill(0);
  for (let i = 0; i < period; i++) {
    let sum = 0;
    for (let k = 0; k < numSeasons; k++) sum += y[k * period + i] - seasonAvg[k];
    seasonal[i] = sum / numSeasons;
  }

  let level = seasonAvg[0];

  // به‌روزرسانیِ بازگشتیِ استاندارد — از t=period شروع می‌شود چون [0, period)
  // فقط برایِ مقداردهیِ اولیه (بالا) استفاده شد.
  for (let t = period; t < n; t++) {
    const phase = t % period;
    const prevLevel = level;
    const newLevel = alpha * (y[t] - seasonal[phase]) + (1 - alpha) * (level + trend);
    const newTrend = beta * (newLevel - prevLevel) + (1 - beta) * trend;
    const newSeasonal = gamma * (y[t] - newLevel) + (1 - gamma) * seasonal[phase];
    level = newLevel;
    trend = newTrend;
    seasonal[phase] = newSeasonal;
  }

  return { level, trend, seasonal, period, phaseOffset: n % period };
}

/**
 * پیش‌بینیِ h گامِ آینده از رویِ مدلِ برازش‌شده. خروجی هیچ‌وقت منفی نیست:
 * تقاضای منفی بی‌معناست، حتی اگر جمعِ ریاضیِ level+trend+seasonal (برای
 * اعداد کوچک با فصلیِ منفیِ بزرگ) منفی شود. این کلمپ هم در سنجشِ دقت
 * (fitAndEvaluate پایین‌تر) و هم در خروجیِ نهایی اعمال می‌شود — یعنی MAE
 * گزارش‌شده دقیقاً همان چیزی‌ست که در عمل دیده می‌شود، نه یک نسخه‌ی
 * خوش‌بینانه‌ترِ محاسبه‌نشده.
 */
export function forecastHoltWinters(model: HoltWintersModel, horizon: number): number[] {
  const out: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const phase = (model.phaseOffset + h - 1) % model.period;
    const raw = model.level + h * model.trend + model.seasonal[phase];
    out.push(Math.max(0, raw));
  }
  return out;
}

/**
 * baseline صادقانه برای fallback وقتی مدلِ یادگرفته فعال نیست: همان
 * الگوی هفته‌ی اخیر را تکرار کن. lastPeriodValues باید آخرین «period»
 * روزِ خام باشد (واقعی، نه پیش‌بینی).
 */
export function seasonalNaiveForecast(lastPeriodValues: readonly number[], horizon: number): number[] {
  const period = lastPeriodValues.length;
  const out: number[] = [];
  for (let h = 0; h < horizon; h++) out.push(Math.max(0, lastPeriodValues[h % period]));
  return out;
}

// ── لایه‌ی دامنه: آموزش + سنجش یک سری روی هولدآوت ──

export interface SeriesModelState {
  model: HoltWintersModel;
  mae: number;
  baselineMae: number;
  isActive: boolean;
  reason: string;
  /** آخرین ۷ روزِ خام — برایِ fallback با seasonalNaiveForecast وقتی isActive=false. */
  lastValues: number[];
}

/**
 * یک سری (تعدادِ رزرو یا کاورها) را روی split زمانیِ ۸۰/۲۰ می‌سنجد.
 * فرض: n (طولِ کل) و splitAt از قبل توسطِ فراخوان چک شده‌اند
 * (splitAt >= period*2 و n-splitAt > 0) — این تابع خودش گیتِ سازه‌ای
 * نمی‌زند، فقط ریاضیِ سنجش را انجام می‌دهد.
 */
function trainSeries(series: readonly number[], n: number, splitAt: number, baselineLabel: string): SeriesModelState {
  const trainSet = series.slice(0, splitAt);
  const holdout = series.slice(splitAt);
  const lastValues = series.slice(-DEMAND_PERIOD);

  // مدلِ «تولیدی» همان مدلِ فیت‌شده روی ۸۰٪ آموزش است — دوباره روی کلِ
  // داده fit نمی‌کنیم، دقیقاً مثلِ no-show-model.ts: عددِ دقتی که گزارش
  // می‌شود باید متعلق به همان وزن‌هایی باشد که واقعاً استفاده می‌شوند، نه
  // یک مدلِ دیگر که بعداً جای آن گذاشته شده.
  const model = fitHoltWinters(trainSet, DEMAND_PERIOD);
  const learnedPreds = forecastHoltWinters(model, holdout.length);
  const mae = meanAbsoluteError(learnedPreds, holdout);

  // baseline: مقدارِ واقعیِ همین‌روز در هفته‌ی قبل (نه پیش‌بینیِ بازگشتی از
  // پیش‌بینیِ خودش) — سنجشِ منصفانه در برابرِ ساده‌ترین کارِ ممکن.
  const baselinePreds = holdout.map((_, i) => series[splitAt + i - DEMAND_PERIOD]);
  const baselineMae = meanAbsoluteError(baselinePreds, holdout);

  const decision = decideModelActivation({
    sampleSize: n,
    minSampleSize: MIN_SAMPLE_SIZE_DAYS,
    learnedError: mae,
    baselineError: baselineMae,
    baselineLabel,
  });

  return { model, mae, baselineMae, isActive: decision.isActive, reason: decision.reason, lastValues };
}

// ── از اینجا به بعد: DB واقعی. در تستِ واحد صدا زده نمی‌شود (نیاز به Postgres دارد). ──

interface DailyRow {
  day: Date;
  reservation_count: bigint | number;
  covers: bigint | number;
}

/**
 * سریِ روزانه‌ی «تعدادِ رزرو» و «مجموعِ کاورها» را برایِ این رستوران
 * می‌سازد — یک ردیف به‌ازایِ هر روزِ تقویمی، بدونِ شکاف (روزهایی که هیچ
 * رزروی نبوده صفر می‌شوند، نه اینکه از سری حذف شوند؛ حذف‌کردن فازِ
 * فصلیِ هفتگی را به‌هم می‌ریزد چون دیگر هر ۷ نقطه دقیقاً یک هفته نیست).
 *
 * generate_series تقویمِ کامل را می‌سازد؛ LEFT JOIN با رزروهایِ واقعی صفر
 * را برایِ روزهای بدونِ رزرو تضمین می‌کند. بازه: [امروز−LOOKBACK_DAYS,
 * دیروز] — امروز عمداً کنار گذاشته شده چون هنوز کامل نشده (نشتِ اطلاعاتِ
 * جزئی: شمردنِ «تا این لحظه» به‌جایِ عددِ نهاییِ روز).
 *
 * مجموعه‌یِ وضعیت‌ها («تقاضایِ واقعی») هرچیزی‌ست که از مرحله‌ی pending/
 * waitlist عبور کرده و لغو/رد/منقضی نشده — یعنی مشتری واقعاً قصدِ حضور
 * داشته، چه در نهایت آمده باشد (seated/dining/completed) چه نیامده
 * (no_show). لغوها و ردها بیرون‌اند چون آن تقاضا در عمل تبخیر شده و
 * تکرارپذیر نیست.
 */
async function fetchDailySeries(restaurantId: string): Promise<{ counts: number[]; covers: number[] }> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - LOOKBACK_DAYS);

  const rows = await db.$queryRaw<DailyRow[]>`
    WITH days AS (
      SELECT generate_series(${start}::date, CURRENT_DATE - 1, interval '1 day')::date AS day
    ),
    agg AS (
      SELECT slot_start::date AS day,
             COUNT(*)::bigint AS reservation_count,
             COALESCE(SUM(party_size), 0)::bigint AS covers
      FROM reservations
      WHERE restaurant_id = ${restaurantId}::uuid
        AND status IN ('confirmed', 'auto_confirmed', 'preparing', 'checked_in', 'running_late',
                        'arrived', 'seated', 'dining', 'completed', 'no_show')
        AND slot_start >= ${start}
        AND slot_start < CURRENT_DATE
      GROUP BY 1
    )
    SELECT d.day, COALESCE(a.reservation_count, 0) AS reservation_count, COALESCE(a.covers, 0) AS covers
    FROM days d
    LEFT JOIN agg a ON a.day = d.day
    ORDER BY d.day ASC
  `;

  return {
    counts: rows.map((r) => Number(r.reservation_count)),
    covers: rows.map((r) => Number(r.covers)),
  };
}

export interface DemandTrainResult {
  trained: boolean;
  reason?: string;
  sampleSize: number;
  countActive?: boolean;
  coversActive?: boolean;
}

/**
 * آموزشِ شبانه برایِ یک رستوران — از همان cronِ maintenance/customer-insights
 * صدا زده می‌شود که no-show model را هم بازآموزی می‌کند.
 */
export async function trainAndCalibrateDemandForecast(restaurantId: string): Promise<DemandTrainResult> {
  const { counts, covers } = await fetchDailySeries(restaurantId);
  const n = counts.length;
  const splitAt = Math.floor(n * 0.8);
  const holdoutLen = n - splitAt;

  if (splitAt < MIN_STRUCTURAL_DAYS || holdoutLen === 0) {
    return { trained: false, reason: `دادهٔ کافی برای split نیست (${n} روز)`, sampleSize: n };
  }

  const countState = trainSeries(counts, n, splitAt, 'پیش‌بینیِ فصلیِ ساده (تعدادِ رزروِ هفته‌ی قبل)');
  const coversState = trainSeries(covers, n, splitAt, 'پیش‌بینیِ فصلیِ ساده (کاورهای هفته‌ی قبل)');

  await db.restaurantDemandForecast.upsert({
    where: { restaurantId },
    create: {
      restaurantId, historyDays: n,
      countModel: countState as unknown as Prisma.InputJsonValue,
      coversModel: coversState as unknown as Prisma.InputJsonValue,
    },
    update: {
      historyDays: n,
      countModel: countState as unknown as Prisma.InputJsonValue,
      coversModel: coversState as unknown as Prisma.InputJsonValue,
      trainedAt: new Date(),
    },
  });
  await invalidate(cacheKey('demand-forecast', restaurantId));

  return { trained: true, sampleSize: n, countActive: countState.isActive, coversActive: coversState.isActive };
}

export interface DemandForecastPoint {
  date: string; // YYYY-MM-DD
  predicted: number;
}

export interface DemandForecastSeries {
  source: 'learned' | 'naive';
  mae?: number;
  baseline_mae?: number;
  accuracy_vs_baseline_pct?: number;
  points: DemandForecastPoint[];
}

export interface DemandForecastResult {
  trained_at: Date;
  history_days: number;
  reservations: DemandForecastSeries;
  covers: DemandForecastSeries;
}

/** عددهای خامِ پیش‌بینی را به تاریخِ تقویمیِ واقعی وصل می‌کند — h=0 یعنی فردا. */
function attachDates(values: readonly number[]): DemandForecastPoint[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return values.map((v, h) => {
    const d = new Date(base);
    d.setDate(d.getDate() + h + 1);
    return { date: d.toISOString().slice(0, 10), predicted: Math.round(v * 10) / 10 };
  });
}

function buildForecastSeries(state: SeriesModelState, horizonDays: number): DemandForecastSeries {
  if (state.isActive) {
    const values = forecastHoltWinters(state.model, horizonDays);
    return {
      source: 'learned',
      mae: Math.round(state.mae * 100) / 100,
      baseline_mae: Math.round(state.baselineMae * 100) / 100,
      accuracy_vs_baseline_pct: state.baselineMae > 0
        ? Math.round(((state.baselineMae - state.mae) / state.baselineMae) * 1000) / 10
        : 0,
      points: attachDates(values),
    };
  }
  // مدلِ یادگرفته فعال نیست (داده کم یا بهتر از baseline نبود) — به‌جایِ
  // سکوتِ کامل، همان پیش‌بینیِ فصلیِ ساده با برچسبِ صادقانه‌ی «naive» نشان
  // داده می‌شود، نه چیزی که ادعایِ «هوش مصنوعی» کند.
  return { source: 'naive', points: attachDates(seasonalNaiveForecast(state.lastValues, horizonDays)) };
}

/**
 * خواندنِ پیش‌بینیِ فعلیِ یک رستوران (کش‌شده، ۱ ساعت). null یعنی «هنوز
 * تاریخچه‌ی کافی برایِ حتی یک تلاشِ آموزش وجود نداشته» — این با
 * source:'naive' فرق دارد (آن یعنی «تلاش شد ولی هنوز به baseline نرسید»؛
 * این یعنی «هنوز اصلاً امتحان نشده»).
 */
export async function getDemandForecast(restaurantId: string, horizonDays = 14): Promise<DemandForecastResult | null> {
  const row = await cached(cacheKey('demand-forecast', restaurantId), 3600, () =>
    db.restaurantDemandForecast.findUnique({ where: { restaurantId } }),
  );
  if (!row) return null;

  return {
    trained_at: row.trainedAt,
    history_days: row.historyDays,
    reservations: buildForecastSeries(row.countModel as unknown as SeriesModelState, horizonDays),
    covers: buildForecastSeries(row.coversModel as unknown as SeriesModelState, horizonDays),
  };
}
