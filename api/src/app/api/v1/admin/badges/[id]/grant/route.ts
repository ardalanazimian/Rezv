import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { grantBadge } from '@/lib/badges';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ id: zUuid });
const bodySchema = z.object({ user_id: zUuid, note: z.string().max(300).trim().optional() });

/** POST /api/v1/admin/badges/:id/grant — اعطایِ نشان به یک کاربر (idempotent) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);
    const { user_id, note } = await parseBody(req, bodySchema);
    const result = await grantBadge(id, user_id, admin.sub, note, clientIp(req));
    return NextResponse.json({ ok: true, already_granted: result.alreadyGranted });
  } catch (e) { return errorResponse(e); }
}
