import { createLogger } from './logger';
import { enqueue } from './queue';
import { metrics } from './metrics';
import { consumeSms, hasSmsBalance, chargeSmsForJob, type DebitOutcome } from './sms-balance';
import { outboundHttpSignal } from './outbound-http';
const log = createLogger('sms');

export type SmsJob = {
  to: string;
  template: 'otp' | 'booking_confirm' | 'reminder' | 'welcome_visit' | 'campaign' | 'winback_offer'
    // ── قالب‌های چرخه‌ی حیات رزرو ──
    | 'booking_waitlist' | 'booking_preparing' | 'booking_rejected'
    | 'booking_cancelled' | 'booking_noshow' | 'booking_thanks'
    | 'waitlist_joined' | 'waitlist_offer'
    // SPEC-B: دعوتِ اولین‌ورودِ owner — tokens: [ownerName, restaurantName, inviteUrl]
    | 'staff_invite';
  tokens: string[];
  restaurantId?: string;  // اگر مشخص باشد، از موجودی SMS رستوران کم می‌شود (OTP سطح پلتفرم آن را ندارد)
  /**
   * متنِ آزاد (فقط ملی‌پیامک). اگر پر باشد، به‌جایِ الگو یک پیامکِ متن‌آزاد از
   * خطِ اختصاصی ارسال می‌شود.
   *
   * چرا اضافه شد: کاوه‌نگار فقط `verify/lookup` (الگومحور) داشت، پس متنی که
   * رستوران‌دار در کمپین می‌نوشت **قابلِ ارسال نبود** و بی‌صدا دور ریخته
   * می‌شد. ملی‌پیامک `SendSMS` را دارد که متنِ دلخواه می‌فرستد.
   * ⚠️ ارسالِ متنِ آزاد نیازِ خطِ اختصاصی (`MELIPAYAMAK_FROM`) دارد؛ خطِ
   * خدماتیِ اشتراکی فقط الگو قبول می‌کند.
   */
  text?: string;
  /**
   * کلیدِ یکتاسازی — اگر داده شود، صف کارِ تکراری با همین کلید را نمی‌پذیرد.
   * صف از روزِ اول این را پشتیبانی می‌کرد (`enqueue`)، ولی `enqueueSms` آن را
   * عبور نمی‌داد؛ پس هیچ پیامکی نمی‌توانست یکتا شود. یادآوریِ رزرو اولین
   * مصرف‌کننده است (`reminder:<reservationId>`).
   */
  idempotencyKey?: string;
};

/**
 * نگاشتِ قالب → `bodyId`ِ ملی‌پیامک (سرویسِ «خطِ خدماتی/الگو»).
 *
 * ⚠️ مهاجرت از کاوه‌نگار (۲۰۲۶-۰۸-۲۶): کاوه‌نگار الگو را با **نام** صدا
 * می‌زد (`rezervno-otp`)، ملی‌پیامک با **شناسه‌ی عددی** (`bodyId`) که پس از
 * تأییدِ متنِ الگو در پنل صادر می‌شود. پس این‌ها پیش‌فرضِ معنادار ندارند —
 * یک bodyIdِ حدسی یعنی ارسالِ رد‌شده. نبودشان **صریح** گزارش می‌شود، نه
 * اینکه بی‌صدا به عددی جایگزین بیفتد.
 */
function bodyIdFor(template: SmsJob['template']): string | undefined {
  // ⚠️ عمداً **تابع** است، نه ثابتِ سطحِ ماژول (اصلاح ۲۰۲۶-۰۸-۲۶): اعتبارنامه‌ها
  // (`MELIPAYAMAK_USERNAME/PASSWORD`) از قبل در زمانِ فراخوانی خوانده می‌شدند،
  // ولی bodyIdها در زمانِ **لودِ ماژول** — یک ناسازگاریِ واقعی: تغییرِ env
  // نیازِ ری‌استارت داشت، و در تست هر فایلی مجبور می‌شد پیش از importِ این
  // ماژول env بچیند (که با top-level await ترتیبِ رانر را به‌هم می‌ریخت و
  // stubِ سراسریِ fetch را به تست‌های دیگر نشت می‌داد — با اجرای واقعی دیده شد).
  const map: Record<SmsJob['template'], string | undefined> = {
    otp: process.env.MELIPAYAMAK_BODYID_OTP,
    booking_confirm: process.env.MELIPAYAMAK_BODYID_BOOKING,
    reminder: process.env.MELIPAYAMAK_BODYID_REMINDER,
    welcome_visit: process.env.MELIPAYAMAK_BODYID_WELCOME,
    campaign: process.env.MELIPAYAMAK_BODYID_CAMPAIGN,
    winback_offer: process.env.MELIPAYAMAK_BODYID_WINBACK,
    booking_waitlist: process.env.MELIPAYAMAK_BODYID_WAITLIST,
    booking_preparing: process.env.MELIPAYAMAK_BODYID_PREPARING,
    booking_rejected: process.env.MELIPAYAMAK_BODYID_REJECTED,
    booking_cancelled: process.env.MELIPAYAMAK_BODYID_CANCELLED,
    booking_noshow: process.env.MELIPAYAMAK_BODYID_NOSHOW,
    booking_thanks: process.env.MELIPAYAMAK_BODYID_THANKS,
    waitlist_joined: process.env.MELIPAYAMAK_BODYID_WL_JOIN,
    waitlist_offer: process.env.MELIPAYAMAK_BODYID_WL_OFFER,
    staff_invite: process.env.MELIPAYAMAK_BODYID_INVITE,
  };
  return map[template];
}

const MELI_BASE = 'https://rest.payamak-panel.com/api/SendSMS';

/**
 * جداکننده‌ی مقادیرِ توکن در سرویسِ الگویِ ملی‌پیامک.
 *
 * ⚠️ **راستی‌آزمایی‌نشده** (۲۰۲۶-۰۸-۲۶): ملی‌پیامک این جزئیات را عمومی مستند
 * نکرده و هیچ‌کدام از SDKهای رسمی‌اش (python/php/C#) نمونه‌ی چندتوکنی ندارند.
 * `;` قراردادِ رایجِ این سرویس است و پیش‌فرض گرفته شد، ولی **پیش از تولید
 * باید از پنلِ خودت تأیید شود**. قابلِ تنظیم گذاشته شد تا اگر فرق داشت،
 * نیازِ تغییرِ کد نباشد.
 */
function tokenSep(): string { return process.env.MELIPAYAMAK_TOKEN_SEPARATOR || ';'; }

type MeliResponse = { Value?: string | number; RetStatus?: number; StrRetStatus?: string };

/**
 * موفقیت را از شکستِ ملی‌پیامک تفکیک می‌کند.
 *
 * قراردادِ سرویس: `RetStatus === 1` یعنی پذیرفته شد و `Value` همان recId است.
 * در پاسخ‌های قدیمی‌تر فقط `Value` می‌آید که «recId یا شماره‌ی خطا» است
 * (کامنتِ خودِ SDKِ رسمیِ PHP) — و کدهای خطا اعدادِ کوچک‌اند، پس recIdِ واقعی
 * با طولش تشخیص داده می‌شود.
 *
 * عمداً محافظه‌کار است: هر چیزی که قطعاً موفق نیست، شکست حساب می‌شود. یک
 * پیامکِ ارسال‌نشده که «ارسال شد» گزارش شود، دقیقاً همان جعلِ موفقیتی است که
 * کلِ این ممیزی درباره‌اش است.
 */
function meliAccepted(d: MeliResponse | null): boolean {
  if (!d) return false;
  if (typeof d.RetStatus === 'number') return d.RetStatus === 1;
  const v = Number(d.Value);
  return Number.isFinite(v) && v > 1000;   // recId، نه کدِ خطا
}

/**
 * شکلِ محلیِ شماره (`+989…`/`98…` → `09…`). فرمتِ گیرنده‌ی کاوه‌نگار است.
 *
 * export شده چون تنها تعریفِ این تبدیل در کدبیس همین است و مسیرهایی که باید
 * یک شماره‌ی ورودی را با شماره‌ی ذخیره‌شده تطبیق دهند (مثلِ گاردِ «این شماره
 * واقعاً امروز اینجا چک‌این کرده؟» در `restaurant/sms`) به همین تبدیل نیاز
 * دارند. تعریفِ دومِ موازی = دو رفتارِ متفاوت در دو مسیر.
 */
export function toLocalNumber(phone: string): string {
  if (phone.startsWith('+98')) return '0' + phone.slice(3);
  if (phone.startsWith('98')) return '0' + phone.slice(2);
  return phone;
}

/**
 * مسیرِ اضطراری وقتی صف (`jobs`) در دسترس نیست.
 *
 * ⚠️ یافته‌ی ۲۰۲۶-۰۸-۲۵ — یک نشتیِ مستقیمِ **پول**: تنها جایی که موجودیِ
 * پیامکِ رستوران کسر می‌شود `worker.ts` است (`consumeSms` پیش از
 * `sendSmsNow`). این fallback هرگز از worker رد نمی‌شود، پس تا امروز:
 *  • هر پیامکی که در قطعیِ صف از این‌جا می‌رفت **بدونِ کسرِ اعتبار** می‌رفت
 *    (سقفِ موجودی کاملاً دور زده می‌شد و در `sms_transactions` هم ردی
 *    نمی‌ماند — یعنی نه گزارشِ مصرف درست بود نه صورت‌حساب)،
 *  • و `.catch(() => {})` خطای خودِ ارسال را هم می‌بلعید: هیچ لاگ، هیچ
 *    متریک، هیچ نشانه‌ای. یک قطعیِ کاملِ ارسال از بیرون دقیقاً شبیهِ کارکردِ
 *    عادی بود.
 *
 * قاعده‌ی این‌جا عیناً همان قاعده‌ی worker است (پیاده‌سازیِ دوم نیست — همان
 * `sendSmsCharged`): چک، ارسال، و کسر فقط پس از پذیرشِ ارائه‌دهنده؛ اگر اعتبار
 * نبود **ارسال نمی‌شود**. fail-closed عمدی است (CLAUDE.md §۹): علتِ شکستِ
 * `enqueue` معمولاً خودِ دیتابیس است، و اگر نتوانیم موجودی را بخوانیم یعنی
 * نمی‌دانیم اجازه‌ی ارسال داریم یا نه — «نمی‌دانم» باید بسته باشد، نه باز.
 *
 * تابع عمداً throw نمی‌کند: `enqueueSms` از روزِ اول void و بی‌استثنا بوده و
 * چند صداکننده‌اش (مثلاً `createReservation` بعد از commit) خطا را
 * نمی‌گیرند — throwِ تازه یعنی رزروِ ثبت‌شده با ۵۰۰ به کاربر گزارش شود.
 * به‌جایش هر شکست **صریحاً** لاگ و متریک می‌شود.
 */
async function sendDirectFallback(job: SmsJob): Promise<void> {
  let outcome: SmsChargedOutcome;
  try {
    outcome = await sendSmsCharged(job, { jobId: null, reason: 'queue_fallback' });
  } catch (e) {
    // ⚠️ اینجا عمداً «بی‌صدا» نیست. متریکِ جدا از `network` است چون معنایش
    // فرق دارد: در مسیرِ عادی، شکستِ ارسال را worker با retry جبران می‌کند؛
    // اینجا هیچ retryای وجود ندارد و پیام **قطعاً** از دست رفته است.
    log.error('ارسالِ مستقیمِ پیامک در مسیرِ اضطراری شکست خورد — پیام از دست رفت', {
      template: job.template, restaurantId: job.restaurantId ?? null, error: (e as Error).message,
    });
    metrics.smsFailed.inc({ template: job.template, reason: 'fallback_failed' });
    return;
  }
  if (outcome.status === 'balance_unknown') {
    log.error('خواندنِ موجودیِ پیامک در مسیرِ اضطراری ناموفق — ارسال انجام نشد', {
      template: job.template, restaurantId: job.restaurantId, error: outcome.error,
    });
    metrics.smsFailed.inc({ template: job.template, reason: 'balance_check_failed' });
  } else if (outcome.status === 'insufficient_balance') {
    log.error('موجودیِ پیامکِ رستوران کافی نیست — مسیرِ اضطراری ارسال نکرد', {
      template: job.template, restaurantId: job.restaurantId,
    });
    metrics.smsFailed.inc({ template: job.template, reason: 'insufficient_balance' });
  }
}

export type SmsChargedOutcome =
  | { status: 'balance_unknown'; error: string }
  | { status: 'insufficient_balance' }
  | { status: 'not_accepted'; reason: SmsNotAcceptedReason }
  | { status: 'sent'; charge: DebitOutcome | 'not_applicable' | 'charge_failed' };

/**
 * تنها قاعده‌ی پولِ پیامکِ رستوران: **چک ← ارسال ← کسر، و کسر فقط پس از پذیرشِ ارائه‌دهنده.**
 * worker و مسیرِ اضطراری هر دو از همین‌جا می‌روند — دو نسخه از یک قاعده همان
 * نقصی بود که `sendDirectFallback` یک‌بار با آن بی‌صورت‌حساب ارسال می‌کرد.
 *
 * ⚠️ چرا کسر پس از ارسال (دستورِ ۰۴۹ §۳ — پیش از این، کسر پیش از ارسال بود):
 *  • شکستِ شبکه throw می‌کند و retry می‌خورد؛ هیچ اعتباری نگرفته‌ایم، پس
 *    retry هم دوباره نمی‌گیرد. قبلاً هر تلاش یک اعتبار بود — تا ۵ برای یک پیام.
 *  • ردِ ارائه‌دهنده و «پیکربندی‌نشده» throw نمی‌کنند و job کامل می‌شود؛ قبلاً
 *    رستوران برای پیامی که هرگز پذیرفته نشد پول می‌داد.
 *  • `jobId` کسر را به‌ازای job یکتا می‌کند (`chargeSmsForJob`)، پس reclaimِ
 *    jobی که ارسال و کسرش انجام شده ولی completed نشده، دوباره کسر نمی‌کند.
 *
 * ⚠️ هزینه‌ی این ترتیب، گفته‌شده: چک اتمیک نیست. اگر workerِ هم‌زمان آخرین
 * اعتبار را میانِ چک و کسر خرج کند، پیام رفته و کسر ممکن نیست (موجودی منفی
 * نمی‌شود — CHECKِ مهاجرتِ ۰۶۴). آن پیام هزینه‌ی پلتفرم است نه رستوران، و
 * بی‌صدا نیست: `rezervno_sms_uncharged_total`. عکسش — کسرِ اول و بازپرداخت —
 * برای هر jobی که با reclaim به dead برسد اعتبار را بی‌بازگشت می‌سوزاند.
 *
 * شکستِ **خودِ کسر** پس از ارسالِ موفق هم throw نمی‌کند: throw یعنی retry و
 * retry یعنی پیامِ تکراری به مهمان. شمرده می‌شود و job کامل می‌شود.
 */
export async function sendSmsCharged(
  job: SmsJob, charge: { jobId: string | null; reason: string },
): Promise<SmsChargedOutcome> {
  const rid = job.restaurantId;
  if (rid) {
    let allowed: boolean;
    try {
      allowed = await hasSmsBalance(rid);
    } catch (e) {
      return { status: 'balance_unknown', error: (e as Error).message };
    }
    if (!allowed) return { status: 'insufficient_balance' };
  }

  const sent = await sendSmsNow(job);
  if (!sent.accepted) return { status: 'not_accepted', reason: sent.reason };
  if (!rid) return { status: 'sent', charge: 'not_applicable' };

  let result: DebitOutcome;
  try {
    result = charge.jobId
      ? await chargeSmsForJob(rid, charge.jobId, charge.reason)
      : ((await consumeSms(rid, 1, charge.reason)) ? 'charged' : 'insufficient');
  } catch (e) {
    log.error('پیامک ارسال شد ولی کسرِ اعتبار شکست خورد', {
      template: job.template, restaurantId: rid, jobId: charge.jobId, error: (e as Error).message,
    });
    metrics.smsUncharged.inc({ template: job.template, reason: 'charge_failed' });
    return { status: 'sent', charge: 'charge_failed' };
  }
  if (result === 'insufficient') {
    log.error('پیامک ارسال شد ولی موجودی در میانه‌ی ارسال تمام شد — بی‌کسر', {
      template: job.template, restaurantId: rid, jobId: charge.jobId,
    });
    metrics.smsUncharged.inc({ template: job.template, reason: 'insufficient_balance' });
  }
  if (result === 'already_charged') {
    // ⚠️ RT-20 (رد تیم، ۲۰۲۶-۰۹-۱۳): رسیدن به این خط یعنی `sendSmsNow` **بالاتر
    // موفق شده** و بعد کسر به ایندکسِ یکتا خورده — پس این یک پیامِ دومِ واقعی
    // به مهمان است، نه یک تلاشِ بی‌اثر. صورت‌حساب درست است (یک کسر)، ولی
    // مهمان دو پیام گرفته و پلتفرم دو بار به ارائه‌دهنده پول داده.
    //
    // تا امروز این تنها خروجیِ `sendSmsCharged` بود که نه لاگ داشت نه متریک:
    // `already_charged` در کلِ `api/src` فقط در `sms-balance.ts` ظاهر می‌شد و
    // هیچ مصرف‌کننده‌ای نداشت. سطحِ `error` و نه `warn`، چون هزینه‌ی بیرونی
    // دارد و مهمان می‌بیندش.
    log.error('همان job دوباره اجرا شد — پیامِ دومِ واقعی به مهمان رفت (کسر قبلاً انجام شده بود)', {
      template: job.template, restaurantId: rid, jobId: charge.jobId,
    });
    metrics.smsDuplicateSend.inc({ template: job.template });
  }
  return { status: 'sent', charge: result };
}

export async function enqueueSms(job: SmsJob): Promise<void> {
  // ── صف یکپارچه (Postgres-based) — برای مقیاس و مدیریت متمرکز ──
  // قبلاً این تابع به یک لیست Redis push می‌کرد؛ حالا از صف عمومی Job
  // استفاده می‌کند که retry/backoff/DLQ/priority/idempotency دارد (تست‌شده
  // روی PostgreSQL واقعی). همه‌ی فراخوان‌های موجود بدون تغییر کار می‌کنند.
  //
  // استثنا: OTP باید همزمان برود (کاربر منتظر کد است) — مسیر مستقیم.
  if (job.template === 'otp') { await sendSmsNow(job); return; }
  try {
    await enqueue({
      kind: 'sms',
      payload: job as unknown as Record<string, unknown>,
      ...(job.idempotencyKey ? { idempotencyKey: job.idempotencyKey } : {}),
    });
    return;
  } catch (e) {
    // اگر صف در دسترس نبود، به ارسال مستقیم fallback کن (بهتر از گم‌شدن پیام)
    // — ولی با همان قاعده‌ی موجودیِ worker و بدونِ بلعیدنِ خطا (توضیحِ کامل
    // روی `sendDirectFallback`).
    log.warn('صف در دسترس نیست، ارسال مستقیم SMS', { error: (e as Error).message });
  }
  await sendDirectFallback(job);
}

/**
 * آیا زیرساختِ پیامک واقعاً قابلِ استفاده است؟
 *
 * (میراثِ ادغام ۲۰۲۶-۰۸-۲۶: مفهوم از شاخه‌ی open-tasks-review آمد — آنجا برای
 * کاوه‌نگار فقط وجودِ API_KEY بود. برای ملی‌پیامک «آماده» یعنی اعتبارنامه‌ها
 * **و** bodyIdِ الگویِ OTP، چون بدونِ دومی مسیرِ ورود همچنان بی‌پیامک می‌ماند.)
 *
 * مسیرهایی که نتیجه‌شان به رسیدنِ پیامک وابسته است — مثلِ OTP — باید پیش از
 * ادعای موفقیت این را بپرسند؛ وگرنه کاربر ۲۰۴ِ موفق می‌گیرد و کدی که هرگز
 * نمی‌آید را انتظار می‌کشد (و چون OTP_DEV_MODE در production استثناست، عملاً
 * **هیچ‌کس نمی‌تواند وارد شود** در حالی که همه‌ی لاگ‌ها تمیزند).
 */
export function smsTransportReady(): boolean {
  return Boolean(
    process.env.MELIPAYAMAK_USERNAME &&
    process.env.MELIPAYAMAK_PASSWORD &&
    process.env.MELIPAYAMAK_BODYID_OTP,
  );
}

/**
 * سقفِ توکنِ سرویسِ الگویِ کاوه‌نگار (میراث). با ملی‌پیامک سقفِ سختِ ۳تایی
 * وجود ندارد — همه‌ی توکن‌ها join می‌شوند و «بریدنِ خاموشِ توکنِ چهارم»
 * (باگی که در booking_confirm کدِ رزرو را می‌انداخت) از اساس منتفی است.
 * صادر می‌ماند چون reminders.ts به مفهومش ارجاع می‌دهد؛ حدِ طراحیِ الگوهاست،
 * نه حدِ ارسال.
 */
export const MAX_SMS_TOKENS = 3;

/**
 * ارسالِ واقعیِ یک SMS از طریقِ **ملی‌پیامک** (توسطِ workerِ صف یا مسیرِ OTP).
 *
 * دو مسیرِ متفاوتِ سرویس — انتخاب بر اساسِ اینکه job متنِ آزاد دارد یا نه:
 *   • `BaseServiceNumber` (bodyId)  → پیامکِ الگومحور رویِ خطِ خدماتی.
 *     معادلِ مستقیمِ `verify/lookup`ِ کاوه‌نگار. برایِ OTP و پیام‌های تراکنشی
 *     **الزامی** است (خطِ خدماتی متنِ آزاد قبول نمی‌کند).
 *   • `SendSMS` (متنِ آزاد)          → از خطِ اختصاصی (`MELIPAYAMAK_FROM`).
 *     چیزی که کاوه‌نگار اصلاً نداشت، و به همین دلیل متنِ کمپینِ رستوران‌دار
 *     بی‌صدا دور ریخته می‌شد.
 */
export type SmsNotAcceptedReason = 'not_configured' | 'no_sender_line' | 'missing_bodyid' | 'rejected';

/**
 * ⚠️ خروجی از ۲۰۲۶-۰۹-۱۳ دیگر `void` نیست: «پذیرفته شد یا نه» را برمی‌گرداند.
 * چهار راهِ «نرفت» (پیکربندی‌نشده، بی‌خط، بی‌bodyId، ردِ ارائه‌دهنده) عمداً
 * throw نمی‌کنند — retryشان بی‌فایده است — ولی تا امروز از «رفت» قابلِ تشخیص
 * هم نبودند، و handlerِ worker برای هر چهار اعتبارِ رستوران را کسر می‌کرد
 * (دستورِ ۰۴۹ و هم‌خانواده‌اش). شکستِ شبکه همچنان throw می‌کند تا retry بخورد.
 */
export type SmsSendResult = { accepted: true } | { accepted: false; reason: SmsNotAcceptedReason };

export async function sendSmsNow(job: SmsJob): Promise<SmsSendResult> {
  const username = process.env.MELIPAYAMAK_USERNAME;
  const password = process.env.MELIPAYAMAK_PASSWORD;
  if (!username || !password) {
    // ⚠️ بلندی این شکست میراثِ ادغام است (یافته‌ی open-tasks-review دربارهٔ
    // «خطرناک‌ترین سکوتِ سیستم»): بدونِ اعتبارنامه در production باید صدا
    // داشته باشد و شمرده شود — نه debugِ بی‌صدا. مسیرِ OTP جداگانه پیش از
    // ادعای موفقیت smsTransportReady() را می‌پرسد.
    metrics.smsFailed.inc({ template: job.template, reason: 'not_configured' });
    if (process.env.NODE_ENV === 'production') {
      log.error('MELIPAYAMAK_USERNAME/PASSWORD تنظیم نشده — هیچ پیامکی ارسال نمی‌شود', { template: job.template });
    } else {
      log.debug(`(dev) SMS → ${job.to}`, { template: job.template });
    }
    return { accepted: false, reason: 'not_configured' };
  }
  const receptor = toLocalNumber(job.to);

  // ── انتخابِ مسیر ──
  const freeText = (job.text || '').trim();
  let url: string;
  let body: Record<string, string>;

  if (freeText) {
    const from = process.env.MELIPAYAMAK_FROM;
    if (!from) {
      // بدونِ خطِ اختصاصی، ارسالِ متنِ آزاد ممکن نیست. صریح شکست می‌خورد تا
      // مصرف‌کننده «ارسال شد» نگوید.
      log.error('ارسالِ متنِ آزاد بدونِ MELIPAYAMAK_FROM ممکن نیست', { template: job.template });
      metrics.smsFailed.inc({ template: job.template, reason: 'no_sender_line' });
      return { accepted: false, reason: 'no_sender_line' };
    }
    url = `${MELI_BASE}/SendSMS`;
    body = { username, password, to: receptor, from, text: freeText, isFlash: 'false' };
  } else {
    const bodyId = bodyIdFor(job.template);
    if (!bodyId) {
      // نبودِ bodyId یعنی الگو در پنل تعریف/تأیید نشده. حدس‌زدن ممنوع.
      log.error('bodyIdِ الگو تنظیم نشده — پیامک ارسال نشد', { template: job.template });
      metrics.smsFailed.inc({ template: job.template, reason: 'missing_bodyid' });
      return { accepted: false, reason: 'missing_bodyid' };
    }
    url = `${MELI_BASE}/BaseServiceNumber`;
    body = { username, password, to: receptor, bodyId, text: job.tokens.join(tokenSep()) };
  }

  try {
    // ⚠️ `signal` الزامی است: بدونِ آن تنها سقف، پیش‌فرضِ ~۳۰۰ ثانیه‌ای undici
    // بود (اندازه‌گیریِ واقعی در `lib/outbound-http.ts`) — یعنی یک درگاهِ کندِ
    // ملی‌پیامک می‌توانست workerِ صف را دقایقی ببندد و کلِ batchِ سریالی پشتش
    // بماند. اجاره‌ی صف هم از همین سقف مشتق می‌شود.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: outboundHttpSignal(),
    });
    const data = (await res.json().catch(() => null)) as MeliResponse | null;
    if (!res.ok || !meliAccepted(data)) {
      // پاسخِ خامِ ارائه‌دهنده لاگ می‌شود، نه یک پیامِ حدسی: جدولِ کدهای خطای
      // ملی‌پیامک عمومی مستند نیست، پس تشخیص باید از رویِ داده‌ی واقعی باشد.
      log.error(`ارسال ناموفق → ${receptor}`, {
        template: job.template,
        status: res.status,
        retStatus: data?.RetStatus,
        strRetStatus: data?.StrRetStatus,
        value: data?.Value,
      });
      metrics.smsFailed.inc({ template: job.template, reason: 'rejected' });
      return { accepted: false, reason: 'rejected' };
    }
    log.info(`ارسال شد → ${receptor}`, { template: job.template, recId: data?.Value });
    metrics.smsSent.inc({ template: job.template });
    return { accepted: true };
  } catch (e) {
    log.error(`خطای شبکه → ${receptor}`, { template: job.template, error: (e as Error).message });
    metrics.smsFailed.inc({ template: job.template, reason: 'network' });
    throw e; // به worker اجازه بده retry را تصمیم بگیرد
  }
}
