import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { getReservationEvents } from '@/lib/lifecycle';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, zReservationCode, z } from '@/lib/schemas';

const paramsSchema = z.object({ code: zReservationCode });

/** GET /api/v1/restaurant/reservations/:code/events — تاریخچه‌ی تغییر وضعیت (audit log) */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'staff') throw Err.forbidden();
    const { code } = parseParams(await params, paramsSchema);
    const resv = await db.reservation.findUnique({
      where: { code },
      select: { id: true, restaurant: { select: { tenantId: true } } },
    });
    if (!resv || (resv as any).restaurant.tenantId !== auth.tenantId) throw Err.forbidden();
    const events = await getReservationEvents(resv.id);
    return NextResponse.json({ events });
  } catch (e) { return errorResponse(e); }
}
