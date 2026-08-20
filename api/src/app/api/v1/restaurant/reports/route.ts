import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { sinceDays } from '@/lib/staff-helpers';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseQuery, z } from '@/lib/schemas';

const querySchema = z.object({ range: z.string().regex(/^\d{1,3}d$/).default('30d') });

// GET /restaurant/reports/revenue?range=30d
export const GET = withRestaurantAuth({ permission: 'canViewRevenue' }, async (req, ctx) => {
  const { range } = parseQuery(req, querySchema);
  const days = Math.min(180, Number(range.replace('d', '')) || 30);
  const since = sinceDays(days);

  const data = await cached(cacheKey('revenue', ctx.restaurant.id, days), 300, async () => {
    const dailyRows = await db.$queryRaw<{ day: string; revenue: bigint }[]>`
      SELECT to_char(r.slot_start, 'YYYY-MM-DD') AS day, COALESCE(SUM(ri.qty * mi.price_toman), 0)::bigint AS revenue
      FROM reservations r
      JOIN reservation_items ri ON ri.reservation_id = r.id
      JOIN menu_items mi ON mi.id = ri.menu_item_id
      WHERE r.restaurant_id = ${ctx.restaurant.id}::uuid
        AND r.status = 'completed'
        AND r.slot_start >= ${since}
      GROUP BY day ORDER BY day ASC
    `;

    const topItems = await db.menuItem.findMany({
      where: { restaurantId: ctx.restaurant.id }, orderBy: { soldCount: 'desc' }, take: 8,
      select: { name: true, emoji: true, priceToman: true, soldCount: true },
    });

    const bySourceRows = await db.$queryRaw<{ source: string; revenue: bigint; cnt: bigint }[]>`
      SELECT r.source, COALESCE(SUM(ri.qty * mi.price_toman), 0)::bigint AS revenue, COUNT(DISTINCT r.id)::bigint AS cnt
      FROM reservations r
      LEFT JOIN reservation_items ri ON ri.reservation_id = r.id
      LEFT JOIN menu_items mi ON mi.id = ri.menu_item_id
      WHERE r.restaurant_id = ${ctx.restaurant.id}::uuid
        AND r.status = 'completed'
        AND r.slot_start >= ${since}
      GROUP BY r.source
    `;

    const noShowCount = await db.reservation.count({ where: { restaurantId: ctx.restaurant.id, status: 'no_show', slotStart: { gte: since } } });
    const avgTicketRow = await db.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(sub.total)::float AS avg FROM (
        SELECT r.id, SUM(ri.qty * mi.price_toman) AS total
        FROM reservations r JOIN reservation_items ri ON ri.reservation_id = r.id
        JOIN menu_items mi ON mi.id = ri.menu_item_id
        WHERE r.restaurant_id = ${ctx.restaurant.id}::uuid AND r.status = 'completed' AND r.slot_start >= ${since}
        GROUP BY r.id
      ) sub
    `;
    const avgTicket = Math.round(avgTicketRow[0]?.avg || 0);
    const estimatedNoShowLossToman = noShowCount * avgTicket;
    const totalRevenue = dailyRows.reduce((s, r) => s + Number(r.revenue), 0);

    return {
      range_days: days,
      total_revenue_toman: totalRevenue,
      daily: dailyRows.map(r => ({ day: r.day, revenue_toman: Number(r.revenue) })),
      top_items: topItems.map(i => ({ name: i.name, emoji: i.emoji, price_toman: i.priceToman, sold_count: i.soldCount })),
      by_source: bySourceRows.map(r => ({ source: r.source, revenue_toman: Number(r.revenue), reservation_count: Number(r.cnt) })),
      no_show_impact: { count: noShowCount, avg_ticket_toman: avgTicket, estimated_loss_toman: estimatedNoShowLossToman },
    };
  });

  return NextResponse.json(data);
});
