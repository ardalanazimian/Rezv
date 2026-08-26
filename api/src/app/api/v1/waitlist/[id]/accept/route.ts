import { NextResponse } from 'next/server';
import { acceptOffer } from '@/lib/waitlist';
import { verifyAccess } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ id: zUuid });

// استخراج userId از توکن (اگر باشد). مشتری احراز‌هویت‌شده فقط روی ورودی خودش.
function callerId(req: Request): string | undefined {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return undefined;
  try { const p = verifyAccess(h.slice(7)); return p.kind === 'customer' ? p.sub : undefined; }
  catch { return undefined; }
}

/** POST /api/v1/waitlist/:id/accept — پذیرش آفر میز → رزرو ساخته می‌شود.
 *  ورودیِ متعلق‌به‌کاربر: نیازِ احرازِ هویتِ مشتری. ورودیِ مهمان: نیازِ
 *  ?token=... (guest_token همان که هنگامِ join برگردانده شد). */
async function POST_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { id } = parseParams(await params, paramsSchema);
    const guestToken = new URL(req.url).searchParams.get('token') ?? undefined;
    const result = await acceptOffer(id, 'customer', { callerUserId: callerId(req), guestToken });
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/waitlist/[id]/accept', POST_impl);
