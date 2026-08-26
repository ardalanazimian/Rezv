import { createLogger } from './logger';
import { enqueue } from './queue';
import { metrics } from './metrics';
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

function toLocalNumber(phone: string): string {
  if (phone.startsWith('+98')) return '0' + phone.slice(3);
  if (phone.startsWith('98')) return '0' + phone.slice(2);
  return phone;
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
    await enqueue({ kind: 'sms', payload: job as unknown as Record<string, unknown> });
  } catch (e) {
    // اگر صف در دسترس نبود، به ارسال مستقیم fallback کن (بهتر از گم‌شدن پیام)
    log.warn('صف در دسترس نیست، ارسال مستقیم SMS', { error: (e as Error).message });
    await sendSmsNow(job).catch(() => {});
  }
}

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
    log.debug(`(dev) SMS → ${job.to}`, { template: job.template });
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
