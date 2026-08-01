import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAvailability } from '@/lib/reservations';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, parseQuery, zDateStr, z } from '@/lib/schemas';

const paramsSchema = z.object({ slug: z.string().min(1).max(150) });
const querySchema = z.object({
  date: zDateStr,
  party: z.number().int().min(1).max(30).default(2),
});

/** GET /api/v1/restaurants/{slug}/availability?date=2026-06-12&party=2 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = parseParams(await params, paramsSchema);
    const { date, party } = parseQuery(req, querySchema);
    const r = await db.restaurant.findUnique({ where: { slug }, select: { id: true } });
    if (!r) throw Err.notFound('رستوران');
    return NextResponse.json(await getAvailability(r.id, date, party));
  } catch (e) { return errorResponse(e); }
}
