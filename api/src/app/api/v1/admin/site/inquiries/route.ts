import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { parseQuery, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/admin/site/inquiries — صندوقِ ورودیِ تماس با فروش
// ═══════════════════════════════════════════════════════════════════════

const querySchema = z.object({
  status: z.enum(['open', 'in_progress', 'closed'] as const).optional(),
  topic: z.string().max(30).optional(),
  q: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).max(100_000).optional(),
});

async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const { status, topic, q, limit, offset } = parseQuery(req, querySchema);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (topic) where.topic = topic;
    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    }

    const [rows, total, openCount] = await Promise.all([
      db.siteInquiry.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit ?? 50, skip: offset ?? 0 }),
      db.siteInquiry.count({ where }),
      db.siteInquiry.count({ where: { status: 'open' } }),
    ]);

    return NextResponse.json({
      total,
      count: rows.length,
      open: openCount,
      items: rows.map((i) => ({
        id: i.id, code: i.code, name: i.name, phone: i.phone, email: i.email,
        company: i.company, topic: i.topic, message: i.message, status: i.status,
        admin_note: i.adminNote, handled_by: i.handledBy, handled_at: i.handledAt,
        utm_source: i.utmSource, landing_path: i.landingPath, created_at: i.createdAt,
      })),
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/site/inquiries', GET_impl);
