import { NextResponse } from 'next/server';
import { runWorker } from '@/lib/worker';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';

/**
 * POST /api/v1/maintenance/jobs-drain — worker صف Job.
 * هر دقیقه توسط cron صدا زده می‌شود و تا ۵۰ job را پردازش می‌کند.
 * stateless و موازی‌پذیر: claim با SKIP LOCKED، پس چند worker همزمان امن است.
 */
export async function POST(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;
    const result = await runWorker(50);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) { return errorResponse(e); }
}

// Vercel Cron از GET استفاده می‌کند؛ به همان منطق POST وصلش می‌کنیم.
export const GET = POST;
