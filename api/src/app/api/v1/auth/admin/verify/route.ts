import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { signAccess, signRefresh } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { ApiError, Err, errorResponse } from '@/lib/errors';
import { parseBody, zPhone, zOtpCode, z } from '@/lib/schemas';
import { findPlatformAdmin } from '@/lib/platform-admin';
import { audit, maskPhone } from '@/lib/audit';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ phone: zPhone, code: zOtpCode });

async function POST_impl(req: Request) {
  const ip = clientIp(req);
  let phoneMasked: string | null = null;
  try {
    // ── گاردِ فلگ (۲۰۲۶-۰۹-۰۲) ──
    // ⚠️ **پیش از هر کارِ دیگر**، حتی پیش از ریت‌لیمیت و پارسِ بدنه: وقتی
    // قابلیت خاموش است این مسیر باید طوری رفتار کند که انگار **وجود ندارد**
    // (۴۰۴، نه ۴۰۳). تفاوتِ ۴۰۳ و ۴۰۴ به مهاجم می‌گوید مسیری هست که فقط
    // بسته است — و او منتظرِ روشن‌شدنش می‌ماند.
    //
    // چرا این مسیر باید بسته باشد: همان principalِ platform-admin را صادر
    // می‌کند بدونِ اینکه TOTP بخواهد، یعنی عاملِ سومِ `auth/admin/login` را
    // کاملاً دور می‌زند. رجوع به توضیحِ `DEFAULT_OFF` در lib/feature-flags.ts
    if (!(await isFeatureEnabled('admin_otp_login_enabled'))) throw Err.notFound('مسیر');

    await enforceRateLimit(ip, RULES.otpVerify);
    const { phone, code } = await parseBody(req, schema);
    phoneMasked = maskPhone(phone);
    const admin = await findPlatformAdmin(phone);
    await verifyOtp(phone, code);
    const principal = { sub: admin.id, kind: 'staff' as const, tenantId: admin.tenantId, role: 'owner' as const };
    // بالاترین سطحِ دسترسیِ پلتفرم — ورودش حتماً باید ردِ audit داشته باشد.
    await audit({
      action: 'auth.login', actorId: admin.id, actorType: 'admin', ip,
      detail: { channel: 'platform-admin', tenant_id: admin.tenantId, phone_masked: phoneMasked },
    });
    return NextResponse.json({
      access: signAccess(principal),
      refresh: signRefresh(principal),
      admin: { id: admin.id, tenant_id: admin.tenantId, tenant_name: admin.tenant.name },
    });
  } catch (e) {
    await audit({
      action: 'auth.failure', actorType: 'admin', ip, success: false,
      detail: { channel: 'platform-admin', phone_masked: phoneMasked, reason: e instanceof ApiError ? e.code : 'INTERNAL' },
    });
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/admin/verify', POST_impl);
