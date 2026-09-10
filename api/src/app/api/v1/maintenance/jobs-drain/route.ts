import { NextResponse } from 'next/server';
import { runWorker } from '@/lib/worker';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/**
 * POST /api/v1/maintenance/jobs-drain — worker صف Job.
 * هر دقیقه توسط cron صدا زده می‌شود و تا ۵۰ job را پردازش می‌کند.
 * stateless و موازی‌پذیر: claim با SKIP LOCKED، پس چند worker همزمان امن است.
 */
async function POST_impl(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;
    // بدونِ آرگومان: اندازه‌ی batch تنها یک مرجع دارد (`WORKER_BATCH_MAX` در
    // lib/queue.ts) و «اجاره»ی صف از همان مشتق می‌شود. عددِ ثابتِ اینجا یک
    // کپیِ دوم بود که می‌توانست بی‌صدا از اجاره جدا بیفتد.
    const result = await runWorker();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) { return errorResponse(e); }
}


// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/maintenance/jobs-drain', POST_impl);
// Vercel Cron از GET استفاده می‌کند؛ به همان منطقِ POSTِ شمرده‌شده وصل است.
export const GET = POST;
