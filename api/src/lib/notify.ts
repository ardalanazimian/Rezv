import { createLogger } from './logger';
import { enqueue } from './queue';
import { metrics } from './metrics';
import { outboundHttpSignal } from './outbound-http';
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
  // پر می‌شود ولی هیچ فرسنده‌ای آن را نمی‌خواند. این تابع عمداً یک
  // پیاده‌سازیِ جعلی نمی‌سازد؛ فقط دیگر **بی‌صدا** نیست.
  //
  // مرزِ صداقت در API از قبل درست بود و باید همان بماند:
  // `POST /me/push-subscribe` دو فیلدِ جدا برمی‌گرداند — `enabled` («ذخیره
  // شد») و `ready` («واقعاً کار می‌کند») — و `ready` همیشه false است. پس
  // هیچ کاربری وعده‌ی دریافتِ push نمی‌گیرد.
  //
  // کپیِ صفِ انتظار دیگر فقط پیامک وعده می‌دهد (waitlist.js، ۲۰۲۶-۰۹-۲۳).
  metrics.pushNotSent.inc({ reason: 'transport_not_implemented' });
  log.debug(`[PUSH:پیاده‌سازی‌نشده] user:${userId} | ${title}`);
}

/**
 * آیا ایمیل واقعاً قابلِ ارسال است؟ مسیرهایی که **نتیجه‌شان به رسیدنِ ایمیل
 * وابسته است** باید پیش از ادعای موفقیت این را بپرسند — همان قراردادِ
 * `smsTransportReady()` در lib/sms.ts.
 */
export function emailTransportReady(): boolean {
  return Boolean(process.env.EMAIL_API_KEY);
}

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
      signal: outboundHttpSignal(),
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      log.error(`ارسالِ ایمیل ناموفق → ${to}`, { subject, status: res.status, detail: detail.slice(0, 300) });
      metrics.emailFailed.inc({ reason: 'rejected' });
      return;
    }
    log.info(`ایمیل ارسال شد → ${to}`, { subject });
    metrics.emailSent.inc();
  } catch (e) {
    log.error(`خطای شبکه در ارسالِ ایمیل → ${to}`, { subject, error: (e as Error).message });
    metrics.emailFailed.inc({ reason: 'network' });
    throw e;
  }
}

export async function queueEmail(to: string, subject: string, body: string, idempotencyKey?: string): Promise<void> {
  try {
    await enqueue({ kind: 'email', payload: { to, subject, body }, idempotencyKey });
  } catch {
    await sendEmail(to, subject, body).catch(() => {});
  }
}

export async function queuePush(userId: string, title: string, body: string, idempotencyKey?: string): Promise<void> {
  try {
    await enqueue({ kind: 'push', payload: { userId, title, body }, idempotencyKey });
  } catch {
    await sendPush(userId, title, body).catch(() => {});
  }
}
