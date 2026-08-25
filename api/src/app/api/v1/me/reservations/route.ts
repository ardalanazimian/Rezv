import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { dbRead as db } from '@/lib/db';
import { Err, errorResponse } from '@/lib/errors';

/** GET — تاریخچه برای «رزرو مجدد» */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const list = await db.reservation.findMany({
      where: { userId: auth.sub },
      orderBy: { slotStart: 'desc' },
      take: 50,
      include: {
        restaurant: { select: { name: true, slug: true } },
        items: { include: { menuItem: { select: { name: true } } } },
      },
    });
    return NextResponse.json(list);
  } catch (e) { return errorResponse(e); }
}
