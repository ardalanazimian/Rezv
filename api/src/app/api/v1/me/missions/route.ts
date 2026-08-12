import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { listMissionsForUser } from '@/lib/missions';
import { Err, errorResponse } from '@/lib/errors';
import { parseQuery, zUuid, z } from '@/lib/schemas';

const querySchema = z.object({ restaurant_id: zUuid.optional() });

/** GET /api/v1/me/missions?restaurant_id=... — ماموریت‌هایِ فعال + پیشرفتِ همین کاربر */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const { restaurant_id } = parseQuery(req, querySchema);
    const missions = await listMissionsForUser(auth.sub, restaurant_id);
    return NextResponse.json({ missions });
  } catch (e) { return errorResponse(e); }
}
