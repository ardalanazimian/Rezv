import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';
import { resendInvite } from '@/lib/provisioning';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ id: zUuid });

/**
 * POST — ارسالِ مجددِ دعوتِ اولین‌ورودِ owner (SPEC-B §۸).
 * توکن و انقضای تازه؛ PENDINGهای قبلی REVOKED (لینکِ لورفته‌ی قدیمی می‌میرد).
 * منطق در lib/provisioning.ts — این فایل فقط auth + شکلِ HTTP.
 */
async function POST_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);
    const r = await resendInvite(id, { adminId: admin.sub, ip: clientIp(req) });
    return NextResponse.json({ invite_sent_to: r.inviteSentTo, expires_at: r.expiresAt });
  } catch (e) { return errorResponse(e); }
}

export const POST = withApiMetrics('/api/v1/admin/restaurants/[id]/resend-invite', POST_impl);
