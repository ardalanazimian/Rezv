import { NextResponse } from 'next/server';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { clearAbuseFlag, setAbuseFlagManually } from '@/lib/fraud';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse, Err } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ userId: zUuid });
const bodySchema = z.object({
  action: z.enum(['clear', 'flag']),
  reason: z.string().max(500).optional(),
});

/**
 * PATCH /api/v1/admin/abuse-flags/[userId] — کنترلِ دستیِ فلگِ سوءاستفاده
 * از پنلِ شرکت (سطحِ پلتفرم، نه یک رستوران خاص).
 *  { action: 'clear' } — پاک‌کردنِ فلگ (appeal/false-positive).
 *  { action: 'flag', reason } — فلگِ دستی وقتی تیمِ پلتفرم مستقیم یه الگو دید.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = adminAuthFromRequest(req);
    const { userId } = parseParams(await params, paramsSchema);
    const body = await parseBody(req, bodySchema);

    if (body.action === 'clear') {
      try {
        await clearAbuseFlag(userId, admin.sub, null, 'admin');
      } catch (e) {
        throw Err.notFound((e as Error).message || 'پروفایلِ اقتصادیِ این کاربر یافت نشد');
      }
    } else {
      await setAbuseFlagManually(userId, admin.sub, body.reason ?? 'فلگِ دستیِ ادمینِ پلتفرم');
    }

    return NextResponse.json({ ok: true, user_id: userId, action: body.action });
  } catch (e) { return errorResponse(e); }
}
