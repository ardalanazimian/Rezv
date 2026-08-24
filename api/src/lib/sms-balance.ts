import { db } from './db';
import { createLogger } from './logger';
import { Err } from './errors';

const log = createLogger('sms-balance');

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
  return db.$transaction(async (tx) => {
    // کاهش اتمیک فقط اگر موجودی کافی است
    const rows = await tx.$queryRaw<{ sms_balance: number }[]>`
      UPDATE restaurants
      SET sms_balance = sms_balance - ${count}, sms_total_sent = sms_total_sent + ${count}
      WHERE id = ${restaurantId}::uuid AND sms_balance >= ${count}
      RETURNING sms_balance
    `;
    if (rows.length === 0) {
      log.warn('موجودی SMS کافی نیست', { restaurantId, count });
      return false;
    }
    await tx.smsTransaction.create({
      data: { restaurantId, delta: -count, reason, balanceAfter: rows[0].sms_balance },
    });
    return true;
  });
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
