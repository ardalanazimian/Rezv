import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/** GET /api/v1/me/chats — لیست گفتگوهای مشتری (برای صفحه‌ی «پیام‌ها») */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await enforceRateLimit(clientIp(req), RULES.search);

    const threads = await db.chatThread.findMany({
      where: { userId: auth.sub },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: {
        restaurant: { select: { id: true, name: true, slug: true } },
        reservation: { select: { code: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, sender: true, createdAt: true } },
      },
    });

    return NextResponse.json({
      items: threads.map(t => ({
        id: t.id,
        restaurant: { id: t.restaurant.id, name: t.restaurant.name, slug: t.restaurant.slug },
        reservation_code: t.reservation?.code ?? null,
        unread: t.unreadForUser,
        last_message: t.messages[0]
          ? { body: t.messages[0].body, sender: t.messages[0].sender, created_at: t.messages[0].createdAt }
          : null,
        last_message_at: t.lastMessageAt,
      })),
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/chats', GET_impl);
