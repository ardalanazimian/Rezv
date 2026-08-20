import { db } from './db';
import { createLogger } from './logger';
import { metrics } from './metrics';

const log = createLogger('queue');

// ═══════════════════════════════════════════════════════════════════════
//  صف Job عمومی — مبتنی بر Postgres (FOR UPDATE SKIP LOCKED)
//
//  چرا Postgres نه Redis/SQS: دیتابیس از قبل هست، و این الگو همه‌ی نیازها
//  را بدون سرویس سوم می‌دهد — و مهم‌تر: idempotency و claim اتمیک در همان
//  تراکنش دیتابیس تضمین می‌شوند. کل الگو روی PostgreSQL واقعی تست شد.
//
//  قابلیت‌ها:
//   • Priority — claim به ترتیب priority (1=بالاترین)
//   • Idempotency — کلید یکتا؛ کار تکراری enqueue نمی‌شود
//   • Retry + Exponential Backoff — شکست → pending با run_after عقب‌تر (2^attempts)
//   • Dead Letter Queue — بعد از max_attempts → status='dead'
//   • SKIP LOCKED — چند worker موازی، هیچ کار دوباره پردازش نمی‌شود
//   • Worker Monitoring — getQueueStats() برای داشبورد
// ═══════════════════════════════════════════════════════════════════════

export type JobKind = 'sms' | 'email' | 'push' | 'report' | 'image' | 'webhook';

// اولویت پیش‌فرض هر نوع (قابل override هنگام enqueue)
const DEFAULT_PRIORITY: Record<JobKind, number> = {
  sms: 2,       // اعلان‌های حساس به زمان (یادآوری رزرو، آفر لیست انتظار)
  push: 3,
  webhook: 4,   // ادغام شخص ثالث (POS/حسابداری) — نسبتاً به‌موقع
  email: 5,
  image: 6,
  report: 8,    // سنگین ولی غیرفوری
};

export type EnqueueOptions = {
  kind: JobKind;
  payload: Record<string, unknown>;
  priority?: number;
  idempotencyKey?: string;     // اگر داده شود، کار تکراری enqueue نمی‌شود
  maxAttempts?: number;
  runAfter?: Date;             // زمان‌بندی برای آینده (مثلاً یادآوری ۲۴ ساعت قبل)
};

/** افزودن کار به صف. اگر idempotencyKey تکراری باشد، کار جدید ساخته نمی‌شود. */
export async function enqueue(opts: EnqueueOptions): Promise<{ id: string; deduped: boolean }> {
  const priority = opts.priority ?? DEFAULT_PRIORITY[opts.kind] ?? 5;
  try {
    const job = await db.job.create({
      data: {
        kind: opts.kind,
        payload: opts.payload as object,
        priority,
        idempotencyKey: opts.idempotencyKey ?? null,
        maxAttempts: opts.maxAttempts ?? 5,
        runAfter: opts.runAfter ?? new Date(),
      },
      select: { id: true },
    });
    log.debug(`enqueue ${opts.kind}`, { id: job.id, priority });
    return { id: job.id, deduped: false };
  } catch (e: any) {
    // P2002 = نقض unique (idempotencyKey تکراری) → کار قبلاً در صف است
    if (e?.code === 'P2002' && opts.idempotencyKey) {
      const existing = await db.job.findUnique({
        where: { idempotencyKey: opts.idempotencyKey }, select: { id: true },
      });
      log.debug(`enqueue dedup ${opts.kind}`, { key: opts.idempotencyKey });
      return { id: existing?.id ?? '', deduped: true };
    }
    throw e;
  }
}

export type ClaimedJob = {
  id: string; kind: string; payload: any; attempts: number; maxAttempts: number;
};

/**
 * Claim اتمیک تا `limit` کار pending به ترتیب priority.
 * FOR UPDATE SKIP LOCKED تضمین می‌کند workerهای موازی کار تکراری برندارند.
 */
export async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  const rows = await db.$queryRaw<ClaimedJob[]>`
    WITH claimed AS (
      SELECT id FROM jobs
      WHERE status = 'pending' AND run_after <= now()
      ORDER BY priority ASC, run_after ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE jobs j
    SET status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
    FROM claimed
    WHERE j.id = claimed.id
    RETURNING j.id, j.kind, j.payload, j.attempts, j.max_attempts AS "maxAttempts"
  `;
  return rows;
}

/** علامت‌گذاری کار به‌عنوان موفق. */
export async function completeJob(id: string, result?: Record<string, unknown>): Promise<void> {
  await db.job.update({
    where: { id },
    data: { status: 'completed', result: (result ?? {}) as object, lockedAt: null },
  });
}

/** مدتِ backoff نمایی بر حسب ثانیه (سقف ۱ ساعت). تابع خالص — قابل‌تست بدون DB. */
export function computeBackoffSeconds(attempts: number): number {
  return Math.min(Math.pow(2, attempts), 3600);
}

/** آیا job با این تعداد تلاش باید به DLQ برود؟ تابع خالص — قابل‌تست بدون DB. */
export function shouldDeadLetter(attempts: number, maxAttempts: number): boolean {
  return attempts >= maxAttempts;
}

/**
 * علامت‌گذاری شکست. اگر attempts به max رسیده باشد → DLQ (dead).
 * وگرنه → pending با backoff نمایی (2^attempts ثانیه).
 */
export async function failJob(job: ClaimedJob, error: string): Promise<'retry' | 'dead'> {
  const willDie = shouldDeadLetter(job.attempts, job.maxAttempts);
  const backoffSec = computeBackoffSeconds(job.attempts);
  await db.$executeRaw`
    UPDATE jobs SET
      status = ${willDie ? 'dead' : 'pending'}::job_status,
      run_after = now() + (interval '1 second' * ${backoffSec}),
      last_error = ${error.slice(0, 1000)},
      locked_at = NULL,
      updated_at = now()
    WHERE id = ${job.id}::uuid
  `;
  if (willDie) {
    log.error(`job رفت به DLQ`, { id: job.id, kind: job.kind, attempts: job.attempts, error });
  } else {
    log.warn(`job retry`, { id: job.id, kind: job.kind, attempt: job.attempts, backoffSec });
  }
  return willDie ? 'dead' : 'retry';
}

/** آمار صف برای مانیتورینگ worker (داشبورد/متریک). */
export async function getQueueStats(): Promise<{ kind: string; status: string; count: number }[]> {
  const rows = await db.$queryRaw<{ kind: string; status: string; count: bigint }[]>`
    SELECT kind, status::text AS status, count(*) AS count
    FROM jobs
    WHERE status IN ('pending','processing','dead')
    GROUP BY kind, status
  `;
  return rows.map((r) => ({ kind: r.kind, status: r.status, count: Number(r.count) }));
}

/** به‌روزرسانی متریک‌های Prometheus از وضعیت صف (برای endpoint /api/metrics). */
export async function refreshQueueMetrics(): Promise<void> {
  try {
    const stats = await getQueueStats();
    let pendingTotal = 0, deadTotal = 0;
    for (const s of stats) {
      if (s.status === 'pending') pendingTotal += s.count;
      if (s.status === 'dead') deadTotal += s.count;
    }
    metrics.jobsPending.set(pendingTotal);
    metrics.jobsDead.set(deadTotal);
  } catch {
    // متریک نباید مسیر اصلی را بشکند
  }
}
