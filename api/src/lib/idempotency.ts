import { createHash } from 'crypto';
import { db } from './db';
import { createLogger } from './logger';
import { ApiError } from './errors';

const log = createLogger('idempotency');

// ═══════════════════════════════════════════════════════════════════════
//  Idempotency سطح HTTP — جلوگیری از double-submit
//
//  مشکل: کاربر روی «رزرو» دوبار می‌زند (یا شبکه retry می‌کند) → دو تلاش.
//  EXCLUDE constraint از double-booking روی یک میز جلوگیری می‌کند، ولی
//  دو رزرو روی میزهای مختلف یا دو پرداخت همچنان ممکن است.
//
//  راه‌حل: کلاینت یک هدر `Idempotency-Key` می‌فرستد. اگر همان کلید قبلاً
//  دیده شده باشد، پاسخ اولِ cache‌شده برمی‌گردد (بدون اجرای دوباره).
//  تست‌شده روی PostgreSQL واقعی.
// ═══════════════════════════════════════════════════════════════════════

type IdempotentResult<T> =
  | { replayed: true; response: T }
  | { replayed: false; commit: (response: T) => Promise<void> };

// اگر یک کلید بیش از این مدت in_progress بماند (مثلاً process وسط کار مرد یا
// commit شکست خورد)، «کهنه» تلقی و قابل‌بازپس‌گیری می‌شود تا 409 دائمی نشود.
const STALE_IN_PROGRESS_MS = 60_000; // ۶۰ ثانیه (بیشتر از هر عملیات رزرو منطقی)

/**
 * تلاش برای claim یک کلید idempotency.
 * - اگر کلید جدید باشد: claim می‌کند و یک `commit` برمی‌گرداند که پاسخ را ذخیره می‌کند.
 * - اگر کلید تکراری و کامل (done) باشد: پاسخ cache‌شده را با `replayed: true` برمی‌گرداند.
 * - اگر کلید in_progress و «کهنه» باشد (H11): آن را بازپس‌می‌گیرد و اجازه‌ی اجرای دوباره می‌دهد.
 * - اگر کلید in_progress و تازه باشد: خطای ۴۰۹ (درخواست همزمان واقعی).
 *
 * ⚠️ باگ H11: قبلاً اگر commit شکست می‌خورد فقط لاگ می‌شد و کلید برای همیشه
 * in_progress می‌ماند؛ هر retry بعدی 409 دائمی می‌گرفت (رزرو ساخته شده بود ولی
 * کاربر هرگز موفقیت را نمی‌دید). حالا (۱) کلیدهای in_progressِ کهنه بازپس‌گرفته
 * می‌شوند و (۲) شکست commit مدیریت می‌شود.
 */
export async function withIdempotency<T>(
  clientKey: string | undefined,
  scope: string,
  actor: string,
): Promise<IdempotentResult<T>> {
  if (!clientKey) {
    // بدون کلید → بدون محافظت؛ commit کاری نمی‌کند
    return { replayed: false, commit: async () => {} };
  }

  // ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۰) — با اجرای زنده اثبات شد، نه از رویِ کد:
  //
  // `scope` گرفته و *ذخیره* می‌شد ولی هرگز در تضاد یا جست‌وجو استفاده نمی‌شد:
  // `ON CONFLICT (key)` و `findUnique({ where: { key } })`. و هیچ‌جا هویتِ
  // درخواست‌کننده هم دخیل نبود. یعنی کلِ کشِ پاسخ فقط به یک رشته‌ی **کاملاً
  // کلاینت‌کنترل** بسته بود.
  //
  // بازتولیدِ واقعی: کاربرِ A روی scope='reservation' پاسخی ذخیره کرد، بعد
  // همان کلید روی scope='walkin' فرستاده شد → عیناً پاسخِ A برگشت، شاملِ کدِ
  // رزرو (که خودش شناسه‌ی دسترسیِ مهمان است). لاگ حتی scopeِ درخواست‌کننده را
  // می‌نوشت و پاسخِ scopeِ دیگری را برمی‌گرداند.
  //
  // دو پیامد: (۱) تداخلِ بینِ scopeها — قطعی. (۲) بازپخشِ پاسخ بینِ کاربران —
  // هر کسی که همان کلید را بفرستد پاسخِ نفرِ قبلی را می‌گیرد. بهره‌برداریش به
  // آنتروپیِ کلیدِ کلاینت وابسته است (مرورگر randomUUID می‌دهد، ولی سرور هیچ
  // الزامی نمی‌گذارد و مصرف‌کننده‌ی API می‌تواند کلیدِ ضعیف بفرستد).
  //
  // رفع بدونِ مهاجرت: کلیدِ ذخیره‌سازی از (scope، هویتِ درخواست‌کننده، کلیدِ
  // کلاینت) مشتق می‌شود. ستونِ `key` همان PK می‌ماند، فقط مقدارش دیگر خامِ
  // کلاینت نیست. `scope` هم هنوز جدا ذخیره می‌شود (برایِ دیباگ/گزارش).
  //
  // ⚠️ اثرِ گذارِ استقرار (کوچک ولی واقعی، پنهانش نمی‌کنم): کلیدهای قدیمی با
  // این نگاشت مچ نمی‌شوند. اگر درخواستی *پیش از* استقرار ارسال و *پس از* آن
  // retry شود، به‌جای replay دوباره اجرا می‌شود. پنجره‌اش چند ثانیه‌ی استقرار
  // است و ردیف‌های قدیمی خودشان تا ۲۴ ساعت منقضی می‌شوند.
  // ⚠️ جداکننده با *طول‌پیشوند* است، نه یک کاراکترِ ثابت: `clientKey` کاملاً
  // کلاینت‌کنترل است، پس با هر جداکنندهٔ ساده‌ای می‌شد مرزها را جابه‌جا کرد
  // (مثلاً کلیدی که خودش شاملِ همان جداکننده باشد تا هشِ ترکیبِ دیگری بسازد).
  // با طول‌پیشوند این ابهام ممکن نیست.
  //
  // ⚠️ نسخه‌ی اولِ همین خط از بایتِ NUL به‌عنوان جداکننده استفاده می‌کرد.
  // کار می‌کرد ولی فایل را برای grep و ابزارهای متنی «باینری» می‌کرد و در
  // بازبینی نامرئی بود — با ASCIIِ خوانا جایگزین شد.
  const key = createHash('sha256')
    .update(`${scope.length}:${scope}|${actor.length}:${actor}|${clientKey}`)
    .digest('hex');

  const makeCommit = () => async (response: T) => {
    // اگر ذخیره‌ی پاسخ شکست خورد، کلید را به‌جای رهاکردن در in_progress، حذف کن
    // تا retry بعدی بتواند دوباره claim کند (نه اینکه 409 دائمی بگیرد).
    try {
      await db.idempotencyKey.update({
        where: { key },
        data: { status: 'done', response: response as object },
      });
    } catch (e) {
      log.warn('ذخیره‌ی پاسخ idempotency ناموفق؛ آزادسازی کلید برای retry', (e as Error).message);
      await db.idempotencyKey.delete({ where: { key } }).catch(() => {});
    }
  };

  // تلاش برای claim اتمیک (insert با ON CONFLICT DO NOTHING)
  const claimed = await db.$queryRaw<{ key: string }[]>`
    INSERT INTO idempotency_keys (key, scope, status, expires_at)
    VALUES (${key}, ${scope}, 'in_progress', now() + interval '24 hours')
    ON CONFLICT (key) DO NOTHING
    RETURNING key
  `;

  if (claimed.length > 0) {
    return { replayed: false, commit: makeCommit() };
  }

  // کلید تکراری — وضعیتش را بخوان
  const existing = await db.idempotencyKey.findUnique({ where: { key } });
  if (existing?.status === 'done' && existing.response !== null) {
    log.debug('replay idempotent', { scope });
    return { replayed: true, response: existing.response as T };
  }

  // in_progress است — کهنه؟ اگر created/updated قدیمی‌تر از آستانه باشد، بازپس‌بگیر.
  if (existing) {
    const age = Date.now() - new Date(existing.createdAt).getTime();
    if (age > STALE_IN_PROGRESS_MS) {
      // بازپس‌گیری اتمیک: فقط اگر هنوز in_progress است، به تازه ریست کن.
      const reclaimed = await db.$queryRaw<{ key: string }[]>`
        UPDATE idempotency_keys
        SET status = 'in_progress', expires_at = now() + interval '24 hours', created_at = now()
        WHERE key = ${key} AND status = 'in_progress'
        RETURNING key
      `;
      if (reclaimed.length > 0) {
        log.warn('کلید idempotency کهنه بازپس‌گرفته شد', { scope, ageMs: age });
        return { replayed: false, commit: makeCommit() };
      }
      // اگر بازپس‌گیری نشد یعنی رقیب همین لحظه done کرد → دوباره بخوان.
      const after = await db.idempotencyKey.findUnique({ where: { key } });
      if (after?.status === 'done' && after.response !== null) {
        return { replayed: true, response: after.response as T };
      }
    }
  }

  // هنوز in_progressِ تازه = درخواست همزمان واقعی با همان کلید
  //
  // ⚠️ باگِ واقعی که با تستِ زنده (curlِ مستقیم روی سروِ محلی + Postgres واقعی، نه
  // فرض) پیدا شد: قبلاً اینجا یک Errorِ خام با statusCode/codeِ دستی پرتاب می‌شد.
  // errorResponse فقط instanceof ApiError را می‌شناسد؛ Errorِ خام همیشه به ۵۰۰
  // «خطای داخلی» تبدیل می‌شد و کلاینت هرگز ۴۰۹ِ واقعی نمی‌دید (نه فقط پیام،
  // خودِ statusCode هم گم می‌شد). حالا واقعاً ApiError پرتاب می‌شود.
  throw new ApiError('IDEMPOTENCY_CONFLICT', 'درخواست تکراری در حال پردازش است', 409);
}

/** پاک‌سازی کلیدهای منقضی (توسط cron نگه‌داری صدا زده می‌شود). */
export async function cleanupIdempotencyKeys(): Promise<number> {
  const res = await db.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return res.count;
}
