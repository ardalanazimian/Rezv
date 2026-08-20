import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';

/**
 * GET /api/v1/admin/system-health — سلامت زیرساخت پلتفرم (پنل شرکت).
 * صف Job، webhookها، و خطاهای اخیر را در سطح کل پلتفرم نشان می‌دهد.
 * این به CEO/تیم فنی دید لحظه‌ای از سلامت سیستم می‌دهد.
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);

    const [jobsByStatus, activeWebhooks, failedActions24h, deadJobs, oldestPending] = await Promise.all([
      // وضعیت صف Job بر اساس status
      db.$queryRaw<{ status: string; count: bigint }[]>`
        SELECT status::text, count(*) AS count FROM jobs GROUP BY status
      `,
      db.webhook.count({ where: { isActive: true } }),
      // اقدامات ناموفق ۲۴ ساعت اخیر (از audit log)
      db.auditLog.count({ where: { success: false, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      // jobهای dead (نیاز به بررسی دستی)
      db.job.findMany({
        where: { status: 'dead' },
        select: { id: true, kind: true, lastError: true, attempts: true, createdAt: true },
        orderBy: { createdAt: 'desc' }, take: 10,
      }),
      // قدیمی‌ترین job در صف (اگر خیلی قدیمی باشد = صف گیر کرده)
      db.job.findFirst({
        where: { status: 'pending' },
        select: { createdAt: true, kind: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const jobCounts: Record<string, number> = { pending: 0, processing: 0, completed: 0, failed: 0, dead: 0 };
    for (const row of jobsByStatus) jobCounts[row.status] = Number(row.count);

    // سلامت کلی: اگر job dead یا خطای زیاد یا صف گیرکرده باشد، هشدار
    const queueStuck = oldestPending && (Date.now() - oldestPending.createdAt.getTime()) > 10 * 60_000;
    const health =
      jobCounts.dead > 0 || failedActions24h > 50 ? 'critical'
      : jobCounts.failed > 10 || queueStuck ? 'warning'
      : 'healthy';

    return NextResponse.json({
      health,
      jobs: jobCounts,
      active_webhooks: activeWebhooks,
      failed_actions_24h: failedActions24h,
      queue_stuck: !!queueStuck,
      oldest_pending_job: oldestPending ? { kind: oldestPending.kind, since: oldestPending.createdAt } : null,
      dead_jobs: deadJobs.map(j => ({
        id: j.id, kind: j.kind, error: j.lastError, attempts: j.attempts, created_at: j.createdAt,
      })),
    });
  } catch (e) { return errorResponse(e); }
}
