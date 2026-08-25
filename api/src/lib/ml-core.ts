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
  /** **سقفِ** تکرار، نه تعدادِ ثابت — با رسیدن به همگرایی زودتر می‌ایستد. */
  iterations?: number;
  /** بزرگ‌ترین گامِ مجازِ پارامتر برای اعلامِ همگرایی. */
  tolerance?: number;
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
  const { learningRate = 0.3, iterations = 20_000, l2 = 0.02, tolerance = 1e-7 } = opts;
  const n = X.length;
  if (n === 0) throw new Error('trainLogisticRegression: دیتاست خالی است');
  const d = X[0].length;
  const w = new Array(d).fill(0);

  // ⚠️ همگرایی حالا **تشخیص داده می‌شود**، نه اینکه به یک تعدادِ ثابت تکرار
  // اعتماد شود. یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۵ که این را لازم کرد:
  //
  // سقفِ قبلی ۸۰۰ تکرارِ ثابت بود و برای بردارِ ۷تاییِ اولیه (که تقریباً
  // همه‌اش دودویی بود) کافی بود. با گسترشِ بردار به ۱۲ ویژگیِ پیوسته، همان
  // ۸۰۰ تکرار **زیرآموزش** می‌داد و مدلِ غنی‌تر روی هولدآوت از مدلِ فقیرتر
  // بدتر می‌شد. اندازه‌گیریِ واقعی روی همان دادهٔ کنترل‌شده:
  //   ۸۰۰ تکرار  → AUC ۰٫۶۶۴۲  (بدتر از v1 با ۰٫۶۶۶۱)
  //   ۳۰۰۰ تکرار → AUC ۰٫۶۷۶۸  (بهتر از v1)
  // یعنی نتیجه‌ی «ویژگیِ جدید کمکی نکرد» کاملاً غلط ولی کاملاً قابلِ‌باور
  // بود. هیچ خطایی هم تولید نمی‌شد.
  //
  // با توقفِ مبتنی بر همگرایی، دفعه‌ی بعد که کسی ویژگی اضافه کند این تله
  // دوباره سراغش نمی‌آید؛ و چون زودتر می‌ایستد، بردارِ سبک هزینه‌ی بیشتری
  // هم نمی‌دهد (v1 هنوز حدودِ همان ۸۰۰ تکرار تمام می‌شود).
  for (let it = 0; it < iterations; it++) {
    const grad = new Array(d).fill(0);
    for (let i = 0; i < n; i++) {
      const p = sigmoid(dot(w, X[i]));
      const err = p - y[i];
      for (let j = 0; j < d; j++) grad[j] += err * X[i][j];
    }
    let maxStep = 0;
    for (let j = 0; j < d; j++) {
      const reg = j === 0 ? 0 : l2 * w[j];
      const step = (learningRate / n) * (grad[j] + reg);
      w[j] -= step;
      const abs = Math.abs(step);
      if (abs > maxStep) maxStep = abs;
    }
    if (maxStep < tolerance) break;
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
/**
 * AUC-ROC — قدرتِ **تفکیکِ** مدل، با روشِ رتبه‌ای (Mann–Whitney U).
 *
 * ⚠️ چرا Brier کافی نیست و این اضافه شد: Brier دو چیزِ متفاوت را با هم قاطی
 * می‌کند — کالیبراسیون (آیا عددِ ۰٫۳ واقعاً یعنی ۳۰٪؟) و تفکیک (آیا
 * پرریسک‌ها را از کم‌ریسک‌ها جدا می‌کند؟). یک مدل که به **همه** میانگینِ
 * نرخِ no-show را بدهد، Brierِ نسبتاً خوبی می‌گیرد ولی عملاً بی‌فایده است:
 * AUCش دقیقاً ۰٫۵ است.
 *
 * و سؤالِ عملیاتیِ واقعیِ رستوران‌دار همین تفکیک است: «امشب فقط وقتِ تماس با
 * ۱۰ مهمان را دارم — آیا این ۱۰ تا درست‌اند؟» این را فقط AUC جواب می‌دهد.
 *
 * روشِ رتبه‌ای عمداً به‌جای شمارشِ زوجی: با n نمونه، زوجی O(n²) است و روی
 * چند هزار رزرو کند می‌شود؛ رتبه‌ای O(n log n) است و با هم‌رتبه‌ها (ties)
 * هم درست رفتار می‌کند (رتبه‌ی میانگین).
 *
 * @returns AUC در [۰،۱]، یا `null` اگر همه‌ی برچسب‌ها یک‌کلاسه باشند
 *   (آنجا AUC **تعریف‌نشده** است، نه صفر — قاعده‌ی ML_CONTRACT).
 */
export function rocAuc(
  predictions: readonly number[],
  labels: readonly number[],
): number | null {
  if (predictions.length !== labels.length) {
    throw new Error('rocAuc: طولِ پیش‌بینی و برچسب یکی نیست');
  }
  const n = predictions.length;
  if (n === 0) return null;

  const pos = labels.reduce((s, y) => s + (y === 1 ? 1 : 0), 0);
  const neg = n - pos;
  // تک‌کلاسه ⇒ تفکیک بی‌معناست. `null` یعنی «نمی‌دانیم»، نه «بد».
  if (pos === 0 || neg === 0) return null;

  const idx = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => predictions[a] - predictions[b]);

  // رتبه‌ی میانگین برای هم‌رتبه‌ها — بدونِ این، مدلی که به همه عددِ یکسان
  // می‌دهد AUCِ ۱ یا ۰ می‌گیرد به‌جای ۰٫۵.
  const rank = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && predictions[idx[j + 1]] === predictions[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;         // رتبه‌ها از ۱ شروع می‌شوند
    for (let k = i; k <= j; k++) rank[idx[k]] = avg;
    i = j + 1;
  }

  let sumRankPos = 0;
  for (let k = 0; k < n; k++) if (labels[k] === 1) sumRankPos += rank[k];

  return (sumRankPos - (pos * (pos + 1)) / 2) / (pos * neg);
}

/** یک سطلِ منحنیِ کالیبراسیون. */
export interface CalibrationBucket {
  /** مرزِ پایین و بالای احتمالِ پیش‌بینی‌شده. */
  from: number;
  to: number;
  /** تعدادِ نمونه در این سطل. */
  n: number;
  /** میانگینِ احتمالِ پیش‌بینی‌شده. */
  predicted: number;
  /** نرخِ واقعیِ رخداد در همین سطل. */
  observed: number;
}

/**
 * منحنیِ کالیبراسیون — «وقتی مدل می‌گوید ۳۰٪، واقعاً ۳۰٪ رخ می‌دهد؟»
 *
 * چرا جدا از Brier: Brier یک عددِ خلاصه است و نمی‌گوید **کجا** خطا دارد.
 * مدلی که ریسکِ بالا را دستِ‌بالا و ریسکِ پایین را دستِ‌پایین می‌زند
 * می‌تواند Brierِ قابلِ‌قبولی داشته باشد، ولی همان اریبی یعنی رستوران‌دار
 * روی «۸۰٪ خطر» بیش‌ازحد واکنش نشان می‌دهد. سطل‌بندی این را نشان می‌دهد.
 *
 * سطل‌های خالی حذف می‌شوند — گزارشِ `observed: 0` برای سطلی که هیچ نمونه‌ای
 * ندارد یعنی ادعای اندازه‌گیری‌نشده (ML_CONTRACT).
 */
export function calibrationCurve(
  predictions: readonly number[],
  labels: readonly number[],
  buckets = 10,
): CalibrationBucket[] {
  if (predictions.length !== labels.length) {
    throw new Error('calibrationCurve: طولِ پیش‌بینی و برچسب یکی نیست');
  }
  if (buckets < 2) throw new Error('calibrationCurve: حداقل ۲ سطل لازم است');

  const acc = Array.from({ length: buckets }, () => ({ n: 0, sumP: 0, sumY: 0 }));
  for (let i = 0; i < predictions.length; i++) {
    const p = Math.min(Math.max(predictions[i], 0), 1);
    const b = Math.min(Math.floor(p * buckets), buckets - 1);
    acc[b].n++; acc[b].sumP += p; acc[b].sumY += labels[i] === 1 ? 1 : 0;
  }
  return acc.flatMap((a, b) => a.n === 0 ? [] : [{
    from: b / buckets,
    to: (b + 1) / buckets,
    n: a.n,
    predicted: a.sumP / a.n,
    observed: a.sumY / a.n,
  }]);
}

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
  /**
   * لحظه‌ی شروعِ اسلات — برای ویژگی‌های زمانی (ساعتِ روز، آخرِ هفته) در
   * بردارِ v2.
   *
   * ⚠️ اختیاری است و این عمدی‌ست: `computeStaticScoreFromFeatures`
   * (heuristic) هرگز از آن استفاده نمی‌کند و امضایش نباید بشکند. مسیرهایی
   * که به مدلِ یادگرفته می‌رسند همیشه پُرش می‌کنند؛ نبودش در
   * `buildFeatureVector` به‌صورتِ «سیگنالِ زمانی نداریم» رفتار می‌شود، نه
   * یک ساعتِ ساختگی.
   */
  slotStart?: Date;
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

// ═══════════════════════════════════════════════════════════════════════
//  شاخصِ پایداریِ جمعیت (PSI) — ریاضیاتِ خالصِ تشخیصِ رانش (فازِ ۷)
//
//  PSI دو توزیع را مقایسه می‌کند: «مرجع» (وقتی مدل ساخته/سنجیده شد) و
//  «فعلی» (چیزی که الان واقعاً می‌بینیم). اگر ورودی‌ها یا خروجی‌هایِ مدل
//  جابه‌جا شده باشند، مدل ممکن است هنوز «کار کند» ولی دیگر روی همان دنیایی
//  نباشد که برایش کالیبره شده بود.
//
//  آستانه‌هایِ متعارفِ صنعت (و عمداً همان‌ها، نه اعدادِ ابداعی):
//    PSI < 0.1        → پایدار
//    0.1 ≤ PSI < 0.25 → جابه‌جاییِ متوسط، ارزشِ نگاه‌کردن دارد
//    PSI ≥ 0.25       → جابه‌جاییِ قابل‌توجه
//
//  ⚠️ PSI روی نمونه‌ی کم بی‌معناست و عددِ بزرگ می‌سازد. تصمیمِ «کافی بودنِ
//  نمونه» عمداً بیرونِ این تابع است (صداکننده باید کف بگذارد) تا این‌جا
//  فقط ریاضیاتِ خالص و تست‌پذیر بماند.
// ═══════════════════════════════════════════════════════════════════════

/** تعدادِ سطل‌ها برای توزیعِ احتمال روی بازه‌ی ۰..۱. */
export const PSI_BUCKETS = 10;

/** هموارسازی: سطلِ خالی لگاریتمِ بی‌نهایت می‌سازد. */
const PSI_EPSILON = 1e-6;

/** شمارشِ نسبیِ مقادیرِ ۰..۱ در سطل‌هایِ هم‌عرض. */
export function bucketize01(values: readonly number[], buckets = PSI_BUCKETS): number[] {
  const counts = new Array(buckets).fill(0);
  if (values.length === 0) return counts;
  for (const v of values) {
    const clamped = Math.min(1, Math.max(0, v));
    // مقدارِ دقیقاً ۱ باید در آخرین سطل بیفتد، نه سطلِ خارج از محدوده.
    const idx = Math.min(buckets - 1, Math.floor(clamped * buckets));
    counts[idx] += 1;
  }
  return counts.map(c => c / values.length);
}

/**
 * PSI بینِ توزیعِ مرجع و فعلی برای مقادیرِ ۰..۱ (مثلاً احتمالِ پیش‌بینی‌شده).
 * هر دو آرایه باید ناخالی باشند؛ وگرنه NaN برمی‌گردد که صداکننده باید
 * به‌عنوانِ «قابلِ محاسبه نیست» رفتار کند، نه صفر.
 */
export function populationStabilityIndex(
  reference: readonly number[],
  current: readonly number[],
  buckets = PSI_BUCKETS,
): number {
  if (reference.length === 0 || current.length === 0) return NaN;
  const ref = bucketize01(reference, buckets);
  const cur = bucketize01(current, buckets);
  let psi = 0;
  for (let i = 0; i < buckets; i++) {
    const r = Math.max(ref[i], PSI_EPSILON);
    const c = Math.max(cur[i], PSI_EPSILON);
    psi += (c - r) * Math.log(c / r);
  }
  return psi;
}

export type PsiBand = 'stable' | 'moderate' | 'significant';

export function psiBand(psi: number): PsiBand {
  if (psi >= 0.25) return 'significant';
  if (psi >= 0.1) return 'moderate';
  return 'stable';
}
