import { Prisma } from '@prisma/client';
import { db } from './db';
import { cached, cacheKey, invalidate } from './cache';
import { meanAbsoluteError, decideModelActivation } from './ml-core';
// «روز» = روزِ تهران. تعریفِ واحد و شواهدش در lib/restaurant-manager.ts.
import { TEHRAN_SLOT_DAY, TEHRAN_TODAY, BUSINESS_TZ } from './restaurant-manager';

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

/**
 * نسخه‌ی شکلِ حالتِ ذخیره‌شده در `restaurant_demand_forecasts.count_model/covers_model`.
 *
 * ⚠️ چرا لازم شد (۲۰۲۶-۰۸-۲۵): تا نسخه‌ی ۱، مدلِ ذخیره‌شده روی **۸۰٪ اولِ**
 * سری fit می‌شد ولی خروجی‌اش به‌عنوانِ «۱۴ روزِ آینده» برچسب می‌خورد. با
 * LOOKBACK_DAYS=۱۸۰ یعنی مبدأِ پیش‌بینی ۳۶ روز عقب‌تر از دیروز بود و
 * `attachDates` آن را «فردا به بعد» می‌نامید — ۳۷ روز خطای تاریخ، و چون
 * ۳۷ mod ۷ = ۲، الگویِ هفتگی هم دو روز جابه‌جا نمایش داده می‌شد. UI هیچ
 * تاریخی نشان نمی‌دهد، پس کاربر امکانِ دیدنِ این جابه‌جایی را نداشت.
 *
 * ردیف‌هایِ ذخیره‌شده‌ی نسخه‌ی قدیمی این فیلد را ندارند. برایشان **عدد جعل
 * نمی‌شود**: `getDemandForecast` تا اولین بازآموزیِ شبانه `null` برمی‌گرداند
 * (همان قاعده‌ی گاردِ نسخه در no-show-model.ts).
 */
export const DEMAND_STATE_VERSION = 2;

export interface SeriesModelState {
  model: HoltWintersModel;
  mae: number;
  baselineMae: number;
  isActive: boolean;
  reason: string;
  /** آخرین ۷ روزِ خام — برایِ fallback با seasonalNaiveForecast وقتی isActive=false. */
  lastValues: number[];
  /** آخرین روزِ تقویمیِ (تهرانِ) موجود در سری — مبدأِ واقعیِ پیش‌بینی.
   *  بدونِ این، نگاشتِ «گامِ h → تاریخ» یک فرضِ نانوشته بود. */
  lastObservedDay: string; // YYYY-MM-DD
  /** رجوع کن به DEMAND_STATE_VERSION. */
  version: number;
}

/**
 * یک سری (تعدادِ رزرو یا کاورها) را روی split زمانیِ ۸۰/۲۰ می‌سنجد.
 * فرض: n (طولِ کل) و splitAt از قبل توسطِ فراخوان چک شده‌اند
 * (splitAt >= period*2 و n-splitAt > 0) — این تابع خودش گیتِ سازه‌ای
 * نمی‌زند، فقط ریاضیِ سنجش را انجام می‌دهد.
 */
function trainSeries(
  series: readonly number[],
  days: readonly string[],
  n: number,
  splitAt: number,
  baselineLabel: string,
): SeriesModelState {
  const trainSet = series.slice(0, splitAt);
  const holdout = series.slice(splitAt);
  const lastValues = series.slice(-DEMAND_PERIOD);

  // ── سنجش: مدلِ سنجش فقط رویِ ۸۰٪ آموزش fit می‌شود و هرگز سرو نمی‌شود ──
  const evalModel = fitHoltWinters(trainSet, DEMAND_PERIOD);
  const learnedPreds = forecastHoltWinters(evalModel, holdout.length);
  const mae = meanAbsoluteError(learnedPreds, holdout);

  // ── baselineِ منصفانه: **همان افق**، همان مبدأ ──────────────────────
  // ⚠️ باگی که اینجا بود (۲۰۲۶-۰۸-۲۵): baseline قبلاً
  // `series[splitAt + i - 7]` بود. برای i>=7 این یعنی خواندنِ مقدارِ
  // **واقعیِ داخلِ خودِ هولدآوت** — یعنی یک baselineِ عملاً «۷ روز جلوتر با
  // مشاهده‌ی تازه»، در حالی که مدلِ یادگرفته یک پیش‌بینیِ تک‌مبدأیِ ۳۶ روزه
  // می‌داد. دو افقِ کاملاً متفاوت به‌عنوانِ برابر مقایسه می‌شدند، و چون
  // فعال‌سازی ۵٪ بهبود می‌خواهد، مدلِ یادگرفته **ساختاراً** محکوم به شکست
  // بود — پس حکمِ «مدل بهتر از baseline نشد» یک حکمِ صادقانه نبود.
  //
  // حالا هر دو طرف از همان مبدأ (پایانِ trainSet) و برای همان افق پیش‌بینی
  // می‌کنند: baseline همان `seasonalNaiveForecast` است که ML_CONTRACT.md
  // به‌عنوانِ baselineِ رسمیِ تقاضا اسم می‌برد (و تا امروز اصلاً صدا زده
  // نمی‌شد). هم‌ترازیِ فاز: `trainSet.slice(-7)[0]` اندیسِ splitAt-7 است که
  // با splitAt هم‌روزِ هفته است، پس `[i % 7]` دقیقاً همان روزِ هفته‌ی
  // holdout[i] را می‌دهد.
  const baselinePreds = seasonalNaiveForecast(trainSet.slice(-DEMAND_PERIOD), holdout.length);
  const baselineMae = meanAbsoluteError(baselinePreds, holdout);

  const decision = decideModelActivation({
    sampleSize: n,
    minSampleSize: MIN_SAMPLE_SIZE_DAYS,
    learnedError: mae,
    baselineError: baselineMae,
    baselineLabel,
  });

  // ── مدلِ سرو: روی **کلِ** سری، تا مبدأش «دیروز» باشد نه ۸۰٪ عقب‌تر ──
  // ⚠️ صداقت درباره‌ی معنیِ عددِ MAE: این MAE متعلق به *روش* است (خطایِ
  // برون‌نمونه‌ایِ Holt-Winters روی هولدآوتِ زمانی)، نه به همین وزن‌های
  // ذخیره‌شده. این ادعا سست نیست: α/β/γ **ثابت‌های کدند** و از داده انتخاب
  // نمی‌شوند، پس هیچ هایپرپارامتری روی هولدآوت تنظیم نشده و refit فقط
  // «حالت» را به آخرین مشاهده می‌رساند — چیزی به مدل یاد نمی‌دهد که در
  // سنجش دیده باشد.
  // و بدیلش بدتر بود: مدلِ ۸۰٪ که مبدأش ۳۶ روز عقب است، عملاً پیش‌بینیِ
  // *گذشته* را به‌عنوانِ «هفته‌ی آینده» نشان می‌داد.
  const model = fitHoltWinters(series, DEMAND_PERIOD);

  return {
    model, mae, baselineMae,
    isActive: decision.isActive, reason: decision.reason,
    lastValues,
    lastObservedDay: days[days.length - 1],
    version: DEMAND_STATE_VERSION,
  };
}

// ── از اینجا به بعد: DB واقعی. در تستِ واحد صدا زده نمی‌شود (نیاز به Postgres دارد). ──

interface DailyRow {
  day: Date;
  reservation_count: bigint | number;
  covers: bigint | number;
}

/** خروجیِ fetchDailySeries — `days` هم‌طولِ سری‌هاست و `days[i]` تاریخِ
 *  تقویمیِ (تهرانِ) نقطه‌ی `i` است. بدونِ این، نگاشتِ «اندیسِ پیش‌بینی →
 *  تاریخ» یک حدسِ ضمنی می‌شد — همان حدسی که ۳۷ روز خطا داشت. */
export interface DailySeries {
  days: string[]; // YYYY-MM-DD به وقتِ تهران
  counts: number[];
  covers: number[];
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
 * ⚠️ «روز» اینجا روزِ **تهران** است، نه UTC (رفعِ ۲۰۲۶-۰۸-۲۵). نسخه‌ی قبلی
 * `slot_start::date` و `CURRENT_DATE` می‌زد و چون Postgres روی UTC اجرا
 * می‌شود، هر اسلاتِ ۰۰:۰۰ تا ۰۳:۲۹ به وقتِ تهران در سطلِ روزِ *قبل*
 * می‌افتاد — یعنی دقیقاً همان سیگنالِ فصلیِ هفتگی که این مدل قرار است یاد
 * بگیرد، با یک نویزِ سیستماتیک آلوده می‌شد. تعریفِ واحد در
 * lib/restaurant-manager.ts (TEHRAN_SLOT_DAY / TEHRAN_TODAY).
 *
 * مجموعه‌یِ وضعیت‌ها («تقاضایِ واقعی») هرچیزی‌ست که از مرحله‌ی pending/
 * waitlist عبور کرده و لغو/رد/منقضی نشده — یعنی مشتری واقعاً قصدِ حضور
 * داشته، چه در نهایت آمده باشد (seated/dining/completed) چه نیامده
 * (no_show). لغوها و ردها بیرون‌اند چون آن تقاضا در عمل تبخیر شده و
 * تکرارپذیر نیست. (این لیست بعداً هم‌نامِ DEMAND_RESERVATION_STATUSES در
 * lib/reservation-status.ts استخراج شد — اینجا لفظی مانده تا کوئریِ
 * تست‌شده‌ی موجود دست‌نخورده بماند؛ در تغییرِ بعدی که این فایل لمس شود
 * می‌تواند یکی شود.)
 */
/**
 * ⚠️ export عمدی و فقط برای تست — دقیقاً همان دلیلِ `fetchTrainingRows` در
 * no-show-model.ts: تستِ سطل‌بندیِ روز باید همین کوئریِ *واقعی* را اجرا کند.
 * اگر تست کوئری را بازنویسی می‌کرد، فقط خودش را می‌سنجید و تفاوتِ UTC/تهران
 * دوباره نامرئی می‌ماند.
 */
export async function fetchDailySeries(restaurantId: string): Promise<DailySeries> {
  const rows = await db.$queryRaw<DailyRow[]>`
    WITH bounds AS (
      SELECT ${TEHRAN_TODAY} - ${LOOKBACK_DAYS}::int AS first_day,
             ${TEHRAN_TODAY} - 1                     AS last_day
    ),
    days AS (
      SELECT generate_series(b.first_day, b.last_day, interval '1 day')::date AS day FROM bounds b
    ),
    agg AS (
      SELECT ${TEHRAN_SLOT_DAY} AS day,
             COUNT(*)::bigint AS reservation_count,
             COALESCE(SUM(party_size), 0)::bigint AS covers
      FROM reservations, bounds b
      WHERE restaurant_id = ${restaurantId}::uuid
        AND status IN ('confirmed', 'auto_confirmed', 'preparing', 'checked_in', 'running_late',
                        'arrived', 'seated', 'dining', 'completed', 'no_show')
        -- مرزِ خام روی خودِ ستون (نه روی عبارتِ زمان‌منطقه‌ای) تا ایندکسِ
        -- (restaurant_id, slot_start) قابلِ استفاده بماند؛ ±۱ روز حاشیه
        -- چون مرزِ روزِ تهران ۳:۳۰ با مرزِ روزِ UTC فاصله دارد. برشِ دقیق را
        -- خودِ LEFT JOIN با days انجام می‌دهد.
        AND slot_start >= b.first_day - interval '1 day'
        AND slot_start <  b.last_day  + interval '2 days'
      GROUP BY 1
    )
    SELECT d.day, COALESCE(a.reservation_count, 0) AS reservation_count, COALESCE(a.covers, 0) AS covers
    FROM days d
    LEFT JOIN agg a ON a.day = d.day
    ORDER BY d.day ASC
  `;

  return {
    // Prisma ستونِ `date` را به Date در نیمه‌شبِ UTC می‌دهد، پس slice روی
    // ISO دقیقاً همان روزِ تقویمی است (بدونِ لغزشِ منطقه‌ی زمانی).
    days: rows.map((r) => new Date(r.day).toISOString().slice(0, 10)),
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
  const { days, counts, covers } = await fetchDailySeries(restaurantId);
  const n = counts.length;
  const splitAt = Math.floor(n * 0.8);
  const holdoutLen = n - splitAt;

  if (splitAt < MIN_STRUCTURAL_DAYS || holdoutLen === 0) {
    return { trained: false, reason: `دادهٔ کافی برای split نیست (${n} روز)`, sampleSize: n };
  }

  const countState = trainSeries(counts, days, n, splitAt, 'پیش‌بینیِ فصلیِ ساده (تعدادِ رزروِ هفته‌ی قبل)');
  const coversState = trainSeries(covers, days, n, splitAt, 'پیش‌بینیِ فصلیِ ساده (کاورهای هفته‌ی قبل)');

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
  // تاریخچه‌ی append-only (migration 042) — دو ردیف (یکی برایِ سریِ «تعداد»،
  // یکی برایِ «کاور») چون هرکدام مستقلاً train/فعال می‌شوند. هم‌الگو با
  // no-show-model.ts — شکستِ این نوشتن نباید آموزشِ اصلی را خراب کند.
  await db.modelTrainingRun.createMany({
    data: [
      {
        restaurantId, kind: 'demand_forecast', sampleSize: n, isActive: countState.isActive,
        reason: countState.reason,
        metrics: { series: 'count', mae: countState.mae, baselineMae: countState.baselineMae } as unknown as Prisma.InputJsonValue,
      },
      {
        restaurantId, kind: 'demand_forecast', sampleSize: n, isActive: coversState.isActive,
        reason: coversState.reason,
        metrics: { series: 'covers', mae: coversState.mae, baselineMae: coversState.baselineMae } as unknown as Prisma.InputJsonValue,
      },
    ],
  }).catch(() => null);
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
  /** سنِ مدل بر حسبِ ساعت، از آخرین آموزش. */
  age_hours: number;
  /** آموزشِ شبانه دیرتر از انتظار اجرا شده — عدد هنوز قابلِ‌نمایش است ولی
   *  مصرف‌کننده باید صریحاً بگوید کهنه است، نه اینکه آن را حقیقتِ امروز جا بزند. */
  stale: boolean;
  reservations: DemandForecastSeries;
  covers: DemandForecastSeries;
}

const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' → میلی‌ثانیه‌ی نیمه‌شبِ UTCِ همان روزِ تقویمی (فقط برای
 *  حسابِ اختلافِ روز؛ هیچ ادعایی درباره‌ی ساعت ندارد). */
function isoDayToMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function msToIsoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const tehranDayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** «امروز» به وقتِ تهران — هم‌ارزِ دقیقِ TEHRAN_TODAY در SQL. */
export function tehranTodayIso(now: Date = new Date()): string {
  return tehranDayFmt.format(now);
}

/** عددهای خامِ پیش‌بینی را به تاریخِ تقویمیِ واقعی وصل می‌کند.
 *  `firstDay` تاریخِ نقطه‌ی اول است — هیچ‌چیز ضمنی نیست. */
function attachDates(values: readonly number[], firstDay: string): DemandForecastPoint[] {
  const base = isoDayToMs(firstDay);
  return values.map((v, i) => ({
    date: msToIsoDay(base + i * DAY_MS),
    predicted: Math.round(v * 10) / 10,
  }));
}

/**
 * ساختِ سریِ قابلِ‌نمایش.
 *
 * نگاشتِ کلیدی (و تنها جایی که تعریف می‌شود): اندیسِ `i` در خروجیِ **هر
 * دو** روشِ پیش‌بینی به روزِ `lastObservedDay + 1 + i` اشاره می‌کند —
 *   • Holt-Winters: گامِ h به روزِ `lastObservedDay + h`، یعنی i = h−1.
 *   • فصلیِ ساده: `lastValues[i % 7]` که اندیسِ `lastObservedDay − 6 + (i%7)`
 *     است و چون −6 ≡ +1 (mod 7)، دقیقاً هم‌روزِ هفته‌ی `lastObservedDay+1+i`.
 * پس برای شروع از **فردا** باید `offset = today − lastObservedDay` گام از
 * ابتدا کنار گذاشته شود (مدلِ تازه: offset = ۱، یعنی فقط «امروز» حذف می‌شود).
 *
 * ⚠️ این نگاشت عمداً به `lastObservedDay` گره خورده و نه به «فرضِ اینکه
 * مدل دیشب آموزش دیده»: اگر cron یک شب را از دست بدهد، تاریخ‌ها باز هم
 * درست می‌مانند و فقط افقِ پیش‌بینی بلندتر می‌شود (که با پرچمِ stale
 * گزارش می‌شود). نسخه‌ی قبلی به‌جای آن، عددِ روزِ دیگری را به‌نامِ فردا
 * نشان می‌داد.
 */
function buildForecastSeries(
  state: SeriesModelState,
  horizonDays: number,
  todayIso: string,
): DemandForecastSeries {
  const offset = Math.round((isoDayToMs(todayIso) - isoDayToMs(state.lastObservedDay)) / DAY_MS);
  // مدلی که مبدأش از «امروز» جلوتر است بی‌معناست (ساعتِ سرور عقب رفته؟) —
  // حداقلِ ۱ یعنی همیشه از فردا شروع می‌کنیم، هرگز از گذشته.
  const skip = Math.max(1, offset);
  const firstDay = msToIsoDay(isoDayToMs(todayIso) + DAY_MS);
  const steps = skip + horizonDays;

  if (state.isActive) {
    const values = forecastHoltWinters(state.model, steps).slice(skip);
    return {
      source: 'learned',
      mae: Math.round(state.mae * 100) / 100,
      baseline_mae: Math.round(state.baselineMae * 100) / 100,
      accuracy_vs_baseline_pct: state.baselineMae > 0
        ? Math.round(((state.baselineMae - state.mae) / state.baselineMae) * 1000) / 10
        : 0,
      points: attachDates(values, firstDay),
    };
  }
  // مدلِ یادگرفته فعال نیست (داده کم یا بهتر از baseline نبود) — به‌جایِ
  // سکوتِ کامل، همان پیش‌بینیِ فصلیِ ساده با برچسبِ صادقانه‌ی «naive» نشان
  // داده می‌شود، نه چیزی که ادعایِ «هوش مصنوعی» کند.
  const naive = seasonalNaiveForecast(state.lastValues, steps).slice(skip);
  return { source: 'naive', points: attachDates(naive, firstDay) };
}

/**
 * سقفِ سنِ مدل.
 *
 * ⚠️ این دو عدد **انتخاب‌اند، نه اندازه‌گیری** (همان صداقتی که
 * ML_CONTRACT.md درباره‌ی ATTRIBUTION_WINDOW_DAYS می‌خواهد):
 *  • آموزش شبانه ساعتِ ۰۳:۰۰ اجرا می‌شود، پس سنِ سالم همیشه < ۲۴ ساعت است.
 *    ۳۰ ساعت یعنی «یک اجرا از دست رفته»، با ۶ ساعت حاشیه برای تأخیرِ cron.
 *  • ۷ روز سقفِ سختِ نمایش است: فراتر از آن، هم مبدأِ حالتِ Holt-Winters
 *    خیلی عقب است و هم افقِ واقعی از بازه‌ای که MAE رویش سنجیده شده
 *    (۱ تا طولِ هولدآوت) بیرون می‌زند — یعنی عددی نشان می‌دادیم که هیچ
 *    تخمینی از خطایش نداریم. آنجا `null` تنها جوابِ صادقانه است.
 */
const STALE_AFTER_HOURS = 30;
const MAX_AGE_HOURS = 7 * 24;

/** حداقلِ شکلی که هر دو مسیرِ پیش‌بینی (یادگرفته و فصلیِ ساده) به آن نیاز دارند. */
function isUsableState(s: SeriesModelState): boolean {
  return Array.isArray(s.lastValues) && s.lastValues.length === DEMAND_PERIOD
    && typeof s.lastObservedDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.lastObservedDay)
    && !!s.model && Array.isArray(s.model.seasonal) && s.model.seasonal.length === DEMAND_PERIOD;
}

/**
 * خواندنِ پیش‌بینیِ فعلیِ یک رستوران (کش‌شده، ۱ ساعت). null یعنی «هنوز
 * تاریخچه‌ی کافی برایِ حتی یک تلاشِ آموزش وجود نداشته» — این با
 * source:'naive' فرق دارد (آن یعنی «تلاش شد ولی هنوز به baseline نرسید»؛
 * این یعنی «هنوز اصلاً امتحان نشده»).
 *
 * null همچنین یعنی: مدل آن‌قدر کهنه است که نمایشش ادعای بی‌پشتوانه می‌شود،
 * یا با نسخه‌ی قدیمیِ حالت ذخیره شده (رجوع کن به DEMAND_STATE_VERSION).
 */
export async function getDemandForecast(restaurantId: string, horizonDays = 14): Promise<DemandForecastResult | null> {
  const row = await cached(cacheKey('demand-forecast', restaurantId), 3600, () =>
    db.restaurantDemandForecast.findUnique({ where: { restaurantId } }),
  );
  if (!row) return null;

  const countState = row.countModel as unknown as SeriesModelState | null;
  const coversState = row.coversModel as unknown as SeriesModelState | null;
  // گاردِ نسخه: ردیفِ ذخیره‌شده‌ی پیش از نسخه‌ی ۲ `lastObservedDay` ندارد،
  // پس تاریخِ نقاطش قابلِ محاسبه نیست. جعلِ تاریخ ممنوع — تا بازآموزیِ
  // شبانه (حداکثر ۲۴ ساعت) این رستوران پیش‌بینی ندارد، و این را می‌گوید.
  if (countState?.version !== DEMAND_STATE_VERSION || coversState?.version !== DEMAND_STATE_VERSION) return null;
  // گاردِ شکل: `seasonalNaiveForecast` روی آرایه‌ی خالی `[h % 0]` می‌زند ⇒
  // NaN که بی‌سروصدا تا خودِ عددِ نمایش‌داده‌شده می‌رود. یک ردیفِ سالم همیشه
  // دقیقاً DEMAND_PERIOD مقدار دارد؛ هرچیزِ دیگری یعنی ردیف خراب است و
  // «نمی‌دانم» تنها جوابِ صادقانه است (نه یک عدد).
  if (!isUsableState(countState) || !isUsableState(coversState)) return null;

  const ageHours = (Date.now() - row.trainedAt.getTime()) / 3_600_000;
  if (ageHours > MAX_AGE_HOURS) return null;

  const todayIso = tehranTodayIso();
  return {
    trained_at: row.trainedAt,
    history_days: row.historyDays,
    age_hours: Math.round(ageHours * 10) / 10,
    stale: ageHours > STALE_AFTER_HOURS,
    reservations: buildForecastSeries(countState, horizonDays, todayIso),
    covers: buildForecastSeries(coversState, horizonDays, todayIso),
  };
}
