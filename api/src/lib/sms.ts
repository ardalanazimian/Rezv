import { createLogger } from './logger';
import { enqueue } from './queue';
import { metrics } from './metrics';
import { consumeSms } from './sms-balance';
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
 * `consumeSms`): اول کسر، بعد ارسال؛ اگر کسر ممکن نبود **ارسال نمی‌شود**.
 * fail-closed عمدی است (CLAUDE.md §۹): علتِ شکستِ `enqueue` معمولاً خودِ
 * دیتابیس است، و اگر نتوانیم موجودی را کم کنیم یعنی نمی‌دانیم اجازه‌ی ارسال
 * داریم یا نه — «نمی‌دانم» باید بسته باشد، نه باز.
 *
 * تابع عمداً throw نمی‌کند: `enqueueSms` از روزِ اول void و بی‌استثنا بوده و
 * چند صداکننده‌اش (مثلاً `createReservation` بعد از commit) خطا را
 * نمی‌گیرند — throwِ تازه یعنی رزروِ ثبت‌شده با ۵۰۰ به کاربر گزارش شود.
 * به‌جایش هر شکست **صریحاً** لاگ و متریک می‌شود.
 */
async function sendDirectFallback(job: SmsJob): Promise<void> {
  if (job.restaurantId) {
    let charged = false;
    try {
      charged = await consumeSms(job.restaurantId, 1, 'queue_fallback');
    } catch (e) {
      log.error('کسرِ موجودیِ پیامک در مسیرِ اضطراری ناموفق — ارسال انجام نشد', {
        template: job.template, restaurantId: job.restaurantId, error: (e as Error).message,
      });
      metrics.smsFailed.inc({ template: job.template, reason: 'balance_check_failed' });
      return;
    }
    if (!charged) {
      log.error('موجودیِ پیامکِ رستوران کافی نیست — مسیرِ اضطراری ارسال نکرد', {
        template: job.template, restaurantId: job.restaurantId,
      });
      metrics.smsFailed.inc({ template: job.template, reason: 'insufficient_balance' });
      return;
    }
  }
  try {
    await sendSmsNow(job);
  } catch (e) {
    // ⚠️ اینجا عمداً «بی‌صدا» نیست. متریکِ جدا از `network` است چون معنایش
    // فرق دارد: در مسیرِ عادی، شکستِ ارسال را worker با retry جبران می‌کند؛
    // اینجا هیچ retryای وجود ندارد و پیام **قطعاً** از دست رفته است.
    log.error('ارسالِ مستقیمِ پیامک در مسیرِ اضطراری شکست خورد — پیام از دست رفت', {
      template: job.template, restaurantId: job.restaurantId ?? null, error: (e as Error).message,
    });
    metrics.smsFailed.inc({ template: job.template, reason: 'fallback_failed' });
  }
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
export async function sendSmsNow(job: SmsJob): Promise<void> {
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
    return;
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
      return;
    }
    url = `${MELI_BASE}/SendSMS`;
    body = { username, password, to: receptor, from, text: freeText, isFlash: 'false' };
  } else {
    const bodyId = bodyIdFor(job.template);
    if (!bodyId) {
      // نبودِ bodyId یعنی الگو در پنل تعریف/تأیید نشده. حدس‌زدن ممنوع.
      log.error('bodyIdِ الگو تنظیم نشده — پیامک ارسال نشد', { template: job.template });
      metrics.smsFailed.inc({ template: job.template, reason: 'missing_bodyid' });
      return;
    }
    url = `${MELI_BASE}/BaseServiceNumber`;
    body = { username, password, to: receptor, bodyId, text: job.tokens.join(tokenSep()) };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
      return;
    }
    log.info(`ارسال شد → ${receptor}`, { template: job.template, recId: data?.Value });
    metrics.smsSent.inc({ template: job.template });
  } catch (e) {
    log.error(`خطای شبکه → ${receptor}`, { template: job.template, error: (e as Error).message });
    metrics.smsFailed.inc({ template: job.template, reason: 'network' });
    throw e; // به worker اجازه بده retry را تصمیم بگیرد
  }
}
