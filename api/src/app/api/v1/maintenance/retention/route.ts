import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cleanupIdempotencyKeys } from '@/lib/idempotency';
import { prunePlatformEvents } from '@/lib/platform-events';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { createLogger } from '@/lib/logger';
import { errorResponse } from '@/lib/errors';
import { MAX_LEARNED_VOCAB_ROWS } from '@/lib/assistant';

import { withApiMetrics } from '@/lib/api-metrics';

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
 *  • platform_events بر اساسِ سطحِ اعتماد → حذف (§۱۴؛ ۹۰/۱۸۰/۴۰۰ روز)
 *  • restaurant_assistant_logs قدیمی‌تر از ۹۰ روز → حذف
 *  • restaurant_assistant_vocab: ردیف‌های خارج از سقفِ خوانده‌شده → حذف
 */
async function POST_impl(req: Request) {
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

    // هرسِ تله‌متری — تنها جدولی که تا فازِ ۲ هیچ سیاستِ نگه‌داری نداشت.
    // اگر شکست بخورد نباید بقیه‌ی پاک‌سازی را باطل کند (jobِ روزانه است و
    // خطایش در لاگ می‌ماند)، پس جدا catch می‌شود.
    const telemetry = await prunePlatformEvents().catch((e) => {
      log.error('هرسِ platform_events ناموفق', { error: (e as Error).message });
      return null;
    });

    // ── دستیارِ هوشمند (migration 050) — دو جدولی که هیچ سیاستِ نگه‌داری
    //    نداشتند و **کاربر خودش** ردیف‌هایشان را می‌سازد.
    //
    //    ⚠️ چرا لازم است (یافته‌ی ۲۰۲۶-۰۸-۲۵): هر سؤال یک ردیفِ log و هر
    //    اصلاح تا ده‌ها ردیفِ vocab می‌سازد، و `word` یک `text`ِ بدونِ سقف
    //    است. مسیرِ نوشتن الان محدود شده (سقفِ توکن + یک‌بار آموزش به‌ازای
    //    هر سؤال + سطحِ ریت‌لیمیتِ `auth`)، ولی رشدِ **تجمعی** باز هم باید
    //    هرس شود؛ وگرنه جدول فقط کندتر بزرگ می‌شود، نه اینکه بزرگ نشود.
    //
    //    هرسِ vocab دقیقاً همان بُرشی است که طبقه‌بند می‌خواند
    //    (`MAX_LEARNED_VOCAB_ROWS` با همان ترتیب): ردیفی که حذف می‌شود
    //    ردیفی است که هیچ‌وقت در هیچ طبقه‌بندی‌ای شرکت نمی‌کرد. یک تعریف،
    //    از `lib/assistant.ts` import می‌شود تا این دو عدد نتوانند واگرا شوند.
    //
    //    مثلِ تله‌متری جدا catch می‌شوند: خطایشان نباید بقیه‌ی پاک‌سازیِ
    //    روزانه را باطل کند.
    const assistantLogs = await db.$executeRaw`
      DELETE FROM restaurant_assistant_logs WHERE created_at < now() - interval '90 days'
    `.catch((e) => {
      log.error('هرسِ restaurant_assistant_logs ناموفق', { error: (e as Error).message });
      return null;
    });
    const assistantVocab = await db.$executeRaw`
      DELETE FROM restaurant_assistant_vocab v
      USING (
        SELECT id, row_number() OVER (
          PARTITION BY restaurant_id ORDER BY count DESC, updated_at DESC
        ) AS rn
        FROM restaurant_assistant_vocab
      ) ranked
      WHERE v.id = ranked.id AND ranked.rn > ${MAX_LEARNED_VOCAB_ROWS}
    `.catch((e) => {
      log.error('هرسِ restaurant_assistant_vocab ناموفق', { error: (e as Error).message });
      return null;
    });

    const result = {
      idempotency_keys: idemDeleted,
      completed_jobs: completedJobs,
      dead_jobs: deadJobs,
      audit_logs: oldAudit,
      platform_events: telemetry,
      assistant_logs: assistantLogs,
      assistant_vocab: assistantVocab,
    };
    log.info('retention cleanup', result);
    return NextResponse.json({ ok: true, deleted: result });
  } catch (e) { return errorResponse(e); }
}


// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/maintenance/retention', POST_impl);
// Vercel Cron از GET استفاده می‌کند؛ به همان منطقِ POSTِ شمرده‌شده وصل است.
export const GET = POST;
