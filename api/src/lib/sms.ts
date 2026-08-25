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
    | 'waitlist_joined' | 'waitlist_offer';
  tokens: string[];
  restaurantId?: string;  // اگر مشخص باشد، از موجودی SMS رستوران کم می‌شود (OTP سطح پلتفرم آن را ندارد)
  /**
   * کلیدِ یکتاسازی — اگر داده شود، صف کارِ تکراری با همین کلید را نمی‌پذیرد.
   * صف از روزِ اول این را پشتیبانی می‌کرد (`enqueue`)، ولی `enqueueSms` آن را
   * عبور نمی‌داد؛ پس هیچ پیامکی نمی‌توانست یکتا شود. یادآوریِ رزرو اولین
   * مصرف‌کننده است (`reminder:<reservationId>`).
   */
  idempotencyKey?: string;
};

const TEMPLATE_MAP: Record<SmsJob['template'], string> = {
  otp: process.env.KAVENEGAR_TPL_OTP || 'rezervno-otp',
  booking_confirm: process.env.KAVENEGAR_TPL_BOOKING || 'rezervno-booking',
  reminder: process.env.KAVENEGAR_TPL_REMINDER || 'rezervno-reminder',
  welcome_visit: process.env.KAVENEGAR_TPL_WELCOME || 'rezervno-welcome',
  campaign: process.env.KAVENEGAR_TPL_CAMPAIGN || 'rezervno-campaign',
  winback_offer: process.env.KAVENEGAR_TPL_WINBACK || 'rezervno-winback',
  // ── قالب‌های چرخه‌ی حیات (با پیش‌فرض؛ در پنل کاوه‌نگار قابل تعریف) ──
  booking_waitlist: process.env.KAVENEGAR_TPL_WAITLIST || 'rezervno-waitlist',
  booking_preparing: process.env.KAVENEGAR_TPL_PREPARING || 'rezervno-preparing',
  booking_rejected: process.env.KAVENEGAR_TPL_REJECTED || 'rezervno-rejected',
  booking_cancelled: process.env.KAVENEGAR_TPL_CANCELLED || 'rezervno-cancelled',
  booking_noshow: process.env.KAVENEGAR_TPL_NOSHOW || 'rezervno-noshow',
  booking_thanks: process.env.KAVENEGAR_TPL_THANKS || 'rezervno-thanks',
  waitlist_joined: process.env.KAVENEGAR_TPL_WL_JOIN || 'rezervno-wl-join',
  waitlist_offer: process.env.KAVENEGAR_TPL_WL_OFFER || 'rezervno-wl-offer',
};

/** سقفِ توکنِ lookupِ کاوه‌نگار (token, token2, token3). */
export const MAX_SMS_TOKENS = 3;

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

/** ارسال واقعی یک SMS از طریق کاوه‌نگار (توسط worker صف یا مسیر OTP صدا زده می‌شود). */
/**
 * آیا پیامک واقعاً قابلِ ارسال است؟ (کلیدِ کاوه‌نگار تنظیم شده؟)
 * مسیرهایی که **نتیجه‌شان به رسیدنِ پیامک وابسته است** — مثلِ OTP — باید
 * پیش از ادعای موفقیت این را بپرسند.
 */
export function smsTransportReady(): boolean {
  return Boolean(process.env.KAVENEGAR_API_KEY);
}

export async function sendSmsNow(job: SmsJob): Promise<void> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  if (!apiKey) {
    // ⚠️ یافته‌ی ۲۰۲۶-۰۸-۲۵ — خطرناک‌ترین حالتِ «سکوت» در کلِ سیستم:
    // بدونِ کلید، این تابع بی‌صدا برمی‌گشت و **هیچ متریکی** نمی‌خورد. برای
    // پیامکِ تبلیغاتی قابلِ‌تحمل است، ولی برای OTP یعنی: کاربر شماره می‌زند،
    // پاسخِ ۲۰۴ِ **موفق** می‌گیرد، پیامک هرگز نمی‌آید، و منتظر می‌ماند.
    // چون OTP_DEV_MODE در production استثنا می‌دهد، هیچ راهِ دیگری هم برای
    // گرفتنِ کد نیست ⇒ **هیچ‌کس نمی‌تواند وارد شود** — نه مشتری، نه
    // رستوران‌دار، نه ادمین — در حالی که API بالاست و لاگ تمیز.
    // حالا دستِ‌کم شمرده و در production با هشدار لاگ می‌شود؛ و مسیرِ OTP
    // خودش پیش از ادعای موفقیت `smsTransportReady()` را می‌پرسد.
    metrics.smsFailed.inc({ template: job.template, reason: 'no_api_key' });
    if (process.env.NODE_ENV === 'production') {
      log.error('KAVENEGAR_API_KEY تنظیم نشده — هیچ پیامکی ارسال نمی‌شود', { template: job.template });
    } else {
      log.debug(`(dev) SMS → ${job.to}`, { template: job.template });
    }
    return;
  }
  const receptor = toLocalNumber(job.to);
  const template = TEMPLATE_MAP[job.template];

  // ⚠️ گاردِ بریدنِ خاموش (یافته‌ی ۲۰۲۶-۰۸-۲۵): این تابع فقط سه توکن را
  // عبور می‌دهد (`token`, `token2`, `token3` — سقفِ lookupِ کاوه‌نگار)، ولی
  // چند فراخوان **چهار** توکن می‌فرستادند. توکنِ چهارم بی‌صدا دور ریخته
  // می‌شد. جدی‌ترین موردش `booking_confirm` بود که توکنِ چهارمش **کدِ رزرو**
  // است: کاربر پیامکِ تأیید می‌گرفت بدونِ کدی که برای مراجعه لازم دارد.
  //
  // اینجا عمداً پیام را دستکاری یا بازچینش نمی‌کنیم — ترتیبِ توکن‌ها به
  // قالبِ تعریف‌شده در پنلِ کاوه‌نگار وابسته است و حدس‌زدنش پیام را خراب
  // می‌کند. کاری که می‌کنیم این است که **دیگر خاموش نباشد**.
  if (job.tokens.length > MAX_SMS_TOKENS) {
    log.error(`قالبِ ${job.template}: ${job.tokens.length} توکن داده شد ولی فقط ${MAX_SMS_TOKENS} تا ارسال می‌شود`, {
      template: job.template, dropped: job.tokens.slice(MAX_SMS_TOKENS),
    });
    metrics.smsFailed.inc({ template: job.template, reason: 'token_overflow' });
  }

  const params = new URLSearchParams({ receptor, template, token: job.tokens[0] || '' });
  if (job.tokens[1]) params.set('token2', job.tokens[1]);
  if (job.tokens[2]) params.set('token3', job.tokens[2]);
  const url = `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json?${params.toString()}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.return?.status !== 200) {
      log.error(`ارسال ناموفق → ${receptor}`, { template: job.template, reason: data?.return?.message || res.status });
      metrics.smsFailed.inc({ template: job.template, reason: 'rejected' });
      return;
    }
    log.info(`ارسال شد → ${receptor}`, { template: job.template });
    metrics.smsSent.inc({ template: job.template });
  } catch (e) {
    log.error(`خطای شبکه → ${receptor}`, { template: job.template, error: (e as Error).message });
    metrics.smsFailed.inc({ template: job.template, reason: 'network' });
    throw e; // به worker اجازه بده retry را تصمیم بگیرد
  }
}
