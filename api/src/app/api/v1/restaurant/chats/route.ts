import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseQuery, z } from '@/lib/schemas';

const listQuery = z.object({
  filter: z.enum(['unread', 'all']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/v1/restaurant/chats — لیست گفتگوهای رستوران (اینباکس)
 *
 * ⚠️ رفعِ ناهم‌خوانیِ مجوز (ممیزیِ RBAC): `chats/[id]/route.ts` (خواندن و
 * فرستادنِ پیامِ یک گفتگو) از قبل `canManageReservations` داشت، ولی همین
 * *فهرست* نداشت — و فهرست خودش `customer.phone` و متنِ آخرین پیامِ هر
 * گفتگو را برمی‌گرداند. یعنی گاردِ جزئیات با یک درخواست به فهرست دور می‌خورد.
 * حالا هر دو یک کلید دارند، هم‌راستا با `VIEW_PERMISSION.chat` در پنل.
 */
export const GET = withRestaurantAuth({ permission: 'canManageReservations', rateLimit: 'search' }, async (req, ctx) => {
  const { filter, limit } = parseQuery(req, listQuery);

  const where: Record<string, unknown> = { restaurantId: ctx.restaurant.id };
  if (filter === 'unread') where.unreadForStaff = { gt: 0 };

  const [threads, unreadTotal] = await Promise.all([
    db.chatThread.findMany({
      where, orderBy: { lastMessageAt: 'desc' }, take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        reservation: { select: { code: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, sender: true, createdAt: true } },
      },
    }),
    db.chatThread.count({ where: { restaurantId: ctx.restaurant.id, unreadForStaff: { gt: 0 } } }),
  ]);

  return NextResponse.json({
    unread_threads: unreadTotal,
    items: threads.map(t => ({
      id: t.id,
      customer: {
        name: [t.user.firstName, t.user.lastName].filter(Boolean).join(' ') || 'مهمان',
        phone: t.user.phone,
      },
      reservation_code: t.reservation?.code ?? null,
      unread: t.unreadForStaff,
      last_message: t.messages[0]
        ? { body: t.messages[0].body, sender: t.messages[0].sender, created_at: t.messages[0].createdAt }
        : null,
      last_message_at: t.lastMessageAt,
    })),
  });
});
