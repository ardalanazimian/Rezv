import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAvailability } from '@/lib/reservations';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, parseQuery, zDateStr, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';
import { bookableStatus } from '@/lib/restaurant-bookable';

const paramsSchema = z.object({ slug: z.string().min(1).max(150) });
const querySchema = z.object({
  date: zDateStr,
  party: z.number().int().min(1).max(30).default(2),
});

/** GET /api/v1/restaurants/{slug}/availability?date=2026-06-12&party=2 */
async function GET_impl(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = parseParams(await params, paramsSchema);
    const { date, party } = parseQuery(req, querySchema);
    // ⚠️ isOpen/onlineGating/lastSeenAt هم لازم‌اند، نه فقط id — بندِ گاردِ پایین.
    const r = await db.restaurant.findUnique({
      where: { slug },
      select: { id: true, isOpen: true, onlineGating: true, lastSeenAt: true },
    });
    if (!r) throw Err.notFound('رستوران');

    // ── گاردِ اتصال: همان شرطی که ثبتِ رزرو با آن رد می‌کند ──────────────
    // چرا اینجا هم لازم است (بن‌بستِ اندازه‌گیری‌شده‌ی ۲۰۲۶-۰۸-۲۵، روی همان
    // رستوران و همان لحظه، ۴ دقیقه و ۲۹ ثانیه پس از آخرین heartbeat):
    //   GET  …/availability?date=…&party=2  → 200 با {"time":"19:00",
    //        "free_tables":[1..9],"status":"open"}
    //   POST /v1/reservations با همان ۱۹:۰۰ → 422 RESTAURANT_OFFLINE
    // یعنی اپ ساعتِ آزاد نشان می‌داد، کاربر انتخاب می‌کرد، و در آخرین قدم رد
    // می‌شد — بدونِ اینکه هیچ‌جا بشود فهمید چرا. گاردِ رزرو در
    // lib/reservations.ts:122 بود ولی این route هیچ گاردی نداشت.
    //
    // پاسخ عمداً ۲۰۰ می‌ماند (نه خطا): «رستوران الان آفلاین است» یک وضعیتِ
    // معتبرِ کسب‌وکار است، نه خطای کلاینت. ولی سانسِ آزاد نمی‌دهد و علتش را
    // صریح می‌گوید تا اپ بتواند حقیقت را نشان دهد.
    const payload = await getAvailability(r.id, date, party);
    const status = bookableStatus(r);
    if (status !== 'online') {
      return NextResponse.json({
        ...payload,
        slots: [],
        restaurant_status: status,
        reason: status === 'closed'
          ? 'این رستوران فعلاً رزروِ آنلاین نمی‌پذیرد'
          : 'این رستوران موقتاً برای رزروِ آنلاین در دسترس نیست',
      });
    }
    return NextResponse.json({ ...payload, restaurant_status: 'online' });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/restaurants/[slug]/availability', GET_impl);
