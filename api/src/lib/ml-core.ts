// ═══════════════════════════════════════════════════════════════════════
//  هسته‌ی مشترکِ یادگیریِ ماشین — بدونِ وابستگی به DB یا دامنه‌ی خاص
//
//  این ماژول «تعمیمِ یادگیری»ی است که اول فقط برای پیش‌بینیِ no-show نوشته
//  شده بود (lib/no-show-model.ts). ریاضیاتِ آن‌جا (sigmoid، gradient descent،
//  Brier score، قاعده‌ی ایمنیِ فعال‌سازی) از اول هیچ منطقِ مخصوصِ no-show
//  نداشت — فقط در همان فایل حبس شده بود. این‌جا بیرون کشیده شده تا هر مدلِ
//  یادگرفته‌ی بعدی (مثلاً lib/demand-forecast.ts برای پیش‌بینیِ تقاضا) از
//  همین بنیان استفاده کند، نه یک کپیِ دیگر از همان کد.
//
//  قراردادِ مشترکی که هر مدلِ یادگرفته‌ی این پروژه باید رعایت کند
//  (پیاده‌سازی‌شده در decideModelActivation):
//   ۱) یادگیری per-tenant (per-restaurant) است، نه یک مدلِ سراسری.
//   ۲) سنجش روی هولدآوتِ *زمانی* (نه split تصادفی) — برای داده‌ای که در طول
//      زمان جمع می‌شود، split تصادفی نشتِ اطلاعات ایجاد می‌کند (مدل از چیزی
//      که در لحظه‌ی تصمیم هنوز اتفاق نیفتاده بود یاد می‌گیرد).
//   ۳) مقایسه‌ی صادقانه با baseline (heuristic دستی یا پیش‌بینیِ ساده‌ی
//      فصلی) روی همان هولدآوت — نه روی داده‌ی آموزش.
//   ۴) فقط اگر بهبودِ نسبی از یک آستانه‌ی حداقلی بیشتر بود، مدلِ یادگرفته
//      جایگزینِ baseline می‌شود؛ وگرنه بی‌صدا (silent fallback) به baseline
//      برمی‌گردد. مدلِ بدتر یا نامطمئن هرگز فعال نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

/** تابعِ سیگموید با حفاظ در برابرِ overflow برای |z| خیلی بزرگ (exp(710) → Infinity). */
export function sigmoid(z: number): number {
  if (z >= 40) return 1;
  if (z <= -40) return 0;
  return 1 / (1 + Math.exp(-z));
}

/** ضربِ داخلیِ دو بردارِ هم‌طول. */
export function dot(a: readonly number[], b: readonly number[]): number {
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
 * رگرسیونِ لجستیک با batch gradient descent. پیاده‌سازیِ دستی و ساده — برای
 * مقیاسِ این پروژه (چند ویژگی، چند صد تا چند هزار ردیف در هر رستوران)
 * کتابخانه‌ی ML یک وابستگیِ سنگینِ بی‌توجیه است.
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
 * است. برخلافِ accuracy، اعتمادبه‌نفسِ نادرست را هم جریمه می‌کند و برای
 * کلاس‌های نامتوازن (مثلِ no-show که معمولاً اقلیت است) معیارِ درست‌تری‌ست.
 * فقط برای خروجیِ احتمالاتی (۰..۱) معنا دارد — برای پیش‌بینیِ عددیِ پیوسته
 * (مثلِ تعدادِ رزرو در پیش‌بینیِ تقاضا) از meanAbsoluteError استفاده کن.
 */
export function brierScore(predictions: readonly number[], labels: readonly number[]): number {
  if (predictions.length === 0) return 1; // بدترینِ ممکن — نباید در عمل رخ دهد
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) sum += (predictions[i] - labels[i]) ** 2;
  return sum / predictions.length;
}

/**
 * Mean Absolute Error — معیارِ خطا برای پیش‌بینیِ عددیِ پیوسته (رگرسیون)،
 * نه احتمال. نسبت به RMSE در برابرِ outlier (مثلاً یک شبِ جشنِ غیرمنتظره)
 * مقاوم‌تر است و مستقیماً به واحدِ خودِ داده (تعداد رزرو/کاور) قابلِ‌تفسیر
 * می‌ماند — برخلافِ RMSE که خطا را به توانِ دو می‌برد.
 */
export function meanAbsoluteError(predictions: readonly number[], actuals: readonly number[]): number {
  if (predictions.length === 0) return Infinity; // بدترینِ ممکن — نباید در عمل رخ دهد
  let sum = 0;
  for (let i = 0; i < predictions.length; i++) sum += Math.abs(predictions[i] - actuals[i]);
  return sum / predictions.length;
}

export interface ActivationDecision {
  isActive: boolean;
  reason: string;
}

export interface ActivationParams {
  sampleSize: number;
  minSampleSize: number;
  /** معیارِ خطای مدلِ یادگرفته روی هولدآوت (Brier برای طبقه‌بندی، MAE برای رگرسیون). پایین‌تر = بهتر. */
  learnedError: number;
  /** همان معیار برای baseline (heuristic/پیش‌بینیِ فصلیِ ساده)، روی همان هولدآوت. */
  baselineError: number;
  minRelativeImprovement?: number;
  /** نامِ baseline برای متنِ دلیل (مثلاً «heuristic» یا «پیش‌بینیِ فصلیِ ساده»). */
  baselineLabel?: string;
  /** گیتِ اضافیِ اختیاریِ خاصِ دامنه — مثلاً حداقل تعدادِ نمونه‌ی مثبت در
   *  طبقه‌بندی، یا حداقلِ واریانسِ داده در رگرسیون. اگر ok=false باشد، مدل
   *  بدونِ محاسبه‌ی بهبود رد می‌شود (قبل از چک شدنِ baseline/improvement). */
  extraGate?: { ok: boolean; reason: string };
}

const DEFAULT_MIN_RELATIVE_IMPROVEMENT = 0.05;

/**
 * قاعده‌ی ایمنیِ عمومیِ فعال‌سازی — همان منطقی که اول برای no-show نوشته شد،
 * حالا دامنه‌مستقل: هر مدلِ یادگرفته (طبقه‌بندی یا رگرسیون) از همین تابع
 * برای تصمیمِ «جایگزینِ baseline بشوم یا نه» استفاده می‌کند. ترتیبِ چک‌ها
 * عمداً همین است: اول حجمِ نمونه (ارزان‌ترین رد)، بعد گیتِ دامنه‌ای، بعد
 * اعتبارِ baseline، در آخر بهبودِ نسبی.
 */
export function decideModelActivation(params: ActivationParams): ActivationDecision {
  const {
    sampleSize, minSampleSize, learnedError, baselineError,
    minRelativeImprovement = DEFAULT_MIN_RELATIVE_IMPROVEMENT,
    baselineLabel = 'baseline', extraGate,
  } = params;

  if (sampleSize < minSampleSize) {
    return { isActive: false, reason: `دادهٔ کافی نیست (${sampleSize} < ${minSampleSize})` };
  }
  if (extraGate && !extraGate.ok) {
    return { isActive: false, reason: extraGate.reason };
  }
  if (baselineError <= 0) {
    return { isActive: false, reason: 'baseline نامعتبر' };
  }
  const improvement = (baselineError - learnedError) / baselineError;
  if (improvement < minRelativeImprovement) {
    return { isActive: false, reason: `بهبود کافی نیست (${(improvement * 100).toFixed(1)}٪ < ${minRelativeImprovement * 100}٪)` };
  }
  return { isActive: true, reason: `${(improvement * 100).toFixed(1)}٪ دقیق‌تر از ${baselineLabel} روی هولدآوت` };
}

// ═══════════════════════════════════════════════════════════════════════
//  ویژگی‌هایِ خامِ رفتارِ مهمان + فرمولِ heuristic
//
//  ⚠️ چرا این دو از customer-insights.ts به این‌جا منتقل شدند (۲۰۲۶-۰۸-۲۰):
//  یک چرخه‌ی واقعیِ import وجود داشت — customer-insights به no-show-model
//  نیاز داشت (مدلِ یادگرفته) و no-show-model به customer-insights
//  (computeStaticScoreFromFeatures به‌عنوانِ baseline). راهِ‌حلِ قبلی یک
//  `await import()`ِ پویا در مسیرِ داغِ رزرو بود.
//
//  آن راهِ‌حل روی Node 20 می‌شکند: زیرِ tsx ماژول به یک data: URL تبدیل
//  می‌شود و Node 20 نمی‌تواند specifierِ نسبی را از داخلِ data: URL حل کند
//  (ERR_UNSUPPORTED_RESOLVE_REQUEST). چون importهایِ پویا در آن مسیر داخلِ
//  یک fire-and-forgetِ بی‌catch بودند، شکست بی‌صدا بود.
//
//  ml-core عمداً هیچ importی ندارد، پس میزبانِ درستِ این دو است: چرخه
//  می‌شکند و هر دو طرف می‌توانند static import کنند — بدونِ هیچ importِ
//  پویایی در مسیرِ داغ.
// ═══════════════════════════════════════════════════════════════════════

/**
 * ویژگی‌های خامی که هم فرمولِ heuristic و هم مدلِ یادگرفته از رویشان ساخته
 * می‌شوند — تنها جایی که «سابقه‌ی مشتری» و «زمان‌بندیِ رزرو» به عدد تبدیل
 * می‌شوند.
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
 * هم مسیرِ زنده‌ی fallback را تغذیه می‌کند و هم baselineِ مقایسه در آموزشِ
 * مدلِ یادگرفته را — منبعِ واحد، تا این دو مسیر روزی از هم جدا نیفتند.
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

  // ── منبع رزرو: تماس تلفنی/walk-in نسبت به اپ کمی نامطمئن‌تر ──
  if (f.source === 'phone') score += 5;

  return Math.max(0, Math.min(100, score));
}
