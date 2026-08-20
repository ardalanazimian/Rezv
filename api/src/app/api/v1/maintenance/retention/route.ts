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
 *  • دفترِ پیش‌بینی/نتیجه قدیمی‌تر از ۲ سال → حذف
 *
 * چرا دفترها هم پاک‌سازی می‌شوند: model_predictions/model_outcomes
 * (migration 055) append-only‌اند و با هر رزرو رشد می‌کنند — بدونِ سقف،
 * جدولی که فقط برایِ سنجش لازم است بی‌نهایت بزرگ می‌شود. پنجره‌ی سنجشِ
 * واقعی ۹۰ روز است (lib/model-evaluation.ts)، پس ۲ سال با فاصله‌ی زیاد
 * محافظه‌کارانه است و هم‌زمان §۳۶ نقشه‌راه (نگه‌داشتِ محدود، نه ابدی) را
 * رعایت می‌کند.
 *
 * ترتیب مهم است: اول نتیجه، بعد پیش‌بینی — چون خواندنِ سنجش با JOIN
 * انجام می‌شود و نتیجه‌ی یتیم بی‌ضررتر از پیش‌بینیِ یتیم نیست، ولی
 * برعکسش هم فرقی نمی‌کند؛ هر دو با یک پنجره پاک می‌شوند تا جفت‌ها
 * نیمه‌کاره نمانند.
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

    const oldOutcomes = await db.$executeRaw`
      DELETE FROM model_outcomes WHERE occurred_at < now() - interval '2 years'
    `;
    const oldPredictions = await db.$executeRaw`
      DELETE FROM model_predictions WHERE predicted_at < now() - interval '2 years'
    `;

    const result = {
      idempotency_keys: idemDeleted,
      completed_jobs: completedJobs,
      dead_jobs: deadJobs,
      audit_logs: oldAudit,
      model_outcomes: oldOutcomes,
      model_predictions: oldPredictions,
    };
    log.info('retention cleanup', result);
    return NextResponse.json({ ok: true, deleted: result });
  } catch (e) { return errorResponse(e); }
}

// Vercel Cron از GET استفاده می‌کند؛ به همان منطق POST وصلش می‌کنیم.
export const GET = POST;
