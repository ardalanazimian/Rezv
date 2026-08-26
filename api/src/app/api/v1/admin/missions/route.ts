import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseQuery, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

// بدونِ تغییرِ سمانتیکِ updateMissionProgressTx (lib/missions.ts) — این روت‌ها
// فقط رویِ خودِ رکوردِ Mission (تعریف) کار می‌کنند، نه رویِ MissionProgress.
const kindEnum = z.enum(['weekly', 'seasonal', 'onboarding', 'recovery', 'general']);
const statusEnum = z.enum(['active', 'archived']);

const querySchema = z.object({
  restaurant_id: zUuid.optional(),
  status: statusEnum.optional(),
});
const bodySchema = z.object({
  restaurant_id: zUuid.nullable().optional(), // null/نبود = سراسری
  title: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  kind: kindEnum,
  target_count: z.number().int().min(1).max(1000).default(1),
  xp_reward: z.number().int().min(0).max(1_000_000).default(0),
  wallet_reward: z.number().int().min(0).max(1_000_000).default(0),
  strike_relief: z.number().int().min(0).max(20).default(0),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
});

/** GET /api/v1/admin/missions?restaurant_id=&status= — فهرستِ ماموریت‌ها (فقط ادمینِ پلتفرم) */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const { restaurant_id, status } = parseQuery(req, querySchema);
    const where: Record<string, unknown> = {};
    if (restaurant_id) where.restaurantId = restaurant_id;
    if (status) where.status = status;
    const items = await db.mission.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    return NextResponse.json({ items });
  } catch (e) { return errorResponse(e); }
}

/** POST /api/v1/admin/missions — تعریفِ ماموریتِ جدید (فقط ادمینِ پلتفرم) */
async function POST_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const b = await parseBody(req, bodySchema);

    const mission = await db.mission.create({
      data: {
        restaurantId: b.restaurant_id ?? null,
        title: b.title, description: b.description ?? null, kind: b.kind,
        targetCount: b.target_count, xpReward: b.xp_reward, walletReward: b.wallet_reward,
        strikeRelief: b.strike_relief,
        startsAt: b.starts_at ? new Date(b.starts_at) : null,
        endsAt: b.ends_at ? new Date(b.ends_at) : null,
      },
    });
    await audit({ action: 'mission.created', actorId: admin.sub, actorType: 'admin', targetId: mission.id, detail: { title: mission.title, kind: mission.kind } });
    return NextResponse.json({ ok: true, mission }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/missions', GET_impl);
export const POST = withApiMetrics('/api/v1/admin/missions', POST_impl);
