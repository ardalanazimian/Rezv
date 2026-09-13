import {
  claimJobs, completeJob, failJob, refreshQueueMetrics,
  reclaimStaleJobs, WORKER_BATCH_MAX, type ClaimedJob,
} from './queue';
import { sendSmsCharged, type SmsJob } from './sms';
import { sendEmail, sendPush } from './notify';
import { deliverWebhook } from './events';
import { createLogger } from './logger';
import { metrics } from './metrics';

const log = createLogger('worker');

// ═══════════════════════════════════════════════════════════════════════
//  Worker صف — یک batch از job‌ها را claim و بر اساس kind dispatch می‌کند.
//  هر handler کار واقعی را انجام می‌دهد. اگر throw کند، failJob تصمیم
//  retry/DLQ را می‌گیرد. اگر موفق شود، completeJob.
//
//  چون claim با SKIP LOCKED است، می‌توان چند نسخه از این worker را موازی
//  اجرا کرد (چند pod/cron) بدون پردازش تکراری.
// ═══════════════════════════════════════════════════════════════════════

// هر نوع job چطور پردازش می‌شود
const handlers: Record<string, (payload: any, job: ClaimedJob) => Promise<Record<string, unknown> | void>> = {
  sms: async (p: SmsJob, job) => {
    // قاعده‌ی پول در `sendSmsCharged` است: چک ← ارسال ← کسر پس از پذیرش، و
    // کسر به‌ازای `job.id` یکتا — پس retry و reclaimِ همان job دوباره کسر نمی‌کنند
    // (دستورِ ۰۴۹). OTP و پیامک‌های سطح پلتفرم restaurantId ندارند → بدون چک.
    const outcome = await sendSmsCharged(p, { jobId: job.id, reason: 'campaign' });
    if (outcome.status === 'insufficient_balance') {
      // موجودی تمام شده — ارسال نشد؛ failJob تا سقفِ تلاش‌ها retry و بعد DLQ می‌کند
      throw new Error(`موجودی پیامک رستوران ${p.restaurantId} کافی نیست`);
    }
    if (outcome.status === 'balance_unknown') {
      // نمی‌دانیم اجازه‌ی ارسال داریم یا نه → ارسال نکن، retry
      throw new Error(`خواندنِ موجودیِ پیامکِ رستوران ${p.restaurantId} ناموفق: ${outcome.error}`);
    }
    return outcome;
  },
  email: async (p: { to: string; subject: string; body: string }) => {
    await sendEmail(p.to, p.subject, p.body);
  },
  push: async (p: { userId: string; title: string; body: string }) => {
    await sendPush(p.userId, p.title, p.body);
  },
  webhook: async (p: any) => { await deliverWebhook(p); },
  // نکته: نوعِ کاری که handler ندارد (مثلاً یک kind قدیمی در صف) توسط runWorker
  // مستقیم به dead-letter می‌رود و در متریک‌ها دیده می‌شود — بدونِ retryِ بی‌فایده.
};

/**
 * یک batch را پردازش می‌کند. حداکثر `max` کار. خروجی: شمارش نتایج.
 *
 * ⚠️ `max` به `WORKER_BATCH_MAX` محدود می‌شود و این عمدی است: `JOB_LEASE_MS`
 * از همان ثابت مشتق شده (اجاره باید کلِ batchِ سریالی را بپوشاند). اگر کسی
 * روزی `runWorker(500)` صدا بزند، بدونِ این clamp اجاره بی‌صدا ناکافی می‌شد و
 * workerِ دوم کارِ در حالِ اجرا را بازپس می‌گرفت — یعنی پیامکِ تکراری.
 */
export async function runWorker(max = WORKER_BATCH_MAX): Promise<{ processed: number; failed: number; dead: number }> {
  // پیش از برداشتنِ کارِ تازه، کارهای رهاشده‌ی workerِ کرش‌کرده را برگردان.
  // این‌جا و نه در یک cronِ جداگانه: هر دقیقه که `jobs-drain` اجرا می‌شود این
  // هم اجرا می‌شود، بدونِ افزودنِ زمان‌بندیِ تازه‌ای که ممکن است ست نشود.
  await reclaimStaleJobs(WORKER_BATCH_MAX);

  const jobs = await claimJobs(Math.min(max, WORKER_BATCH_MAX));
  let processed = 0, failed = 0, dead = 0;

  for (const job of jobs) {
    const handler = handlers[job.kind];
    if (!handler) {
      // نوع ناشناخته → مستقیم DLQ (نباید بی‌نهایت retry شود)
      await failJob({ ...job, attempts: job.maxAttempts }, `نوع job ناشناخته: ${job.kind}`);
      dead++;
      metrics.jobsProcessed.inc({ kind: job.kind, outcome: 'dead' });
      continue;
    }
    try {
      const result = await handler(job.payload, job);
      await completeJob(job.id, result ?? undefined);
      processed++;
      metrics.jobsProcessed.inc({ kind: job.kind, outcome: 'success' });
    } catch (e) {
      const outcome = await failJob(job, (e as Error).message);
      if (outcome === 'dead') { dead++; metrics.jobsProcessed.inc({ kind: job.kind, outcome: 'dead' }); }
      else { failed++; metrics.jobsProcessed.inc({ kind: job.kind, outcome: 'retry' }); }
    }
  }

  // به‌روزرسانی gaugeهای صف برای مانیتورینگ
  await refreshQueueMetrics();

  if (jobs.length > 0) log.info('batch worker', { processed, failed, dead });
  return { processed, failed, dead };
}
