import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { updateBadgeDefinition } from '@/lib/badges';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ id: zUuid });
const bodySchema = z.object({
  name: z.string().min(1).max(60).trim().optional(),
  description: z.string().max(300).trim().nullable().optional(),
  icon: z.string().min(1).max(40).trim().optional(),
  color: z.string().max(20).trim().nullable().optional(),
  is_active: z.boolean().optional(),
});

/** PATCH /api/v1/admin/badges/:id — ویرایشِ تعریفِ نشان (فقط ادمینِ پلتفرم) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);
    const b = await parseBody(req, bodySchema);
    const badge = await updateBadgeDefinition(id, {
      name: b.name, description: b.description, icon: b.icon, color: b.color, isActive: b.is_active,
      adminId: admin.sub,
    });
    return NextResponse.json({ ok: true, badge });
  } catch (e) { return errorResponse(e); }
}
