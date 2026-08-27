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

  // ⚠️ سخت‌شده (۲۰۲۶-۰۸-۲۵) — نقش از **دیتابیس** خوانده می‌شود، نه از توکن.
  //
  // تا امروز خطِ اولِ این تابع `if (auth.role === 'owner' || 'manager') return`
  // بود و `auth.role` مستقیم از JWT می‌آمد. توکن عکسِ لحظه‌ی صدور است و
  // ۱۵ دقیقه عمر دارد و هیچ لیستِ ابطالی ندارد؛ یعنی هر تنزلِ نقش تا ۱۵ دقیقه
  // بی‌اثر می‌ماند — روی **همه‌ی** روت‌هایِ `withRestaurantAuth`، چون آن wrapper
  // برخلافِ خواهرش `withStaffAuth` نقش را تازه نمی‌کند
  // (`resolveStaffRestaurant` فقط `restaurantId`/`tenantId`/`isActive`
  // می‌خواند — نه `role`).
  //
  // ⚠️ و صادقانه دربارهٔ شدت: **امروز مسیرِ APIی برای تغییرِ نقش وجود ندارد**
  // (`PATCH /restaurant/staff` فقط name/is_active/restaurant_id/permissions را
  // می‌پذیرد — بررسی شد)، پس این یک حفره‌ی زنده و قابلِ‌سوءاستفاده نبود؛ یک
  // فرضِ نانوشته بود که با اولین «تغییرِ نقش» — چه از API، چه دستی در DB —
  // بی‌صدا به حفره تبدیل می‌شد. همان الگویی که برای `isActive` در
  // ۲۰۲۶-۰۸-۲۰ و برای `tenantId` بسته شد.
  //
  // هزینه‌اش یک کوئریِ اضافه روی کلیدِ اصلی برای مسیرِ owner/manager است
  // (قبلاً صفر کوئری داشت). اندازه‌گیری‌شده روی Postgresِ واقعی، نه تخمین —
  // عدد در پیامِ کامیت. `isActive` هم همین‌جا دوباره چک می‌شود تا این تابع
  // به‌تنهایی هم درست باشد، نه فقط وقتی از دلِ `withRestaurantAuth` می‌آید.
  const staff = await db.staff.findFirst({
    // خودِ کارمندِ لاگین‌کرده (auth.sub = staff.id) — نه یک کارمندِ دلخواه از
    // همان تنانت. باگِ قدیمی: findFirst فقط با tenantId «اولین» staff را
    // می‌گرفت، پس مجوزهای یک نفر به همه‌ی کارکنانِ تنانت اعمال می‌شد.
    where: { id: auth.sub, tenantId: auth.tenantId },
    select: { id: true, role: true, isActive: true },
  });
  if (!staff || !staff.isActive) throw Err.forbidden();

  if (staff.role === 'owner' || staff.role === 'manager') return; // دسترسی کامل

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
