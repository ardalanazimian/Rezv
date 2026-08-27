import { NextResponse } from 'next/server';
import { requestOtp } from '@/lib/otp';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { ApiError, Err, errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { findPlatformAdmin } from '@/lib/platform-admin';
import { audit, maskPhone } from '@/lib/audit';

import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ phone: zPhone });

// ═══════════════════════════════════════════════════════════════════════
//  ⚠️ رفعِ شمارش‌پذیریِ شماره (فازِ ۲، یافته‌ی ۱۸ در docs/recovery/OPEN-FINDINGS.md)
//
//  قبلاً: شماره‌ی غیرادمین ۴۰۳ «این شماره مدیر پلتفرم نیست» می‌گرفت و ادمینِ
//  واقعی ۲۰۴. یعنی این endpoint یک اوراکلِ کاملِ «آیا این شماره ابَرادمین
//  است؟» بود — و آن حساب **تنها** حسابِ ابَرادمینِ پلتفرم است، یعنی
//  پرامتیازترین هدفِ کلِ سامانه. با `RULES.otpVerify` (۸ در ۱۰ دقیقه به‌ازای
//  هر IP) پروب‌کردنِ فهرستی از شماره‌های کاندید کاملاً عملی است، و نتیجه‌اش
//  یک هدفِ مشخص برای SIM-swap یا مهندسیِ اجتماعی است.
//
//  حالا: پاسخ برای «ادمین نیست» و «ادمین هست» یکسان است. **هزینه‌ای اضافه
//  نمی‌شود** — پیامک همچنان فقط برای شماره‌ی معتبر می‌رود؛ فقط *پاسخ* یکدست شد.
//
//  دو چیزی که عمداً یکدست **نشدند**، چون هیچ‌کدام تابعِ شماره نیستند و پس
//  اوراکل نمی‌سازند:
//   • خطای پیکربندی (`PLATFORM_ADMIN_TENANT_ID` تنظیم نشده) — بلعیدنش یعنی
//     یک استقرارِ خراب بی‌صدا ۲۰۴ می‌دهد و هیچ‌کس نمی‌تواند وارد شود، بدونِ
//     هیچ خطای قابلِ‌مشاهده‌ای. همان ضدالگویِ ALLOWED_ORIGINS.
//   • شماره‌ی بدشکل (۴۲۲ از `zPhone`/`normalizePhone`).
//
//  و چون سیگنال از پاسخِ HTTP حذف شد، `auth.failure` به audit اضافه شد —
//  وگرنه رفعِ امنیتی، رصدپذیری را می‌کشت (متریکِ
//  `rezervno_auth_failures_total` و آلارمِ `AuthFailureSpike` از همین تغذیه
//  می‌شوند؛ رجوع کن به توضیحِ داخلِ lib/audit.ts).
// ═══════════════════════════════════════════════════════════════════════

async function POST_impl(req: Request) {
  const ip = clientIp(req);
  try {
    await enforceRateLimit(ip, RULES.otpVerify);
    const { phone } = await parseBody(req, schema);
    const phoneMasked = maskPhone(phone);

    // خطای پیکربندی صریح می‌ماند (تابعِ شماره نیست ⇒ اوراکل نیست).
    if (!process.env.PLATFORM_ADMIN_TENANT_ID) throw Err.forbidden('پنل شرکت پیکربندی نشده است');

    // فقط ۴۰۳ِ «ادمین نیست» بلعیده می‌شود. خطای واقعی (DB/شبکه) باید بالا
    // برود — بندِ ۳: شکستِ زیرساخت هرگز نباید به موفقیتِ خاموش تبدیل شود.
    const admin = await findPlatformAdmin(phone).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 403) return null;
      throw e;
    });

    if (!admin) {
      await audit({
        action: 'auth.failure', actorType: 'admin', ip, success: false,
        detail: { channel: 'admin-request', phone_masked: phoneMasked, reason: 'NOT_PLATFORM_ADMIN' },
      });
      return new NextResponse(null, { status: 204 });
    }

    const result = await requestOtp(phone);
    return result.devCode ? NextResponse.json(result) : new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/admin/request', POST_impl);
