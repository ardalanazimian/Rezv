import { db } from './db';
import { createLogger } from './logger';
import { metrics } from './metrics';
import { OUTBOUND_HTTP_TIMEOUT_MS } from './outbound-http';

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
//   • Lease/Reclaim — کارِ رهاشده‌ی workerِ کرش‌کرده دوباره به چرخه برمی‌گردد
//   • Worker Monitoring — getQueueStats() برای داشبورد
//
//  ⚠️ اصلاحِ ادعای نادرست (۲۰۲۶-۰۹-۰۶): تا این تاریخ دو خطِ «Retry» و «DLQ»
//  بالا فقط برای handlerهایی درست بودند که `throw` می‌کنند. برای **کرش**
//  (SIGKILL/OOM/ری‌استارتِ کانتینر) هیچ‌کدام برقرار نبود: `locked_at` نوشته
//  می‌شد ولی **هیچ‌جا خوانده نمی‌شد**، پس سطر برای همیشه در 'processing'
//  می‌ماند — نه retry، نه DLQ، و نامرئی (متریک فقط pending/dead را می‌شمرد).
//  حالا `reclaimStaleJobs()` آن حلقه را می‌بندد و `jobsStuck` دیدنی‌اش می‌کند.
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

// ═══════════════════════════════════════════════════════════════════════
//  اجاره‌ی job (lease) — اشتقاق، نه عددِ دلبخواه
//
//  یک سطرِ 'processing' یعنی «workerی این کار را در دست دارد». اگر آن worker
//  کشته شود، سطر تا ابد می‌ماند. «اجاره» حداکثر مدتی است که این ادعا را باور
//  می‌کنیم؛ بعد از آن سطر را بازپس می‌گیریم.
//
//  ⚠️ عدم‌تقارنِ خطر — مبنای همه‌ی انتخاب‌های زیر:
//    • اجاره‌ی **بلندترِ** لازم  → فقط بازیابی دیر می‌شود. بی‌خطر.
//    • اجاره‌ی **کوتاه‌ترِ** لازم → کارِ در حالِ اجرا بازپس گرفته و **دوباره**
//      پردازش می‌شود؛ یعنی پیامکِ دوم برای همان مهمان. از خودِ نقص بدتر.
//  پس هر جا شک بود، سقفِ بالاتر انتخاب شده.
//
//  ── چرا اجاره در اندازه‌ی کلِ batch است و نه یک handler ──
//  `claimJobs` **همه‌ی** سطرهای یک batch را با یک `locked_at = now()` مهر
//  می‌زند (همان UPDATE پایین)، ولی `runWorker` آن‌ها را **سریالی** پردازش
//  می‌کند. یعنی آخرین job از یک batchِ ۵۰تایی، پیش از آنکه handlerش اصلاً
//  شروع شود، به‌طورِ کاملاً مشروع به اندازه‌ی ۴۹ کارِ قبلی در 'processing'
//  نشسته است. اجاره‌ای که فقط یک handler را بپوشاند، دقیقاً همان jobها را
//  می‌دزدد.
//
//  (گزینه‌ی «heartbeat»ِ per-job بررسی و رد شد: تازه‌کردنِ `locked_at` هنگام
//  شروعِ هر job، jobهای هنوز-شروع‌نشده‌ی همان batch را همچنان با مهرِ کهنه رها
//  می‌کند و دقیقاً همان دزدی را ممکن نگه می‌دارد. پوشاندنِ کلِ batch ساده‌تر و
//  اثباتاً امن است.)
// ═══════════════════════════════════════════════════════════════════════

/**
 * بیشترین تعداد کاری که یک اجرای worker برمی‌دارد.
 *
 * تنها مرجع؛ `runWorker` و routeِ `jobs-drain` هر دو از همین می‌خوانند. اگر
 * این عدد بزرگ شود، `JOB_LEASE_MS` خودکار با آن بزرگ می‌شود — این گره عمدی
 * است، وگرنه بزرگ‌کردنِ batch بی‌صدا اجاره را ناکافی می‌کرد.
 */
export const WORKER_BATCH_MAX = 50;

/**
 * سقفِ انتظار برای گرفتنِ اتصال از pool — از همان envی که `lib/db.ts` می‌خواند
 * (`pool_timeout`). دو رفت‌وبرگشتِ DB در بدترین حالت برای هر job: یک
 * `consumeSms` و یک `completeJob`/`failJob`.
 *
 * ⚠️ صادقانه: هیچ `statement_timeout` در این مخزن ست نشده (grep، کدِ خروجِ ۱)،
 * پس زمانِ **اجرای** یک کوئری رسماً بی‌کران است و این جمله فقط زمانِ
 * **گرفتنِ اتصال** را می‌پوشاند. به‌همین‌دلیل عدم‌تقارنِ بالا اهمیت دارد:
 * اجاره عمداً سخاوتمند بسته شده تا کندیِ DB به بازپس‌گیریِ زودرس منجر نشود.
 */
const DB_POOL_TIMEOUT_MS = Number(process.env.DB_POOL_TIMEOUT || '10') * 1000;

/** بدترین حالتِ یک job: یک فراخوانیِ HTTPِ خروجی + دو رفت‌وبرگشتِ DB. */
export const JOB_WORST_CASE_MS = OUTBOUND_HTTP_TIMEOUT_MS + 2 * DB_POOL_TIMEOUT_MS;

/**
 * اجاره = بدترین حالتِ **کلِ batch**، چون کلِ batch یک `locked_at` مشترک دارد.
 *
 * با مقادیرِ امروز: ۵۰ × (۱۰s + ۲×۱۰s) = ۱۵۰۰ ثانیه ≈ ۲۵ دقیقه.
 * هیچ‌کدام از این سه عدد اینجا اختراع نشده‌اند — به‌ترتیب از
 * `lib/outbound-http.ts`، `lib/db.ts` (`DB_POOL_TIMEOUT`) و `WORKER_BATCH_MAX`
 * می‌آیند.
 */
export const JOB_LEASE_MS = WORKER_BATCH_MAX * JOB_WORST_CASE_MS;

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

export type ReclaimedJob = {
  id: string; kind: string; status: 'pending' | 'dead'; attempts: number; maxAttempts: number;
};

/**
 * بازپس‌گیریِ کارهایی که workerِ کرش‌کرده در 'processing' رها کرده.
 *
 * سطری که `locked_at`ش از `JOB_LEASE_MS` کهنه‌تر است، صاحبِ زنده ندارد:
 *   • اگر سهمیه‌ی تلاش باقی مانده → 'pending' (دوباره برداشته می‌شود)
 *   • اگر `attempts >= max_attempts` → 'dead' (DLQ)
 * قاعده‌ی دوم عمداً همان `shouldDeadLetter` است؛ گاردِ رانشِ بینِ این دو در
 * `tests/queue-lease-reclaim.integration.test.mts` روی مقادیرِ مرزی assert
 * می‌شود، چون منطق ناچار در SQL تکرار شده تا کلِ عملیات اتمیک بماند.
 *
 * ⚠️ `attempts` عمداً **افزایش نمی‌یابد**: هنگامِ claim یک واحد افزوده شده
 * (همان UPDATEِ `claimJobs`)، پس تلاشِ کرش‌کرده از قبل شمرده شده. شمردنِ
 * دوباره سهمیه را نصف می‌کرد.
 *
 * ⚠️ backoff عمداً اعمال نمی‌شود (`run_after = now()`): jobِ سمی که worker را
 * می‌کُشد از قبل با `attempts` کران‌دار است و خودِ اجاره یک محدودکننده‌ی نرخِ
 * طبیعی است — هر سطر حداکثر یک‌بار در هر دوره‌ی اجاره بازپس گرفته می‌شود.
 * این از تکرارِ فرمولِ `computeBackoffSeconds` در SQL هم جلوگیری می‌کند.
 *
 * `FOR UPDATE SKIP LOCKED` همان الگویِ `claimJobs` است تا دو workerِ موازی یک
 * سطر را دوبار بازپس نگیرند.
 */
export async function reclaimStaleJobs(limit = WORKER_BATCH_MAX): Promise<ReclaimedJob[]> {
  const rows = await db.$queryRaw<ReclaimedJob[]>`
    WITH stale AS (
      SELECT id FROM jobs
      WHERE status = 'processing'
        AND locked_at IS NOT NULL
        AND locked_at < now() - (interval '1 millisecond' * ${JOB_LEASE_MS})
      ORDER BY locked_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE jobs j
    SET status = (CASE WHEN j.attempts >= j.max_attempts THEN 'dead' ELSE 'pending' END)::job_status,
        locked_at = NULL,
        run_after = now(),
        last_error = 'اجاره منقضی شد — worker پیش از اتمامِ کار متوقف شد (کرش/ری‌استارت)',
        updated_at = now()
    FROM stale
    WHERE j.id = stale.id
    RETURNING j.id, j.kind, j.status::text AS status, j.attempts, j.max_attempts AS "maxAttempts"
  `;

  for (const r of rows) {
    metrics.jobsReclaimed.inc({ kind: r.kind, outcome: r.status === 'dead' ? 'dead' : 'retry' });
  }
  if (rows.length > 0) {
    log.error('کارهای رهاشده بازپس گرفته شدند — یک worker پیش از اتمامِ کار مرده است', {
      count: rows.length,
      dead: rows.filter((r) => r.status === 'dead').length,
      leaseMs: JOB_LEASE_MS,
    });
  }
  return rows;
}

/**
 * تعداد سطرهایی که همین حالا فراتر از اجاره در 'processing' مانده‌اند.
 *
 * ⚠️ `::int` در SQL **و** `Number()` در JS — هر دو لایه: `count(*)` در
 * `$queryRaw` مقدارِ `BigInt` برمی‌گرداند حتی وقتی جنریکِ TypeScript
 * `number` می‌گوید (جنریک فقط assertion است، تبدیل نمی‌کند).
 */
export async function countStaleProcessingJobs(): Promise<number> {
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM jobs
    WHERE status = 'processing'
      AND locked_at IS NOT NULL
      AND locked_at < now() - (interval '1 millisecond' * ${JOB_LEASE_MS})
  `;
  return Number(rows[0]?.n ?? 0);
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
    // ⚠️ تا ۲۰۲۶-۰۹-۰۶ فقط دو خطِ بالا اینجا بود، و دقیقاً به همین دلیل کارِ
    // گیرکرده در 'processing' **نامرئی** بود: نه داشبورد می‌دیدش نه آلارم.
    // مسیرِ بازپس‌گیری‌ای که کسی نتواند ببیندش، همان نقص است یک طبقه بالاتر.
    metrics.jobsStuck.set(await countStaleProcessingJobs());
  } catch {
    // متریک نباید مسیر اصلی را بشکند
  }
}
