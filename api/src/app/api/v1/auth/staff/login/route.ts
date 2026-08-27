import { NextResponse } from 'next/server';
import { signAccess, signRefresh } from '@/lib/jwt';
import { acceptPendingInvites } from '@/lib/provisioning';
import { clientIp } from '@/lib/ratelimit';
import { ApiError, errorResponse } from '@/lib/errors';
import { parseBody, zUsername, zPassword, z } from '@/lib/schemas';
import { getEffectivePermissions } from '@/lib/permissions';
import { resolveStaffRestaurant } from '@/lib/staff-helpers';
import { authenticateStaffByPassword } from '@/lib/password-auth';
import { normalizeUsername } from '@/lib/password';
import { audit } from '@/lib/audit';

import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ username: zUsername, password: zPassword });

/**
 * POST — ورودِ کارکنانِ رستوران با نامِ کاربری و رمز.
 *
 * ⚠️ این مسیر **جایگزینِ** `auth/staff/verify` (OTP) نیست، کنارِ آن است.
 * دلیلِ وجودش: تنها راهِ ورود پیامک بود و بدونِ `KAVENEGAR_API_KEY` هیچ‌کس
 * — حتی صاحبِ رستوران — نمی‌توانست وارد پنل شود.
 *
 * شکلِ پاسخ **عمداً بایت‌به‌بایت** همانِ مسیرِ OTP است تا پنل نیازی به دو
 * شاخه‌ی جداگانه نداشته باشد؛ هر واگرایی اینجا یعنی یکی از دو مسیرِ ورود
 * بی‌صدا نیمه‌کار می‌شود (همان کلاسِ باگی که در خودِ `verify` رخ داد و
 * صفحه‌ی ورود شعبه‌ای را نشان می‌داد که API رویش کار نمی‌کرد).
 */
async function POST_impl(req: Request) {
  const ip = clientIp(req);
  let username: string | null = null;
  try {
    const body = await parseBody(req, schema);
    username = normalizeUsername(body.username);
    // ریت‌لیمیتِ دوبُعدی و سنجشِ رمز، هر دو داخلِ همین تابع.
    const staff = await authenticateStaffByPassword(body.username, body.password, ip);

    const role = (staff.role === 'owner' || staff.role === 'manager' || staff.role === 'staff') ? staff.role : 'staff';
    // SPEC-B (C10): همان هوکِ مسیرِ OTP — دعوتِ اولین‌ورود با رمز هم پذیرفته شود.
    await acceptPendingInvites(staff.phone);
    const principal = { sub: staff.id, kind: 'staff' as const, tenantId: staff.tenantId, role };
    const permissions = await getEffectivePermissions(staff.id, role);
    const restaurant = await resolveStaffRestaurant(principal).catch(() => null);

    await audit({
      action: 'staff.login', actorId: staff.id, actorType: 'staff', ip,
      restaurantId: restaurant?.id ?? null,
      detail: { role, tenant_id: staff.tenantId, channel: 'password', username },
    });

    return NextResponse.json({
      access: signAccess(principal),
      refresh: signRefresh(principal),
      staff: {
        id: staff.id, role, tenant_id: staff.tenantId,
        restaurant_id: restaurant?.id ?? null,
        restaurant_name: restaurant?.name ?? null,
        permissions,
      },
    });
  } catch (e) {
    // ⚠️ نامِ کاربری در audit می‌ماند ولی رمز **هرگز** — نه در لاگ، نه در
    // audit، نه در متریک. تلاشِ ناموفق باید قابلِ ردیابی باشد، نه قابلِ سوءاستفاده.
    await audit({
      action: 'auth.failure', actorType: 'staff', ip, success: false,
      detail: { channel: 'staff-password', username, reason: e instanceof ApiError ? e.code : 'INTERNAL' },
    });
    return errorResponse(e);
  }
}

export const POST = withApiMetrics('/api/v1/auth/staff/login', POST_impl);
