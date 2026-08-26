import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

// توکن = ۶۴ کاراکترِ hex (randomBytes(32) در provisioning.ts). شکلِ نامعتبر
// همان مسیرِ notFound را می‌رود تا فرمِ توکن هم چیزی لو ندهد.
const paramsSchema = z.object({ token: z.string().min(8).max(128) });

/**
 * POST — «claim»ِ دعوت (SPEC-B §۵، §۶-۱): تبدیلِ لینکِ پیامکی به شروعِ فلوی ورود.
 *
 * ⚠️ عمداً هیچ‌چیزی mutate نمی‌کند و توکن **احرازِ هویت نیست** (§۳-۲ spec):
 * فقط اعلام می‌کند این دعوت مالِ کدام رستوران/شماره است و کدام روش‌های ورود
 * برای آن حساب فعال‌اند (C10ِ برنامه: از ۰۷۴ رمز هم داریم، نه فقط OTP).
 * پذیرشِ واقعیِ دعوت side-effectِ ورودِ موفق است (verify/login).
 *
 * منقضی/نامعتبر/باطل‌شده → یکسان NOT_FOUND (جدولِ §۷؛ بدونِ افشای تفکیک).
 */
async function POST_impl(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { token } = parseParams(await params, paramsSchema);

    const invite = await db.staffInvite.findUnique({
      where: { token },
      select: {
        status: true, expiresAt: true, phone: true,
        restaurant: { select: { name: true, slug: true } },
        staff: { select: { username: true } },
      },
    });
    if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
      throw Err.notFound('دعوت');
    }

    const local = invite.phone.startsWith('+98') ? '0' + invite.phone.slice(3) : invite.phone;
    return NextResponse.json({
      restaurant: { name: invite.restaurant.name, slug: invite.restaurant.slug },
      phone_mask: local.length >= 7 ? `${local.slice(0, 4)}***${local.slice(-4)}` : '***',
      methods: { otp: true, password: !!invite.staff.username },
      expires_at: invite.expiresAt,
    });
  } catch (e) { return errorResponse(e); }
}

export const POST = withApiMetrics('/api/v1/auth/invite/[token]/claim', POST_impl);
