import { db } from './db';
import { Err } from './errors';
import { normalizePhone } from './otp';

export async function findPlatformAdmin(rawPhone: string) {
  const platformTenantId = process.env.PLATFORM_ADMIN_TENANT_ID;
  const phone = normalizePhone(rawPhone);
  if (!platformTenantId && process.env.NODE_ENV !== 'production') {
    const fallback = await db.staff.findFirst({
      where: { phone, isActive: true },
      include: { tenant: { select: { id: true, name: true } } },
    });
    if (fallback) return fallback;
  }

  if (!platformTenantId) throw Err.forbidden('پنل شرکت پیکربندی نشده است');

  const staff = await db.staff.findFirst({
    where: { phone, tenantId: platformTenantId, role: 'owner', isActive: true },
    include: { tenant: { select: { id: true, name: true } } },
  });
  if (!staff) throw Err.forbidden('این شماره مدیر پلتفرم نیست');
  return staff;
}