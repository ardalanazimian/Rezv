import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { parseQuery, z } from '@/lib/schemas';
import { STATUS_LABEL, type PhotoStatus } from '@/lib/photo-moderation';

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('pending'),
  // z.number() خودش رشته‌ی عددیِ کوئری‌استرینگ را می‌پذیرد (validate.ts)
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

/**
 * GET /api/v1/admin/photos — صفِ بازبینیِ عکسِ گالری (پنل شرکت).
 *
 * پیش‌فرض فقط pendingها را می‌دهد و قدیمی‌ترین را اول: صف باید FIFO باشد
 * وگرنه عکسِ یک رستوران می‌تواند هفته‌ها پشتِ آپلودهای تازه بماند.
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);
    const { status, limit, offset } = parseQuery(req, querySchema);

    const where = status === 'all' ? {} : { status: status as PhotoStatus };

    const [rows, total, pendingCount] = await Promise.all([
      db.restaurantPhoto.findMany({
        where,
        orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' },
        take: limit,
        skip: offset,
        include: { restaurant: { select: { id: true, name: true, slug: true, city: true } } },
      }),
      db.restaurantPhoto.count({ where }),
      db.restaurantPhoto.count({ where: { status: 'pending' } }),
    ]);

    return NextResponse.json({
      items: rows.map((p) => ({
        id: p.id,
        url: p.url,
        caption: p.caption,
        category: p.category,
        status: p.status,
        status_label: STATUS_LABEL[p.status as PhotoStatus],
        rejection_reason: p.rejectionReason,
        width: p.width,
        height: p.height,
        byte_size: p.byteSize,
        original_name: p.originalName,
        created_at: p.createdAt.toISOString(),
        reviewed_at: p.reviewedAt?.toISOString() ?? null,
        restaurant: {
          id: p.restaurant.id,
          name: p.restaurant.name,
          slug: p.restaurant.slug,
          city: p.restaurant.city,
        },
      })),
      total,
      pending_count: pendingCount,
      limit,
      offset,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
