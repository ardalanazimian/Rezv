// ═══════════════════════════════════════════════════════════════════════
//  دستیارِ هوشمندِ رستوران — طبقه‌بندیِ نیت (Intent) کاملاً آفلاین
//
//  هیچ فراخوانیِ AI/LLM بیرونی اینجا نیست. طبقه‌بند یک Naive Bayesِ
//  چندجمله‌ای (multinomial) دستی‌ست — همان خانواده‌ی ریاضیاتِ سبکی که
//  lib/ml-core.ts برای مدل‌های یادگرفته‌ی دیگر (no-show، پیش‌بینیِ تقاضا)
//  استفاده می‌کند: بدونِ کتابخانه‌ی ML، کاملاً شفاف، کاملاً آفلاین.
//
//  خودآموزی (self-learning) چطور کار می‌کند:
//   ۱) هر نیت با چند جمله‌ی نمونه‌ی دستی‌نویس شروع می‌شود (SEED_EXAMPLES) —
//      این «دانشِ اولیه»ی سیستم است، نه دیتای واقعی.
//   ۲) وقتی کارمند سؤالی می‌پرسد و دستیار مطمئن نیست (یا جواب را اصلاح
//      می‌کند)، کلمه‌های همان سؤال به شمارشِ نیتِ درست در جدولِ
//      restaurant_assistant_vocab اضافه می‌شوند (lib/assistant.ts →
//      teachAssistant). دفعه‌ی بعد که کلماتِ مشابه بیایند، امتیازِ آن نیت
//      بالاتر می‌رود — این خودِ یادگیریِ آنلاینِ Naive Bayes است، بدونِ
//      نیاز به آموزشِ دسته‌ای یا هیچ سرویسِ بیرونی.
//   ۳) یادگیری per-restaurant است (هر رستوران واژگانِ خودش را می‌سازد) —
//      دقیقاً همان فلسفه‌ی «یادگیری per-tenant» که در ml-core.ts مستند شده.
//
//  این فایل خالص است (بدونِ DB) — مستقیماً با tsx --test تست می‌شود.
//  بخشِ DB (خواندن/نوشتنِ واژگانِ یادگرفته) در lib/assistant.ts است.
// ═══════════════════════════════════════════════════════════════════════

export const ASSISTANT_INTENTS = [
  'greeting',
  'help',
  'reservations_today',
  'reservations_tomorrow',
  'busiest_day',
  'slow_day',
  'at_risk_customers',
  'vip_customers',
  'underused_tables',
  'waitlist_now',
  'tables_now',
  'upcoming_high_risk',
  'demand_tomorrow',
  'no_show_model_status',
] as const;

export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export function isAssistantIntent(v: string): v is AssistantIntent {
  return (ASSISTANT_INTENTS as readonly string[]).includes(v);
}

/** برچسبِ فارسیِ نمایشی برای هر نیت — در چیپ‌های پیشنهاد و راهنما استفاده می‌شود. */
export const INTENT_LABELS: Record<AssistantIntent, string> = {
  greeting: 'سلام‌واحوال‌پرسی',
  help: 'راهنما',
  reservations_today: 'تعداد رزروهای امروز',
  reservations_tomorrow: 'تعداد رزروهای فردا',
  busiest_day: 'پرترددترین روزِ هفته',
  slow_day: 'کم‌ترددترین روزِ هفته',
  at_risk_customers: 'مشتریانِ در آستانه‌ی ریزش',
  vip_customers: 'مشتریانِ VIP',
  underused_tables: 'میزهای کم‌استفاده',
  waitlist_now: 'طولِ لیستِ انتظار الان',
  tables_now: 'وضعیتِ میزها الان',
  upcoming_high_risk: 'رزروهای پرریسکِ نزدیک',
  demand_tomorrow: 'پیش‌بینیِ تقاضای فردا',
  no_show_model_status: 'وضعیتِ مدلِ یادگرفته‌ی no-show',
};

/** جمله‌های نمونه‌ی دستی‌نویس — «دانشِ اولیه»‌ی هر نیت، نه دیتای واقعی. */
const SEED_EXAMPLES: Record<AssistantIntent, string[]> = {
  greeting: ['سلام', 'سلام خوبی', 'درود', 'سلام دستیار', 'سلام وقت بخیر'],
  help: [
    'چیکار میتونی بکنی', 'راهنما', 'چه کمکی میتونی بکنی',
    'چه سوالاتی میتونم بپرسم', 'راهنمایی کن', 'چی بلدی',
  ],
  reservations_today: [
    'امروز چند رزرو داریم', 'تعداد رزرو امروز چقدره', 'امروز چندتا مهمون داریم',
    'امروز چند نفر رزرو کردن', 'رزروهای امروز چندتاست',
  ],
  reservations_tomorrow: [
    'فردا چند رزرو داریم', 'تعداد رزرو فردا چقدره', 'فردا چندتا میز رزرو شده',
    'فردا چند مهمون داریم',
  ],
  busiest_day: [
    'کدوم روز هفته شلوغ‌تره', 'پرترددترین روز کدومه', 'کدوم روز بیشترین رزرو رو داریم',
    'بهترین روز هفته کدومه', 'قوی‌ترین روزهای هفته کدومن',
  ],
  slow_day: [
    'کدوم روز خلوت‌تره', 'کم‌ترددترین روز کدومه', 'ضعیف‌ترین روز هفته کدومه',
    'کدوم روز کمترین مشتری رو داریم',
  ],
  at_risk_customers: [
    'کدوم مشتریا دارن از دست میرن', 'چند مشتری در خطر ریزش داریم',
    'مشتریای در حال ریزش کیا هستن', 'کدوم مشتری‌ها دیگه نمیان',
  ],
  vip_customers: [
    'مشتریای وی‌ای‌پی چندتان', 'چند مشتری VIP داریم', 'لیست مشتریای ویژه رو بگو',
    'مشتریای طلایی کیا هستن',
  ],
  underused_tables: [
    'کدوم میزا کم استفاده میشن', 'کدوم میز خالی می‌مونه بیشتر',
    'میزای بلا استفاده کدومن', 'کدوم میزها کمتر رزرو میشن',
  ],
  waitlist_now: [
    'الان چندتا تو لیست انتظاریم', 'صف انتظار الان چقدره', 'چند نفر منتظر میز هستن الان',
    'لیست انتظار الان چند نفره',
  ],
  tables_now: [
    'الان چند میز خالیه', 'وضعیت میزا الان چطوره', 'چندتا میز پره الان',
    'الان چند میز آزاده',
  ],
  upcoming_high_risk: [
    'رزروای پرریسک نزدیک کدومن', 'کدوم رزروا احتمال نیومدن دارن',
    'رزرو پرریسک ۴۸ ساعت آینده', 'کدوم رزروها ریسک نیومدن دارن',
  ],
  demand_tomorrow: [
    'فردا چقدر شلوغه', 'پیش‌بینی تقاضای فردا چیه', 'فردا استقبال چطوره',
    'پیش‌بینی رزرو فردا چقدره',
  ],
  no_show_model_status: [
    'مدل نیومدن مشتری چقدر دقیقه', 'وضعیت مدل no-show چیه',
    'سیستم یادگیری no-show چقدر پیشرفت کرده', 'مدل پیش‌بینی نیومدن دقیقه یا نه',
  ],
};

// ── نرمال‌سازی/توکنایزیشنِ فارسی — بدونِ کتابخانه، فقط regex ──

/** حروفِ عربی رایج در تایپِ فارسی → معادلِ فارسی؛ حذفِ اعراب/تشدید و علائم. */
export function normalizePersian(text: string): string {
  return text
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // اعراب/تشدید عربی
    .replace(/[‌‏‎]/g, ' ') // نیم‌فاصله/جهت‌نما → فاصله
    .toLowerCase()
    .trim();
}

/** کلماتِ کاملاً بدونِ‌بارِ معنایی (حروفِ اضافه/ربط) — کلماتِ پرسشی مثلِ
 *  «چند»/«چقدر»/«کدوم» عمداً حذف نمی‌شوند چون خودشان سیگنالِ نیت‌اند. */
const STOPWORDS = new Set([
  'را', 'رو', 'با', 'از', 'به', 'در', 'که', 'این', 'آن', 'هست', 'است',
  'بود', 'یک', 'و', 'یا', 'هم', 'می', 'برای', 'لطفا', 'لطفاً', 'کن',
  'کنید', 'بگو', 'بگید', 'دستیار', 'ما', 'من', 'تو', 'شما', 'داریم', 'دارم',
]);

export function tokenize(text: string): string[] {
  const normalized = normalizePersian(text);
  return normalized
    .split(/[^؀-ۿ0-9a-z]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

// ── ساختِ شمارشِ کلماتِ seed یک‌بار در زمانِ لودِ ماژول ──

type WordCounts = Record<string, number>;
type VocabByIntent = Record<string, WordCounts>;

function buildSeedCounts(): VocabByIntent {
  const out: VocabByIntent = {};
  for (const intent of ASSISTANT_INTENTS) {
    const counts: WordCounts = {};
    for (const example of SEED_EXAMPLES[intent]) {
      for (const tok of tokenize(example)) counts[tok] = (counts[tok] || 0) + 1;
    }
    out[intent] = counts;
  }
  return out;
}

const SEED_COUNTS = buildSeedCounts();

/** یک جمله‌ی نمونه‌ی طبیعی برای هر نیت — برایِ متنِ راهنما و چیپ‌های پیشنهاد،
 *  تا این جملات جای دیگری دوباره hardcode نشوند. شاملِ همه‌ی نیت‌ها (حتی
 *  greeting/help) تا نوعش صادقانه total بماند؛ فیلترکردنِ آن دو از فهرستِ
 *  «چه‌چیزی می‌توانم بپرسم» در نقطه‌ی مصرف (lib/assistant.ts) انجام می‌شود. */
export const INTENT_EXAMPLE_QUESTION: Record<AssistantIntent, string> = Object.fromEntries(
  ASSISTANT_INTENTS.map((i) => [i, SEED_EXAMPLES[i][0]]),
) as Record<AssistantIntent, string>;

/** نیت‌هایی که «سؤالِ داده‌ای واقعی»‌اند — برایِ فهرستِ راهنما/چیپِ پیشنهاد،
 *  بدونِ greeting/help (که خودشان جوابِ ثابت‌اند، نه چیزی که بشود «پیشنهاد» داد). */
export const DATA_INTENTS = ASSISTANT_INTENTS.filter(
  (i): i is Exclude<AssistantIntent, 'greeting' | 'help'> => i !== 'greeting' && i !== 'help',
);

/** وزنِ نسبیِ نمونه‌های seed در برابرِ واژگانِ یادگرفته‌شده‌ی واقعی — با
 *  تجمعِ کافیِ اصلاح از کارمندها، واژگانِ یادگرفته می‌تواند بر seed غالب شود؛
 *  ولی از روزِ اول (بدونِ هیچ یادگیری‌ای) سیستم باز هم کار می‌کند. */
const SEED_WEIGHT = 3;

/** واژگانِ سراسری (برای Laplace smoothing) — اتحادِ کلماتِ seed. واژگانِ
 *  یادگرفته‌شده معمولاً زیرمجموعه‌ی همین فضا هستند (فارسیِ محاوره‌ای محدود)،
 *  پس این تخمین برای |V| کافی‌ست؛ اگر کلمه‌ی کاملاً تازه‌ای یاد گرفته شود،
 *  Laplace smoothing باز هم صحیح می‌ماند (فقط اندکی محافظه‌کارتر). */
const GLOBAL_KNOWN_WORDS = new Set(Object.values(SEED_COUNTS).flatMap((c) => Object.keys(c)));
const GLOBAL_VOCAB_SIZE = GLOBAL_KNOWN_WORDS.size;

/** آیا این کلمه در seed یا واژگانِ یادگرفته‌شده دیده شده؟ برایِ تشخیصِ
 *  «جمله‌ی کاملاً ناآشنا» — نه فقط برایِ محاسبه‌ی امتیاز. */
function isKnownWord(word: string, learnedVocab: VocabByIntent): boolean {
  if (GLOBAL_KNOWN_WORDS.has(word)) return true;
  for (const intent of ASSISTANT_INTENTS) {
    if (learnedVocab[intent]?.[word]) return true;
  }
  return false;
}

export interface RankedIntent {
  intent: AssistantIntent;
  probability: number;
}

export interface ClassificationResult {
  intent: AssistantIntent;
  confidence: number; // همان probability بالاترین نیت — بینِ ۰ و ۱
  ranked: RankedIntent[]; // نزولی، همه‌ی نیت‌ها
}

/**
 * طبقه‌بندیِ Naive Bayesِ چندجمله‌ای با Laplace smoothing. `learnedVocab`
 * شمارشِ واژگانِ یادگرفته‌شده‌ی همین رستوران است (از DB، در lib/assistant.ts
 * خوانده می‌شود) — اینجا فقط دریافت می‌شود تا این تابع خالص و تست‌پذیر بماند.
 */
export function classify(tokens: readonly string[], learnedVocab: VocabByIntent = {}): ClassificationResult {
  const scores: Record<string, number> = {};
  const priorLogProb = -Math.log(ASSISTANT_INTENTS.length); // پیشینِ یکنواخت

  for (const intent of ASSISTANT_INTENTS) {
    const seed = SEED_COUNTS[intent] || {};
    const learned = learnedVocab[intent] || {};
    const totalWordsInIntent =
      Object.values(seed).reduce((s, c) => s + c * SEED_WEIGHT, 0) +
      Object.values(learned).reduce((s, c) => s + c, 0);

    let score = priorLogProb;
    for (const tok of tokens) {
      const count = (seed[tok] || 0) * SEED_WEIGHT + (learned[tok] || 0);
      score += Math.log((count + 1) / (totalWordsInIntent + GLOBAL_VOCAB_SIZE));
    }
    scores[intent] = score;
  }

  // softmax روی امتیازها = نرمال‌سازیِ posterior (چون score = log(prior) + Σlog(likelihood))
  const maxScore = Math.max(...Object.values(scores));
  const exps = Object.fromEntries(
    ASSISTANT_INTENTS.map((i) => [i, Math.exp(scores[i] - maxScore)]),
  ) as Record<AssistantIntent, number>;
  const sumExp = Object.values(exps).reduce((s, v) => s + v, 0);

  const ranked: RankedIntent[] = ASSISTANT_INTENTS
    .map((intent) => ({ intent, probability: exps[intent] / sumExp }))
    .sort((a, b) => b.probability - a.probability);

  // اگر هیچ‌کدام از کلماتِ ورودی در seed یا واژگانِ یادگرفته‌شده دیده نشده
  // باشند، سیستم واقعاً چیزی نمی‌داند — ولی Naive Bayes روی کلماتِ کاملاً
  // ناشناخته می‌تواند به‌طورِ کاذب مطمئن به‌نظر برسد (چون کلاس‌هایی با
  // واژگانِ کوچک‌تر، برایِ کلماتِ ناشناخته احتمالِ Laplace-smoothedِ کمی
  // بالاتر می‌گیرند). به‌جایِ این اطمینانِ کاذب، صادقانه به عدمِ‌اطمینانِ
  // یکنواخت برمی‌گردیم — هم‌راستا با فلسفه‌ی «هیچ‌وقت آماره‌ی نامعلوم را
  // حدس نزن» که در کلِ این پروژه رعایت شده (مثلاً restaurant-manager.ts).
  const allUnknown = tokens.length > 0 && !tokens.some((t) => isKnownWord(t, learnedVocab));
  const confidence = allUnknown ? 1 / ASSISTANT_INTENTS.length : ranked[0].probability;

  return { intent: ranked[0].intent, confidence, ranked };
}

/** آستانه‌ی «فهمیدم» — بالاتر از شانسِ خالص (۱/تعدادِ نیت‌ها ≈ ۰.۰۷)، ولی نه
 *  آن‌قدر بالا که هر نوسانِ کوچک fallback بخورد. */
export const CONFIDENCE_THRESHOLD = 0.35;
