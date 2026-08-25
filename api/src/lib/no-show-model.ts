import { Prisma } from '@prisma/client';
import { db } from './db';
import { cached, cacheKey, invalidate } from './cache';
import { createLogger } from './logger';
import { metrics } from './metrics';
import {
  sigmoid, trainLogisticRegression, predictProba, brierScore, decideModelActivation,
  rocAuc, calibrationCurve, type CalibrationBucket,
  computeStaticScoreFromFeatures, type RawFeatureInput,
  type ActivationDecision,
} from './ml-core';

const log = createLogger('no-show-model');

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
//  ریاضیاتِ خالص (sigmoid، gradient descent، Brier، قاعده‌ی ایمنیِ فعال‌سازی)
//  در lib/ml-core.ts است — این‌جا فقط دوباره export می‌شوند تا کدِ موجود
//  (تست‌ها، customer-insights.ts) نشکند. هرچه اینجا مانده مخصوصِ no-show
//  است: بردارِ ویژگی، آستانه‌های ایمنی، و کوئریِ آموزش از دیتابیس.
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
  'shrunkNoShowRate', // نرخِ no-showِ قبلی، **جمع‌شده به سمتِ میانگین** — پایین را بخوان
  'priorEvidence',    // چقدر از آن نرخ مطمئنیم (لگاریتمِ تعدادِ سابقه)
  'leadLog',          // فاصله‌ی ثبت تا اسلات، پیوسته و لگاریتمی
  'lastMinute',       // < 30 دقیقه تا شروعِ اسلات (اثرِ آستانه‌ای، جدا از پیوسته)
  'largeParty',       // >= 6 نفر
  'partySizeNorm',    // اندازه‌ی گروه، پیوسته
  'phoneSource',
  'hourSin',          // ساعتِ روز به وقتِ تهران، دایره‌ای
  'hourCos',
  'isWeekend',        // پنجشنبه/جمعه — آخرِ هفته‌ی ایران، نه شنبه/یکشنبه
] as const;

/**
 * نسخه‌ی بردارِ ویژگی. **هر** تغییری در `NO_SHOW_FEATURE_NAMES` یا در معنیِ
 * یکی از درایه‌های `buildFeatureVector` باید این را جلو ببرد.
 *
 * ⚠️ چرا این یک گاردِ ایمنی است و نه سلیقه: `dot()` روی طولِ **weights**
 * حلقه می‌زند. وزنِ ۷تایی روی بردارِ ۹تایی هیچ خطایی نمی‌دهد — دو ویژگیِ
 * آخر را نادیده می‌گیرد و امتیازی برمی‌گرداند که کاملاً قابلِ‌باور و کاملاً
 * غلط است. برعکسش (وزنِ ۹تایی، بردارِ ۷تایی) به `undefined` می‌رسد ⇒ NaN ⇒
 * تا خودِ UI. هیچ‌کدام لاگ یا استثنا تولید نمی‌کنند.
 *
 * پس مدلی که نسخه‌اش با این ثابت نمی‌خواند سرو **نمی‌شود** و سیستم صادقانه
 * یک پله عقب می‌رود (سراسری، یا heuristic) تا آموزشِ شبانه نسخه‌ی تازه بسازد.
 *
 * ⚠️ **تنها** منبعِ نسخه‌ی ویژگیِ no-show در کلِ سیستم. دفترِ پیش‌بینی
 * (`prediction-ledger.ts`) برچسبِ خودش را از همین می‌سازد و ثابتِ موازی
 * ندارد — یک بار داشت و همان باعث شد بردار در v2 عوض شود ولی برچسبِ
 * دفتر دست‌نخورده بماند، یعنی دقیقاً همان «دو معنا زیرِ یک برچسب» که
 * خودِ آن ثابت قرار بود جلویش را بگیرد.
 *
 * تاریخچه: v1 بردارِ ۷تاییِ اولیه · v2 همان ترکیب با معنیِ تازه‌ی
 * priorTotal (فازِ ۴) · v3 بردارِ ۱۲تایی با جمع‌شدگی، فاصله‌ی پیوسته و
 * ویژگی‌های زمانیِ تهران.
 */
export const NO_SHOW_FEATURE_VERSION = 'v3';

const MIN_LEAD_MINUTES_RISKY = 30;
const MAX_LEAD_MINUTES_SAFE = 7 * 24 * 60;
const LARGE_PARTY_SIZE = 6;

/** تعدادِ مشاهده‌ی مجازی در هموارسازیِ نرخِ سابقه. بزرگ‌تر = محافظه‌کارتر. */
const PRIOR_PSEUDO_COUNT = 5;
/**
 * نرخِ پایه‌ای که نرخِ کم‌شواهد به سمتش جمع می‌شود.
 * ⚠️ یک عددِ پیشینِ محافظه‌کارانه است، نه یک اندازه‌گیری. تأثیرش فقط روی
 * کاربرانِ کم‌سابقه است و با زیادشدنِ سابقه به‌سرعت محو می‌شود؛ خودِ مدل هم
 * وزنِ این ویژگی را از داده یاد می‌گیرد.
 */
const BASE_NO_SHOW_RATE = 0.10;
/** تعدادِ سابقه‌ای که «شواهد» را عملاً اشباع می‌کند. */
const EVIDENCE_SATURATION = 20;
/** سقفِ نرمال‌سازیِ اندازه‌ی گروه. */
const PARTY_SIZE_SATURATION = 12;
/** آخرِ هفته‌ی ایران: پنجشنبه(۴) و جمعه(۵) در نگاشتِ ۰=یکشنبه. */
const IRAN_WEEKEND_DAYS = new Set([4, 5]);

const tehranPartsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tehran', hour12: false, hour: '2-digit', weekday: 'short',
});
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** ساعت (۰..۲۳) و روزِ هفته (۰=یکشنبه) به وقتِ تهران. */
export function tehranHourWeekday(d: Date): { hour: number; weekday: number } {
  const parts = tehranPartsFmt.formatToParts(d);
  const hourRaw = Number(parts.find((p) => p.type === 'hour')?.value);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? '';
  // `hour12:false` در بعضی نسخه‌های ICU برای نیمه‌شب «24» می‌دهد نه «0».
  return { hour: (Number.isFinite(hourRaw) ? hourRaw : 0) % 24, weekday: WEEKDAY_INDEX[wd] ?? 0 };
}

/**
 * بردارِ ویژگی برای مدلِ یادگرفته — از همان RawFeatureInputِ تعریف‌شده در
 * customer-insights.ts می‌سازد (تنها به‌عنوانِ type import می‌شود، پس
 * وابستگیِ دوریِ اجرایی نمی‌سازد). فرمول‌بندی‌اش لزوماً با شاخه‌بندیِ
 * computeStaticScoreFromFeatures یکی نیست — این یک مدلِ جدید و مستقل است
 * که خودش وزن‌هایش را از داده یاد می‌گیرد، نه کپیِ heuristic.
 */
export function buildFeatureVector(input: RawFeatureInput): number[] {
  const hasHistory = input.hasUserId && input.priorTotal > 0;

  // ── ۱) نرخِ سابقه با جمع‌شدگی (shrinkage) ─────────────────────────────
  // ⚠️ نقصِ v1: `priorNoShowRate` خام بود. کاربری با **یک** رزروِ قبلی که
  // no-show شده نرخِ ۱٫۰ می‌گرفت — دقیقاً همان عددی که کاربری با ۵۰ رزرو و
  // ۵۰ no-show می‌گیرد. مدل این دو را یکسان می‌دید، در حالی که اولی تقریباً
  // هیچ شواهدی ندارد. چون اکثرِ کاربران سابقه‌ی خیلی کوتاهی دارند، این
  // پرنویزترین ویژگیِ بردار بود.
  //
  // اینجا نرخ به سمتِ نرخِ پایه‌ی پلتفرم جمع می‌شود، به اندازه‌ی
  // PRIOR_PSEUDO_COUNT مشاهده‌ی مجازی (هموارسازیِ لاپلاس/بیزِ تجربی):
  //   (noShows + α·base) / (total + α)
  // با α=۵: یک no-show از یک رزرو ⇒ ۰٫۲۹ (نه ۱٫۰)؛ ۵۰ از ۵۰ ⇒ ۰٫۹۲.
  const observedNoShows = hasHistory ? input.priorNoShowRate * input.priorTotal : 0;
  const shrunkNoShowRate = hasHistory
    ? (observedNoShows + PRIOR_PSEUDO_COUNT * BASE_NO_SHOW_RATE) / (input.priorTotal + PRIOR_PSEUDO_COUNT)
    : 0;

  // ── ۲) «چقدر می‌دانیم» به‌عنوانِ ویژگیِ مستقل ─────────────────────────
  // بدونِ این، مدل نمی‌تواند یاد بگیرد که به نرخِ کم‌شواهد کمتر تکیه کند.
  const priorEvidence = hasHistory
    ? Math.min(1, Math.log1p(input.priorTotal) / Math.log1p(EVIDENCE_SATURATION))
    : 0;

  // ── ۳) فاصله‌ی زمانی، پیوسته ────────────────────────────────────────
  // ⚠️ نقصِ v1: فقط دو پرچمِ دودویی (<۳۰دقیقه، >۷روز). یعنی رزروِ ۳۵ دقیقه
  // مانده و رزروِ ۶ روز مانده **بردارِ کاملاً یکسانی** داشتند [۰,۰] — کلِ
  // طیفِ میانی، که اکثریتِ رزروهاست، برای مدل نامرئی بود.
  // لگاریتم عمدی است: تفاوتِ ۱۰ دقیقه با ۱ ساعت مهم‌تر از تفاوتِ ۳۰ روز با
  // ۳۱ روز است.
  const leadClamped = Math.max(1, Math.min(input.leadMinutes, MAX_LEAD_MINUTES_SAFE * 2));
  const leadLog = Math.log1p(leadClamped) / Math.log1p(MAX_LEAD_MINUTES_SAFE * 2);

  // ── ۴) ویژگی‌های زمانی، به وقتِ **تهران** ─────────────────────────────
  // ⚠️ چرا تهران و نه UTC: رزروِ ۰۱:۰۰ بامدادِ تهران در UTC روزِ **قبل** و
  // ساعتِ ۲۱:۳۰ است. با UTC، هم ساعت غلط می‌شد هم روزِ هفته — و مدل یک
  // الگویِ شیفت‌خورده یاد می‌گرفت که با هیچ واقعیتی نمی‌خواند.
  // ⚠️ و آخرِ هفته در ایران **پنجشنبه/جمعه** است، نه شنبه/یکشنبه.
  // sin/cos چون ساعت دایره‌ای است: ۲۳ و ۰ همسایه‌اند، نه دورترین نقطه.
  let hourSin = 0, hourCos = 0, isWeekend = 0;
  if (input.slotStart) {
    const { hour, weekday } = tehranHourWeekday(input.slotStart);
    const theta = (2 * Math.PI * hour) / 24;
    hourSin = Math.sin(theta);
    hourCos = Math.cos(theta);
    isWeekend = IRAN_WEEKEND_DAYS.has(weekday) ? 1 : 0;
  }

  return [
    1, // بایاس
    input.hasUserId ? 1 : 0,
    shrunkNoShowRate,
    priorEvidence,
    leadLog,
    input.leadMinutes < MIN_LEAD_MINUTES_RISKY ? 1 : 0,
    input.partySize >= LARGE_PARTY_SIZE ? 1 : 0,
    Math.min(input.partySize, PARTY_SIZE_SATURATION) / PARTY_SIZE_SATURATION,
    input.source === 'phone' ? 1 : 0,
    hourSin,
    hourCos,
    isWeekend,
  ];
}

// ── ریاضیاتِ خالصِ عمومی از lib/ml-core.ts — این‌جا re-export می‌شود تا
//    importهای موجود (تست‌ها، customer-insights.ts) بدونِ تغییر کار کنند. ──
export { sigmoid, trainLogisticRegression, predictProba, brierScore, rocAuc, calibrationCurve };
export { MIN_AUC };

export interface TrainingExample {
  features: RawFeatureInput;
  label: 0 | 1; // 1 = no_show
}

export type { ActivationDecision };

// ⚠️ این دو عدد هم‌زمان با v2 بالا رفتند (بود: ۴۰ و ۵) و دلیلش آماری است:
// بردار از ۶ ویژگیِ غیرِبایاس به ۱۱ تا رسید. تخمینِ ۱۲ پارامتر از ۵ رویدادِ
// مثبت، «یادگیری» نیست — حفظ‌کردنِ نویز است.
//
// چرا **الان** بی‌هزینه است: بالابردنِ آستانه معمولاً یعنی «مدل‌های فعالِ
// موجود خاموش می‌شوند». ولی جهشِ نسخه‌ی ویژگی به v2 به‌هرحال همه‌ی مدل‌های
// ذخیره‌شده را (که همه v1 هستند) تا بازآموزیِ شبانه کنار می‌گذارد. پس این
// تغییر هیچ اختلالِ اضافه‌ای نمی‌سازد — و رستورانی که هنوز به حدِ نصاب
// نرسیده حالا مدلِ **سراسری** را می‌گیرد، نه heuristic؛ چیزی که پیش از
// ساختِ مدلِ سراسری وجود نداشت و همین بالابردن را ممکن کرده است.
//
// ⚠️ و صادقانه: گاردِ واقعی همچنان هولدآوت + AUC + بهبودِ نسبی است، نه این
// دو عدد. اینها فقط جلوی «اصلاً تلاش‌کردن» روی دادهٔ آشکارا ناکافی را
// می‌گیرند.
const MIN_SAMPLE_SIZE = 80;
const MIN_POSITIVE_COUNT = 12;
/** بهبودِ نسبیِ حداقلی برای فعال‌کردنِ مدلِ یادگرفته — نوسانِ آماریِ کوچک
 *  نباید هر شب heuristic را با یک مدلِ تصادفاً کمی بهتر عوض کند. */
const MIN_RELATIVE_IMPROVEMENT = 0.05;

/**
 * کفِ تفکیک (AUC) برای فعال‌سازی.
 *
 * ⚠️ چرا لازم شد: تا امروز تنها سنجه Brier بود، و Brier کالیبراسیون و تفکیک
 * را قاطی می‌کند. مدلی که به **همه** میانگینِ نرخِ no-show را بدهد Brierِ
 * قابلِ‌قبولی می‌گیرد و می‌توانست از گیتِ «۵٪ بهتر از heuristic» رد شود، در
 * حالی که AUCش دقیقاً ۰٫۵ است و صفر اطلاعات به رستوران‌دار می‌دهد.
 *
 * عددِ ۰٫۶۰ محافظه‌کارانه است: مدلی با AUC زیرِ آن، برای سؤالِ عملیاتیِ
 * واقعی («با کدام ۱۰ مهمان تماس بگیرم؟») بهتر از حدس نیست.
 */
const MIN_AUC = 0.60;

/**
 * آیا مدلِ یادگرفته باید جایگزینِ heuristic شود؟ منطقِ خالص، بدونِ DB —
 * مستقیماً تست‌پذیر. قاعده‌ی ایمنیِ عمومی در decideModelActivation
 * (lib/ml-core.ts) پیاده شده؛ اینجا فقط آستانه‌های مخصوصِ no-show
 * (MIN_SAMPLE_SIZE/MIN_POSITIVE_COUNT/MIN_RELATIVE_IMPROVEMENT) و گیتِ
 * اضافیِ «تعدادِ no-show کافی» را روی آن پیاده می‌کنیم.
 */
export function decideActivation(params: {
  sampleSize: number;
  positiveCount: number;
  learnedBrier: number;
  staticBrier: number;
}): ActivationDecision {
  const { sampleSize, positiveCount, learnedBrier, staticBrier } = params;
  return decideModelActivation({
    sampleSize,
    minSampleSize: MIN_SAMPLE_SIZE,
    learnedError: learnedBrier,
    baselineError: staticBrier,
    minRelativeImprovement: MIN_RELATIVE_IMPROVEMENT,
    baselineLabel: 'heuristic',
    extraGate: positiveCount < MIN_POSITIVE_COUNT
      ? { ok: false, reason: `تعدادِ no-show برای یادگیری کم است (${positiveCount} < ${MIN_POSITIVE_COUNT})` }
      : { ok: true, reason: '' },
  });
}

/** حداکثرِ تفاوتِ مجازِ احتمالِ پیش‌بینی‌شده که فقط از تغییرِ کانالِ رزرو
 *  (نه رفتارِ واقعی) ناشی می‌شود — ۲۰ درصدِ احتمال. */
const MAX_CHANNEL_BIAS_GAP = 0.2;

export interface BiasCheckResult {
  biased: boolean;
  /** احتمال(مهمان) − احتمال(کاربرِ ثبت‌نامی)، با همه‌ی عواملِ رفتاریِ دیگر یکسان و در حالتِ ریسکِ صفر. */
  knownUserGap: number;
  /** احتمال(رزروِ تلفنی) − احتمال(رزروِ غیرتلفنی)، همان شرایط. */
  phoneSourceGap: number;
  reason: string;
}

/**
 * تستِ سادهِ بایاسِ کانالی (نقشه‌راهِ AI، فازِ ۱) — آیا مدلِ یادگرفته صرفاً
 * به‌خاطرِ اینکه رزرو مهمان است یا از طریقِ تلفن ثبت شده (نه به‌خاطرِ
 * رفتارِ واقعیِ ریسک‌زا: last-minute، سابقه‌ی no-show، گروهِ بزرگ) امتیازِ
 * ریسک را به‌طرزِ نامتناسبی بالا/پایین می‌برد؟
 *
 * روش: یک بردارِ «ریسکِ صفر» می‌سازیم (بدونِ last-minute/very-early/
 * large-party/سابقه‌ی بد) و فقط یک ویژگیِ هویتی/کانالی را در هر بار
 * تغییر می‌دهیم. اگر تفاوتِ احتمالِ پیش‌بینی‌شده از MAX_CHANNEL_BIAS_GAP
 * بیشتر شود، یعنی مدل دارد بر اساسِ «کی هستی/چطور رزرو کردی» تبعیض
 * می‌گذارد، نه بر اساسِ رفتار — چنین مدلی نباید فعال شود، حتی اگر روی
 * Brier کلی از heuristic بهتر باشد.
 */
export function checkChannelBias(weights: number[]): BiasCheckResult {
  // ⚠️ کاوش‌ها از **خودِ فهرستِ نام‌ها** ساخته می‌شوند، نه با آرایه‌ی دستی.
  // این رفعِ یک P0ِ واقعی است (۲۰۲۶-۰۸-۲۵): نسخه‌ی قبلی سه آرایه‌ی
  // **۷ عنصریِ هاردکد** داشت با کامنتِ ترتیبِ v1. وقتی بردار به ۱۲ ویژگی
  // رسید، این تابع دست‌نخورده ماند ⇒ `dot(weights12, probe7)` ⇒ NaN ⇒
  // `Math.abs(NaN) > MAX_CHANNEL_BIAS_GAP` همیشه false ⇒ **گیتِ بایاس یک
  // no-opِ دائمی شد** و مدلی که «مهمان = پرریسک» یاد گرفته بود بی‌مانع فعال
  // می‌شد. با اجرای واقعی تأیید شد: وزنِ ۱۲تایی با `knownUser = -5` (بایاسِ
  // آشکار) هم `biased: false` می‌گرفت.
  //
  // حالا طول همیشه درست است و اندیس‌ها با نام گرفته می‌شوند، پس جابه‌جا‌شدنِ
  // ترتیبِ ویژگی‌ها هم بی‌صدا خرابش نمی‌کند. گاردِ طولِ `dot` هم لایه‌ی دوم
  // است: اگر باز هم از هم جدا افتادند، خطای بلند می‌دهد نه NaN.
  const zeroRisk = () => {
    const v = new Array(NO_SHOW_FEATURE_NAMES.length).fill(0);
    v[NO_SHOW_FEATURE_NAMES.indexOf('bias')] = 1;
    return v;
  };
  const iKnown = NO_SHOW_FEATURE_NAMES.indexOf('knownUser');
  const iPhone = NO_SHOW_FEATURE_NAMES.indexOf('phoneSource');

  const registeredZeroRisk = zeroRisk(); registeredZeroRisk[iKnown] = 1;
  const guestZeroRisk = zeroRisk();
  const phoneZeroRisk = zeroRisk(); phoneZeroRisk[iKnown] = 1; phoneZeroRisk[iPhone] = 1;

  const pRegistered = predictProba(weights, registeredZeroRisk);
  const pGuest = predictProba(weights, guestZeroRisk);
  const pPhone = predictProba(weights, phoneZeroRisk);

  const knownUserGap = pGuest - pRegistered;
  const phoneSourceGap = pPhone - pRegistered;
  const biased = Math.abs(knownUserGap) > MAX_CHANNEL_BIAS_GAP || Math.abs(phoneSourceGap) > MAX_CHANNEL_BIAS_GAP;
  const reason = biased
    ? `مدل صرفاً بر اساسِ کانالِ رزرو (نه رفتار) تفاوتِ زیادی در امتیاز می‌دهد — گپِ مهمان: ${(knownUserGap * 100).toFixed(1)}٪، گپِ تلفنی: ${(phoneSourceGap * 100).toFixed(1)}٪`
    : 'بدون بایاسِ کانالیِ قابل‌توجه';
  return { biased, knownUserGap, phoneSourceGap, reason };
}

/** ساختِ X,y از فهرستی از مثال‌ها — کمکیِ خالص برای تست و برای trainAndCalibrate. */
export function toMatrix(examples: readonly TrainingExample[]): { X: number[][]; y: number[] } {
  return {
    X: examples.map((e) => buildFeatureVector(e.features)),
    y: examples.map((e) => e.label),
  };
}

// ── از اینجا به بعد: DB واقعی. در تستِ واحد صدا زده نمی‌شود (نیاز به Postgres دارد). ──

export interface TrainingRow {
  status: string;
  party_size: number;
  source: string;
  lead_minutes: number;
  has_user_id: boolean;
  prior_no_shows: number;
  prior_completions: number;
  /** برای ویژگی‌های زمانیِ v2. Prisma ستونِ timestamp را Date می‌دهد. */
  slot_start: Date;
}

/**
 * تاریخچه‌ی رزروهای این رستوران را با ویژگیِ «سابقه‌ی مشتری در لحظه‌ی ثبت»
 * برمی‌گرداند — با window function، نه N کوئریِ جدا.
 *
 * نکته‌ی حیاتی برای جلوگیری از نشتِ زمانی: ROWS BETWEEN UNBOUNDED PRECEDING
 * ⚠️ این توضیح در ۲۰۲۶-۰۸-۲۰ بازنویسی شد: پیاده‌سازیِ قبلی window function
 * با `ORDER BY created_at ... 1 PRECEDING` بود و همین‌جا ادعا می‌کرد «دقیقاً
 * همان چیزی که در لحظه‌ی رزرو معلوم بوده». آن ادعا غلط بود — جزئیات و
 * سناریویِ اثبات در خودِ کوئریِ پایین. حالا شرطِ نقطه-در-زمان صریح است:
 * `h.slot_start < r.created_at`.
 *
 * COALESCE(user_id::text, id::text): برای رزروهای مهمان (بدون حساب کاربری)
 * user_id همه NULL است و NULL = NULL هرگز true نمی‌شود؛ بدونِ این fallback
 * هیچ مهمانی با خودش هم مطابقت نمی‌کرد. با id::text هر مهمان گروهِ
 * یک‌نفره‌ی خودش را می‌گیرد (یعنی همیشه «بدونِ سابقه»، دقیقاً مثلِ
 * heuristicِ فعلی) و سابقه‌ی مهمان‌های متفاوت با هم قاطی نمی‌شود.
 *
 * دامنه‌ی برچسب همان چیزی‌ست که recomputeCustomerInsight استفاده می‌کند:
 * completed/arrived/seated/dining = «آمد» (۰)، no_show = «نیامد» (۱).
 */
/**
 * ⚠️ export عمدی و فقط برای تست (فازِ ۴): تستِ برابریِ ویژگی باید بتواند
 * همین کوئریِ *واقعیِ* آموزش را اجرا کند و با مسیرِ سرو مقایسه‌اش کند.
 * اگر به‌جایش کوئری در تست بازنویسی می‌شد، تست فقط خودش را می‌سنجید — و
 * دقیقاً همان اختلافی که این فاز رفعش کرد، دوباره نامرئی می‌ماند.
 */
export async function fetchTrainingRows(restaurantId: string): Promise<TrainingRow[]> {
  const rows = await db.$queryRaw<TrainingRow[]>`
    SELECT r.status, r.party_size, r.source, r.slot_start,
           EXTRACT(EPOCH FROM (r.slot_start - r.created_at)) / 60.0 AS lead_minutes,
           (r.user_id IS NOT NULL) AS has_user_id,
           -- ⚠️ ::int صریح لازم است: COUNT/SUM در Postgres نوعِ bigint
           -- برمی‌گرداند، و Prisma bigint را به BigInt جاوااسکریپت map می‌کند،
           -- نه number — با اینکه TrainingRow زیر «number» اعلام شده (تایپ‌چک
           -- این دروغِ زمانِ اجرا را نمی‌بیند، چون $queryRaw فقط assertion است).
           -- بدونِ این cast، هر رستورانی که حتی یک مشتریِ تکراری داشته باشد
           -- (priorTotal>0) در dot() با «Cannot mix BigInt and other types»
           -- کرش می‌کرد — با تستِ واقعی روی Postgres پیدا شد.
           p.prior_no_shows::int   AS prior_no_shows,
           p.prior_completions::int AS prior_completions
    FROM reservations r
    CROSS JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE h.status = 'no_show') AS prior_no_shows,
        COUNT(*) FILTER (WHERE h.status IN ('completed','arrived','seated','dining')) AS prior_completions
      FROM reservations h
      WHERE h.restaurant_id = r.restaurant_id
        AND COALESCE(h.user_id::text, h.id::text) = COALESCE(r.user_id::text, r.id::text)
        AND h.id <> r.id
        AND h.status IN ('completed','no_show','arrived','seated','dining')
        -- ⚠️ رفعِ نشتِ زمانی (P0، ممیزیِ ۲۰۲۶-۰۸-۲۰): شرطِ زیر عمداً
        -- slot_start است، نه created_at.
        --
        -- نسخه‌ی قبلی یک window function با
        -- ORDER BY created_at ROWS ... 1 PRECEDING بود. آن ترتیب «کدام رزرو
        -- زودتر *ثبت* شد» را می‌سنجید، ولی نتیجه‌ی یک رزرو در لحظه‌ی
        -- *برگزاری* معلوم می‌شود، نه لحظه‌ی ثبت. پس رزروی که زودتر ثبت شده
        -- ولی دیرتر برگزار می‌شود، وضعیتِ no_showِ آینده‌اش وارد ویژگیِ
        -- رزروهایی می‌شد که قبل از آن برگزار شده بودند.
        --
        -- با سناریوی کنترل‌شده روی همین کوئری اثبات شد:
        --   A: ثبت ۲۰۲۶-۰۱-۰۱، برگزاری ۲۰۲۶-۰۳-۰۱، no_show
        --   B: ثبت ۲۰۲۶-۰۲-۰۱، برگزاری ۲۰۲۶-۰۲-۰۲، completed
        -- نسخه‌ی قبلی برای B مقدارِ prior_no_shows = 1 می‌داد — یعنی مدل از
        -- اتفاقی که یک ماه بعد می‌افتاد «یاد می‌گرفت». این دقیقاً همان چیزی
        -- است که مدل را در ارزیابی خوب و در تولید بی‌ارزش می‌کند.
        --
        -- حالا فقط سابقه‌ای شمرده می‌شود که نتیجه‌اش پیش از *ثبتِ* رزروِ
        -- هدف قطعی شده بود.
        AND h.slot_start < r.created_at
    ) p
    WHERE r.restaurant_id = ${restaurantId}::uuid
      AND r.status IN ('completed', 'no_show', 'arrived', 'seated', 'dining')
      -- ⚠️ walk-inها عمداً از **هدفِ آموزش** بیرون‌اند (رفعِ ۲۰۲۶-۰۸-۲۵):
      -- walk-in با slot_start = now و created_at = now ساخته می‌شود
      -- (lib/reservations.ts) ⇒ lead_minutes ≈ 0 — و چون وضعیتش 'seated'
      -- است، برچسبش **همیشه** ۰ می‌شود. walk-in ذاتاً نمی‌تواند no-show
      -- باشد؛ مهمان فیزیکاً آن‌جاست.
      -- نتیجه: مدل یاد می‌گرفت «فاصله‌ی نزدیکِ صفر ⇒ امن»، دقیقاً وارونه‌ی
      -- سیگنالِ واقعی برای رزروِ آنلاینِ last-minute. ویژگیِ پیوسته‌ی leadLog
      -- این را بدتر می‌کرد چون کانالِ دقیق‌تری برای فیت‌کردنِ رابطه‌ی وارونه
      -- می‌داد.
      -- ضمناً یک عدمِ تطابقِ جمعیتیِ train/serve بود: walk-in هرگز از
      -- predictNoShowRisk رد نمی‌شود، پس مدل روی جمعیتی آموزش می‌دید که
      -- هرگز قرار نبود امتیازش بدهد.
      -- ⚠️ ولی در **سابقه**‌ی مهمان (زیرکوئریِ LATERAL) می‌مانند — حضورِ
      -- واقعی بوده و پاک‌کردنش تاریخچه‌ی او را تحریف می‌کند.
      AND r.source <> 'walkin'
    -- ⚠️ DESC + LIMIT، بعد در JS برعکس — همان الگویِ مسیرِ سراسری، و به
    -- دلیلِ دیگری هم لازم (رفعِ ۲۰۲۶-۰۸-۲۵): با ASC + LIMIT 500، به‌محضِ
    -- اینکه یک رستوران از ۵۰۰ رزروِ حل‌شده رد شود، بازآموزیِ شبانه تا ابد
    -- همان ۵۰۰ ردیفِ اول را می‌خواند. مدل هرگز رفتارِ اخیر را نمی‌بیند،
    -- هولدآوت باستانی می‌ماند، و تشخیصِ رانش دقتِ تولیدِ امروز را با
    -- هولدآوتِ آن دوره مقایسه می‌کند ⇒ رانشِ صوریِ دائمی. یعنی «یادگیری»
    -- برای موفق‌ترین رستوران‌ها اول از همه متوقف می‌شد.
    ORDER BY r.created_at DESC
    LIMIT 500
  `;
  return rows.reverse();
}

function rowToExample(row: TrainingRow): TrainingExample {
  // Number(...) دفاعِ لایه‌ی دوم است: کوئری بالا صریحاً ::int می‌زند، ولی
  // اگر آن cast روزی سهواً حذف شود، Postgres باز به bigint/BigInt برمی‌گردد
  // و بدونِ این خط، dot() در ml-core.ts با «Cannot mix BigInt and other
  // types» کرش می‌کند (دقیقاً همان باگی که با تستِ واقعی روی Postgres پیدا
  // شد) — اینجا مطمئن می‌شویم صرفِ‌نظر از نوعِ خام، همیشه number خالص برسد.
  const priorNoShows = Number(row.prior_no_shows);
  const priorCompletions = Number(row.prior_completions);
  const priorTotal = priorNoShows + priorCompletions;
  return {
    features: {
      hasUserId: row.has_user_id,
      priorTotal,
      priorNoShowRate: priorTotal > 0 ? priorNoShows / priorTotal : 0,
      leadMinutes: row.lead_minutes,
      partySize: row.party_size,
      source: row.source,
      slotStart: row.slot_start,
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
  /** تفکیکِ مدلِ یادگرفته روی هولدآوت. `null` = اندازه‌گیری نشد (هولدآوتِ تک‌کلاسه). */
  learnedAuc?: number | null;
  /** تفکیکِ heuristic روی همان هولدآوت — برای مقایسه‌ی منصفانه. */
  staticAuc?: number | null;
  /** منحنیِ کالیبراسیون: «وقتی مدل ۳۰٪ می‌گوید، واقعاً ۳۰٪ رخ می‌دهد؟» */
  calibration?: CalibrationBucket[];
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

  // ── تفکیک، جدا از کالیبراسیون ──────────────────────────────────────
  // `null` یعنی هولدآوت تک‌کلاسه بود ⇒ تفکیک **اندازه‌گیری نشد**، نه اینکه
  // بد بود. در آن حالت فعال‌سازی رد می‌شود: مدلی که نتوانستیم بسنجیمش
  // نباید به تولید برود (همان انضباطِ «چیزی را که اثبات نکردی ادعا نکن»).
  const learnedAuc = rocAuc(learnedPreds, holdoutY);
  const staticAuc = rocAuc(staticPreds, holdoutY);
  const calibration = calibrationCurve(learnedPreds, holdoutY);

  const decision = decideActivation({ sampleSize: examples.length, positiveCount, learnedBrier, staticBrier });

  // گیتِ تفکیک — پیش از گیتِ بایاس، چون ارزان‌تر و بنیادی‌تر است.
  const aucGate: { ok: boolean; reason: string } =
    learnedAuc === null
      ? { ok: false, reason: 'تفکیک اندازه‌گیری نشد (هولدآوت تک‌کلاسه) — مدلِ نسنجیده فعال نمی‌شود' }
      : learnedAuc < MIN_AUC
        ? { ok: false, reason: `تفکیکِ ناکافی: AUC ${learnedAuc.toFixed(3)} < ${MIN_AUC} — بهتر از حدس نیست` }
        : { ok: true, reason: '' };

  // گیتِ ایمنیِ اضافی: حتی اگر مدل روی Brierِ کلی از heuristic بهتر باشد،
  // اگر صرفاً بر اساسِ کانالِ رزرو (مهمان/تلفنی) تبعیض بگذارد فعال نمی‌شود —
  // دقیقاً همان انضباطِ «مدلِ مشکوک هیچ‌وقت جایگزین نمی‌شود» که در
  // decideModelActivation هست، این‌بار برای بایاس نه فقط دقت.
  const biasCheck = checkChannelBias(weights);
  const isActive = decision.isActive && aucGate.ok && !biasCheck.biased;
  const reason = !decision.isActive ? decision.reason
    : !aucGate.ok ? aucGate.reason
    : biasCheck.biased ? biasCheck.reason
    : decision.reason;

  // تاریخچه‌ی append-only (migration 042) — هیچ‌وقت overwrite نمی‌شود تا
  // داشبوردِ سلامتِ مدل بتواند «امتحان‌شد ولی فعال نشد» را هم ببیند، نه فقط
  // آخرین وضعیت. شکستِ این نوشتن نباید آموزشِ اصلی را خراب کند.
  //
  // ⚠️ ترتیب عمداً عوض شد (فازِ ۶): این create حالا *پیش از* upsert است، چون
  // شناسه‌اش باید در ردیفِ مدلِ فعال ذخیره شود تا پیش‌بینی‌هایِ تولید به همین
  // نسخه بسته شوند. اگر create شکست بخورد، runId می‌ماند null و مدل مثلِ قبل
  // ذخیره می‌شود — یعنی نسب‌نامه از دست می‌رود ولی آموزش سالم می‌ماند. همان
  // مصالحه‌ی قبلی، فقط جابه‌جا شده.
  const run = await db.modelTrainingRun.create({
    data: {
      restaurantId, kind: 'no_show', sampleSize: examples.length,
      metrics: {
        learnedBrier, staticBrier,
        knownUserGap: biasCheck.knownUserGap, phoneSourceGap: biasCheck.phoneSourceGap,
      } as unknown as Prisma.InputJsonValue,
      isActive, reason,
    },
    select: { id: true },
  }).catch(() => null);

  // activeRunId فقط وقتی به این اجرا اشاره می‌کند که همین اجرا واقعاً فعال
  // شده باشد. اگر گیتِ ایمنی ردش کرده، مدلِ فعالِ قبلی (اگر بود) سرِ جایش
  // می‌ماند و نسب‌نامه‌اش هم نباید به اجرایِ ردشده منتقل شود.
  const runIdIfActive = isActive ? (run?.id ?? null) : undefined;

  await db.restaurantNoShowModel.upsert({
    where: { restaurantId },
    create: {
      restaurantId, weights, sampleSize: examples.length, positiveCount,
      learnedBrier, staticBrier, isActive,
      featureVersion: NO_SHOW_FEATURE_VERSION,
      activeRunId: isActive ? (run?.id ?? null) : null,
    },
    update: {
      weights, sampleSize: examples.length, positiveCount,
      learnedBrier, staticBrier, isActive, trainedAt: new Date(),
      featureVersion: NO_SHOW_FEATURE_VERSION,
      ...(runIdIfActive !== undefined ? { activeRunId: runIdIfActive } : {}),
    },
  });
  await invalidateNoShowModelCache(restaurantId);

  return {
    trained: true, sampleSize: examples.length, positiveCount,
    learnedBrier, staticBrier, learnedAuc, staticAuc, calibration, isActive, reason,
  };
}

// ── کلیدهای کشِ مدل — **تنها** جای تعریفشان ───────────────────────────
//
// ⚠️ یافته‌ی ۲۰۲۶-۰۸-۲۵ (تستِ `ml-platform-model` گرفتش): این کلید یک‌بار
// عوض شد (`noshow-model` → `noshow-model-v2`، کامیتِ 22ac0b6 در ۲۰۲۶-۰۸-۲۰)
// چون شکلِ مقدارِ کش‌شده عوض شده بود — ولی فقط **خواننده** به‌روز شد. هر دو
// نویسنده (پایانِ آموزشِ شبانه، و بازگردانیِ رانش در `model-drift.ts`) هنوز
// کلیدِ قدیمی را invalidate می‌کردند، یعنی **هیچ‌کدام کاری نمی‌کردند**:
//   • مدلِ تازه‌آموزش‌دیده تا ۱ ساعت سرو نمی‌شد؛
//   • و بدتر: مدلی که به‌خاطرِ افتِ کارایی «پس گرفته شده» بود تا ۱ ساعت
//     **همچنان سرو می‌شد** — یعنی خودِ سازوکارِ بازگردانی بی‌اثر بود.
// هیچ خطایی هم تولید نمی‌شد؛ `invalidate` روی کلیدی که وجود ندارد موفق است.
//
// برای همین کلید حالا فقط از این دو تابع ساخته می‌شود و نویسنده‌ها
// `invalidateNoShowModelCache` را صدا می‌زنند، نه `cacheKey` را مستقیم.
const restaurantModelKey = (restaurantId: string) => cacheKey('noshow-model-v2', restaurantId);
const platformModelKey = () => cacheKey('noshow-model-v2', 'platform');

/** بی‌اعتبارکردنِ کشِ مدلِ یک رستوران. **هر** نویسنده‌ای که
 *  `restaurant_no_show_models` را عوض می‌کند باید این را صدا بزند. */
export async function invalidateNoShowModelCache(restaurantId: string): Promise<void> {
  await invalidate(restaurantModelKey(restaurantId)).catch(() => {});
}

/** همان، برای مدلِ سراسری. */
export async function invalidatePlatformNoShowModelCache(): Promise<void> {
  await invalidate(platformModelKey()).catch(() => {});
}

/** خواندنِ مدلِ فعالِ یک رستوران (کش‌شده — این تابع در مسیرِ داغِ ثبتِ رزرو
 *  صدا زده می‌شود). null یعنی «چیزی فعال نیست، از heuristic استفاده کن». */
export async function getLearnedNoShowModel(restaurantId: string): Promise<number[] | null> {
  const m = await getLearnedNoShowModelWithRun(restaurantId);
  return m ? m.weights : null;
}

/**
 * همان مدلِ فعال، به‌علاوه‌ی شناسه‌ی اجرایِ آموزشی که ساختش (فازِ ۶).
 *
 * ⚠️ چرا دو تابع و نه تغییرِ امضایِ قبلی: getLearnedNoShowModel جای دیگری هم
 * صدا زده می‌شود و قراردادش «وزن‌ها یا null» است. شکستنِ آن برایِ یک فیلدِ
 * اضافه، تغییرِ بی‌دلیل در مسیرهایی است که به نسب‌نامه کاری ندارند.
 *
 * runId می‌تواند null باشد و این حالتِ صادقانه‌ای است: مدل‌هایی که پیش از
 * مهاجرتِ ۰۵۶ آموزش دیده‌اند نسب‌نامه ندارند و نباید برایشان یکی جعل شود.
 */
export async function getLearnedNoShowModelWithRun(
  restaurantId: string,
): Promise<{ weights: number[]; runId: string | null } | null> {
  // شکلِ کش عمداً عوض شد؛ کلید هم باید عوض می‌شد وگرنه یک کشِ گرمِ قدیمی
  // (آرایه‌ی خام) به‌عنوانِ آبجکت خوانده می‌شد و بی‌صدا undefined می‌داد.
  return cached(restaurantModelKey(restaurantId), 3600, async () => {
    const row = await db.restaurantNoShowModel.findUnique({
      where: { restaurantId },
      select: { isActive: true, weights: true, activeRunId: true, featureVersion: true },
    });
    if (!row?.isActive) return null;
    // گاردِ نسخه — رجوع کن به NO_SHOW_FEATURE_VERSION. عمداً بی‌صدا نیست:
    // اگر این هشدار زیاد دیده شود یعنی آموزشِ شبانه کار نمی‌کند.
    if (row.featureVersion !== NO_SHOW_FEATURE_VERSION) {
      log.warn('مدلِ رستوران با نسخه‌ی ویژگیِ ناسازگار سرو نشد', {
        restaurantId, modelVersion: row.featureVersion, codeVersion: NO_SHOW_FEATURE_VERSION,
      });
      metrics.modelVersionMismatch.inc({ scope: 'restaurant' });
      return null;
    }
    return { weights: row.weights, runId: row.activeRunId };
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  مدلِ سراسریِ پلتفرم — رفعِ سرمای شروع
//
//  ⚠️ مسئله‌ای که حل می‌کند: گیتِ فعال‌سازی به‌ازای **هر رستوران** ۴۰ نمونه
//  و ۵ no-show می‌خواهد. برای پلتفرمی که تازه لانچ می‌کند یعنی تقریباً هیچ
//  رستورانی هرگز مدل نمی‌گیرد و همه تا ماه‌ها روی heuristicِ ثابت می‌مانند —
//  هرچقدر هم که کلِ پلتفرم داده جمع کند. یعنی «یادگیری» عملاً اتفاق نمی‌افتد.
//
//  با این مدل، رستورانِ تازه از روزِ اول از تجربه‌ی کلِ پلتفرم بهره می‌برد و
//  به‌محضِ کافی‌شدنِ دادهٔ خودش، مدلِ اختصاصی‌اش جایگزین می‌شود.
// ═══════════════════════════════════════════════════════════════════════

/** سقفِ نمونه‌ی آموزشِ سراسری — بیش از این، بازدهی نزولی و هزینه‌ی حافظه. */
const PLATFORM_MAX_ROWS = 5000;

/**
 * حداقلِ تعدادِ رستورانِ سهیم.
 *
 * چرا جدا از حداقلِ نمونه: ۴۰۰ رزرو که همه از **یک** رستوران باشند، مدلِ
 * «سراسری» نیست — مدلِ همان رستوران است با برچسبِ غلط، و روی بقیه بدتر از
 * heuristic عمل می‌کند. این گیت جلوی آن ادعا را می‌گیرد.
 */
const PLATFORM_MIN_RESTAURANTS = 3;

/** همان کوئریِ آموزش، بدونِ قیدِ رستوران. عمداً همان شکلِ ویژگی و همان
 *  شرطِ نقطه-در-زمان (`h.slot_start < r.created_at`) — اگر این دو از هم
 *  جدا شوند، مدلِ سراسری روی ویژگی‌هایی آموزش می‌بیند که مسیرِ سرو
 *  نمی‌سازد و در تولید بی‌ارزش می‌شود. */
export async function fetchPlatformTrainingRows(): Promise<TrainingRow[]> {
  // ⚠️ دو مرحله، و ترتیبش حیاتی است (رفعِ P0، ممیزیِ نهاییِ ۲۰۲۶-۰۸-۲۵):
  //   ۱) DESC + LIMIT ⇒ **تازه‌ترین** N ردیف (نه قدیمی‌ترین)
  //   ۲) بعد در JS برعکس ⇒ ترتیبِ **زمانیِ صعودی** برای split
  //
  // چرا مهم بود: `trainAndCalibratePlatformNoShowModel` با
  // `slice(0, 80%)` آموزش و `slice(80%)` هولدآوت می‌سازد. با آرایه‌ی
  // نزولی، این یعنی آموزش روی **تازه‌ترین** ۸۰٪ و سنجش روی **قدیمی‌ترین**
  // ۲۰٪ — یعنی مدل روی آینده آموزش می‌دید و روی گذشته سنجیده می‌شد.
  // بدتر از split تصادفی، و `learnedBrier`/`learnedAuc`ی که گیتِ فعال‌سازی
  // روی آن تصمیم می‌گیرد هیچ تخمینی از کاراییِ آینده نبود.
  //
  // دامنه‌ی اثر بزرگ‌ترین ممکن بود: این مدل به **هر** رستورانی که مدلِ
  // اختصاصی ندارد سرو می‌شود. مسیرِ per-restaurant از روزِ اول `ASC` بود؛
  // فقط این یکی از آن جدا افتاده بود.
  const rows = await db.$queryRaw<TrainingRow[]>`
    SELECT r.status, r.party_size, r.source, r.slot_start,
           EXTRACT(EPOCH FROM (r.slot_start - r.created_at)) / 60.0 AS lead_minutes,
           (r.user_id IS NOT NULL) AS has_user_id,
           p.prior_no_shows::int   AS prior_no_shows,
           p.prior_completions::int AS prior_completions
    FROM reservations r
    CROSS JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE h.status = 'no_show') AS prior_no_shows,
        COUNT(*) FILTER (WHERE h.status IN ('completed','arrived','seated','dining')) AS prior_completions
      FROM reservations h
      -- سابقه عمداً **درونِ همان رستوران** می‌ماند، حتی در مدلِ سراسری:
      -- مسیرِ سرو هم دقیقاً همین را می‌سازد. اگر اینجا سابقه‌ی بین‌رستورانی
      -- می‌شد، ویژگیِ آموزش با ویژگیِ سرو فرق می‌کرد — همان کلاسِ خطایی که
      -- فازِ ۴ رفعش کرد.
      WHERE h.restaurant_id = r.restaurant_id
        AND COALESCE(h.user_id::text, h.id::text) = COALESCE(r.user_id::text, r.id::text)
        AND h.id <> r.id
        AND h.status IN ('completed','no_show','arrived','seated','dining')
        AND h.slot_start < r.created_at
    ) p
    WHERE r.status IN ('completed', 'no_show', 'arrived', 'seated', 'dining')
      -- همان دلیلِ کوئریِ per-restaurant بالا: walk-in برچسبِ همیشه-صفر با
      -- فاصله‌ی صفر است و مدل را وارونه آموزش می‌دهد.
      AND r.source <> 'walkin'
    ORDER BY r.created_at DESC
    LIMIT ${PLATFORM_MAX_ROWS}
  `;
  return rows.reverse();
}

export interface PlatformTrainResult {
  trained: boolean;
  reason?: string;
  sampleSize: number;
  positiveCount: number;
  restaurantCount: number;
  learnedBrier?: number;
  staticBrier?: number;
  learnedAuc?: number | null;
  isActive?: boolean;
}

/**
 * آموزشِ مدلِ سراسری. از همان cronِ شبانه، **یک بار** برای کلِ پلتفرم (نه
 * به‌ازای هر رستوران).
 *
 * از **همان** گیت‌های مدلِ اختصاصی عبور می‌کند — Brier نسبت به heuristic،
 * کفِ AUC، و بایاسِ کانالی. «سراسری» بودن هیچ تخفیفی در استانداردِ کیفیت
 * نمی‌دهد؛ اگر مدلی به‌اندازه‌ی heuristic خوب نیست، سراسری‌بودنش بدترش
 * می‌کند نه بهتر، چون به همه‌ی رستوران‌ها سرو می‌شود.
 */
export async function trainAndCalibratePlatformNoShowModel(): Promise<PlatformTrainResult> {
  const rows = await fetchPlatformTrainingRows();
  const examples = rows.map(rowToExample);
  const positiveCount = examples.filter((e) => e.label === 1).length;

  const restaurantCount = await db.reservation.findMany({
    where: { status: { in: ['completed', 'no_show', 'arrived', 'seated', 'dining'] as never } },
    select: { restaurantId: true }, distinct: ['restaurantId'], take: 200,
  }).then((r) => r.length);

  const base = { sampleSize: examples.length, positiveCount, restaurantCount };

  if (restaurantCount < PLATFORM_MIN_RESTAURANTS) {
    return {
      trained: false,
      reason: `تنوعِ رستوران کافی نیست (${restaurantCount} < ${PLATFORM_MIN_RESTAURANTS}) — مدلِ «سراسری» با دادهٔ یک‌دو رستوران، سراسری نیست`,
      ...base,
    };
  }

  const splitAt = Math.floor(examples.length * 0.8);
  const trainSet = examples.slice(0, splitAt);
  const holdout = examples.slice(splitAt);
  if (holdout.length === 0 || trainSet.length === 0) {
    return { trained: false, reason: 'دادهٔ کافی برای split نیست', ...base };
  }

  const { X: trainX, y: trainY } = toMatrix(trainSet);
  const { X: holdoutX, y: holdoutY } = toMatrix(holdout);

  const weights = trainLogisticRegression(trainX, trainY);
  const learnedPreds = holdoutX.map((x) => predictProba(weights, x));
  const learnedBrier = brierScore(learnedPreds, holdoutY);
  const staticPreds = holdout.map((e) => computeStaticScoreFromFeatures(e.features) / 100);
  const staticBrier = brierScore(staticPreds, holdoutY);
  const learnedAuc = rocAuc(learnedPreds, holdoutY);

  const decision = decideActivation({ sampleSize: examples.length, positiveCount, learnedBrier, staticBrier });
  const aucOk = learnedAuc !== null && learnedAuc >= MIN_AUC;
  const biasCheck = checkChannelBias(weights);
  const isActive = decision.isActive && aucOk && !biasCheck.biased;

  const reason = !decision.isActive ? decision.reason
    : learnedAuc === null ? 'تفکیک اندازه‌گیری نشد (هولدآوتِ تک‌کلاسه)'
    : !aucOk ? `تفکیکِ ناکافی: AUC ${learnedAuc.toFixed(3)} < ${MIN_AUC}`
    : biasCheck.biased ? biasCheck.reason
    : decision.reason;

  // مدلِ فعالِ قبلی کنار می‌رود تا «آخرین فعال» همیشه یکتا باشد.
  if (isActive) {
    await db.platformNoShowModel.updateMany({ where: { isActive: true }, data: { isActive: false } });
  }
  await db.platformNoShowModel.create({
    data: {
      weights, sampleSize: examples.length, positiveCount, restaurantCount,
      learnedBrier, staticBrier, learnedAuc, isActive, activationReason: reason,
      featureVersion: NO_SHOW_FEATURE_VERSION,
    },
  });
  await invalidatePlatformNoShowModelCache();

  return { trained: true, ...base, learnedBrier, staticBrier, learnedAuc, isActive, reason };
}

/** آخرین مدلِ سراسریِ فعال، یا null. */
export async function getPlatformNoShowModel(): Promise<number[] | null> {
  const row = await cached(platformModelKey(), 300, async () => {
    // فیلترِ نسخه داخلِ کوئری است، نه بعدش: وگرنه یک مدلِ ناسازگارِ تازه‌تر
    // مدلِ سازگارِ قدیمی‌تر را می‌پوشاند و نتیجه null می‌شد، در حالی که یک
    // مدلِ کاملاً قابلِ‌استفاده وجود دارد.
    const m = await db.platformNoShowModel.findFirst({
      where: { isActive: true, featureVersion: NO_SHOW_FEATURE_VERSION },
      orderBy: { trainedAt: 'desc' }, select: { weights: true },
    });
    return m ? { weights: m.weights } : null;
  });
  return row?.weights ?? null;
}

/** از کجا آمد — برای نسب‌نامه‌ی دفترِ پیش‌بینی و داشبورد.
 *  `heuristic` حالتی است که **هیچ** مدلی نیست؛ آنجا `getEffectiveNoShowModel`
 *  مقدارِ `null` برمی‌گرداند، نه یک شیء با این برچسب — پس نوعِ بازگشتی
 *  عمداً باریک‌تر است و همان را می‌گوید. */
export type NoShowModelSource = 'restaurant' | 'platform' | 'heuristic';
export type LearnedModelSource = Exclude<NoShowModelSource, 'heuristic'>;

/**
 * مدلی که واقعاً باید برای این رستوران استفاده شود.
 *
 * ترتیب عمدی: مدلِ **اختصاصیِ** رستوران همیشه بر سراسری مقدم است — وقتی
 * رستورانی دادهٔ کافیِ خودش را دارد، الگوی خودش دقیق‌تر از میانگینِ پلتفرم
 * است. سراسری فقط شکافِ «هنوز داده ندارم» را پر می‌کند، نه اینکه جایگزینِ
 * یادگیریِ محلی شود.
 */
export async function getEffectiveNoShowModel(
  restaurantId: string,
): Promise<{ weights: number[]; source: LearnedModelSource; runId: string | null } | null> {
  const own = await getLearnedNoShowModelWithRun(restaurantId).catch(() => null);
  if (own) return { weights: own.weights, source: 'restaurant', runId: own.runId };

  const platform = await getPlatformNoShowModel().catch(() => null);
  if (platform) return { weights: platform, source: 'platform', runId: null };

  return null;
}
