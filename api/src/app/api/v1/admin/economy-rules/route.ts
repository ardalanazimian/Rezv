import { NextResponse } from 'next/server';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { getEconomyRuleConfig, setEconomyRule } from '@/lib/economy-rules';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

const bodySchema = z.object({
  completed_xp: z.number().int().min(0).max(1_000_000).optional(),
  completed_coins: z.number().int().min(0).max(1_000_000).optional(),
});

/** GET /api/v1/admin/economy-rules — مقدارِ فعلیِ پاداشِ رزروِ completed (فقط ادمینِ پلتفرم) */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);
    const config = await getEconomyRuleConfig();
    return NextResponse.json({ rules: { completed_xp: config.completedXp, completed_coins: config.completedCoins } });
  } catch (e) { return errorResponse(e); }
}

/** PATCH /api/v1/admin/economy-rules — ویرایشِ پاداشِ رزروِ completed */
export async function PATCH(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = adminAuthFromRequest(req);
    const b = await parseBody(req, bodySchema);
    if (b.completed_xp !== undefined) await setEconomyRule('completed_xp', b.completed_xp, admin.sub);
    if (b.completed_coins !== undefined) await setEconomyRule('completed_coins', b.completed_coins, admin.sub);
    const config = await getEconomyRuleConfig();
    return NextResponse.json({ ok: true, rules: { completed_xp: config.completedXp, completed_coins: config.completedCoins } });
  } catch (e) { return errorResponse(e); }
}
