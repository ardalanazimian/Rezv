import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { claimMission } from '@/lib/missions';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ id: zUuid });

/** POST /api/v1/me/missions/:id/claim — دریافتِ جایزه‌ی ماموریتِ تکمیل‌شده */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { id } = parseParams(await params, paramsSchema);
    const result = await claimMission(auth.sub, id);
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
