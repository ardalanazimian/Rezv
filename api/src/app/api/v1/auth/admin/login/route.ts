import { NextResponse } from 'next/server';
import { signAccess, signRefresh } from '@/lib/jwt';
import { clientIp, enforceRateLimit, RULES } from '@/lib/ratelimit';
import { ApiError, Err, errorResponse } from '@/lib/errors';
import { parseBody, zUsername, zPassword, z } from '@/lib/schemas';
import { authenticateStaffByPassword } from '@/lib/password-auth';
import { normalizeUsername } from '@/lib/password';
import { audit } from '@/lib/audit';
import { adminLoginEnabled, verifyAdminTotp, type TotpOutcome } from '@/lib/admin-totp';

import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({
  username: zUsername,
  password: zPassword,
  // عاملِ سوم — فقط وقتی `ADMIN_LOGIN_ENABLED=true` است اصلاً خوانده می‌شود.
  // اختیاری در شِیما تا وقتی قابلیت خاموش است، رفتارِ امروز **بایت‌به‌بایت**
  // دست‌نخورده بماند (کلاینتِ قدیمی همچنان بدونِ این فیلد کار می‌کند).
  totp: z.string().trim().min(1).max(16).optional(),
});

/**
 * POST — ورودِ مدیرِ پلتفرم (پنلِ شرکت).
 *
 * ⚠️ احرازِ هویت و **مجوز** عمداً دو مرحله‌ی جدا هستند:
 * `authenticateStaffByPassword` فقط می‌گوید «این رمز مالِ این حساب است»؛
 * مدیرِ پلتفرم بودن یک شرطِ **مستقل** است که از DB خوانده می‌شود، دقیقاً
 * مثلِ مسیرِ OTP (`findPlatformAdmin`). یعنی یک کارمندِ عادی با رمزِ درستِ
 * خودش هم اینجا رد می‌شود.
 *
 * چرا چکِ نقش اینجا و نه داخلِ تابعِ مشترک: تابعِ مشترک برای هر دو پنل است؛
 * اگر شرطِ ادمین را داخلش می‌بردیم، مسیرِ رستوران هم به آن آلوده می‌شد.
 *
 * ── عاملِ سوم (TOTP، ۲۰۲۶-۰۸-۲۹) ──
 * وقتی `ADMIN_LOGIN_ENABLED=true` باشد، علاوه بر رمز یک کدِ ۶ رقمیِ TOTP هم
 * لازم است (RFC 6238، کاملاً آفلاین — رجوع به `lib/admin-totp.ts`).
 * پیش‌فرض **خاموش** است و در آن حالت این مسیر دقیقاً همان رفتارِ قبلی را
 * دارد. توکنِ صادرشده در هر دو حالت **یکسان** است، پس RBAC و
 * tenant isolation و `requireAdmin` اصلاً لمس نمی‌شوند.
 */
async function POST_impl(req: Request) {
  const ip = clientIp(req);
  let username: string | null = null;
  let totpOutcome: TotpOutcome | 'skipped' = 'skipped';
  try {
    const platformTenantId = process.env.PLATFORM_ADMIN_TENANT_ID;
    if (!platformTenantId) throw Err.forbidden('پنل شرکت پیکربندی نشده است');

    const body = await parseBody(req, schema);
    username = normalizeUsername(body.username);

    // ── سقفِ تلاش، **پیش از** هر کارِ گران‌قیمت (scrypt یک KDFِ حافظه‌سخت است) ──
    // رویِ هر دو بُعد، مثلِ `passwordLogin`: per-IP جلوی پویشِ یک مهاجم و
    // per-username جلوی پویشِ توزیع‌شده رویِ همان حسابِ ادمین.
    if (adminLoginEnabled()) {
      await enforceRateLimit(`ip:${ip}`, RULES.adminTotpLogin);
      await enforceRateLimit(`user:${username}`, RULES.adminTotpLogin);
    }

    const staff = await authenticateStaffByPassword(body.username, body.password, ip);

    // مجوز — همان سه شرطِ `findPlatformAdmin`، از ردیفِ تازه‌خوانده‌ی DB.
    // (`isActive` را خودِ تابعِ احراز هم چک کرده؛ اینجا صریح تکرار می‌شود تا
    // این روت به‌تنهایی هم درست باشد، نه فقط به اتکای صداکننده‌اش.)
    if (staff.tenantId !== platformTenantId || staff.role !== 'owner' || !staff.isActive) {
      throw Err.forbidden('این حساب مدیر پلتفرم نیست');
    }

    // ── عاملِ سوم ──
    // ⚠️ عمداً **بعد** از احرازِ رمز: تا اینجا نرسیم، وجود یا نبودِ راز هیچ
    // چیزی درباره‌ی درستیِ رمز لو نمی‌دهد.
    if (adminLoginEnabled()) {
      totpOutcome = await verifyAdminTotp(username, body.totp ?? '');
      if (totpOutcome !== 'ok') {
        // ⚠️ **همان** خطایی که مسیرِ رمز می‌دهد (`Err.invalidCredentials`)،
        // نه یک کدِ تازه: اگر شکستِ TOTP از شکستِ رمز قابلِ تفکیک باشد، مهاجم
        // می‌فهمد کدام نیمه را درست حدس زده و فضایِ جست‌وجویش نصف می‌شود.
        // fail-closed: نبودِ پیکربندی هم مثلِ کدِ غلط، **ورود ممنوع** است —
        // نه بازگشتِ بی‌صدا به دو عاملی.
        throw Err.invalidCredentials();
      }
    }

    const principal = { sub: staff.id, kind: 'staff' as const, tenantId: staff.tenantId, role: 'owner' as const };
    // بالاترین سطحِ دسترسیِ پلتفرم — ورودش حتماً باید ردِ audit داشته باشد.
    await audit({
      action: 'auth.login', actorId: staff.id, actorType: 'admin', ip,
      detail: {
        channel: 'platform-admin-password', tenant_id: staff.tenantId, username,
        totp: totpOutcome,
      },
    });
    return NextResponse.json({
      access: signAccess(principal),
      refresh: signRefresh(principal),
      admin: { id: staff.id, tenant_id: staff.tenantId, tenant_name: staff.tenant.name },
    });
  } catch (e) {
    await audit({
      action: 'auth.failure', actorType: 'admin', ip, success: false,
      detail: {
        channel: 'platform-admin-password', username,
        reason: e instanceof ApiError ? e.code : 'INTERNAL',
        totp: totpOutcome,
      },
    });
    return errorResponse(e);
  }
}

/**
 * GET — فقط یک پرچم: آیا فرمِ ورود باید فیلدِ TOTP را نشان بدهد؟
 *
 * ⚠️ چرا لازم است: پنلِ شرکت یک اپِ استاتیک است و `process.env` را نمی‌بیند.
 * بدونِ این، UI مجبور می‌شد فیلد را همیشه رندر کند و با CSS پنهانش کند —
 * و `display:none` قبلاً در همین مخزن با `display:flex` دور زده شده بود.
 * پس تصمیم باید **سمتِ سرور** گرفته شود و فیلد اصلاً در DOM نیاید.
 *
 * ⚠️ این نشتِ اطلاعات نیست: روشن‌بودنِ دوعاملی رازِ امنیتی نیست — مهاجم در
 * اولین تلاش هم می‌فهمید. رازِ واقعی `ADMIN_TOTP_SECRET` است که هرگز از
 * این‌جا بیرون نمی‌رود.
 */
async function GET_impl() {
  return NextResponse.json({ totp_required: adminLoginEnabled() });
}

export const GET = withApiMetrics('/api/v1/auth/admin/login', GET_impl);
export const POST = withApiMetrics('/api/v1/auth/admin/login', POST_impl);
