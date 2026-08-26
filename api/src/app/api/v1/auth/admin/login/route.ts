import { NextResponse } from 'next/server';
import { signAccess, signRefresh } from '@/lib/jwt';
import { clientIp } from '@/lib/ratelimit';
import { ApiError, Err, errorResponse } from '@/lib/errors';
import { parseBody, zUsername, zPassword, z } from '@/lib/schemas';
import { authenticateStaffByPassword } from '@/lib/password-auth';
import { normalizeUsername } from '@/lib/password';
import { audit } from '@/lib/audit';

import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ username: zUsername, password: zPassword });

/**
 * POST — ورودِ مدیرِ پلتفرم (پنلِ شرکت) با نامِ کاربری و رمز.
 *
 * ⚠️ احرازِ هویت و **مجوز** عمداً دو مرحله‌ی جدا هستند:
 * `authenticateStaffByPassword` فقط می‌گوید «این رمز مالِ این حساب است»؛
 * مدیرِ پلتفرم بودن یک شرطِ **مستقل** است که از DB خوانده می‌شود، دقیقاً
 * مثلِ مسیرِ OTP (`findPlatformAdmin`). یعنی یک کارمندِ عادی با رمزِ درستِ
 * خودش هم اینجا رد می‌شود.
 *
 * چرا چکِ نقش اینجا و نه داخلِ تابعِ مشترک: تابعِ مشترک برای هر دو پنل است؛
 * اگر شرطِ ادمین را داخلش می‌بردیم، مسیرِ رستوران هم به آن آلوده می‌شد.
 */
async function POST_impl(req: Request) {
  const ip = clientIp(req);
  let username: string | null = null;
  try {
    const platformTenantId = process.env.PLATFORM_ADMIN_TENANT_ID;
    if (!platformTenantId) throw Err.forbidden('پنل شرکت پیکربندی نشده است');

    const body = await parseBody(req, schema);
    username = normalizeUsername(body.username);
    const staff = await authenticateStaffByPassword(body.username, body.password, ip);

    // مجوز — همان سه شرطِ `findPlatformAdmin`، از ردیفِ تازه‌خوانده‌ی DB.
    // (`isActive` را خودِ تابعِ احراز هم چک کرده؛ اینجا صریح تکرار می‌شود تا
    // این روت به‌تنهایی هم درست باشد، نه فقط به اتکای صداکننده‌اش.)
    if (staff.tenantId !== platformTenantId || staff.role !== 'owner' || !staff.isActive) {
      throw Err.forbidden('این حساب مدیر پلتفرم نیست');
    }

    const principal = { sub: staff.id, kind: 'staff' as const, tenantId: staff.tenantId, role: 'owner' as const };
    // بالاترین سطحِ دسترسیِ پلتفرم — ورودش حتماً باید ردِ audit داشته باشد.
    await audit({
      action: 'auth.login', actorId: staff.id, actorType: 'admin', ip,
      detail: { channel: 'platform-admin-password', tenant_id: staff.tenantId, username },
    });
    return NextResponse.json({
      access: signAccess(principal),
      refresh: signRefresh(principal),
      admin: { id: staff.id, tenant_id: staff.tenantId, tenant_name: staff.tenant.name },
    });
  } catch (e) {
    await audit({
      action: 'auth.failure', actorType: 'admin', ip, success: false,
      detail: { channel: 'platform-admin-password', username, reason: e instanceof ApiError ? e.code : 'INTERNAL' },
    });
    return errorResponse(e);
  }
}

export const POST = withApiMetrics('/api/v1/auth/admin/login', POST_impl);
