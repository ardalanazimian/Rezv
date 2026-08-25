import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { banUser } from '@/lib/ban';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ userId: zUuid });
const bodySchema = z.object({ reason: z.string().min(1).max(500).trim() });

/**
 * POST /api/v1/admin/users/:userId/ban — بن سختِ کاربر (فقط ادمینِ پلتفرم).
 * idempotent: اگر کاربر الان بن است، خطا نمی‌دهد؛ همان وضعیت را تأیید می‌کند.
 * کاملاً جدا از فلگِ نرمِ abuse (رجوع کن به admin/abuse-flags/[userId]).
 */
async function POST_impl(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { userId } = parseParams(await params, paramsSchema);
    const { reason } = await parseBody(req, bodySchema);

    const result = await banUser(userId, admin.sub, reason, clientIp(req));
    return NextResponse.json({ ok: true, user_id: userId, already_banned: result.alreadyBanned });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/admin/users/[userId]/ban', POST_impl);
