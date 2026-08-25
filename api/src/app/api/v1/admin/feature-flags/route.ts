import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { FEATURE_FLAG_KEYS, getAllFeatureFlags, setFeatureFlag } from '@/lib/feature-flags';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

const bodySchema = z.object({
  flags: z.array(z.object({
    key: z.enum(FEATURE_FLAG_KEYS),
    enabled: z.boolean(),
  })).min(1).max(FEATURE_FLAG_KEYS.length),
});

/** GET /api/v1/admin/feature-flags — وضعیتِ فعلیِ همه‌ی سوییچ‌ها (فقط ادمینِ پلتفرم) */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const flags = await getAllFeatureFlags();
    return NextResponse.json({ flags });
  } catch (e) { return errorResponse(e); }
}

/** PATCH /api/v1/admin/feature-flags — تغییرِ یک یا چند سوییچ · بدنه: { flags: [{key, enabled}] } */
export async function PATCH(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { flags } = await parseBody(req, bodySchema);
    for (const f of flags) await setFeatureFlag(f.key, f.enabled, admin.sub);
    const current = await getAllFeatureFlags();
    return NextResponse.json({ ok: true, flags: current });
  } catch (e) { return errorResponse(e); }
}
