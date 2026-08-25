import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, z, zUuid } from '@/lib/schemas';
import { getOrCreateThread } from '@/lib/chat';

import { withApiMetrics } from '@/lib/api-metrics';

const bodySchema = z.object({
  reservation_id: zUuid.optional(),  // اگر می‌خواهد چت مربوط به یک رزرو باشد
});

/**
 * POST /api/v1/restaurants/:slug/chat — شروع (یا بازگرداندن) گفتگو با یک رستوران.
 * پاسخ: { thread_id }. اگر از قبل thread باشد، همان برمی‌گردد (idempotent).
 */
async function POST_impl(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await enforceRateLimit(clientIp(req), RULES.auth);

    const { slug } = await params;
    const restaurant = await db.restaurant.findUnique({
      where: { slug }, select: { id: true },
    });
    if (!restaurant) throw Err.notFound('رستوران');

    const { reservation_id } = await parseBody(req, bodySchema);
    const thread = await getOrCreateThread({
      restaurantId: restaurant.id,
      userId: auth.sub,
      reservationId: reservation_id ?? null,
    });

    return NextResponse.json({ thread_id: thread.id }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/restaurants/[slug]/chat', POST_impl);
