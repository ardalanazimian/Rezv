import { NextResponse } from 'next/server';
import { verifyOtp, normalizePhone } from '@/lib/otp';
import { signAccess, signRefresh } from '@/lib/jwt';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, zPhone, zOtpCode, z } from '@/lib/schemas';
import { getEffectivePermissions } from '@/lib/permissions';
import { resolveStaffRestaurant } from '@/lib/staff-helpers';

const schema = z.object({ phone: zPhone, code: zOtpCode });

/** POST — تأیید کد و صدور توکن staff (با نقش و tenant) */
export async function POST(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.otpVerify);
    const { phone, code } = await parseBody(req, schema);
    const normalized = normalizePhone(phone);
    const staff = await db.staff.findFirst({ where: { phone: normalized } });
    if (!staff) throw Err.forbidden('این شماره دسترسی پنل رستوران ندارد');
    if (!staff.isActive) throw Err.forbidden('این حساب غیرفعال شده است');
    await verifyOtp(normalized, code);
    const role = (staff.role === 'owner' || staff.role === 'manager' || staff.role === 'staff') ? staff.role : 'staff';
    const principal = { sub: staff.id, kind: 'staff' as const, tenantId: staff.tenantId, role };
    const access = signAccess(principal);
    const refresh = signRefresh(principal);
    // مجوزهای مؤثرِ همین کارمند تا پنل بتواند UI را مطابقِ دسترسیِ واقعی محدود کند.
    // بدون این، کارمندِ محدودشده همه‌ی صفحات را می‌دید و فقط هنگامِ درخواست ۴۰۳ می‌گرفت.
    const permissions = await getEffectivePermissions(staff.id, role);
    // ⚠️ رفعِ باگ (پیدا‌شده با تستِ واقعیِ end-to-end): قبلاً اینجا از یک
    // کوئریِ جدا (tenant.restaurants[0]، بدونِ orderBy و بدونِ احترام به
    // قفلِ شعبه‌ی staff) استفاده می‌شد که می‌توانست با آنچه
    // withRestaurantAuth/resolveStaffRestaurant در فراخوانی‌های بعدی
    // برمی‌گرداند فرق کند — یعنی صفحه‌ی لاگین یک شعبه را نشان می‌داد ولی کلِ
    // API روی شعبه‌ی دیگری کار می‌کرد. حالا از همان تابعِ واحد استفاده
    // می‌شود تا این دو مسیر هرگز نتوانند از هم جدا بیفتند.
    const restaurant = await resolveStaffRestaurant(principal).catch(() => null);
    return NextResponse.json({
      access, refresh,
      staff: { id: staff.id, role, tenant_id: staff.tenantId, restaurant_id: restaurant?.id ?? null, restaurant_name: restaurant?.name ?? null, permissions },
    });
  } catch (e) { return errorResponse(e); }
}
