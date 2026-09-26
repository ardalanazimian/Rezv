import { createLogger } from './logger';
import { enqueue } from './queue';
import { metrics } from './metrics';
import { outboundHttpSignal } from './outbound-http';
const log = createLogger('notify');
// ═════════════════════════════════════════════════════════
//  اعلان Push و Email — رزرونو
//
//  این ماژول رابط یکپارچه‌ای برای اعلان‌های غیر-SMS فراهم می‌کند.
//  در حالت پیش‌فرض (بدون کلید ارائه‌دهنده) فقط لاگ می‌کند.
//  برای production، کلیدها را در env بگذار و منطق ارسال واقعی فعال می‌شود.
// ═════════════════════════════════════════════════════════

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
  // کپیِ صفِ انتظار دیگر فقط پیامک وعده می‌دهد (waitlist.js، ۲۰۲۶-۰۹-۲۷).
  metrics.pushNotSent.inc({ reason: 'transport_not_implemented' });
  log.debug(`[PUSH:پیاده‌سازی‌نشده] user:${userId} | ${title}`);
}
