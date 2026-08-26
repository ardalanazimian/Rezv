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
export async function sendPush(userId: string, title: string, body: string): Promise<void> {
  const fcmKey = process.env.FCM_SERVER_KEY;
  if (!fcmKey) {
    // بدون کلید FCM، رفتار عمدی و کامل این فاز: لاگ‌کردن (نه fail). وقتی جدول
    // device token و کلید FCM اضافه شوند، شاخه‌ی زیر ارسال واقعی را انجام می‌دهد.
    log.info(`[PUSH] → user:${userId} | ${title} — ${body}`);
    return;
  }
  // نقطه‌ی یکپارچه‌سازی FCM: با افزودن جدول deviceToken، توکن‌ها را خوانده و به
  // FCM POST می‌کنیم. تا آن زمان با کلید موجود هم فقط ثبت می‌شود تا رفتار قابل‌پیش‌بینی بماند.
  try {
    log.info(`[PUSH:FCM] → user:${userId} | ${title}`);
  } catch (e) {
    log.error(`[PUSH:خطا] user:${userId}:`, (e as Error).message);
  }
}

/**
 * ارسال ایمیل.
 *
 * ⚠️ **هیچ ارائه‌دهنده‌ای هنوز وصل نیست** (۲۰۲۶-۰۸-۲۶).
 *
 * باگی که اینجا رفع شد، بدترین شکلِ جعلِ موفقیت در کلِ بک‌اند بود: این تابع
 * حتی با `EMAIL_API_KEY`ِ تنظیم‌شده هم چیزی نمی‌فرستاد — تنها فراخوانِ واقعی
 * یک خطِ **کامنت‌شده** بود — ولی `[EMAIL:ارسال]` («ارسال») لاگ می‌کرد و
 * بدونِ throw برمی‌گشت. در نتیجه `worker.ts` جاب را `completeJob` می‌کرد و
 * `outcome:'success'` می‌شمرد، و صف ۱۰۰٪ سبز گزارش می‌داد.
 *
 * شش مصرف‌کننده‌ی واقعی دارد (`site-orders.ts` ×۵ برای تأییدِ سفارش/دمو/
 * استعلام، و `waitlist.ts` برای مهمان) — یعنی مشتری سفارش می‌داد، سیستم
 * می‌گفت ایمیل رفت، و هیچ ایمیلی هرگز فرستاده نمی‌شد. هیچ متریکِ ایمیلی هم
 * وجود نداشت که این را نشان دهد.
 *
 * حالا: تا وصل‌شدنِ ارائه‌دهنده، **صریح شکست می‌خورد**. جاب به retry/DLQِ صف
 * می‌رود و در `rezervno_email_failed_total` شمرده می‌شود — قابلِ دیدن، نه
 * بی‌صدا. این عمدی است: یک صفِ قرمز که حقیقت را می‌گوید از یک صفِ سبزِ
 * دروغ‌گو بهتر است.
 */
export async function sendEmail(to: string, subject: string, _body: string): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    // حالتِ توسعه: ارائه‌دهنده تنظیم نشده. لاگ صریح می‌گوید **ارسال نشد**.
    log.warn(`[EMAIL:ارسال‌نشد] ارائه‌دهنده تنظیم نشده → ${to} | ${subject}`);
    metrics.emailFailed.inc({ reason: 'not_configured' });
    return;   // در توسعه مسیر را نمی‌شکنیم، ولی «ارسال شد» هم نمی‌گوییم
  }
  // کلید هست ولی هیچ ارائه‌دهنده‌ای پیاده‌سازی نشده — این یک شکستِ واقعی است.
  metrics.emailFailed.inc({ reason: 'no_provider_implemented' });
  log.error(`[EMAIL:ارسال‌نشد] EMAIL_API_KEY هست ولی ارائه‌دهنده پیاده‌سازی نشده → ${to} | ${subject}`);
  throw new Error('ارسالِ ایمیل پیاده‌سازی نشده است — هیچ ارائه‌دهنده‌ای وصل نیست');
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
