import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { mapPrismaError } from '@/lib/site-content';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════════════════
//  PATCH /api/v1/admin/site/inquiries/{id} — رسیدگی به پیامِ سایت
//  تغییرِ وضعیت + یادداشتِ داخلی. «چه‌کسی و چه‌زمانی رسیدگی کرد» ثبت می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({ id: zUuid });
const bodySchema = z.object({
  status: z.enum(['open', 'in_progress', 'closed'] as const).optional(),
  admin_note: z.string().max(2000).trim().optional(),
});

async function PATCH_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);
    const body = await parseBody(req, bodySchema);

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.admin_note !== undefined) data.adminNote = body.admin_note;
    // هر لمسی «رسیدگی» است — حتی افزودنِ یادداشت بدونِ تغییرِ وضعیت.
    data.handledBy = admin.sub;
    data.handledAt = new Date();

    const row = await db.siteInquiry.update({ where: { id }, data })
      .catch((err: unknown) => { throw mapPrismaError(err); });

    await audit({
      action: 'admin.action', actorId: admin.sub, actorType: 'admin',
      targetId: id, ip: clientIp(req),
      detail: { operation: 'site_inquiry_update', code: row.code, status: row.status },
    });

    return NextResponse.json({
      ok: true,
      inquiry: {
        id: row.id, code: row.code, status: row.status,
        admin_note: row.adminNote, handled_at: row.handledAt,
      },
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const PATCH = withApiMetrics('/api/v1/admin/site/inquiries/[id]', PATCH_impl);
