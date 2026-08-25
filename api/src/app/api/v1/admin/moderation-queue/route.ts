import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getModerationQueueSummary } from '@/lib/moderation-queue';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/**
 * GET /api/v1/admin/moderation-queue — خلاصه‌ی یکپارچه‌ی نظارت (فقط ادمینِ پلتفرم).
 * عمداً «اسکلت»: فقط شمارشِ ابزارهایِ نظارتیِ موجود (بن سختِ کاربر، فلگِ
 * سوءاستفاده، بنِ IP، صفِ عکس)، بدونِ ابزارِ نظارتیِ تازه.
 */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const summary = await getModerationQueueSummary();
    return NextResponse.json(summary);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/moderation-queue', GET_impl);
