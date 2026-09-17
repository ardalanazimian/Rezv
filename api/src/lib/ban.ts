import { BanReasonKey } from '@prisma/client';
import { db } from './db';
import { Err, type ApiError } from './errors';
import { audit } from './audit';

// ═══════════════════════════════════════════════════════════════════════
//  بن سختِ پلتفرم (Company Control Plane، فازِ ۲ — B1)
//
//  عمداً کاملاً جدا از customer_economy_profiles.has_active_abuse_flag:
//   • abuse flag → نرم، خودکار/الگوریتمی (fraud.ts)، مسیرها را مسدود نمی‌کند
//     (فقط برایِ نمایش/بررسیِ دستیِ تیمِ پلتفرم است).
//   • بن سخت → تصمیمِ *دستیِ* ادمینِ پلتفرم، مسیرهایِ احراز/رزرو را واقعاً
//     می‌بندد (۴۰۳ با کدِ پایدارِ USER_BANNED).
//
//  «الان بن است» = banned_at ست شده و unbanned_at نال است.
// ═══════════════════════════════════════════════════════════════════════

export type BanFields = { bannedAt: Date | null; unbannedAt: Date | null };

/**
 * کلیدهای مجازِ دلیلِ عمومی — **از enumِ Prisma**، نه فهرستِ دوم (F003 · مهاجرتِ ۰۹۱).
 * متنِ فارسیِ هر کلید در اپِ مشتری است؛ سرور فقط کلید را می‌دهد.
 */
export const BAN_REASON_KEYS = Object.values(BanReasonKey) as readonly BanReasonKey[];

/**
 * خطای ۴۰۳ِ USER_BANNED برای **خودِ کاربر** — تنها سازنده‌ی آن.
 *
 * ⚠️ F003 (STATE M-14): فقط `bannedReasonKey` و `bannedAt` وارد می‌شوند. `bannedReason` (یادداشتِ
 * داخلیِ ادمین) عمداً پارامتر نیست تا هیچ فراخوانی نتواند دوباره آن را به پاسخ برساند —
 * همان کاری که `otp/verify` و دستِ‌سازِ `auth/refresh` تا ۲۰۲۶-۰۹-۱۷ می‌کردند.
 */
export function bannedError(u: { bannedReasonKey: BanReasonKey | null; bannedAt: Date | null }): ApiError {
  return Err.userBanned(u.bannedReasonKey, u.bannedAt);
}

export function isCurrentlyBanned(u: BanFields): boolean {
  return u.bannedAt !== null && u.unbannedAt === null;
}

/** اگر کاربر الان بن است، ApiError(403, USER_BANNED) پرتاب می‌کند؛ وگرنه بی‌صدا برمی‌گردد. */
export async function assertUserNotBanned(userId: string): Promise<void> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { bannedAt: true, unbannedAt: true, bannedReasonKey: true },
  });
  if (u && isCurrentlyBanned(u)) throw bannedError(u);
}

/**
 * بن‌کردنِ یک کاربر — idempotent: اگر الان بن است، هیچ نوشتنی/auditِ تازه‌ای
 * انجام نمی‌شود (وضعیتِ فعلی همان می‌ماند، نه بازنویسیِ خاموشِ banned_at).
 *
 * دو ورودیِ جدا برای دو مخاطب (F003): `reasonKey` به خودِ کاربر نشان داده می‌شود؛ `note`
 * یادداشتِ داخلیِ ادمین است و فقط در `users.banned_reason` و audit می‌ماند.
 */
export async function banUser(
  userId: string, adminId: string,
  input: { reasonKey: BanReasonKey; note: string },
  ip: string | null,
): Promise<{ alreadyBanned: boolean }> {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { bannedAt: true, unbannedAt: true },
  });
  if (!existing) throw Err.notFound('کاربر');
  if (isCurrentlyBanned(existing)) return { alreadyBanned: true };

  await db.user.update({
    where: { id: userId },
    data: {
      bannedAt: new Date(), bannedReason: input.note, bannedReasonKey: input.reasonKey,
      bannedByAdminId: adminId, unbannedAt: null, unbanReason: null,
    },
  });
  await audit({
    action: 'user.ban', actorId: adminId, actorType: 'admin', targetId: userId, ip,
    detail: { reason_key: input.reasonKey, reason: input.note },
  });
  return { alreadyBanned: false };
}

/** رفعِ بن — idempotent: اگر الان بن نیست، هیچ نوشتنی/auditِ تازه‌ای انجام نمی‌شود. */
export async function unbanUser(userId: string, adminId: string, reason: string | undefined, ip: string | null): Promise<{ alreadyUnbanned: boolean }> {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { bannedAt: true, unbannedAt: true },
  });
  if (!existing) throw Err.notFound('کاربر');
  if (!isCurrentlyBanned(existing)) return { alreadyUnbanned: true };

  await db.user.update({
    where: { id: userId },
    data: { unbannedAt: new Date(), unbanReason: reason ?? null },
  });
  await audit({ action: 'user.unban', actorId: adminId, actorType: 'admin', targetId: userId, ip, detail: { reason: reason ?? null } });
  return { alreadyUnbanned: false };
}
