import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ id: zUuid });
const bodySchema = z.object({
  title: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
  target_count: z.number().int().min(1).max(1000).optional(),
  xp_reward: z.number().int().min(0).max(1_000_000).optional(),
  wallet_reward: z.number().int().min(0).max(1_000_000).optional(),
  strike_relief: z.number().int().min(0).max(20).optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  status: z.enum(['active', 'archived']).optional(), // آرشیوکردن = «حذفِ نرم» (به‌جای DELETEِ سخت، تا MissionProgressِ موجود نشکند)
});

/**
 * PATCH /api/v1/admin/missions/:id — ویرایشِ ماموریت (فقط ادمینِ پلتفرم).
 * بدونِ حذفِ سخت عمداً: MissionProgressِ کاربرهای موجود به این رکورد وصل است؛
 * status='archived' هم‌الگو با الگویِ isActive در RewardMarketplaceItem است.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);
    const b = await parseBody(req, bodySchema);

    const existing = await db.mission.findUnique({ where: { id } });
    if (!existing) throw Err.notFound('ماموریت');

    const data: Record<string, unknown> = {};
    if (b.title !== undefined) data.title = b.title;
    if (b.description !== undefined) data.description = b.description;
    if (b.target_count !== undefined) data.targetCount = b.target_count;
    if (b.xp_reward !== undefined) data.xpReward = b.xp_reward;
    if (b.wallet_reward !== undefined) data.walletReward = b.wallet_reward;
    if (b.strike_relief !== undefined) data.strikeRelief = b.strike_relief;
    if (b.starts_at !== undefined) data.startsAt = b.starts_at ? new Date(b.starts_at) : null;
    if (b.ends_at !== undefined) data.endsAt = b.ends_at ? new Date(b.ends_at) : null;
    if (b.status !== undefined) data.status = b.status;

    const mission = await db.mission.update({ where: { id }, data });
    await audit({ action: 'mission.updated', actorId: admin.sub, actorType: 'admin', targetId: id, detail: data });
    return NextResponse.json({ ok: true, mission });
  } catch (e) { return errorResponse(e); }
}
