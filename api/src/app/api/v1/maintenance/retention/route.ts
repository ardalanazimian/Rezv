import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cleanupIdempotencyKeys } from '@/lib/idempotency';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { createLogger } from '@/lib/logger';
import { errorResponse } from '@/lib/errors';

const log = createLogger('retention');

/**
 * POST /api/v1/maintenance/retention — پاک‌سازی دوره‌ای داده‌های منقضی.
 * توسط cron روزانه صدا زده می‌شود. جلوگیری از رشد بی‌نهایت جداول.
 *
 * سیاست‌ها (قابل تنظیم):
 *  • idempotency_keys منقضی → حذف
 *  • jobs کامل‌شده‌ی قدیمی‌تر از ۷ روز → حذف
 *  • jobs مرده (DLQ) قدیمی‌تر از ۹۰ روز → حذف (تا آن زمان برای تحقیق می‌مانند)
 *  • audit_logs قدیمی‌تر از ۱ سال → حذف (برای compliance تا یک سال نگه می‌داریم)
 */
export async function POST(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;

    const idemDeleted = await cleanupIdempotencyKeys();

    const completedJobs = await db.$executeRaw`
      DELETE FROM jobs WHERE status = 'completed' AND updated_at < now() - interval '7 days'
    `;
    const deadJobs = await db.$executeRaw`
      DELETE FROM jobs WHERE status = 'dead' AND updated_at < now() - interval '90 days'
    `;
    const oldAudit = await db.$executeRaw`
      DELETE FROM audit_logs WHERE created_at < now() - interval '1 year'
    `;

    const result = {
      idempotency_keys: idemDeleted,
      completed_jobs: completedJobs,
      dead_jobs: deadJobs,
      audit_logs: oldAudit,
    };
    log.info('retention cleanup', result);
    return NextResponse.json({ ok: true, deleted: result });
  } catch (e) { return errorResponse(e); }
}

// Vercel Cron از GET استفاده می‌کند؛ به همان منطق POST وصلش می‌کنیم.
export const GET = POST;
