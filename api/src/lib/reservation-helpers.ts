// ═══════════════════════════════════════════════════════════
//  Reservation Helpers — توابعِ کمکیِ خالصِ رزرو
//
//  جدا شده از reservation-engine برای خوانایی و تست‌پذیری بهتر:
//   • computeRanges     — محاسبه‌ی بازه‌ی رزرو + بازه‌ی بلاک (validation)
//   • genReservationCode — کد رزروِ امن و غیرقابل‌حدس
//   • isConflictError    — تشخیصِ خطای تداخل/exclusion دیتابیس (conflicts)
//   • isSerializationError — تشخیصِ خطای serialization/deadlock
//   • withSerializationRetry — سیاستِ *واحدِ* تلاشِ مجدد رویِ آن خطاها
//
//  چهار موردِ اول توابعِ خالص‌اند (بدونِ side-effect، بدونِ DB) — قابلِ تستِ
//  واحدِ ساده. `withSerializationRetry` عمداً استثناست و دو side-effect دارد
//  (یک تایمرِ backoff و یک شمارنده‌ی متریک)؛ این‌جا زندگی می‌کند چون سیاستِ
//  retry و تشخیصِ خطایی که آن را فعال می‌کند باید یک‌جا بمانند، وگرنه دقیقاً
//  همان drift رخ می‌دهد که این فایل برایِ جلوگیری از آن ساخته شد.
// ═══════════════════════════════════════════════════════════
import { Prisma } from '@prisma/client';
import { zonedTimeToUtc } from './hours';
import { randomBytes } from 'crypto';
import { Err } from './errors';
import { metrics } from './metrics';

export interface TimingConfig {
  slotMinutes: number;
  bufferMinutes: number;
  cleaningMinutes: number;
  holdMinutes: number;
}

/** محاسبه‌ی بازه‌ی رزرو + بازه‌ی بلاک (شامل نظافت/بافر). */
export function computeRanges(date: string, time: string, cfg: TimingConfig, durationOverride?: number, timezone = 'Asia/Tehran') {
  const start = zonedTimeToUtc(date, time, timezone);
  if (isNaN(+start)) throw Err.validation('تاریخ یا ساعت نامعتبر است');
  const duration = durationOverride ?? cfg.slotMinutes;
  const end = new Date(+start + duration * 60_000);
  // بازه‌ی بلاک = مدت رزرو + زمان نظافت + بافر ایمنی
  const blockBufferMin = cfg.cleaningMinutes + cfg.bufferMinutes;
  const blockEnd = new Date(+end + blockBufferMin * 60_000);
  return { start, end, blockEnd, duration, blockBufferMin };
}

// کد رزرو امن و غیرقابل‌حدس (نیاز امنیتی): 8 کاراکتر Base32 از منبع تصادفی امن.
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون 0/O/1/I برای خوانایی
/** کد رزروِ تصادفیِ امن (RZ + 7 کاراکتر). */
export function genReservationCode(): string {
  const bytes = randomBytes(8);
  let out = 'RZ';
  for (let i = 0; i < 7; i++) out += B32[bytes[i] % 32];
  return out;
}

// ⚠️ یافته‌یِ واقعی (حسابرسیِ Time-Range/EXCLUDE/Redis-evidence، ۲۰۲۶-۰۸-۱۴،
// با تستِ زنده‌یِ C2 پیدا شد، نه فرض): وقتی دو تراکنشِ Serializable *واقعاً*
// هم‌زمان (بدونِ میانجیِ قفلِ Redis که فشارِ رقابت رو کم می‌کنه) به همون
// ردیفِ EXCLUDE برخورد می‌کنن، Prisma همیشه PrismaClientKnownRequestError
// با meta.code نمی‌ده — گاهی PrismaClientUnknownRequestError برمی‌گردونه که
// کدِ SQLSTATEِ خام (مثلاً «23P01») فقط داخلِ متنِ message هست، نه در یک
// فیلدِ ساختاریافته. isConflictError/isSerializationError این شکل رو
// نمی‌شناختن → خطای خام تا بیرون از createReservation leak می‌کرد و
// errorResponse یک ۵۰۰ی عمومی می‌داد، دقیقاً برایِ یک تداخلِ *واقعی* و
// *درست‌مدیریت‌شده‌ی DB* که باید ۴۰۹ی تمیز (SLOT_FULL/TABLE_CONFLICT) می‌شد.
function pgCodeFromUnknownRequestError(e: unknown): string | undefined {
  if (!(e instanceof Prisma.PrismaClientUnknownRequestError)) return undefined;
  // پیامِ خامِ Postgres چیزی شبیهِ `PostgresError { code: "23P01", ... }` دارد؛
  // این‌جا مستقیم دنبالِ همون کدهایِ شناخته‌شده در متنِ پیام می‌گردیم.
  const m = e.message.match(/"(23P01|40001|40P01)"/);
  return m?.[1];
}

/** تشخیص خطاهای تداخل/exclusion/serialization دیتابیس (برای retry). */
export function isConflictError(e: unknown): boolean {
  // 23P01 = exclusion_violation (EXCLUDE constraint ما)
  // 40001 = serialization_failure ، 40P01 = deadlock_detected
  const code = (e as { code?: string })?.code;
  if (code === '23P01' || code === '40001' || code === '40P01') return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2010') {
      const inner = (e.meta as { code?: string } | undefined)?.code;
      return inner === '23P01' || inner === '40001' || inner === '40P01';
    }
    if (e.code === 'P2034') return true; // write conflict / deadlock در Prisma
  }
  const unknownCode = pgCodeFromUnknownRequestError(e);
  if (unknownCode === '23P01' || unknownCode === '40001' || unknownCode === '40P01') return true;
  return false;
}

/** تشخیصِ خطای serialization/deadlock (زیرمجموعه‌ی conflict، برای retry با backoff). */
export function isSerializationError(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code === '40001' || code === '40P01') return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') return true;
  const unknownCode = pgCodeFromUnknownRequestError(e);
  return unknownCode === '40001' || unknownCode === '40P01';
}

// ═══════════════════════════════════════════════════════════════════════
//  سیاستِ واحدِ تلاشِ مجدد رویِ تداخلِ serialization
//
//  چرا این‌جا و نه یک حلقه‌ی دومِ کپی‌شده در هر نویسنده:
//  زیرِ isolationِ Serializable، ابطالِ یک تراکنش با ۴۰۰۰۱/۴۰P۰۱ رفتارِ
//  **عادی و موردِ انتظارِ** Postgres است، نه یک خطایِ استثنایی — SSI عمداً
//  یکی از دو طرفِ چرخه‌ی rw-antidependency را می‌کُشد. یعنی هر مسیری که
//  isolation را بالا می‌برد، *در همان تغییر* باید retry هم داشته باشد؛
//  وگرنه چیزی که پیش‌تر بی‌صدا خراب می‌شد، حالا بی‌دلیل به کاربر خطا می‌دهد.
//
//  ⚠️ چرا کپی‌کردنِ حلقه ممنوع است (درسِ همین مخزن): محافظِ اشغالِ میز در
//  ۲۰۲۶-۰۹-۰۴ به createWalkin و promoteNext اضافه شد، ولی چون هر مسیر
//  سیاستِ همزمانیِ *خودش* را داشت، فقط createReservation در سطحی اجرا
//  می‌شد که خواندنش برایِ SSI قابلِ‌دیدن باشد. یک سیاست در یک نقطه = هر
//  نویسنده‌ی بعدی هم به‌طورِ پیش‌فرض درست است.
//
//  متریک عمداً داخلِ خودِ helper شمرده می‌شود، نه در محلِ فراخوانی: اگر
//  شمارش وظیفه‌ی فراخواننده بود، سومین فراخواننده آن را از قلم می‌انداخت و
//  ما دوباره یک مکانیزمِ اندازه‌گیری‌نشده می‌داشتیم.
//
//  ⚠️ چرا `op` اجباری است و شمارنده label دارد: بدونِ label، شمارشِ همه‌ی
//  مسیرها در یک عدد جمع می‌شد و یک مسیرِ *مرده* (retryی که هرگز شلیک نمی‌کند،
//  یعنی دقیقاً همان حالتِ خطرناک) پشتِ ترافیکِ مسیرِ پرکارِ دیگر نامرئی
//  می‌ماند. این همان دامِ «گارد از یک منبع می‌شمارد، خطر جایِ دیگری است» است.
//  با label، «walkin=0 در حالی که reservation>0» یک سیگنالِ خواناست.
//  اندازه‌گیریِ زنده‌ی ۲۰۲۶-۰۹-۰۴ (۱۵ مسابقه‌ی واقعی) همین را لازم کرد: بدونِ
//  label نمی‌شد ثابت کرد کدام طرف واقعاً retry می‌کند.
// ═══════════════════════════════════════════════════════════════════════

/** حداکثر تلاش رویِ تداخلِ serialization (شاملِ خودِ تلاشِ اول). */
export const TX_MAX_RETRIES = 5;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `fn` را تا `TX_MAX_RETRIES` بار اجرا می‌کند و فقط رویِ خطایِ
 * serialization/deadlock (`isSerializationError`) با backoffِ تصادفی دوباره
 * تلاش می‌کند. هر خطایِ دیگری بلافاصله بالا می‌رود — یک ۴۰۹ی واقعی
 * (TABLE_CONFLICT/SLOT_FULL) هرگز نباید retry شود.
 *
 * اگر همه‌ی تلاش‌ها مصرف شوند، **آخرین خطایِ واقعی** بالا می‌رود (نه یک خطایِ
 * عمومی) تا فراخواننده بتواند آن را به یک پیامِ صادقِ دامنه‌ای ترجمه کند —
 * دقیقاً کاری که createReservation در `reservations.ts:304-314` می‌کند.
 */
export async function withSerializationRetry<T>(
  op: 'reservation' | 'walkin',
  fn: (attempt: number) => Promise<T>,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < TX_MAX_RETRIES; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastErr = e;
      if (isSerializationError(e) && attempt < TX_MAX_RETRIES - 1) {
        metrics.serializationRetries.inc({ op });
        await sleep(20 * (attempt + 1) + Math.random() * 30); // backoff تصادفی
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? Err.concurrencyRetry();
}
