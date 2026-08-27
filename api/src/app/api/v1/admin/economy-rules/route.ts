import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getEconomyRuleConfig, setEconomyRule } from '@/lib/economy-rules';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const bodySchema = z.object({
  completed_xp: z.number().int().min(0).max(1_000_000).optional(),
  completed_coins: z.number().int().min(0).max(1_000_000).optional(),
});

/** GET /api/v1/admin/economy-rules — مقدارِ فعلیِ پاداشِ رزروِ completed (فقط ادمینِ پلتفرم) */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const config = await getEconomyRuleConfig();
    return NextResponse.json({ rules: { completed_xp: config.completedXp, completed_coins: config.completedCoins } });
  } catch (e) { return errorResponse(e); }
}

/** PATCH /api/v1/admin/economy-rules — ویرایشِ پاداشِ رزروِ completed */
async function PATCH_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const b = await parseBody(req, bodySchema);
    if (b.completed_xp !== undefined) await setEconomyRule('completed_xp', b.completed_xp, admin.sub);
    if (b.completed_coins !== undefined) await setEconomyRule('completed_coins', b.completed_coins, admin.sub);
    const config = await getEconomyRuleConfig();
    return NextResponse.json({ ok: true, rules: { completed_xp: config.completedXp, completed_coins: config.completedCoins } });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/economy-rules', GET_impl);
export const PATCH = withApiMetrics('/api/v1/admin/economy-rules', PATCH_impl);
