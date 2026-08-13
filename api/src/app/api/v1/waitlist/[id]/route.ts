import { NextResponse } from 'next/server';
import { getPosition, leaveWaitlist } from '@/lib/waitlist';
import { verifyAccess } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ id: zUuid });

function callerId(req: Request): string | undefined {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return undefined;
  try { const p = verifyAccess(h.slice(7)); return p.kind === 'customer' ? p.sub : undefined; }
  catch { return undefined; }
}

/** GET /api/v1/waitlist/:id — موقعیت و وضعیت فعلی در صف (داشبورد مشتری) */
// رفع IDOR: اگر کاربر احراز‌هویت‌شده باشد، فقط ورودی خودش را می‌بیند. برای ورودی
// مهمان (userId=null) دسترسی باز است چون شناسه UUID و غیرقابل‌حدس است و فقط داده‌ی
// موقعیت صف برمی‌گرداند (نه PII حساس فراتر از آنچه خودش وارد کرده).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    const { id } = parseParams(await params, paramsSchema);
    const e = await db.waitlistEntry.findUnique({ where: { id } });
    if (!e) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'پیدا نشد' } }, { status: 404 });
    const cid = callerId(req);
    if (cid && e.userId && e.userId !== cid) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'پیدا نشد' } }, { status: 404 });
    }
    const position = await getPosition(id);
    return NextResponse.json({
      id: e.id, status: e.status, position,
      party_size: e.partySize, is_vip: e.isVip,
      estimated_wait_minutes: e.estimatedWaitMinutes,
      waited_minutes: Math.round((Date.now() - +e.joinedAt) / 60_000),
      offer_expires_at: e.offerExpiresAt, offered_table: e.offeredTableNumber,
      reservation_code: e.reservationCode,
    });
  } catch (e) { return errorResponse(e); }
}

/** DELETE /api/v1/waitlist/:id — خروج از صف. ورودیِ متعلق‌به‌کاربر: نیازِ
 *  احرازِ هویتِ مشتری. ورودیِ مهمان: نیازِ ?token=... (guest_token همان که
 *  هنگامِ join برگردانده شد). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { id } = parseParams(await params, paramsSchema);
    const guestToken = new URL(req.url).searchParams.get('token') ?? undefined;
    const result = await leaveWaitlist(id, { callerUserId: callerId(req), guestToken });
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
