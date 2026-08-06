import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, z } from '@/lib/schemas';
import { PUBLIC_STATUS } from '@/lib/photo-moderation';

// ═══════════════════════════════════════════════════════════
//  GET /api/v1/restaurants/{slug} — جزئیاتِ عمومیِ یک رستوران
//  منبعِ دادهٔ صفحه‌ی SEO (apps/seo · /r/{slug}) و کارتِ جزئیاتِ مشتری.
//  عمومی (بدونِ auth)، cache-شده (۶۰ ثانیه — مثلِ لیست). شاملِ دادهٔ مکانی
//  (schema.org PostalAddress + GeoCoordinates)، ساعتِ کاری، منو، عکس، و امتیازِ تجمیعی.
// ═══════════════════════════════════════════════════════════

const paramsSchema = z.object({ slug: z.string().min(1).max(150) });

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = parseParams(await params, paramsSchema);
    const key = cacheKey('restaurant-detail', slug);

    const data = await cached(key, 60, async () => {
      const r = await db.restaurant.findUnique({
        where: { slug },
        select: {
          id: true, slug: true, name: true, cuisine: true, vibes: true, priceBand: true,
          address: true, city: true, district: true, postalCode: true, country: true,
          latitude: true, longitude: true, openingHours: true, timezone: true,
          menuItems: {
            where: { isActive: true }, orderBy: { soldCount: 'desc' },
            select: { name: true, emoji: true, priceToman: true },
          },
          // فقط عکسِ تأییدشده. این تنها مسیری است که گالری را به بیرون
          // می‌دهد — هم اپ مشتری و هم صفحه‌ی سئوی /r/[slug] از همین می‌خوانند
          // — پس همین یک فیلتر، مرزِ «منتشرشده» است.
          photos: {
            where: { status: PUBLIC_STATUS },
            orderBy: { sortOrder: 'asc' },
            select: { url: true, caption: true, category: true },
          },
        },
      });
      if (!r) return null;

      // امتیازِ تجمیعی از نظرهای منتشرشده (schema.org AggregateRating).
      const agg = await db.review.aggregate({
        where: { restaurantId: r.id, isPublished: true },
        _avg: { rating: true }, _count: true,
      });

      return {
        id: r.id, slug: r.slug, name: r.name, cuisine: r.cuisine,
        vibes: r.vibes, price_band: r.priceBand,
        location: {
          address: r.address, city: r.city, district: r.district,
          postal_code: r.postalCode, country: r.country,
          latitude: r.latitude, longitude: r.longitude,
        },
        opening_hours: r.openingHours, timezone: r.timezone,
        rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
        reviews_count: agg._count,
        menu: r.menuItems.map((m) => ({ name: m.name, emoji: m.emoji, price_toman: m.priceToman })),
        photos: r.photos.map((p) => ({ url: p.url, caption: p.caption, category: p.category })),
      };
    });

    if (!data) throw Err.notFound('رستوران');
    return NextResponse.json(data);
  } catch (e) { return errorResponse(e); }
}
