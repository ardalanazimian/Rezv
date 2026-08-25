import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expireOffers, promoteNext } from '@/lib/waitlist';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/**
 * POST /api/v1/maintenance/waitlist — نگهداری لیست انتظار (cron).
 * انقضای آفرهای بی‌پاسخ + تلاش برای ارتقای صف هر رستوران.
 *
 * ⚠️ باگ M5: پردازش موازی محدود به‌جای حلقه‌ی سریال (جلوگیری از timeout در مقیاس).
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function POST_impl(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;

    const expired = await expireOffers();
    const withQueue = await db.waitlistEntry.findMany({
      where: { status: 'waiting' }, distinct: ['restaurantId'], select: { restaurantId: true },
    });
    const results = await mapWithConcurrency(withQueue, 8, (w) => promoteNext(w.restaurantId));
    const promoted = results.filter(r => r.promoted).length;
    return NextResponse.json({ ok: true, expired_offers: expired, promoted });
  } catch (e) { return errorResponse(e); }
}


// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/maintenance/waitlist', POST_impl);
// Vercel Cron از GET استفاده می‌کند؛ به همان منطقِ POSTِ شمرده‌شده وصل است.
export const GET = POST;
