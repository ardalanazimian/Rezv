import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { createBranch } from '@/lib/provisioning';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ id: zUuid });
const bodySchema = z.object({
  branch_name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(60).optional(),
  slug: z.string().trim().max(40).optional(),
  seed_defaults: z.object({ tables: z.number().int().min(0).max(100).optional() }).optional(),
});

/**
 * POST — شعبه‌ی جدید زیرِ **همان** tenantِ رستورانِ [id] (SPEC-B §۸).
 *
 * staffِ جدید ساخته نمی‌شود: ownerِ موجود با restaurantId=null همه‌ی شعبه‌ها
 * را می‌بیند (سمنتیکِ Staff.restaurantId). سقف: Tenant.branchLimit →
 * CONFLICT/branch_limit_reached. منطق در lib/provisioning.ts.
 */
async function POST_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);
    const b = await parseBody(req, bodySchema);
    const r = await createBranch(id, {
      branchName: b.branch_name, city: b.city, slug: b.slug, seedTables: b.seed_defaults?.tables,
    }, { adminId: admin.sub, ip: clientIp(req) });
    return NextResponse.json({ restaurant: r.restaurant, tenant_id: r.tenantId }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

export const POST = withApiMetrics('/api/v1/admin/restaurants/[id]/branches', POST_impl);
