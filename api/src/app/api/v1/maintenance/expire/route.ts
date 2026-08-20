import { NextResponse } from 'next/server';
import { expireStaleHolds } from '@/lib/reservations';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';

/** POST /api/v1/maintenance/expire — انقضای هولدهای رزرو (cron، هدر x-maintenance-key) */
export async function POST(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;
    const expired = await expireStaleHolds();
    return NextResponse.json({ ok: true, expired });
  } catch (e) { return errorResponse(e); }
}

// Vercel Cron از GET استفاده می‌کند؛ به همان منطق POST وصلش می‌کنیم.
export const GET = POST;
