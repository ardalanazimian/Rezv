import { db } from './db';
import { ApiError, Err } from './errors';
import { audit } from './audit';

// ═══════════════════════════════════════════════════════════════════════
//  نشان‌هایِ کنترل‌شده‌یِ پلتفرم (Company Control Plane، فازِ ۳)
//  رجوع کن به schema.prisma برایِ توضیحِ کاملِ جداییِ این سیستم از
//  BADGES قدیمیِ اپِ کاستومر و «آماده‌یِ بلاکچین»ِ chainTxHash/tokenId.
// ═══════════════════════════════════════════════════════════════════════

export async function listBadgeDefinitions(includeInactive = false) {
  return db.badgeDefinition.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBadgeDefinition(input: {
  key: string; name: string; description?: string; icon?: string; color?: string; adminId: string;
}) {
  const existing = await db.badgeDefinition.findUnique({ where: { key: input.key } });
  if (existing) throw new ApiError('BADGE_KEY_TAKEN', 'این کلید قبلاً استفاده شده', 409);

  const badge = await db.badgeDefinition.create({
    data: {
      key: input.key, name: input.name, description: input.description ?? null,
      icon: input.icon || 'star', color: input.color ?? null, createdByAdminId: input.adminId,
    },
  });
  await audit({ action: 'badge.created', actorId: input.adminId, actorType: 'admin', targetId: badge.id, detail: { key: badge.key } });
  return badge;
}

export async function updateBadgeDefinition(id: string, input: {
  name?: string; description?: string | null; icon?: string; color?: string | null; isActive?: boolean; adminId: string;
}) {
  const existing = await db.badgeDefinition.findUnique({ where: { id } });
  if (!existing) throw Err.notFound('نشان');

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.color !== undefined) data.color = input.color;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const badge = await db.badgeDefinition.update({ where: { id }, data });
  await audit({ action: 'badge.updated', actorId: input.adminId, actorType: 'admin', targetId: id, detail: data });
  return badge;
}

/** اعطایِ یک نشان به کاربر — idempotent: اگر همین حالا فعال است، نوشتنِ تازه/audit تازه انجام نمی‌شود. */
export async function grantBadge(badgeId: string, userId: string, adminId: string, note: string | undefined, ip: string | null) {
  const badge = await db.badgeDefinition.findUnique({ where: { id: badgeId } });
  if (!badge) throw Err.notFound('نشان');
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw Err.notFound('کاربر');

  const active = await db.userBadge.findFirst({ where: { badgeId, userId, revokedAt: null } });
  if (active) return { alreadyGranted: true, grant: active };

  const grant = await db.userBadge.create({
    data: { badgeId, userId, grantedByAdminId: adminId, note: note ?? null },
  });
  await audit({ action: 'badge.granted', actorId: adminId, actorType: 'admin', targetId: userId, ip, detail: { badgeId, badgeKey: badge.key } });
  return { alreadyGranted: false, grant };
}

/** لغوِ یک نشانِ فعال — idempotent: اگر الان فعالی وجود ندارد، هیچ نوشتنی/auditِ تازه‌ای انجام نمی‌شود. */
export async function revokeBadge(badgeId: string, userId: string, adminId: string, reason: string | undefined, ip: string | null) {
  const active = await db.userBadge.findFirst({ where: { badgeId, userId, revokedAt: null } });
  if (!active) return { alreadyRevoked: true };

  await db.userBadge.update({
    where: { id: active.id },
    data: { revokedAt: new Date(), revokedByAdminId: adminId, revokeReason: reason ?? null },
  });
  await audit({ action: 'badge.revoked', actorId: adminId, actorType: 'admin', targetId: userId, ip, detail: { badgeId, reason: reason ?? null } });
  return { alreadyRevoked: false };
}

/** نشان‌هایِ فعالِ یک کاربر — برایِ Customer 360. */
export async function listActiveBadgesForUser(userId: string) {
  const grants = await db.userBadge.findMany({
    where: { userId, revokedAt: null },
    orderBy: { grantedAt: 'desc' },
    include: { badge: { select: { key: true, name: true, icon: true, color: true } } },
  });
  return grants.map(g => ({
    id: g.id, key: g.badge.key, name: g.badge.name, icon: g.badge.icon, color: g.badge.color,
    granted_at: g.grantedAt, note: g.note,
  }));
}
