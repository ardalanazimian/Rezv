import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { db } from './db';
import { Err } from './errors';
import { enqueueSms } from './sms';
import { smsAllowedForCategory, findUserByPhoneForConsent } from './notification-prefs';
import { isFeatureEnabled, featureFlagLabel } from './feature-flags';

// ═══════════════════════════════════════════════════════════
//  سرویس وفاداری رزرونو — امتیاز، دعوت، کارت هدیه، پاداش
// ═══════════════════════════════════════════════════════════

const POINTS = {
  signup: 200,           // امتیاز خوش‌آمد
  perReservation: 100,   // هر رزرو تکمیل‌شده
  referralReward: 500,   // پاداش دعوت موفق
  birthday: 1000,        // هدیه‌ی تولد
  anniversary: 1000,     // هدیه‌ی سالگرد
};

/** امتیازی که بابتِ حضورِ واقعی (چک‌این) به باشگاهِ همان رستوران داده می‌شود. */
export const ARRIVAL_POINTS = 50;

// ═══════════════════════════════════════════════════════════════════════
//  نرخِ کانونیِ امتیاز ⇄ تومان — **یک تعریف، در یک فایل**
//
//  تصمیمِ مؤسس (۲۰۲۶-۰۹-۰۹، صریح، هر دو عدد): «۱۰۰۰ تومان خرید = ۲۵ امتیاز»
//  و «۱ امتیاز = ۲ تومان هنگامِ خرج». این دو با هم و با درصدِ کش‌بکِ موجود
//  حساب می‌بندند و همین دلیلِ انتخابِ این شکل است:
//
//      ۱۰۰۰ تومان × ۵٪ = ۵۰ تومان ارزش ÷ ۲ تومان بر امتیاز = ۲۵ امتیاز ✅
//
//  یعنی `cbBasePct` معنایش را نگه می‌دارد و **جایگزینِ نرخِ ثابت نمی‌شود**؛
//  عددِ مؤسس از قبل با درصدِ قابلِ‌تنظیمِ هر رستوران سازگار است.
//
//  ⚠️ چرا یک ثابت و نه دو عدد در دو فایل: تاریخِ همین مخزن استدلال است —
//  `CUSTOMER_APP_URL` زیرِ سه نام زندگی می‌کرد و نامِ مستندشده هرگز خوانده
//  نمی‌شد؛ کلیدهای overrideِ XSS به متنی گره خورده بودند که هرکسی می‌توانست
//  عوضش کند. **یک نرخِ پولی که در دو فایل تکرار شود همان نقص است با
//  پیامدِ بدتر.** هر «کسب» و هر «خرج» باید از همین دو تابع عبور کند.
//
//  ⚠️ صداقتِ صریح: این تغییر، شمارشِ امتیازِ کش‌بک را نصف می‌کند
//  (۱۰۰۰ تومان: ۵۰ ⇦ ۲۵) ولی **ارزشِ تومانیِ برگشتی را عوض نمی‌کند**
//  (۵٪ = ۵۰ تومان، قبل و بعد). چیزی که عوض می‌شود واحدِ شمارش است، نه پول.
//  موجودی‌های تولید که زیرِ «۱ امتیاز = ۱ تومانِ ضمنی» انباشته شده‌اند با
//  این نرخ **دو برابر** ارزش‌گذاری می‌شوند — به همین دلیل بازخرید پشتِ فلگ
//  خاموش می‌ماند (رجوع کن به redeemPointsTx).
// ═══════════════════════════════════════════════════════════════════════

/** تومانی که هر یک امتیاز هنگامِ **خرج** می‌ارزد. تنها تعریفِ این نرخ. */
export const TOMAN_PER_POINT = 2;

/**
 * ارزشِ تومانیِ n امتیاز — **دقیق، بدونِ هیچ رندی**.
 *
 * جهتِ خرج عمداً ضربِ صحیح است: هیچ کسری تولید نمی‌شود، پس هیچ رندی هم
 * لازم نیست. تمامِ رندِ سیستم در جهتِ مخالف (کسب) و فقط یک‌بار انجام می‌شود.
 */
export function pointsToToman(points: number): number {
  if (!Number.isInteger(points) || points < 0) {
    throw Err.validation('امتیاز باید عددِ صحیحِ نامنفی باشد');
  }
  return points * TOMAN_PER_POINT;
}

/**
 * امتیازِ معادلِ یک ارزشِ تومانی — **رند به پایین (floor)، عمدی**.
 *
 * چرا floor و نه round: رفت‌وبرگشت نباید پول خلق کند. با round، ۳ تومان
 * ارزش ⇦ ۲ امتیاز ⇦ ۴ تومان خروجی؛ یعنی یک تومان از هیچ ساخته شد. با floor
 * همیشه `pointsToToman(tomanToPoints(v)) ≤ v` — سیستم هرگز بیشتر از آنچه
 * گرفته پس نمی‌دهد، و روی مضارب دقیقِ نرخ (مثلِ عددِ خودِ مؤسس) تساویِ کامل
 * برقرار است. رند فقط **یک‌بار** و **در انتهای** محاسبه انجام می‌شود.
 */
export function tomanToPoints(valueToman: number): number {
  if (!Number.isFinite(valueToman) || valueToman < 0) {
    throw Err.validation('ارزشِ تومانی باید عددِ نامنفی باشد');
  }
  return Math.floor(valueToman / TOMAN_PER_POINT);
}

/**
 * فرمولِ کسبِ کش‌بک: امتیازی که بابتِ صورت‌حسابِ نهایی با درصدِ رستوران
 * تعلق می‌گیرد. تنها فرمولِ کسب — `reservations.ts` همین را صدا می‌زند.
 *
 * ⚠️ یک floor، در انتها: `floor((final × pct) / (100 × نرخ))`. اگر اول
 * ارزشِ تومانی رند می‌شد و بعد تقسیم، رندِ دوگانه می‌داشتیم و رفت‌وبرگشت
 * دیگر مقایسه‌پذیر نبود.
 */
export function cashbackPointsFor(finalToman: number, cbPct: number): number {
  if (!Number.isFinite(finalToman) || finalToman <= 0) return 0;
  if (!Number.isFinite(cbPct) || cbPct <= 0) return 0;
  return tomanToPoints((finalToman * cbPct) / 100);
}

// ═══════════════════════════════════════════════════════════
//  سطوحِ باشگاه (tier)
//
//  ⚠️ این تعریف‌ها از `loyalty-status.ts` به این‌جا **منتقل** شدند، نه کپی —
//  `loyalty-status.ts` همان‌ها را دوباره export می‌کند تا هیچ صداکننده‌ای
//  نشکند. دلیلِ جابه‌جایی یک وابستگیِ دوری بود: `loyalty-status.ts` از قبل
//  `getPointsBalance` را از همین فایل import می‌کرد، پس اگر `loyalty.ts` هم
//  `tierFromPoints` را از آن‌جا می‌گرفت یک چرخه‌ی import ساخته می‌شد. در این
//  کدبیس هزینه‌ی importهای شکننده قبلاً پرداخت شده (رجوع کن به توضیحِ
//  `ERR_UNSUPPORTED_RESOLVE_REQUEST` در `lifecycle.ts`)، پس چرخه ساخته نشد.
// ═══════════════════════════════════════════════════════════

export interface LoyaltyTier {
  key: 'bronze' | 'silver' | 'gold' | 'platinum';
  name: string;
  emoji: string;
  min: number;
}

export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  { key: 'bronze', name: 'برنزی', emoji: '🥉', min: 0 },
  { key: 'silver', name: 'نقره‌ای', emoji: '🥈', min: 300 },
  { key: 'gold', name: 'طلایی', emoji: '🥇', min: 800 },
  { key: 'platinum', name: 'پلاتینیوم', emoji: '💎', min: 2000 },
];

export function tierFromPoints(points: number): LoyaltyTier {
  let current = LOYALTY_TIERS[0];
  for (const t of LOYALTY_TIERS) if (points >= t.min) current = t;
  return current;
}

const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(prefix: string, len = 8): string {
  const b = randomBytes(len);
  let s = prefix;
  for (let i = 0; i < len; i++) s += B32[b[i] % 32];
  return s;
}

// ── افزودن/کسر امتیاز (با ثبت در دفتر) ──
export async function addPoints(opts: {
  userId: string; delta: number; reason: string; restaurantId?: string; note?: string;
  // فازِ ۱ (§۱۳، تصمیمِ مالک ۲۰۲۶-۰۹-۰۹): کلیدِ صریحِ idempotency (اختیاری).
  // هر فراخوانی که رویدادش می‌تواند تکرار شود (retry/race/cron دوباره) باید
  // کلیدِ پایدار بدهد — مثلاً `referral:${referralId}`. نبودنش یعنی این
  // insert آگاهانه محافظتِ سطحِ DB ندارد (مثلِ اعطای دستیِ ادمین/adjustment)،
  // نه یک سوراخِ فراموش‌شده.
  idempotencyKey?: string;
}): Promise<number> {
  // ledger الگوی append-only است (فقط insert، هیچ‌وقت update روی مجموع) — پس
  // داده‌ی ذخیره‌شده ذاتاً امن در برابر همزمانی است. اما insert و aggregate را
  // در یک تراکنش می‌گذاریم تا «مجموع برگشتی» با همان snapshot سازگار باشد
  // (وگرنه دو addPoints همزمان می‌توانند مجموع‌های میانی ناسازگار برگردانند).
  return db.$transaction(async (tx) => {
    await tx.pointsLedger.create({
      data: {
        userId: opts.userId, delta: opts.delta, reason: opts.reason as any,
        restaurantId: opts.restaurantId ?? null, note: opts.note ?? null,
        idempotencyKey: opts.idempotencyKey ?? null,
      },
    });
    const agg = await tx.pointsLedger.aggregate({ where: { userId: opts.userId }, _sum: { delta: true } });
    return agg._sum.delta ?? 0;
  });
}

// ── موجودی امتیاز کاربر ──
export async function getPointsBalance(userId: string): Promise<number> {
  const agg = await db.pointsLedger.aggregate({ where: { userId }, _sum: { delta: true } });
  return agg._sum.delta ?? 0;
}

// ── تاریخچه‌ی امتیاز ──
export async function getPointsHistory(userId: string, limit = 50) {
  return db.pointsLedger.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
}

// ── امتیازِ باشگاهِ یک رستوران ──
//
// ⚠️ رفعِ P1-6 (فازِ ۲، پروتکل §۱۳ — «دفترِ امتیاز تنها مرجعِ سروری»).
//
// باگ: تنها جایی که امتیازِ باشگاه داده می‌شد (markArrival) مستقیماً
// `club_members.points` را increment می‌کرد و **هیچ ردیفی در دفتر نمی‌ساخت**.
// نتیجه دو عدد بود که هیچ‌وقت با هم نمی‌خواندند: SMSِ خوش‌آمد عددِ ستونی را
// می‌گفت، در حالی که هم اپِ مشتری (getPointsBalance) و هم فهرستِ اعضایِ پنل از
// دفتر می‌خواندند — یعنی آن ۵۰ امتیاز برایِ خودِ مشتری نامرئی بود و هیچ رکوردِ
// حسابرسی‌پذیری (چرا، کِی، بابتِ کدام رزرو) نداشت.
//
// از این‌جا به بعد: **دفتر مرجع است**، و `club_members.points` فقط یک کشِ
// مشتق‌شده است که در *همان تراکنش* به‌روز می‌شود تا از دفتر واگرا نشود.
// هیچ مسیرِ خواندنی دیگر به آن ستون تکیه نمی‌کند.
export async function addClubPoints(opts: {
  userId: string; restaurantId: string; delta: number; reason: string; note?: string;
  // فازِ ۱ (§۱۳) — رجوع کن به توضیحِ همین پارامتر در addPoints بالا.
  idempotencyKey?: string;
}): Promise<number> {
  return db.$transaction(async (tx) => {
    await tx.pointsLedger.create({
      data: {
        userId: opts.userId, restaurantId: opts.restaurantId,
        delta: opts.delta, reason: opts.reason as any, note: opts.note ?? null,
        idempotencyKey: opts.idempotencyKey ?? null,
      },
    });
    const agg = await tx.pointsLedger.aggregate({
      where: { userId: opts.userId, restaurantId: opts.restaurantId },
      _sum: { delta: true },
    });
    const balance = agg._sum.delta ?? 0;
    // کشِ مشتق‌شده — نه مرجع. اگر عضویتی وجود نداشته باشد updateMany صفر ردیف
    // می‌زند و این درست است: دفتر همچنان رکوردِ حقیقت را دارد.
    //
    // ⚠️ رفعِ «سطحِ باشگاه هرگز به‌روز نمی‌شود» (فازِ ۲):
    // `club_members.tier` با `@default("bronze")` ساخته می‌شد و **هیچ کدی در
    // کلِ src/ آن را نمی‌نوشت** — یعنی عضوی با ۲۰۰۰ امتیازِ واقعی در دفتر هم
    // برای همیشه `bronze` می‌ماند. این فقط یک برچسبِ نمایشی نبود:
    //  • `waitlist.ts` (tierToPriority/isVipTier) اولویتِ صف را از همین ستون
    //    می‌خواند ⇒ اولویتِ طلایی/پلاتینیوم عملاً وجود نداشت.
    //  • `restaurant/sms` سگمنتِ کمپین را از همین ستون فیلتر می‌کند ⇒ سگمنتِ
    //    gold/silver همیشه خالی بود.
    //  • توکنِ سطح در پیامکِ خوش‌آمد همیشه «bronze» می‌گفت.
    // سطح از **همان موجودیِ دفتر** مشتق می‌شود (نه از ستونِ کش) و با همان
    // `tierFromPoints()` که مسیرِ نمایشِ مشتری استفاده می‌کند — یک تعریف، نه دو.
    //
    // نکته‌ی صداقت درباره‌ی همزمانی: `points` عمداً `increment` می‌ماند (اتمیک،
    // بدونِ lost-update)، ولی `tier` از aggregateِ داخلِ همین تراکنش می‌آید و
    // اگر دقیقاً هم‌زمان یک grantِ دیگر commit نشده باشد می‌تواند یک پله عقب
    // بماند — که با اولین grantِ بعدی خودش را اصلاح می‌کند. دفتر همچنان مرجع است.
    await tx.clubMember.updateMany({
      where: { restaurantId: opts.restaurantId, userId: opts.userId },
      data: { points: { increment: opts.delta }, tier: tierFromPoints(balance).key },
    });
    return balance;
  });
}

// ── موجودیِ امتیازِ کاربر در باشگاهِ یک رستوران ──
// از دفتر خوانده می‌شود، نه از ستونِ کش. تفاوتش با getPointsBalance اسکوپ است:
// آن‌یکی کلِ پلتفرم را جمع می‌زند، این‌یکی فقط همان رستوران را.
export async function getClubPointsBalance(userId: string, restaurantId: string): Promise<number> {
  return getPointsBalanceInScope(userId, restaurantId);
}

/**
 * موجودیِ امتیاز در یک **اسکوپِ پرداخت‌کننده**.
 *
 * `restaurantId = null` عمداً به‌معنایِ «کیفِ پلتفرم» است، نه «همه‌جا»:
 * اعطاهایِ پلتفرمی (ثبت‌نام، دعوت، تولد، سالگرد) با `restaurantId = null`
 * نوشته می‌شوند (`loyalty.ts` — createReferral/birthday/anniversary) و
 * اعطاهایِ رستوران با شناسه‌ی همان رستوران. این تابع همان تفکیک را برایِ
 * خواندن هم قائل می‌شود.
 */
export async function getPointsBalanceInScope(userId: string, restaurantId: string | null): Promise<number> {
  const agg = await db.pointsLedger.aggregate({
    where: { userId, restaurantId }, _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════
//  خرجِ امتیاز (بازخرید) — `reason: 'redemption'`
//
//  تا امروز `PointsReason.redemption` در کلِ `api/src` **صفر بار** نوشته
//  می‌شد و هیچ نرخِ امتیاز→تومانی وجود نداشت؛ یعنی دفتر یک شمارنده‌ی
//  یک‌طرفه بود. این تابع تنها راهِ خرج است.
//
//  ── چرا اسکوپ‌دار و نه یک کیفِ سراسری ────────────────────────────────
//  قاعده‌ی ۵ («پاداشِ پلتفرمی را پلتفرم می‌پردازد؛ رستوران هرگز بدهکار
//  نمی‌شود») امروز اجراناپذیر است چون `points_ledger` **ستونِ پرداخت‌کننده
//  ندارد** — `restaurant_id` فقط نشانگرِ اسکوپ است. تا وقتی آن ستون نیامده،
//  تنها تفکیکِ صادقانه‌ای که در دست داریم همین `restaurant_id` است. پس:
//  بازخرید همیشه **داخلِ یک اسکوپ** انجام می‌شود و موجودیِ همان اسکوپ را
//  می‌سنجد. نتیجه‌ی ثابت: هیچ اسکوپی منفی نمی‌شود ⇒ نه رستورانی بدهکارِ
//  امتیازِ تولدِ پلتفرم می‌شود، نه پلتفرم بدهکارِ کش‌بکِ رستوران.
//  (مجموعِ سراسری = جمعِ اسکوپ‌ها، پس آن هم منفی نمی‌شود.)
//  ⚠️ پیامدِ محصولی که باید به مالک گفته شود: صفحه‌ی مشتری امروز **جمعِ
//  سراسری** را نشان می‌دهد (`getPointsBalance`) و آن عدد در یک رستوران
//  کاملاً خرج‌شدنی نیست. رجوع کن به گزارش.
//
//  ── چرا قفلِ ردیفِ کاربر، و چرا الگویِ rewards.ts عیناً منتقل نمی‌شود ──
//  `rewards.ts:158-163` شرطِ موجودی را داخلِ خودِ UPDATE می‌گذارد
//  (`WHERE … AND wallet_balance >= cost`) و این **کافی** است چون موجودی
//  یک **ستون رویِ یک ردیف** است: Postgres در READ COMMITTED پشتِ قفلِ همان
//  ردیف صبر می‌کند و شرط را رویِ نسخه‌ی تازه دوباره می‌سنجد.
//
//  اینجا موجودی یک **aggregate رویِ جدولِ append-only** است و هیچ ردیفی
//  برایِ قفل‌شدن وجود ندارد. دو بازخریدِ هم‌زمان هرکدام snapshotی می‌بینند
//  که ردیفِ commit‌نشده‌ی دیگری در آن نیست، هر دو شرط را رد می‌کنند و هر دو
//  می‌نویسند ⇒ موجودی منفی. پس شرطِ داخلِ INSERT لازم است ولی **کافی
//  نیست**؛ یک نقطه‌ی سریال‌سازی هم می‌خواهد. الگویِ موجودِ همین مخزن برایِ
//  همین کلاس مسئله: `SELECT … FOR UPDATE` (کارتِ هدیه در همین فایل،
//  `economy.ts:236`). ردیفِ `users` قفل می‌شود چون طبیعی‌ترین لنگرِ «کیفِ
//  این کاربر» است و O(۱) است (قفلِ همه‌ی ردیف‌های دفترِ کاربر با تعدادِ
//  تراکنش‌ها رشد می‌کند).
//
//  هر دو لایه اثباتِ falsifiability دارند و هرکدام جدا قرمز می‌شوند —
//  رجوع کن به tests/points-redemption.integration.test.mts.
// ═══════════════════════════════════════════════════════════════════════

export interface RedeemPointsResult {
  pointsSpent: number;
  /** ارزشِ تومانیِ خرج‌شده، با نرخِ کانونی. */
  tomanValue: number;
  /** موجودیِ همان اسکوپ پس از خرج. */
  balanceAfter: number;
  /** true یعنی همین کلید قبلاً اعمال شده بود و این فراخوانی چیزی کم نکرد. */
  alreadyApplied: boolean;
}

/**
 * نسخه‌ی tx-aware — برایِ فراخوانی داخلِ تراکنشی که خودِ تخفیف/جایزه را هم
 * می‌نویسد (همان الگویِ `redeemGiftCardTx`). تنها هسته‌ی خرجِ امتیاز.
 *
 * ⚠️ گاردِ فلگ **اینجا** است، نه فقط در روت. بقیه‌ی فلگ‌های این مخزن در
 * لایه‌ی route اجرا می‌شوند؛ برایِ این یکی عمداً پایین‌تر آمد، چون این تنها
 * مسیری است که موجودیِ واقعیِ مشتری را خرج می‌کند و امروز اصلاً route ندارد
 * — پس گاردِ سطحِ route جایی برای نشستن نداشت و «فراموش‌کردنِ گارد در
 * اولین routeِ آینده» تنها چیزی بود که بینِ تولید و پولِ رایگان می‌ایستاد.
 */
/**
 * گاردِ زمانِ اجرا: این تابع واقعاً داخلِ یک تراکنشِ تعاملی است؟
 *
 * چرا لازم است و چرا تایپ کافی نبود — **اندازه‌گیری‌شده، نه استدلال‌شده**:
 * `redeemPointsTx(db, opts)` به‌جای عبور از `$transaction`، زیرِ امضای
 * `Prisma.TransactionClient` **بدونِ خطا type-check می‌شود** (`tsc` exit 0)،
 * چون `PrismaClient` از نظرِ ساختاری آن اینترفیس را ارضا می‌کند. یعنی رفعِ
 * صرفاً تایپی برای این حالت تزئینی بود.
 *
 * تشخیص بر پایه‌ی یک تفاوتِ قطعیِ Prisma است، نه heuristic: کلاینتِ تراکنش
 * `$transaction` را **ندارد** (در `ITXClientDenyList` است)؛ کلاینتِ کامل دارد.
 *
 * چرا این‌جا مهم است: کلِ ایمنیِ بازخرید به قفلِ `FOR UPDATE` بند است که فقط
 * تا پایانِ **تراکنش** نگه داشته می‌شود. با کلاینتِ ساده، قفل در پایانِ همان
 * statement آزاد می‌شود و دو بازخریدِ هم‌زمان هر دو از شرط رد می‌شوند —
 * یعنی خرجِ دوباره‌ی همان موجودی.
 */
function assertInsideTransaction(tx: Prisma.TransactionClient, fn: string): void {
  if ('$transaction' in tx) {
    throw new Error(
      `${fn} باید داخلِ db.$transaction صدا زده شود؛ کلاینتِ کاملِ Prisma پاس داده شده. `
      + 'قفلِ FOR UPDATE بیرونِ تراکنش در پایانِ statement آزاد می‌شود و خرجِ دوباره ممکن می‌شود.',
    );
  }
}

// ⚠️ `Prisma.TransactionClient` و نه `any` — یافته‌ی بازبین (`rezv-e6`، دستورِ
// ۰۴۳)، و شدتش دقیقاً همان‌جایی است که خودش گذاشت: کوچک، نه بلاکر.
//
// ⚠️⚠️ **ولی تایپ به‌تنهایی این اشتباه را نمی‌گیرد، و این با اجرا معلوم شد نه
// با خواندن.** جهشِ ثبت‌شده: `redeemPointsTx(db, opts)` به‌جای عبور از
// `$transaction` — `tsc` **exit 0** داد. علتش ساختاری است: `PrismaClient`
// همه‌ی delegateهای مدل را دارد، پس `Prisma.TransactionClient` را ارضا
// می‌کند. یعنی رفعِ صرفاً تایپی برای همان حالتی که توصیف شده بود **تزئینی**
// بود — تایپ ارزشِ مستندسازی دارد و تایپ‌های واقعاً بی‌ربط را رد می‌کند، ولی
// نه این یکی را.
//
// پس گاردِ واقعی در زمانِ اجراست، و بر پایه‌ی یک تفاوتِ ساختاریِ قطعی:
// کلاینتِ تراکنش `$transaction` **ندارد** (در `ITXClientDenyList` است) و
// کلاینتِ کامل دارد. همان چیزی که تایپ نمی‌بیند، این یک خط می‌بیند.
//
// **کلِ استدلالِ ایمنیِ این تابع به این بند است که `tx` یک تراکنشِ تعاملی
// باشد.** با `any`، اگر روزی کسی کلاینتِ ساده‌ی `db` را پاس بدهد،
// `FOR UPDATE` در پایانِ همان statement آزاد می‌شود و دو بازخریدِ هم‌زمان
// می‌توانند هر دو از شرطِ `WHERE` رد شوند. امروز تنها ورودی `redeemPoints`
// است که درست wrap می‌کند و تستِ همزمانی هم همان مسیر را می‌سنجد — پس این
// یک نقصِ زنده نیست، **درِ بازی است برای اشتباهِ آینده**. `any` همان چیزی
// است که آن اشتباه را ممکن می‌کند.
export async function redeemPointsTx(tx: Prisma.TransactionClient, opts: {
  userId: string;
  /** اسکوپِ خرج: شناسه‌ی رستوران، یا null برایِ کیفِ پلتفرم. */
  restaurantId: string | null;
  points: number;
  /** اجباری — بدونِ آن قیدِ یکتاییِ دفتر برایِ این نویسنده بی‌اثر است. */
  idempotencyKey: string;
  note?: string;
}): Promise<RedeemPointsResult> {
  const { userId, restaurantId, points, idempotencyKey } = opts;

  assertInsideTransaction(tx, 'redeemPointsTx');

  if (!(await isFeatureEnabled('points_redemption_enabled'))) {
    throw Err.featureDisabled(featureFlagLabel('points_redemption_enabled'));
  }
  if (!Number.isInteger(points) || points <= 0) {
    throw Err.validation('امتیازِ خرج‌شده باید عددِ صحیحِ مثبت باشد');
  }
  if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
    throw Err.validation('کلیدِ idempotency برایِ بازخرید اجباری است');
  }

  // ── (۱) نقطه‌ی سریال‌سازی: قفلِ ردیفِ کاربر تا پایانِ تراکنش ──
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE
  `;
  if (locked.length === 0) throw Err.notFound('کاربر');

  // ── (۲) idempotency: زیرِ همان قفل، پس هیچ رقابتی ممکن نیست ──
  // چرا پیش‌بررسی و نه اتکا به خطای قید: در Postgres یک نقضِ unique کلِ
  // تراکنش را abort می‌کند، پس «catch کن و ردیفِ قبلی را برگردان» بدونِ
  // savepoint شدنی نیست. قید همچنان پشتوانه‌ی ساختاری است (اگر این
  // پیش‌بررسی حذف شود، فراخوانیِ دوم P2002 می‌گیرد — نه کسرِ دوباره).
  const existing = await tx.$queryRaw<{ delta: number; user_id: string; restaurant_id: string | null; reason: string }[]>`
    SELECT delta, user_id, restaurant_id, reason::text AS reason
    FROM points_ledger WHERE idempotency_key = ${idempotencyKey}
  `;
  if (existing.length > 0) {
    // ⚠️ «همان کلید» فقط وقتی «همان بازخرید» است که کاربر، اسکوپ و نوعش هم
    // یکی باشد. کلیدها را صداکننده می‌سازد؛ اگر کسی یک کلید را برای دو
    // کاربر/دو اسکوپ به‌کار ببرد، برگرداندنِ «قبلاً انجام شد» یعنی یک خرجِ
    // واقعی بی‌صدا ناپدید شود. این‌جا بلند می‌شکند، نه بی‌صدا.
    const e = existing[0];
    if (e.user_id !== userId || (e.restaurant_id ?? null) !== restaurantId || e.reason !== 'redemption') {
      throw Err.validation('کلیدِ idempotency قبلاً برای یک ردیفِ دیگر استفاده شده است');
    }
    const spent = Math.abs(e.delta);
    const balAgg = await tx.$queryRaw<{ bal: bigint | number }[]>`
      SELECT COALESCE(SUM(delta), 0) AS bal FROM points_ledger
      WHERE user_id = ${userId}::uuid AND restaurant_id IS NOT DISTINCT FROM ${restaurantId}::uuid
    `;
    return {
      pointsSpent: spent, tomanValue: pointsToToman(spent),
      balanceAfter: Number(balAgg[0]?.bal ?? 0), alreadyApplied: true,
    };
  }

  // ── (۳) درج با شرطِ موجودی **داخلِ خودِ همان دستور** ──
  // نه SELECT جدا و بعد INSERT: یک دستور، یک مقایسه، یک نوشتن.
  const inserted = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO points_ledger (user_id, restaurant_id, delta, reason, note, idempotency_key)
    SELECT ${userId}::uuid, ${restaurantId}::uuid, ${-points}::int, 'redemption'::points_reason,
           ${opts.note ?? null}::text, ${idempotencyKey}::text
    WHERE (
      SELECT COALESCE(SUM(delta), 0) FROM points_ledger
      WHERE user_id = ${userId}::uuid AND restaurant_id IS NOT DISTINCT FROM ${restaurantId}::uuid
    ) >= ${points}
    RETURNING id
  `;
  if (inserted.length === 0) throw Err.validation('موجودیِ امتیازِ شما کافی نیست');

  const after = await tx.$queryRaw<{ bal: bigint | number }[]>`
    SELECT COALESCE(SUM(delta), 0) AS bal FROM points_ledger
    WHERE user_id = ${userId}::uuid AND restaurant_id IS NOT DISTINCT FROM ${restaurantId}::uuid
  `;

  // کشِ مشتق‌شده‌ی `club_members` باید با دفتر هم‌قدم بماند (همان قاعده‌ی
  // addClubPoints: دفتر مرجع است، ستون فقط کش). اسکوپِ پلتفرم عضویتی ندارد.
  //
  // ⚠️ یافته‌ی همین کار، با تستِ واقعی و نه با خواندنِ schema: جدولِ
  // `club_members` یک قیدِ `CHECK (points >= 0)` به‌نامِ
  // `club_members_points_nonneg` دارد که **در `schema.prisma` بیان نشده**
  // (Prisma قیدِ CHECK را بیان نمی‌کند) — یعنی کش، برخلافِ خودِ دفتر،
  // **نمی‌تواند بدهی را نمایش دهد**. کسرِ خام اولین بار که موجودی منفی شد
  // با ۲۳۵۱۴ کلِ تراکنش را برگرداند.
  //
  // پس `GREATEST(0, …)`: کش تا جایی که قیدش اجازه می‌دهد با دفتر هم‌قدم
  // می‌ماند و در بدهی روی صفر می‌ایستد. این واگرایی **عمدی و ثبت‌شده** است،
  // نه بی‌دقتی: مرجع دفتر است (قاعده‌ی ۴) و هیچ مسیرِ خواندنی به این ستون
  // تکیه نمی‌کند. راهِ حلِ جایگزین (برداشتنِ قید) عمداً انتخاب نشد — این
  // تغییر نباید قیدی را که کسِ دیگری گذاشته بی‌سروصدا بردارد؛ اگر مالک
  // بخواهد کش هم بدهی را نشان دهد، آن یک migrationِ جداست.
  //
  // چرا SQLِ خام و نه `decrement`: `GREATEST` را Prisma بیان نمی‌کند، و
  // خواندن-سپس-نوشتنِ یک عددِ مطلق اتمیک نیست.
  if (restaurantId) {
    const balance = Number(after[0]?.bal ?? 0);
    await tx.$executeRaw`
      UPDATE club_members
      SET points = GREATEST(0, points - ${points}::int), tier = ${tierFromPoints(balance).key}::text
      WHERE restaurant_id = ${restaurantId}::uuid AND user_id = ${userId}::uuid
    `;
  }

  return {
    pointsSpent: points, tomanValue: pointsToToman(points),
    balanceAfter: Number(after[0]?.bal ?? 0), alreadyApplied: false,
  };
}

/** بازخریدِ امتیاز در تراکنشِ خودش. */
export async function redeemPoints(opts: {
  userId: string; restaurantId: string | null; points: number;
  idempotencyKey: string; note?: string;
}): Promise<RedeemPointsResult> {
  return db.$transaction(async (tx) => redeemPointsTx(tx, opts));
}

// ═══════════════════════════════════════════════════════════════════════
//  بازگردانیِ کش‌بک (clawback) — گاردی که بازخرید بدونِ آن نباید روشن شود
//
//  یافته‌ی سندِ طراحی (§۶.۱-B): کش‌بک در **لحظه‌ی ثبتِ رزرو** نوشته می‌شود
//  (`reservations.ts` داخلِ تراکنشِ ساختِ رزرو) و هیچ‌جا برنمی‌گردد —
//  `lifecycle.ts` امتیازِ حضور و XP می‌دهد ولی کش‌بک را لمس نمی‌کند و هیچ
//  ردیفِ جبرانیِ منفی در کلِ مخزن وجود ندارد. تا امروز بی‌ضرر بود چون
//  امتیاز خرج‌شدنی نبود. **با آمدنِ بازخرید این می‌شود پولِ رایگان:**
//  رزروِ بزرگ بزن، کش‌بک بگیر، خرج کن، لغو کن.
//
//  پس این تابع با همان تغییر شیپ می‌شود، نه بعد از آن.
//
//  کلیدِ idempotency جداگانه دارد (`cashback-reversal:{id}`) تا لغوِ دوباره
//  دوبار کسر نکند — همان قیدِ یکتاییِ دفتر، این‌بار رویِ ردیفِ جبرانی.
//
//  ⚠️ سه انتخابِ صریح که ثبت می‌شوند، نه پنهان:
//   • **مقدار از خودِ ردیفِ اصلی خوانده می‌شود** (کلیدِ `cashback:{id}`)، نه
//     بازمحاسبه از صورت‌حساب: اگر درصدِ رستوران بعد از رزرو عوض شود،
//     بازمحاسبه عددِ دیگری می‌دهد و اختلافش برایِ همیشه در دفتر می‌ماند.
//     نبودِ ردیفِ اصلی یعنی چیزی برای برگرداندن نیست (بی‌سروصدا، درست).
//   • **بدونِ شرطِ موجودی**: اگر مشتری کش‌بک را قبلِ لغو خرج کرده باشد،
//     اسکوپ منفی می‌شود — و این حسابداریِ درست است (بدهی)، نه خطا. شرطِ
//     موجودی اینجا یعنی نشتِ ارزش. موجودیِ منفی جلوی خرجِ بعدی را می‌گیرد
//     چون گاردِ بازخرید `>= points` است.
//   • **بی‌توجه به وضعیتِ مبدأ**: اگر رزروی بعد از نشستنِ مهمان لغو شود،
//     کش‌بکش هم برمی‌گردد. یک قاعده، نه دو. (امتیازِ حضور برنمی‌گردد —
//     آن بابتِ حضورِ واقعی است. ناهماهنگیِ ظاهری عمدی و ثبت‌شده است.)
// ═══════════════════════════════════════════════════════════════════════

/** پیشوندِ کلیدِ ردیفِ اصلیِ کش‌بک — همان که `reservations.ts` می‌نویسد. */
export const CASHBACK_KEY_PREFIX = 'cashback:';
/** پیشوندِ کلیدِ ردیفِ جبرانی. */
export const CASHBACK_REVERSAL_KEY_PREFIX = 'cashback-reversal:';

export async function reverseReservationCashback(reservationId: string): Promise<{
  reversed: boolean; points: number; reason: 'reversed' | 'no_cashback' | 'already_reversed';
}> {
  return db.$transaction(async (tx) => {
    const original = await tx.pointsLedger.findUnique({
      where: { idempotencyKey: `${CASHBACK_KEY_PREFIX}${reservationId}` },
    });
    if (!original) return { reversed: false, points: 0, reason: 'no_cashback' as const };

    const reversalKey = `${CASHBACK_REVERSAL_KEY_PREFIX}${reservationId}`;
    const already = await tx.pointsLedger.findUnique({ where: { idempotencyKey: reversalKey } });
    if (already) return { reversed: false, points: Math.abs(already.delta), reason: 'already_reversed' as const };

    await tx.pointsLedger.create({
      data: {
        userId: original.userId, restaurantId: original.restaurantId,
        // reason عمداً همان 'cashback' است و نه 'adjustment': ردیفِ جبرانی
        // باید در **همان سطلِ حسابداری** بنشیند تا
        // `SUM(delta) WHERE reason='cashback'` عددِ واقعیِ کش‌بکِ پرداخت‌شده
        // را بدهد. با 'adjustment' آن جمع برایِ همیشه بیش‌برآورد می‌ماند.
        delta: -original.delta, reason: 'cashback',
        note: `بازگردانیِ کش‌بکِ رزروِ لغو/عدم‌حضور`,
        idempotencyKey: reversalKey,
      },
    });

    if (original.restaurantId) {
      const agg = await tx.pointsLedger.aggregate({
        where: { userId: original.userId, restaurantId: original.restaurantId },
        _sum: { delta: true },
      });
      // GREATEST — به همان دلیلِ توضیح‌داده‌شده در redeemPointsTx: کشِ
      // `club_members.points` قیدِ `CHECK (points >= 0)` دارد و نمی‌تواند
      // بدهی را نمایش دهد، در حالی که دفتر می‌تواند.
      await tx.$executeRaw`
        UPDATE club_members
        SET points = GREATEST(0, points - ${original.delta}::int),
            tier = ${tierFromPoints(agg._sum.delta ?? 0).key}::text
        WHERE restaurant_id = ${original.restaurantId}::uuid AND user_id = ${original.userId}::uuid
      `;
    }

    return { reversed: true, points: original.delta, reason: 'reversed' as const };
  });
}

// ═══════════ دعوت دوستان (Referral) ═══════════

// کد دعوت یکتای کاربر را بساز یا برگردان
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
  if (u?.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = genCode('REF', 6);
    try {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch (e) { if (i === 4) throw e; }
  }
  throw Err.validation('ساخت کد دعوت ناموفق بود');
}

// ثبت دعوت (کاربر دوستش را با شماره دعوت می‌کند)
export async function createReferral(referrerId: string, inviteePhone: string) {
  const existing = await db.referral.findFirst({
    where: { referrerId, inviteePhone, status: { in: ['pending', 'completed'] } },
  });
  if (existing) throw Err.validation('این شماره را قبلاً دعوت کرده‌اید');
  const ref = await db.referral.create({
    data: { referrerId, inviteePhone, rewardPoints: POINTS.referralReward },
  });
  // پیامک دعوت
  const referrer = await db.user.findUnique({ where: { id: referrerId }, select: { firstName: true, referralCode: true } });
  // ── رضایت (§۱۳/§۱۷) — دسته‌ی `offers` ─────────────────────────────────
  // این پیامک به شماره‌ی یک **شخصِ ثالث** می‌رود که خودش هیچ کنشی نکرده؛
  // یعنی از دیدِ گیرنده یک پیامِ اکتسابِ مشتری است، نه یک رسید. پس در
  // سخت‌گیرانه‌ترین سطلِ رضایت (`MARKETING_CATEGORIES`) قرار می‌گیرد.
  // معمولاً دعوت‌شده اصلاً حساب ندارد ⇒ ترجیحی وجود ندارد ⇒ پیام می‌رود؛
  // گارد فقط وقتی می‌گزد که گیرنده کاربرِ ثبت‌نام‌شده‌ای باشد که صریحاً
  // انصراف داده — دقیقاً همان حالتی که باید محترم شمرده شود.
  const invitee = await findUserByPhoneForConsent(inviteePhone);
  if (smsAllowedForCategory(invitee?.notificationPrefs, 'offers', {
    site: 'loyalty.referral_invite', template: 'campaign', userId: invitee?.id ?? null,
  })) {
    await enqueueSms({
      to: inviteePhone, template: 'campaign',
      tokens: [referrer?.firstName ?? 'دوست شما', referrer?.referralCode ?? ''],
    }).catch(() => {});
  }
  return { id: ref.id, status: ref.status, reward_points: ref.rewardPoints };
}

// تکمیل دعوت (وقتی دعوت‌شده ثبت‌نام و اولین رزرو را کرد → پاداش به دعوت‌کننده)
export async function completeReferral(inviteePhone: string, inviteeId: string) {
  const ref = await db.referral.findFirst({
    where: { inviteePhone, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  if (!ref) return null;
  // NEW-H2: claim اتمیک — فقط اگر هنوز pending است update می‌شود. اگر صفر ردیف
  // (یعنی یک درخواست همزمان زودتر claim کرده)، پاداش داده نمی‌شود (ضد double-reward).
  const claimed = await db.referral.updateMany({
    where: { id: ref.id, status: 'pending' },
    data: { status: 'rewarded', inviteeId, completedAt: new Date() },
  });
  if (claimed.count === 0) return null; // کس دیگری زودتر claim کرد
  // پاداش فقط پس از claim موفق
  //
  // ⚠️ کلیدِ idempotency روی خودِ ردیفِ referral (نه شماره‌ی دعوت‌شده): آن claim
  // اتمیکِ بالا از قبل تضمین می‌کند این بلوک برای یک referral فقط یک‌بار اجرا
  // می‌شود؛ کلید این‌جا لایه‌ی دومِ ساختاری (DB) روی همان تضمین است، دقیقاً
  // هم‌خانواده‌ی الگویِ checked_in در lifecycle.ts.
  await addPoints({
    userId: ref.referrerId, delta: ref.rewardPoints, reason: 'referral',
    note: `دعوت موفق ${inviteePhone}`,
    idempotencyKey: `referral:${ref.id}`,
  });
  return { rewarded: true, referrer_id: ref.referrerId, points: ref.rewardPoints };
}

// آمار دعوت‌های کاربر
export async function getReferralStats(userId: string) {
  const all = await db.referral.findMany({ where: { referrerId: userId } });
  const code = await getOrCreateReferralCode(userId);
  return {
    code,
    total_invited: all.length,
    completed: all.filter(r => r.status === 'rewarded').length,
    pending: all.filter(r => r.status === 'pending').length,
    points_earned: all.filter(r => r.status === 'rewarded').reduce((s, r) => s + r.rewardPoints, 0),
  };
}

// ═══════════ کارت هدیه (Gift Card) ═══════════

export async function createGiftCard(opts: {
  buyerId?: string; restaurantId?: string; amountToman: number;
  recipientName?: string; recipientPhone?: string; message?: string;
}) {
  if (!Number.isInteger(opts.amountToman) || opts.amountToman < 50_000) {
    throw Err.validation('مبلغ کارت هدیه باید حداقل ۵۰٬۰۰۰ تومان باشد');
  }
  let code = '';
  for (let i = 0; i < 5; i++) {
    code = genCode('GIFT', 10);
    const dup = await db.giftCard.findUnique({ where: { code } });
    if (!dup) break;
    if (i === 4) throw Err.validation('ساخت کد ناموفق بود');
  }
  const expiresAt = new Date(Date.now() + 365 * 86_400_000); // یک سال اعتبار
  const card = await db.giftCard.create({
    data: {
      code, buyerId: opts.buyerId ?? null, restaurantId: opts.restaurantId ?? null,
      amountToman: opts.amountToman, balanceToman: opts.amountToman,
      recipientName: opts.recipientName ?? null, recipientPhone: opts.recipientPhone ?? null,
      message: opts.message ?? null, expiresAt,
    },
  });
  // پیامک به گیرنده
  // ⚠️ عمداً **بدونِ گاردِ رضایت** (§۱۳/§۱۷): این پیام تحویلِ یک ارزشِ پولیِ
  // واقعیِ خرج‌شدنی است که به نامِ خودِ گیرنده صادر شده و کدش تنها راهِ
  // استفاده از آن است. خاموش‌کردنش یعنی گیرنده هرگز نفهمد پولی برایش خریده
  // شده — این «رعایتِ رضایت» نیست، گم‌کردنِ دارایی است.
  if (opts.recipientPhone) {
    await enqueueSms({ to: opts.recipientPhone, template: 'campaign', tokens: [opts.recipientName ?? 'دوست عزیز', code] }).catch(() => {});
  }
  return { code: card.code, amount_toman: card.amountToman, expires_at: card.expiresAt };
}

// M10: نرمال‌سازی یکسان کد کارت هدیه — کدها همیشه Base32 بزرگ ذخیره می‌شوند،
// پس ورودی هم باید uppercase+trim شود تا check و redeem هر دو یکسان رفتار کنند
// (قبلاً redeem uppercase می‌کرد ولی check نه → «کارت پیدا نشد» ناسازگار).
function normalizeGiftCode(code: string): string {
  return String(code || '').trim().toUpperCase();
}

// بررسی موجودی کارت هدیه
export async function checkGiftCard(code: string) {
  const card = await db.giftCard.findUnique({ where: { code: normalizeGiftCode(code) } });
  if (!card) throw Err.notFound('کارت هدیه');
  const valid = card.status === 'active' && (!card.expiresAt || card.expiresAt > new Date());
  return {
    code: card.code, amount_toman: card.amountToman, balance_toman: card.balanceToman,
    status: card.status, valid, expires_at: card.expiresAt,
  };
}

// استفاده از کارت هدیه (کسر مبلغ)
// ⚠️ امنیت همزمانی: این تابع read-modify-write است. بدون قفل، دو استفاده‌ی همزمان
// از یک کارت می‌توانند هر دو موجودی را بخوانند و دوبار خرج کنند (double-spend).
// راه‌حل: SELECT ... FOR UPDATE که ردیف کارت را تا پایان تراکنش قفل می‌کند، پس
// استفاده‌ی همزمان دوم تا commit اولی منتظر می‌ماند و سپس موجودی به‌روز را می‌بیند.
// تأییدشده روی PostgreSQL واقعی.
export async function redeemGiftCard(code: string, amountToman: number) {
  // NEW-C1: مبلغ باید مثبت و صحیح باشد — وگرنه مبلغ منفی موجودی را افزایش می‌داد (ساخت پول)
  if (!Number.isInteger(amountToman) || amountToman <= 0) {
    throw Err.validation('مبلغ استفاده باید عددی مثبت باشد');
  }
  return db.$transaction(async (tx) => {
    return redeemGiftCardTx(tx, code, amountToman);
  });
}

/**
 * نسخه‌ی tx-aware کارت هدیه (برای فراخوانی داخل تراکنش رزرو). با قفل FOR UPDATE.
 *
 * ⚠️ رفعِ نشتِ ارزش بینِ رستوران‌ها (فازِ ۲، پروتکل §۷): این تابع کارت را فقط با
 * `code` پیدا می‌کرد و `GiftCard.restaurantId` را **هرگز** با رستورانِ صورت‌حساب
 * مقایسه نمی‌کرد — در حالی که اسکیما عمداً آن ستون را دارد و هم مسیرِ خرید و هم
 * `lib/rewards.ts` مقداردهی‌اش می‌کنند. نتیجه: کارتی که به نامِ رستورانِ A صادر و
 * تأمینِ مالی شده بود، صورت‌حسابِ رستورانِ B را تخفیف می‌داد — یعنی جابه‌جاییِ
 * ارزشِ واقعی بینِ تنانت‌ها.
 *
 * `restaurantId = null` عمداً به‌معنایِ «همه‌جا معتبر» باقی می‌ماند، پس هیچ
 * کارتِ صادرشده‌ای باطل نمی‌شود (تغییر کاملاً افزایشی است).
 * منطقِ قفل/انقضا/موجودی دست‌نخورده است — فقط یک شرطِ دامنه اضافه شده.
 */
// ⚠️ همان تغییر، از روی قاعده‌ی خودِ بازبین: «کلاس را رفع کن، نه نمونه را».
// یافته‌ی ۰۴۳ فقط `redeemPointsTx` را نام برد؛ این تابع همان شکل را داشت و
// همان مسیرِ پول است (کارتِ هدیه). یافته‌ای که فقط روی نمونه‌ی نام‌برده اعمال
// شود، خواهرش را برای دورِ بعد جا می‌گذارد.
export async function redeemGiftCardTx(tx: Prisma.TransactionClient, code: string, amountToman: number, restaurantId?: string) {
  if (!Number.isInteger(amountToman) || amountToman <= 0) {
    throw Err.validation('مبلغ استفاده باید عددی مثبت باشد');
  }
  // قفل ردیف کارت (FOR UPDATE) — ضد double-spend همزمان
  const locked = await tx.$queryRaw<{ id: string; balance_toman: number; status: string; expires_at: Date | null; restaurant_id: string | null }[]>`
    SELECT id, balance_toman, status, expires_at, restaurant_id FROM gift_cards WHERE code = ${normalizeGiftCode(code)} FOR UPDATE
  `;
  const card = locked[0];
  if (!card) throw Err.notFound('کارت هدیه');
  // کارتِ مقیدشده به یک رستوران فقط همان‌جا خرج می‌شود.
  if (card.restaurant_id && restaurantId && card.restaurant_id !== restaurantId) {
    throw Err.validation('این کارت هدیه برای رستوران دیگری صادر شده است');
  }
  if (card.status !== 'active') throw Err.validation('کارت هدیه فعال نیست');
  if (card.expires_at && card.expires_at < new Date()) throw Err.validation('کارت هدیه منقضی شده است');
  if (amountToman > card.balance_toman) throw Err.validation('موجودی کارت کافی نیست');
  const newBalance = card.balance_toman - amountToman;
  await tx.giftCard.update({
    where: { id: card.id },
    data: { balanceToman: newBalance, status: newBalance === 0 ? 'redeemed' : 'active' },
  });
  return { applied: amountToman, remaining: newBalance };
}

/**
 * ماه و روزِ **شمسیِ** یک لحظه، به‌صورتِ عددِ ۱..۱۲ و ۱..۳۱.
 *
 * چرا لازم است: ستونِ users.birth_date در عمل «ماه/روزِ شمسی در قالبِ یک
 * تاریخِ میلادیِ ساختگی (سالِ ۱۹۹۰)» را نگه می‌دارد — رجوع کن به توضیحِ کاملِ
 * grantBirthdayRewards. برایِ مقایسه‌ی درست باید امروز را هم شمسی خواند.
 *
 * از `en-US-u-ca-persian` استفاده می‌شود (نه `fa-IR`) تا ارقام لاتین برگردند
 * و parse کردنشان به numberConversion نیاز نداشته باشد.
 */
export function jalaliMonthDayToday(d: Date): { mm: number; dd: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      timeZone: 'Asia/Tehran', month: 'numeric', day: 'numeric',
    }).formatToParts(d);
    const mm = Number(parts.find((p) => p.type === 'month')?.value);
    const dd = Number(parts.find((p) => p.type === 'day')?.value);
    if (Number.isInteger(mm) && Number.isInteger(dd) && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return { mm, dd };
    }
  } catch { /* محیطِ بدونِ تقویمِ persian — به میلادی برگرد (رفتارِ قبلی) */ }
  return { mm: d.getMonth() + 1, dd: d.getDate() };
}

// ═══════════ پاداش تولد و سالگرد ═══════════

// بررسی و اعطای پاداش تولد/سالگرد (توسط cron روزانه)
export async function grantBirthdayRewards(): Promise<{ birthday: number; anniversary: number }> {
  const today = new Date();

  // ⚠️ رفعِ باگِ «تولد در روزِ اشتباه» (فازِ ۲، پروتکل §۱۱).
  //
  // زنجیره‌ی واقعیِ داده (ردیابی‌شده، نه فرض):
  //  ۱. تنها فرمی که ماهِ تولد را می‌نویسد، واک‌ینِ پنلِ رستوران است
  //     (apps/business/js/reservations.js) و کشویی‌اش ماه‌هایِ **شمسی** را با
  //     value=1..12 می‌فرستد (فروردین=۱ … اسفند=۱۲).
  //  ۲. createWalkinTx آن را با `new Date(Date.UTC(1990, birthMonth - 1, birthDay))`
  //     ذخیره می‌کند — یعنی عددِ ماهِ **شمسی** را در جایگاهِ ماهِ **میلادی** می‌نشاند.
  //     پس ستون یک تاریخِ میلادیِ واقعی نیست؛ یک ظرفِ (ماهِ شمسی، روزِ شمسی) است.
  //  ۳. این تابع قبلاً `today.getMonth() + 1` (ماهِ **میلادیِ** امروز) را با همان
  //     ستون مقایسه می‌کرد — دو مقیاسِ متفاوت.
  //
  // نتیجه: مهمانِ متولدِ ۱ فروردین (شمسی) هدیه‌اش را اولِ **ژانویه** می‌گرفت،
  // حدودِ ۸۰ روز زودتر. هیچ‌کس متوجه نمی‌شد چون هدیه واقعاً ارسال می‌شد.
  //
  // رفع بدونِ تغییرِ اسکیما و بدونِ مهاجرتِ داده: امروز را هم با همان مقیاسی
  // بخوان که داده در آن ذخیره شده — یعنی ماه/روزِ **شمسیِ** امروز.
  // Intl با fa-IR خودش تقویمِ شمسی می‌دهد؛ نیازی به کتابخانه‌ی تبدیل نیست.
  const { mm, dd } = jalaliMonthDayToday(today);

  // کاربرانی که امروز تولدشان است — نام و تلفن را یک‌جا می‌گیریم (بدون N+1)
  // `notification_prefs` در همین SELECT می‌آید — گاردِ رضایتِ پایین نباید یک
  // کوئریِ اضافه به‌ازای هر کاربرِ متولدِ امروز بزند (N+1 در یک cronِ روزانه).
  const birthdayUsers = await db.$queryRaw<{ id: string; phone: string | null; first_name: string | null; notification_prefs: unknown }[]>`
    SELECT id, phone, first_name, notification_prefs FROM users
    WHERE birth_date IS NOT NULL
      AND EXTRACT(MONTH FROM birth_date) = ${mm}
      AND EXTRACT(DAY FROM birth_date) = ${dd}
  `;
  // PERF: چک dedup با findFirst حذف شد — ایندکس یکتای uniq_annual_reward خودش
  // پاداش دوگانه را قطعی جلوگیری می‌کند و catch روی P2002 مسابقه را مدیریت می‌کند.
  // پس به‌جای ۳ کوئری per user (dedup + addPoints + phone)، فقط addPoints می‌ماند.
  for (const u of birthdayUsers) {
    try {
      // کلیدِ idempotency این‌جا belt-and-suspenders است: dedupِ واقعی از
      // `uniq_annual_reward` (migration 013، همین سال/reason/کاربر) می‌آید؛
      // این کلید فقط همان محافظت را در ستونِ عمومیِ idempotency_key هم منعکس
      // می‌کند تا هیچ نویسنده‌ای بدونِ کلید نماند (تصمیمِ مالک ۲۰۲۶-۰۹-۰۹).
      await addPoints({
        userId: u.id, delta: POINTS.birthday, reason: 'birthday', note: 'هدیه‌ی تولد 🎂',
        idempotencyKey: `annual:${u.id}:birthday:${today.getFullYear()}`,
      });
      // ── رضایت (§۱۳/§۱۷) — دسته‌ی `loyalty` ─────────────────────────────
      // محتوایِ پیام «فلانی جان، N امتیازِ تولد گرفتی» است و برچسبِ همین کلید
      // در اپِ مشتری دقیقاً «امتیاز و پاداش — وقتی امتیازت به یه پاداش جدید
      // رسید» است. کلیدِ `offers` («تخفیف و کش‌بک ویژه») هیچ تخفیف/کش‌بکی در
      // این پیام ندارد که توصیفش کند.
      // ⚠️ امتیاز بالاتر از قبل ثبت شده و ثبتش **هرگز** به رضایت گره نمی‌خورد:
      // انصراف فقط جلویِ خبردادن را می‌گیرد، نه جلویِ خودِ پاداش را.
      if (u.phone && smsAllowedForCategory(u.notification_prefs, 'loyalty', {
        site: 'loyalty.birthday_points', template: 'campaign', userId: u.id,
      })) {
        await enqueueSms({ to: u.phone, template: 'campaign', tokens: [u.first_name ?? 'دوست عزیز', String(POINTS.birthday)] }).catch(() => {});
      }
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // فقط پاداش تکراری (unique violation) را رد کن
    }
  }

  // سالگرد — همان الگو
  const annivUsers = await db.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE anniversary_date IS NOT NULL
      AND EXTRACT(MONTH FROM anniversary_date) = ${mm}
      AND EXTRACT(DAY FROM anniversary_date) = ${dd}
  `;
  for (const u of annivUsers) {
    try {
      await addPoints({
        userId: u.id, delta: POINTS.anniversary, reason: 'anniversary', note: 'هدیه‌ی سالگرد 💍',
        idempotencyKey: `annual:${u.id}:anniversary:${today.getFullYear()}`,
      });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e; // پاداش تکراری از اجرای همزمان را نادیده بگیر
    }
  }

  return { birthday: birthdayUsers.length, anniversary: annivUsers.length };
}

export { POINTS };
