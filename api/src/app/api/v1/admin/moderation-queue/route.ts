import { NextResponse } from 'next/server';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { getModerationQueueSummary } from '@/lib/moderation-queue';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';

/**
 * GET /api/v1/admin/moderation-queue — خلاصه‌ی یکپارچه‌ی نظارت (فقط ادمینِ پلتفرم).
 * عمداً «اسکلت»: فقط شمارشِ ابزارهایِ نظارتیِ موجود (بن سختِ کاربر، فلگِ
 * سوءاستفاده، بنِ IP، صفِ عکس)، بدونِ ابزارِ نظارتیِ تازه.
 */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);
    const summary = await getModerationQueueSummary();
    return NextResponse.json(summary);
  } catch (e) { return errorResponse(e); }
}
