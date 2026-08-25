import { claimJobs, completeJob, failJob, refreshQueueMetrics } from './queue';
import { sendSmsNow, type SmsJob } from './sms';
import { consumeSms } from './sms-balance';
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
const handlers: Record<string, (payload: any) => Promise<Record<string, unknown> | void>> = {
  sms: async (p: SmsJob) => {
    // اگر پیامک به یک رستوران تعلق دارد، اول از موجودی کم کن.
    // اگر موجودی کافی نبود، ارسال نکن (ضد ارسال بدون اعتبار).
    // OTP و پیامک‌های سطح پلتفرم restaurantId ندارند → بدون چک ارسال می‌شوند.
    if (p.restaurantId) {
      const ok = await consumeSms(p.restaurantId, 1, 'campaign');
      if (!ok) {
        // موجودی تمام شده — job را به‌جای retry بی‌پایان، با پیام واضح رها کن
        throw new Error(`موجودی پیامک رستوران ${p.restaurantId} کافی نیست`);
      }
    }
    await sendSmsNow(p);
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

/** یک batch را پردازش می‌کند. حداکثر `max` کار. خروجی: شمارش نتایج. */
export async function runWorker(max = 50): Promise<{ processed: number; failed: number; dead: number }> {
  const jobs = await claimJobs(max);
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
      const result = await handler(job.payload);
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
