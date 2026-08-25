import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { parseQuery, z } from '@/lib/schemas';
import { HOURS_STATUS_LABEL, type HoursChangeStatus } from '@/lib/hours-approval';

const querySchema = z.object({
  status: z.enum(['pending', 'rejected', 'all']).default('pending'),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

/**
 * GET /api/v1/admin/hours-changes — صفِ تأییدِ ساعتِ کاری (پنل شرکت).
 *
 * آینه‌یِ GET /admin/photos: پیش‌فرض فقط pendingها را می‌دهد، قدیمی‌ترین
 * اول (FIFO) — وگرنه یک پیشنهاد می‌تواند هفته‌ها پشتِ پیشنهادهای تازه‌تر
 * بماند در حالی که مشتری همچنان ساعتِ کاریِ قدیمی را می‌بیند.
 *
 * توجه: چیزی به‌نامِ «approved» در این صف نمی‌ماند — تأیید یعنی پاک‌شدنِ
 * کاملِ رکورد از صف (رجوع کن به hours-approval.ts). تاریخچه‌یِ تأییدها فقط
 * در audit_logs قابل‌جستجوست، نه اینجا.
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const { status, limit, offset } = parseQuery(req, querySchema);

    const where = status === 'all'
      ? { hoursChangeStatus: { in: ['pending', 'rejected'] } }
      : { hoursChangeStatus: status as HoursChangeStatus };

    const [rows, total, pendingCount] = await Promise.all([
      db.restaurant.findMany({
        where,
        orderBy: { hoursChangeRequestedAt: status === 'pending' ? 'asc' : 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true, name: true, slug: true, city: true, timezone: true,
          openingHours: true, pendingOpeningHours: true,
          hoursChangeStatus: true, hoursChangeReason: true,
          hoursChangeRequestedAt: true, hoursChangeReviewedAt: true,
        },
      }),
      db.restaurant.count({ where }),
      db.restaurant.count({ where: { hoursChangeStatus: 'pending' } }),
    ]);

    return NextResponse.json({
      items: rows.map(r => ({
        id: r.id,
        restaurant: { id: r.id, name: r.name, slug: r.slug, city: r.city },
        timezone: r.timezone,
        live_opening_hours: r.openingHours,
        proposed_opening_hours: r.pendingOpeningHours,
        status: r.hoursChangeStatus,
        status_label: r.hoursChangeStatus ? HOURS_STATUS_LABEL[r.hoursChangeStatus as HoursChangeStatus] : null,
        rejection_reason: r.hoursChangeReason,
        requested_at: r.hoursChangeRequestedAt?.toISOString() ?? null,
        reviewed_at: r.hoursChangeReviewedAt?.toISOString() ?? null,
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
