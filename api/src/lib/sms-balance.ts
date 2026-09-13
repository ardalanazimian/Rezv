import { db } from './db';
import { createLogger } from './logger';
import { Err } from './errors';

const log = createLogger('sms-balance');

/** Starter SMS balance for new restaurants. */
export const STARTER_SMS_BALANCE = 50;

// ═══════════════════════════════════════════════════════════════════════
//  مدیریت موجودی SMS
//
//  هر رستوران یک موجودی پیامک (sms_balance) دارد. ادمین پلتفرم آن را شارژ
//  می‌کند (topup)، و هر ارسال پیامک یکی از آن کم می‌کند (consume).
//
//  هر دو عملیات اتمیک‌اند (همان الگوی امن مسیرهای پول):
//   • topup: افزایش + ثبت تراکنش در یک تراکنش
//   • consume: کاهش فقط اگر موجودی هست (UPDATE...WHERE balance>=n) — ضد
//     ارسال بدون اعتبار. تأییدشده روی PostgreSQL واقعی.
// ═══════════════════════════════════════════════════════════════════════

/**
 * افزایش موجودی SMS یک رستوران (توسط ادمین پلتفرم).
 * اتمیک: افزایش موجودی + ثبت تراکنش حسابرسی.
 */
export async function topupSms(
  restaurantId: string, amount: number, actorId: string, note?: string,
): Promise<{ balance: number }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw Err.validation('تعداد پیامک باید عددی مثبت باشد');
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.restaurant.update({
      where: { id: restaurantId },
      data: { smsBalance: { increment: amount } },
      select: { smsBalance: true },
    });
    await tx.smsTransaction.create({
      data: {
        restaurantId, delta: amount, reason: 'admin_topup',
        balanceAfter: updated.smsBalance, actorId, note: note ?? null,
      },
    });
    log.info('شارژ SMS', { restaurantId, amount, newBalance: updated.smsBalance, actorId });
    return { balance: updated.smsBalance };
  });
}

/**
 * مصرف یک (یا چند) پیامک از موجودی. اتمیک — فقط اگر موجودی کافی باشد.
 * خروجی: true اگر موفق (اعتبار کسر شد)، false اگر موجودی کافی نبود.
 *
 * نکته: اگر false برگرداند، ارسال‌کننده باید پیامک را ارسال نکند یا هشدار دهد.
 * این جلوی ارسال بدون اعتبار را می‌گیرد.
 */
export async function consumeSms(
  restaurantId: string, count = 1, reason = 'reservation_notify',
): Promise<boolean> {
  // ⚠️ افزوده‌شده (۲۰۲۶-۰۸-۲۰) — رفعِ یک عدمِ تقارن، نه یک باگِ زنده.
  //
  // `topupSms` ورودی‌اش را اعتبارسنجی می‌کرد ولی این تابع نه، با اینکه هر دو
  // مسیرِ پول‌اند. اگر روزی `count` منفی برسد، `sms_balance - (-5)` موجودی را
  // *افزایش* می‌دهد و شرطِ `sms_balance >= -5` هم همیشه درست است — یعنی هم
  // گارد بی‌اثر می‌شود هم اعتبارِ رایگان ساخته می‌شود.
  //
  // ⚠️ صداقت: امروز قابلِ‌دسترس **نیست** — هر صداکننده (`sendSmsCharged` در
  // sms.ts) عددِ ثابتِ ۱ می‌فرستد. این دفاعِ در عمق است برای صداکننده‌ی بعدی،
  // نه رفعِ نشتی که در حالِ رخ‌دادن باشد. throw می‌کند و false برنمی‌گرداند چون
  // «۱ـ منفی» یک شرطِ کسب‌وکار نیست، یک خطای برنامه‌نویسی است — همان رفتارِ
  // topupSms. (خودِ چک حالا در `debitSms` است، تنها مسیرِ SQLِ کسر.)
  return (await debitSms(restaurantId, count, reason, null)) === 'charged';
}

/**
 * آیا رستوران دستِ‌کم `count` پیامک اعتبار دارد؟ فقط خواندن — چیزی کسر نمی‌کند.
 *
 * برای «چک ← ارسال ← کسر» (`sendSmsCharged` در `sms.ts`): اگر اعتبار نیست
 * ارسال نمی‌شود، ولی کسر تا پذیرشِ ارائه‌دهنده صبر می‌کند. اتمیک نیست و عمداً
 * نیست — تنها ضامنِ «موجودی منفی نمی‌شود» همان `UPDATE … WHERE sms_balance >= n`
 * در `debitSms` است، نه این چک.
 */
export async function hasSmsBalance(restaurantId: string, count = 1): Promise<boolean> {
  const r = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { smsBalance: true } });
  return !!r && r.smsBalance >= count;
}

/**
 * کسرِ یک پیامکِ **ارسال‌شده** به‌ازای یک job — حداکثر یک‌بار، هر چند بار که
 * همان job اجرا شود.
 *
 * ⚠️ دستورِ ۰۴۹ §۳: handlerِ `sms` پیش از ارسال و بدونِ کلیدِ job کسر می‌کرد، پس
 * retryِ پس از شکستِ شبکه و reclaimِ پس از کرشِ worker هر کدام یک اعتبارِ دیگر
 * می‌سوزاندند. ایندکسِ یکتای `sms_transactions.job_id` (مهاجرتِ ۰۸۷) کلیدِ
 * یکتایی است؛ پیش‌بررسیِ داخلِ تراکنش فقط راهِ ارزان است و ضامن نیست.
 */
export async function chargeSmsForJob(
  restaurantId: string, jobId: string, reason: string,
): Promise<DebitOutcome> {
  return debitSms(restaurantId, 1, reason, jobId);
}

export type DebitOutcome = 'charged' | 'already_charged' | 'insufficient';

/** تنها مسیرِ SQLِ کسرِ پیامک — `consumeSms` و `chargeSmsForJob` هر دو از این‌جا می‌روند. */
async function debitSms(
  restaurantId: string, count: number, reason: string, jobId: string | null,
): Promise<DebitOutcome> {
  if (!Number.isInteger(count) || count <= 0) {
    throw Err.validation('تعداد پیامک باید عددی صحیح و مثبت باشد');
  }
  try {
    return await db.$transaction(async (tx) => {
      if (jobId) {
        const prior = await tx.smsTransaction.findUnique({ where: { jobId }, select: { id: true } });
        if (prior) return 'already_charged';
      }
      // کاهش اتمیک فقط اگر موجودی کافی است
      const rows = await tx.$queryRaw<{ sms_balance: number }[]>`
        UPDATE restaurants
        SET sms_balance = sms_balance - ${count}, sms_total_sent = sms_total_sent + ${count}
        WHERE id = ${restaurantId}::uuid AND sms_balance >= ${count}
        RETURNING sms_balance
      `;
      if (rows.length === 0) {
        log.warn('موجودی SMS کافی نیست', { restaurantId, count });
        return 'insufficient';
      }
      await tx.smsTransaction.create({
        data: { restaurantId, delta: -count, reason, balanceAfter: rows[0].sms_balance, jobId },
      });
      return 'charged';
    });
  } catch (e) {
    // دو اجرای هم‌زمانِ همان job که هر دو از پیش‌بررسی رد شدند: دومی روی ایندکسِ
    // یکتا می‌افتد و کلِ تراکنشش — همراهِ کاهشِ موجودی — برمی‌گردد. پول یک‌بار رفته.
    if (jobId && (e as { code?: string })?.code === 'P2002') return 'already_charged';
    throw e;
  }
}

/** موجودی و تاریخچه‌ی اخیر SMS یک رستوران. */
export async function getSmsBalance(restaurantId: string) {
  const r = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { smsBalance: true, smsTotalSent: true },
  });
  if (!r) throw Err.notFound('رستوران');
  const recent = await db.smsTransaction.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' }, take: 20,
    select: { delta: true, reason: true, balanceAfter: true, note: true, createdAt: true },
  });
  return {
    balance: r.smsBalance,
    total_sent: r.smsTotalSent,
    recent_transactions: recent.map(t => ({
      delta: t.delta, reason: t.reason, balance_after: t.balanceAfter,
      note: t.note, at: t.createdAt,
    })),
  };
}
