import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached } from '@/lib/cache';
import { errorResponse } from '@/lib/errors';
import { parseQuery, zUuid, z } from '@/lib/schemas';

const querySchema = z.object({ restaurant_id: zUuid.optional() });

/** GET /api/v1/events?restaurant_id=... — رویدادهای ویژه‌ی پیش‌رو */
export async function GET(req: Request) {
  try {
    const { restaurant_id: rid } = parseQuery(req, querySchema);
    const key = `events:${rid || 'all'}`;
    const events = await cached(key, 120, async () => {
      return db.specialEvent.findMany({
        where: {
          isPublished: true, startsAt: { gte: new Date() },
          ...(rid ? { restaurantId: rid } : {}),
        },
        orderBy: { startsAt: 'asc' }, take: 20,
        select: { id: true, restaurantId: true, title: true, description: true, emoji: true, startsAt: true, endsAt: true, priceToman: true, capacity: true },
      });
    });
    return NextResponse.json({ events });
  } catch (e) { return errorResponse(e); }
}
