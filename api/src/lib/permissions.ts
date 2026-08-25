import { db } from './db';
import { Err } from './errors';
import type { AccessPayload } from './jwt';

// ═══════════════════════════════════════════════════════════
//  RBAC ماژولار — مکمل role ساده‌ی فعلی (owner/manager/staff)
//  owner و manager همیشه به همه‌چیز دسترسی دارند (سازگار با گذشته).
//  برای role='staff'، اگر رکورد StaffPermission نباشد، پیش‌فرض‌های
//  امن (فقط عملیات روزمره، نه مالی/تنظیمات) اعمال می‌شود.
// ═══════════════════════════════════════════════════════════

export type PermissionKey =
  | 'canManageReservations' | 'canManageTables' | 'canManageWaitlist'
  | 'canViewAnalytics' | 'canViewRevenue' | 'canManageCampaigns'
  | 'canManageCoupons' | 'canManageStaff' | 'canManageSettings';

const SAFE_DEFAULTS: Record<PermissionKey, boolean> = {
  canManageReservations: true, canManageTables: true, canManageWaitlist: true,
  canViewAnalytics: false, canViewRevenue: false, canManageCampaigns: false,
  canManageCoupons: false, canManageStaff: false, canManageSettings: false,
};

export async function requirePermission(auth: AccessPayload, key: PermissionKey): Promise<void> {
  if (auth.kind !== 'staff') throw Err.forbidden();
  if (auth.role === 'owner' || auth.role === 'manager') return; // دسترسی کامل، بدون تغییر رفتار قبلی

  // خودِ کارمندِ لاگین‌کرده (auth.sub = staff.id) — نه یک کارمندِ دلخواه از همان تنانت.
  // باگ: findFirst فقط با tenantId «اولین» staff را می‌گرفت، پس مجوزهای یک نفر
  // به‌اشتباه به همه‌ی کارکنانِ تنانت اعمال می‌شد (privilege escalation یا denial اشتباه).
  const staff = await db.staff.findFirst({ where: { id: auth.sub, tenantId: auth.tenantId }, select: { id: true } });
  if (!staff) throw Err.forbidden();
  const perm = await db.staffPermission.findUnique({ where: { staffId: staff.id } });
  const allowed = perm ? perm[key] : SAFE_DEFAULTS[key];
  if (!allowed) throw Err.forbidden('دسترسی شما برای این بخش محدود شده است');
}

// نسخه‌ی خالص و بدونِ DB: از role و رکوردِ StaffPermission (یا null) نقشه‌ی مؤثرِ
// دسترسی را می‌سازد. دقیقاً همان منطقِ getEffectivePermissions است، فقط بدونِ
// خواندنِ DB — تا هم قابلِ تست باشد و هم صدا زننده بتواند رکوردِ perm را که از
// قبل (مثلاً با include) خوانده پاس بدهد و از N+1 پرهیز کند.
// خروجی همیشه دقیقاً همان ۹ کلیدِ PermissionKey است (نه بیشتر) تا ستون‌های دیگرِ
// StaffPermission مثل updated_at به API نشت نکنند.
export function effectivePermissionsFrom(
  role: string,
  perm: Partial<Record<PermissionKey, boolean>> | null,
): Record<PermissionKey, boolean> {
  const keys = Object.keys(SAFE_DEFAULTS) as PermissionKey[];
  if (role === 'owner' || role === 'manager') {
    return Object.fromEntries(keys.map(k => [k, true])) as Record<PermissionKey, boolean>;
  }
  return perm
    ? Object.fromEntries(keys.map(k => [k, (perm as any)[k]])) as Record<PermissionKey, boolean>
    : { ...SAFE_DEFAULTS };
}

export async function getEffectivePermissions(staffId: string, role: string): Promise<Record<PermissionKey, boolean>> {
  if (role === 'owner' || role === 'manager') return effectivePermissionsFrom(role, null);
  const perm = await db.staffPermission.findUnique({ where: { staffId } });
  return effectivePermissionsFrom(role, perm);
}
