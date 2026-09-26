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

const handlers: Record<string, (payload: any, job: ClaimedJob) => Promise<Record<string, unknown> | void>> = {
  sms: async (p: SmsJob, job) => {
    const outcome = await sendSmsCharged(p, { jobId: job.id, reason: 'campaign' });
    if (outcome.status === 'insufficient_balance') {
      throw new Error(`موجودی پیامک رستوران ${p.restaurantId} کافی نیست`);
    }
    if (outcome.status === 'balance_unknown') {
      throw new Error(`خواندنِ موجودیِ پیامکِ رستوران ${p.restaurantId} ناموفق: ${outcome.error}`);
    }
    return outcome;
  },
  email: async (p: { to: string; subject: string; body: string }) => {
    await sendEmail(p.to, p.subject, p.body);
  },
  push: async (p: { userId: string; title: string; body: string; url?: string; tag?: string }) => {
    await sendPush(p.userId, p.title, p.body, { url: p.url, tag: p.tag });
  },
  webhook: async (p: any) => { await deliverWebhook(p); },
};

export async function runWorker(max = WORKER_BATCH_MAX): Promise<{ processed: number; failed: number; dead: number }> {
  await reclaimStaleJobs(WORKER_BATCH_MAX);

  const jobs = await claimJobs(Math.min(max, WORKER_BATCH_MAX));
  let processed = 0, failed = 0, dead = 0;

  for (const job of jobs) {
    const handler = handlers[job.kind];
    if (!handler) {
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

  await refreshQueueMetrics();

  if (jobs.length > 0) log.info('batch worker', { processed, failed, dead });
  return { processed, failed, dead };
}
