import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseQuery, zUuid, z } from '@/lib/schemas';

const listQuerySchema = z.object({
  filter: z.enum(['unanswered', 'low', 'all']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
const replySchema = z.object({ id: zUuid, reply: z.string().min(1).max(1000).trim() });

/** GET — نظرات رستوران + آمار تجمیعی (میانگین، توزیع ستاره، تعداد بی‌پاسخ) */
export const GET = withRestaurantAuth({ rateLimit: 'search' }, async (req, ctx) => {
  const { filter, limit } = parseQuery(req, listQuerySchema);

  const where: Record<string, unknown> = { restaurantId: ctx.restaurant.id };
  if (filter === 'unanswered') where.reply = null;
  else if (filter === 'low') where.rating = { lte: 2 };

  const [reviews, agg, total, unanswered, dist] = await Promise.all([
    db.review.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit,
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
    db.review.aggregate({ where: { restaurantId: ctx.restaurant.id }, _avg: { rating: true } }),
    db.review.count({ where: { restaurantId: ctx.restaurant.id } }),
    db.review.count({ where: { restaurantId: ctx.restaurant.id, reply: null } }),
    db.review.groupBy({ by: ['rating'], where: { restaurantId: ctx.restaurant.id }, _count: true }),
  ]);

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of dist) distribution[d.rating] = d._count;

  return NextResponse.json({
    avg_rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
    total, unanswered, distribution,
    items: reviews.map(r => ({
      id: r.id,
      name: r.user ? [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || 'مهمان' : 'مهمان',
      rating: r.rating, food: r.foodRating, service: r.serviceRating, atmosphere: r.atmosphereRating,
      body: r.body, reply: r.reply, replied: !!r.reply,
      created_at: r.createdAt,
    })),
  });
});

/** PATCH — پاسخ به یک نظر. بدنه: { id, reply } */
export const PATCH = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx) => {
  const b = await parseBody(req, replySchema);

  const review = await db.review.findUnique({ where: { id: b.id }, select: { restaurantId: true } });
  if (!review || review.restaurantId !== ctx.restaurant.id) throw Err.notFound('نظر');

  await db.review.update({ where: { id: b.id }, data: { reply: b.reply, repliedAt: new Date() } });
  return NextResponse.json({ ok: true });
});
