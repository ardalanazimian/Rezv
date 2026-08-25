import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { unbanUser } from '@/lib/ban';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ userId: zUuid });
const bodySchema = z.object({ reason: z.string().max(500).trim().optional() });

/**
 * POST /api/v1/admin/users/:userId/unban — رفعِ بن سختِ کاربر (فقط ادمینِ پلتفرم).
 * idempotent: اگر کاربر الان بن نیست، خطا نمی‌دهد؛ همان وضعیت را تأیید می‌کند.
 */
export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { userId } = parseParams(await params, paramsSchema);
    const { reason } = await parseBody(req, bodySchema);

    const result = await unbanUser(userId, admin.sub, reason, clientIp(req));
    return NextResponse.json({ ok: true, user_id: userId, already_unbanned: result.alreadyUnbanned });
  } catch (e) { return errorResponse(e); }
}
