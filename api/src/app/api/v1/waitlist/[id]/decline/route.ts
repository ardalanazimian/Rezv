import { NextResponse } from 'next/server';
import { declineOffer } from '@/lib/waitlist';
import { verifyAccess } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ id: zUuid });

function callerId(req: Request): string | undefined {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return undefined;
  try { const p = verifyAccess(h.slice(7)); return p.kind === 'customer' ? p.sub : undefined; }
  catch { return undefined; }
}

/** POST /api/v1/waitlist/:id/decline — رد آفر → آفر به نفر بعدی.
 *  ورودیِ متعلق‌به‌کاربر: نیازِ احرازِ هویتِ مشتری. ورودیِ مهمان: نیازِ
 *  ?token=... (guest_token همان که هنگامِ join برگردانده شد). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { id } = parseParams(await params, paramsSchema);
    const guestToken = new URL(req.url).searchParams.get('token') ?? undefined;
    const result = await declineOffer(id, 'customer', { callerUserId: callerId(req), guestToken });
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
