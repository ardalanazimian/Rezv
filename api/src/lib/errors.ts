import { NextResponse } from 'next/server';
import { createLogger } from './logger';
import { metrics } from './metrics';
const log = createLogger('api');

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details: object = {}) {
    super(message);
  }
}
export const Err = {
  otpInvalid:   () => new ApiError('OTP_INVALID', 'کد تأیید نامعتبر یا منقضی است', 401),
  unauthorized: () => new ApiError('UNAUTHORIZED', 'ابتدا وارد شوید', 401),
  // ورودِ نام‌کاربری/رمز (مهاجرتِ ۰۷۴). کدِ تازه لازم بود چون هیچ‌کدام از
  // موجودها این معنی را ندارند: `UNAUTHORIZED` یعنی «توکن نداری» (کلاینت
  // باید به صفحه‌ی ورود برود) و `OTP_INVALID` مالِ کدِ یک‌بارمصرف است.
  // ⚠️ پیام عمداً **یکسان** برای «کاربر نیست»، «رمز غلط» و «رمز ست نشده»
  // است — تفکیکشان یک اوراکلِ شمارشِ حساب می‌سازد.
  invalidCredentials: () => new ApiError('INVALID_CREDENTIALS', 'نام کاربری یا رمز عبور اشتباه است', 401),
  forbidden:    (msg='دسترسی به این رستوران ندارید') => new ApiError('FORBIDDEN_TENANT', msg, 403),
  notFound:     (what='منبع') => new ApiError('NOT_FOUND', `${what} پیدا نشد`, 404),
  tableConflict:() => new ApiError('TABLE_CONFLICT', 'این میز در این بازه رزرو شده است', 409),
  lockTimeout:  () => new ApiError('SLOT_LOCK_TIMEOUT', 'این بازه در حال رزرو توسط کاربر دیگری است؛ دوباره تلاش کنید', 423),
  validation:   (msg: string, details: object = {}) => new ApiError('VALIDATION', msg, 422, details),
  // SPEC-B (C9): تعارضِ منبع با details.reason ماشین‌خوان — 'duplicate_owner_phone' | 'slug_unavailable' | 'branch_limit_reached' | …
  conflict:     (reason: string, msg = 'تعارض با وضعیتِ موجود') => new ApiError('CONFLICT', msg, 409, { reason }),
  rateLimited:  (retryAfterSec?: number) => new ApiError('RATE_LIMITED', 'تعداد درخواست بیش از حد مجاز', 429, retryAfterSec ? { retryAfterSec } : {}),
  // وابستگیِ بیرونیِ لازم در دسترس نیست. عمداً ۵۰۳ و نه ۵۰۰: این خرابیِ ما
  // نیست، ناتوانیِ **موقتِ** سرویس است و کلاینت باید بداند دوباره تلاش کند.
  serviceUnavailable: (message: string) => new ApiError('SERVICE_UNAVAILABLE', message, 503),

  // ── خطاهای مشخص موتور رزرو (نیاز ۱۵: پیام بامعنی) ──
  restaurantClosed: () => new ApiError('RESTAURANT_CLOSED', 'رستوران در این زمان بسته است', 422),
  restaurantOffline: () => new ApiError('RESTAURANT_OFFLINE', 'این رستوران موقتاً برای رزرو آنلاین در دسترس نیست؛ لطفاً بعداً یا تلفنی تلاش کنید', 422),
  noTableForParty:  (party: number) => new ApiError('NO_TABLE_FOR_PARTY', `میزی با ظرفیت ${party} نفر در این رستوران وجود ندارد`, 422, { party }),
  slotFull:         (time: string) => new ApiError('SLOT_FULL', `ساعت ${time} پر است؛ زمان دیگری انتخاب کنید`, 409, { time }),
  tableNotFound:    (n: number) => new ApiError('TABLE_NOT_FOUND', `میز شماره ${n} وجود ندارد`, 404, { table: n }),
  tableTooSmall:    (n: number) => new ApiError('TABLE_TOO_SMALL', `ظرفیت میز ${n} برای این تعداد کافی نیست`, 422, { table: n }),
  tableUnavailable: (n: number) => new ApiError('TABLE_UNAVAILABLE', `میز شماره ${n} غیرفعال یا در حالِ تعمیر است`, 422, { table: n }),
  pastTime:         () => new ApiError('PAST_TIME', 'زمان رزرو در گذشته است', 422),
  outsideHours:     () => new ApiError('OUTSIDE_HOURS', 'رستوران در این ساعت باز نیست', 422),
  tooFarAhead:      (days: number) => new ApiError('TOO_FAR_AHEAD', `رزرو حداکثر تا ${days} روز آینده ممکن است`, 422, { days }),
  partyTooLarge:    (max: number) => new ApiError('PARTY_TOO_LARGE', `حداکثر ظرفیت رزرو آنلاین ${max} نفر است؛ برای گروه بزرگ‌تر با رستوران تماس بگیرید`, 422, { max }),
  mergeUnavailable: () => new ApiError('MERGE_UNAVAILABLE', 'میزهای کافی برای ترکیب و نشاندن این گروه آزاد نیست', 409),
  reservationExpired:() => new ApiError('RESERVATION_EXPIRED', 'مهلت تأیید این رزرو گذشته است', 410),
  invalidTransition:(from: string, to: string) => new ApiError('INVALID_STATUS_TRANSITION', `تغییر وضعیت از ${from} به ${to} مجاز نیست`, 422, { from, to }),
  concurrencyRetry: () => new ApiError('CONCURRENCY_RETRY', 'به دلیل ترافیک بالا رزرو ثبت نشد؛ لطفاً دوباره تلاش کنید', 409),

  // ── بن سختِ پلتفرم (کاملاً جدا از فلگِ نرمِ abuse) ──
  userBanned: (reason?: string | null) => new ApiError('USER_BANNED', 'دسترسیِ این حساب توسطِ رزرونو مسدود شده است', 403, reason ? { reason } : {}),

  // ── سوییچ‌هایِ قابلیت (kill-switch سطحِ پلتفرم) ──
  featureDisabled: (label: string) => new ApiError('FEATURE_DISABLED', `«${label}» موقتاً غیرفعال است`, 503),

  // ── شعبه‌ی درخواست‌شده در دسترس نیست (فازِ ۲ · P0-1، پروتکل §۷) ──
  //
  // چرا کدِ اختصاصی و نه notFound عمومی: کلاینت باید بتواند **دقیقاً** این حالت
  // را تشخیص بدهد تا انتخابِ کهنه‌ی شعبه را پاک کند و لیست را از نو بگیرد.
  // با ۴۰۴ عمومی، پنل نمی‌فهمد مشکل «شعبه» است و کاربر در یک حلقه‌ی خطا گیر می‌کند.
  branchNotAccessible: () => new ApiError(
    'BRANCH_NOT_ACCESSIBLE',
    'شعبه‌ی انتخاب‌شده دیگر در دسترس نیست (حذف شده یا دسترسی‌اش گرفته شده). یک شعبه‌ی دیگر انتخاب کن.',
    404,
  ),
};
/**
 * ته‌کشیدنِ استخرِ اتصالِ DB (`P2024`) — **سیگنالِ ظرفیت، نه خرابی.**
 *
 * یافته‌ی رد تیم (`rezv-c7`، RT-05، ۲۰۲۶-۰۹-۰۹). استدلالش حسابی بود و بعد
 * اندازه‌گیری شد: `connection_limit=10` و `pool_timeout=10` (`db.ts:52,56`) و هر
 * تراکنشِ رزرو تا ۱۰ ثانیه اتصالش را نگه می‌دارد. اجرای واقعی روی همین ماشین —
 * ۱۰ اتصالِ نگه‌داشته، سپس یک کوئریِ ساده:
 *
 *     پس از ۱۰.۰ ثانیه → P2024 «Timed out fetching a new connection…»
 *     errorResponse     → HTTP 500 / INTERNAL
 *
 * جمله‌ای که اولویتش را توضیح می‌دهد: **«P2028 یک تراکنشِ کُند لازم دارد؛
 * P2024 ده تراکنشِ عادی.»**
 *
 * ⚠️ چرا این‌جا و نه در بلوکِ catchِ رزرو، برخلافِ P2028: اشباعِ استخر مخصوصِ
 * رزرو نیست — **هر** مسیری که به DB می‌زند همین را می‌دهد. گذاشتنش در
 * `reservations.ts` یعنی همان کلاس در ده‌ها مسیرِ دیگر باز می‌ماند، و کسی
 * خبردار نمی‌شود چون همه‌شان ۵۰۰ی یکسان می‌دهند.
 *
 * ⚠️ تطبیق ساختاری است و عمداً `@prisma/client` را import نمی‌کند: این ماژول
 * را تقریباً همه‌چیز import می‌کند و کشاندنِ Prisma به این‌جا یک وابستگیِ
 * سنگین به مسیرِ خطای هر درخواست اضافه می‌کرد.
 */
function isPoolTimeoutError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2024';
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError)
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  if (isPoolTimeoutError(e)) {
    // شمردن پیش از پاسخ: بدونِ این عدد، طوفانِ استخر فقط انبوهی ۵۰۳ در لاگ
    // است و هیچ‌چیز نمی‌گوید علتش کمبودِ ظرفیت بوده نه یک باگ.
    metrics.dbPoolTimeouts.inc();
    log.error('استخرِ اتصالِ DB ته کشید (P2024) — سیگنالِ ظرفیت', e);
    const busy = Err.serviceUnavailable('سرویس موقتاً شلوغ است؛ چند لحظه دیگر دوباره تلاش کنید');
    return NextResponse.json({ error: { code: busy.code, message: busy.message, details: busy.details } }, { status: busy.status });
  }
  log.error('خطای غیرمنتظره', e);
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'خطای داخلی', details: {} } }, { status: 500 });
}
