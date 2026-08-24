import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/otp';
import { signAccess, signRefresh } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { isCurrentlyBanned } from '@/lib/ban';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, zPhone, zOtpCode, z } from '@/lib/schemas';

const schema = z.object({ phone: zPhone, code: zOtpCode });

export async function POST(req: Request) {
  try {
    // M14: throttle per-IP روی verify — تا نتوان با پاشیدن تلاش روی چند شماره از
    // یک IP، شمارنده‌ی per-phone را دور زد (هماهنگ با staff verify).
    await enforceRateLimit(clientIp(req), RULES.otpVerify);
    const { phone, code } = await parseBody(req, schema);
    const userId = await verifyOtp(phone, code);
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, firstName: true, lastName: true, avatarUrl: true, bannedAt: true, unbannedAt: true, bannedReason: true },
    });
    // بن سختِ پلتفرم: OTP درست بود، ولی حسابِ بن‌شده نباید توکن بگیرد.
    if (user && isCurrentlyBanned(user)) throw Err.userBanned(user.bannedReason);
    const { bannedAt: _ba, unbannedAt: _ua, bannedReason: _br, ...publicUser } = user ?? {};
    return NextResponse.json({
      access: signAccess({ sub: userId, kind: 'customer' }),
      refresh: signRefresh({ sub: userId, kind: 'customer' }),
      user: user ? publicUser : null,
      // کاربر جدید = هنوز نام ثبت نکرده (برای نمایش فرم ثبت‌نام در فرانت)
      is_new: !user?.firstName,
    });
  } catch (e) { return errorResponse(e); }
}
