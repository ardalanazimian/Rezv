import { createLogger } from './logger';
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
    const { enqueue } = await import('./queue');
    await enqueue({ kind: 'sms', payload: job as unknown as Record<string, unknown> });
  } catch (e) {
    // اگر صف در دسترس نبود، به ارسال مستقیم fallback کن (بهتر از گم‌شدن پیام)
    log.warn('صف در دسترس نیست، ارسال مستقیم SMS', { error: (e as Error).message });
    await sendSmsNow(job).catch(() => {});
  }
}

/** ارسال واقعی یک SMS از طریق کاوه‌نگار (توسط worker صف یا مسیر OTP صدا زده می‌شود). */
export async function sendSmsNow(job: SmsJob): Promise<void> {
  const apiKey = process.env.KAVENEGAR_API_KEY;
  if (!apiKey) {
    log.debug(`(dev) SMS → ${job.to}`, { template: job.template });
    return;
  }
  const receptor = toLocalNumber(job.to);
  const template = TEMPLATE_MAP[job.template];
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
