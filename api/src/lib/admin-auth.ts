import { verifyAccess } from './jwt';
import { Err } from './errors';

/**
 * احراز هویت مدیر پلتفرم (پنل شرکت).
 * مدیر پلتفرم = یک staff با role='owner' که به tenant پلتفرم تعلق دارد.
 * tenant پلتفرم از env تعیین می‌شود (PLATFORM_ADMIN_TENANT_ID).
 *
 * ⚠️ امنیت (C2): اگر PLATFORM_ADMIN_TENANT_ID تنظیم نشده باشد، دسترسی رد می‌شود
 * (fail-closed). قبلاً اگر این env غایب بود، چک tenant کلاً نادیده گرفته می‌شد و
 * «هر» صاحب رستورانی به پنل شرکت/پلتفرم دسترسی پیدا می‌کرد (نشت کامل عایق‌بندی
 * multi-tenant). حالا نبودِ پیکربندی = هیچ‌کس دسترسی ندارد، نه همه.
 */
export function adminAuthFromRequest(req: Request): { sub: string; tenantId: string } {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) throw Err.unauthorized();
  const payload = verifyAccess(h.slice(7));
  if (payload.kind !== 'staff' || payload.role !== 'owner') {
    throw Err.forbidden('دسترسی مدیر پلتفرم لازم است');
  }
  const platformTenant = process.env.PLATFORM_ADMIN_TENANT_ID;
  // fail-closed: بدون پیکربندی tenant پلتفرم، هیچ دسترسی admin داده نمی‌شود.
  if (!platformTenant) {
    throw Err.forbidden('پنل شرکت پیکربندی نشده است');
  }
  if (payload.tenantId !== platformTenant) {
    throw Err.forbidden('این حساب دسترسی پنل شرکت ندارد');
  }
  return { sub: payload.sub, tenantId: payload.tenantId };
}
