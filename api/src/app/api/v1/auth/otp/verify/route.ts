import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { signAccess, signRefresh } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { isCurrentlyBanned } from '@/lib/ban';
import { ApiError, Err, errorResponse } from '@/lib/errors';
import { parseBody, zPhone, zOtpCode, z } from '@/lib/schemas';
import { audit, maskPhone } from '@/lib/audit';
import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ phone: zPhone, code: zOtpCode });

// ⚠️ رصدپذیری (۲۰۲۶-۰۸-۲۵): این مسیر تا امروز هیچ رویدادِ auditی صادر
// نمی‌کرد. یعنی نه ورودِ موفق ردی می‌گذاشت، نه ورودِ ناموفق —
// و چون `metrics.authFailures` فقط از راهِ `audit({action:'auth.failure'})`
// زیاد می‌شود، آلارمِ criticalِ `AuthFailureSpike` (brute-force) عملاً مرده
// بود: پنج تلاشِ واقعی با کدِ غلط، متریک را صفر نگه می‌داشت.
// شماره‌ی موبایل عمداً ماسک‌شده ثبت می‌شود (رجوع کن به maskPhone در lib/audit.ts).
async function POST_impl(req: Request) {
  const ip = clientIp(req);
  let phoneMasked: string | null = null;
  try {
    // M14: throttle per-IP روی verify — تا نتوان با پاشیدن تلاش روی چند شماره از
    // یک IP، شمارنده‌ی per-phone را دور زد (هماهنگ با staff verify).
    await enforceRateLimit(ip, RULES.otpVerify);
    const { phone, code } = await parseBody(req, schema);
    phoneMasked = maskPhone(phone);
    const userId = await verifyOtp(phone, code);
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, firstName: true, lastName: true, avatarUrl: true, bannedAt: true, unbannedAt: true, bannedReason: true },
    });
    // بن سختِ پلتفرم: OTP درست بود، ولی حسابِ بن‌شده نباید توکن بگیرد.
    if (user && isCurrentlyBanned(user)) throw Err.userBanned(user.bannedReason);
    const { bannedAt: _ba, unbannedAt: _ua, bannedReason: _br, ...publicUser } = user ?? {};
    await audit({
      action: 'auth.login', actorId: userId, actorType: 'customer', ip,
      detail: { channel: 'otp', phone_masked: phoneMasked },
    });
    return NextResponse.json({
      access: signAccess({ sub: userId, kind: 'customer' }),
      refresh: signRefresh({ sub: userId, kind: 'customer' }),
      user: user ? publicUser : null,
      // کاربر جدید = هنوز نام ثبت نکرده (برای نمایش فرم ثبت‌نام در فرانت)
      is_new: !user?.firstName,
    });
  } catch (e) {
    await audit({
      action: 'auth.failure', actorType: 'customer', ip, success: false,
      detail: { channel: 'otp', phone_masked: phoneMasked, reason: e instanceof ApiError ? e.code : 'INTERNAL' },
    });
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/otp/verify', POST_impl);
