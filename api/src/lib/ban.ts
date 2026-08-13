import { db } from './db';
import { Err } from './errors';
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

export function isCurrentlyBanned(u: BanFields): boolean {
  return u.bannedAt !== null && u.unbannedAt === null;
}

/** اگر کاربر الان بن است، ApiError(403, USER_BANNED) پرتاب می‌کند؛ وگرنه بی‌صدا برمی‌گردد. */
export async function assertUserNotBanned(userId: string): Promise<void> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { bannedAt: true, unbannedAt: true, bannedReason: true },
  });
  if (u && isCurrentlyBanned(u)) throw Err.userBanned(u.bannedReason);
}

/**
 * بن‌کردنِ یک کاربر — idempotent: اگر الان بن است، هیچ نوشتنی/auditِ تازه‌ای
 * انجام نمی‌شود (وضعیتِ فعلی همان می‌ماند، نه بازنویسیِ خاموشِ banned_at).
 */
export async function banUser(userId: string, adminId: string, reason: string, ip: string | null): Promise<{ alreadyBanned: boolean }> {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { bannedAt: true, unbannedAt: true },
  });
  if (!existing) throw Err.notFound('کاربر');
  if (isCurrentlyBanned(existing)) return { alreadyBanned: true };

  await db.user.update({
    where: { id: userId },
    data: { bannedAt: new Date(), bannedReason: reason, bannedByAdminId: adminId, unbannedAt: null, unbanReason: null },
  });
  await audit({ action: 'user.ban', actorId: adminId, actorType: 'admin', targetId: userId, ip, detail: { reason } });
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
