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
    // v2 در کلید cache: شکلِ پاسخ عوض شده (slug/نامِ رستوران اضافه شد) و نباید
    // تا انقضای TTL پاسخِ کهنه‌ی بدونِ این فیلدها سرو شود.
    const key = `events-v2:${rid || 'all'}`;
    const events = await cached(key, 120, async () => {
      const rows = await db.specialEvent.findMany({
        where: {
          isPublished: true, startsAt: { gte: new Date() },
          ...(rid ? { restaurantId: rid } : {}),
        },
        orderBy: { startsAt: 'asc' }, take: 20,
        select: {
          id: true, restaurantId: true, title: true, description: true, emoji: true,
          startsAt: true, endsAt: true, priceToman: true, capacity: true,
          // ⚠️ اضافه‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۵): کارتِ رویداد در اپ مشتری فقط
          // restaurantId داشت؛ اگر رستوران در صفحه‌ی بارگذاری‌شده‌ی فید نبود،
          // کلیک راهی به صفحه‌اش نداشت (endpointِ جزئیات slug-محور است).
          // slug + نامِ رستوران deep-open و نمایشِ صادقِ میزبان را ممکن می‌کند.
          restaurant: { select: { slug: true, name: true } },
        },
      });
      // تخت‌کردن — قراردادِ پاسخ ساده می‌ماند و relation به بیرون درز نمی‌کند
      return rows.map(({ restaurant, ...e }) => ({
        ...e, restaurant_slug: restaurant.slug, restaurant_name: restaurant.name,
      }));
    });
    return NextResponse.json({ events });
  } catch (e) { return errorResponse(e); }
}
