import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoMarkRunningLate, autoMarkNoShow, autoComplete } from '@/lib/lifecycle';
import { expireStaleHolds } from '@/lib/reservations';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';

/**
 * POST /api/v1/maintenance/lifecycle — انتقال‌های خودکار چرخه‌ی حیات (cron).
 * انقضای هولد + running_late + no_show + completed برای همه‌ی رستوران‌ها.
 *
 * ⚠️ باگ M5: قبلاً روی همه‌ی رستوران‌ها به‌صورت سریال حلقه می‌زد (۳+ کوئری هرکدام)
 * در یک درخواست با سقف ۳۰ ثانیه؛ با چند صد رستوران، cron timeout می‌کرد و رستوران‌های
 * انتهای لیست هرگز پردازش نمی‌شدند. حالا با batch موازی محدود (concurrency=8) پردازش
 * می‌شوند تا زمان کل به‌شدت کاهش یابد بدون اینکه pool اتصال DB اشباع شود.
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

export async function POST(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;

    const expired = await expireStaleHolds();
    const restaurants = await db.restaurant.findMany({ where: { isOpen: true }, select: { id: true } });

    // پردازش موازی محدود (concurrency=8) — سریع ولی امن برای pool اتصال.
    const perRestaurant = await mapWithConcurrency(restaurants, 8, async (r) => {
      const late = await autoMarkRunningLate(r.id);
      const noShow = await autoMarkNoShow(r.id);
      const completed = await autoComplete(r.id);
      return { late, noShow, completed };
    });
    const late = perRestaurant.reduce((s, x) => s + x.late, 0);
    const noShow = perRestaurant.reduce((s, x) => s + x.noShow, 0);
    const completed = perRestaurant.reduce((s, x) => s + x.completed, 0);

    return NextResponse.json({ ok: true, expired, running_late: late, no_show: noShow, completed });
  } catch (e) { return errorResponse(e); }
}

// Vercel Cron از GET استفاده می‌کند؛ به همان منطق POST وصلش می‌کنیم.
export const GET = POST;
