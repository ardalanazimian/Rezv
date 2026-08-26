import { createLogger } from './logger';
import { enqueue } from './queue';
import { metrics } from './metrics';
const log = createLogger('notify');
// ═══════════════════════════════════════════════════════════
//  اعلان Push و Email — رزرونو
//
//  این ماژول رابط یکپارچه‌ای برای اعلان‌های غیر-SMS فراهم می‌کند.
//  در حالت پیش‌فرض (بدون کلید ارائه‌دهنده) فقط لاگ می‌کند.
//  برای production، کلیدها را در env بگذار و منطق ارسال واقعی فعال می‌شود.
// ═══════════════════════════════════════════════════════════

/**
 * ارسال اعلان Push به کاربر.
 * Production: با FCM (Firebase) یا وب‌پوش. توکن دستگاه از جدول کاربر/دستگاه خوانده می‌شود.
 */
export async function sendPush(userId: string, title: string, _body: string): Promise<void> {
  // ⚠️ صادقانه: ارسالِ واقعیِ push **ساخته نشده**. جدولِ `push_subscriptions`
  // پر می‌شود ولی هیچ فرستنده‌ای آن را نمی‌خواند. این تابع عمداً یک
  // پیاده‌سازیِ جعلی نمی‌سازد؛ فقط دیگر **بی‌صدا** نیست.
  //
  // مرزِ صداقت در API از قبل درست بود و باید همان بماند:
  // `POST /me/push-subscribe` دو فیلدِ جدا برمی‌گرداند — `enabled` («ذخیره
  // شد») و `ready` («واقعاً کار می‌کند») — و `ready` همیشه false است. پس
  // هیچ کاربری وعده‌ی دریافتِ push نمی‌گیرد.
  //
  // ⚠️ یافته‌ی ثبت‌شده و رفع‌نشده: کپیِ صفِ انتظار در
  // `apps/customer/js/waitlist.js` هنوز «پیامک + نوتیفیکیشن لحظه‌ای» وعده
  // می‌دهد. پیامک واقعی است، نوتیفیکیشن نه. رجوع کن به OPEN-FINDINGS.
  metrics.pushNotSent.inc({ reason: 'transport_not_implemented' });
  log.debug(`[PUSH:پیاده‌سازی‌نشده] user:${userId} | ${title}`);
}

/**
 * آیا ایمیل واقعاً قابلِ ارسال است؟ مسیرهایی که **نتیجه‌شان به رسیدنِ ایمیل
 * وابسته است** باید پیش از ادعای موفقیت این را بپرسند — همان قراردادِ
 * `smsTransportReady()` در lib/sms.ts.
 *
 * سابقه (ادغامِ ۲۰۲۶-۰۸-۲۶): دو شاخه هم‌زمان همین ناحیه را رفع کردند. این
 * شاخه جعلِ موفقیت را مستند و صادقانه fail کرد (تا آن روز تنها فراخوانِ
 * واقعیِ ارسال یک خطِ **کامنت‌شده** بود ولی «[EMAIL:ارسال]» لاگ می‌شد و صف
 * ۱۰۰٪ سبز می‌ماند — با ۶ مصرف‌کننده‌ی واقعی)؛ شاخه‌ی open-tasks-review
 * ارائه‌دهنده‌ی واقعی (SendGrid) را پیاده کرد. پیاده‌سازیِ واقعی نگه داشته
 * شد؛ این یادداشت می‌ماند تا «چرا متریکِ ایمیل تازه است» بی‌جواب نماند.
 */
export function emailTransportReady(): boolean {
  return Boolean(process.env.EMAIL_API_KEY);
}

/**
 * ارسالِ واقعیِ ایمیل از طریقِ SendGrid v3.
 *
 * ⚠️ یافته‌ی ۲۰۲۶-۰۸-۲۵ — دومین «سکوتِ خطرناک» بعد از کلیدِ کاوه‌نگار:
 * این تابع قبلاً **هرگز ایمیلی نمی‌فرستاد**. فراخوانِ واقعی کامنت شده بود و
 * تابع در هر دو شاخه بی‌صدا و «موفق» برمی‌گشت — بدونِ هیچ متریکی. بدتر
 * اینکه شاخه‌ی *با کلید* خطِ `[EMAIL:ارسال]` را لاگ می‌کرد؛ یعنی اپراتوری
 * که کلید را تنظیم می‌کرد، در لاگ کلمه‌ی «ارسال» را می‌دید برای ایمیلی که
 * هرگز نرفته بود.
 *
 * چرا مهم بود: کلِ قیفِ فروشِ B2B از همین مسیر می‌گذرد —
 *   • `site-orders.ts:228` اعلانِ درخواستِ دمو/خرید به **خودِ رزرونو**
 *   • `:353` فعال‌سازیِ دموی ۳۰ روزه با کدِ پیگیری برای مشتری
 *   • `:434`/`:590` ثبت و فعال‌سازیِ اشتراک
 *   • `:481` پیامِ فرمِ تماسِ سایت به صندوقِ فروش
 * یعنی یک کسب‌وکار درخواستِ خرید می‌داد، هیچ‌کس در رزرونو خبردار نمی‌شد، و
 * خودش هم هیچ تأییدی نمی‌گرفت. سرنخ‌ها بی‌صدا گم می‌شدند.
 *
 * ⚠️ وضعیتِ فعلی: **آماده، نه فعال.** کد واقعی است ولی تا وقتی
 * `EMAIL_API_KEY` تنظیم نشود هیچ ایمیلی نمی‌رود — و آن حالت حالا **بلند**
 * است (متریک + لاگِ خطا در production)، نه سکوت.
 */
export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM || 'noreply@rezervno.ir';

  if (!apiKey) {
    metrics.emailFailed.inc({ reason: 'no_api_key' });
    if (process.env.NODE_ENV === 'production') {
      log.error('EMAIL_API_KEY تنظیم نشده — هیچ ایمیلی ارسال نمی‌شود', { to, subject });
    } else {
      log.debug(`(dev) EMAIL → ${to} | ${subject}`);
    }
    return;
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });
    // SendGrid موفقیت را با 202 اعلام می‌کند، نه 200.
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      log.error(`ارسالِ ایمیل ناموفق → ${to}`, { subject, status: res.status, detail: detail.slice(0, 300) });
      metrics.emailFailed.inc({ reason: 'rejected' });
      return; // ردِ ارائه‌دهنده با retry درست نمی‌شود
    }
    log.info(`ایمیل ارسال شد → ${to}`, { subject });
    metrics.emailSent.inc();
  } catch (e) {
    log.error(`خطای شبکه در ارسالِ ایمیل → ${to}`, { subject, error: (e as Error).message });
    metrics.emailFailed.inc({ reason: 'network' });
    // ⚠️ عمداً throw می‌شود، نه بلع: worker با throw دوباره تلاش می‌کند و با
    // return کار را «انجام‌شده» علامت می‌زند. بلعیدنِ خطای شبکه یعنی ایمیل
    // برای همیشه گم می‌شود. (همان قرارداد `sendSmsNow`.)
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════
//  نسخه‌های صف‌محور — برای مسیرهای غیرفوری، به‌جای ارسال همزمان
//  از صف Job استفاده کن (retry/DLQ/priority رایگان). worker با
//  sendEmail/sendPush بالا کار واقعی را انجام می‌دهد.
// ═══════════════════════════════════════════════════════════

/** صف‌بندی ایمیل (غیرمسدود). idempotencyKey اختیاری برای جلوگیری از ارسال تکراری. */
export async function queueEmail(to: string, subject: string, body: string, idempotencyKey?: string): Promise<void> {
  try {
    await enqueue({ kind: 'email', payload: { to, subject, body }, idempotencyKey });
  } catch {
    await sendEmail(to, subject, body).catch(() => {}); // fallback
  }
}

/** صف‌بندی Push (غیرمسدود). */
export async function queuePush(userId: string, title: string, body: string, idempotencyKey?: string): Promise<void> {
  try {
    await enqueue({ kind: 'push', payload: { userId, title, body }, idempotencyKey });
  } catch {
    await sendPush(userId, title, body).catch(() => {}); // fallback
  }
}
