import { NextResponse } from 'next/server';
import { sendDueReminders } from '@/lib/reminders';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/**
 * POST /api/v1/maintenance/reminders — یادآوریِ پیامکیِ رزروهای نزدیک (cron).
 *
 * ⚠️ چرا این route تازه است: اپِ مشتری از روزِ اول وعده می‌داد «قبل از رزروت
 * یادت می‌ندازیم» و قالبِ `rezervno-reminder` هم در TEMPLATE_MAP بود، ولی
 * هیچ کدی آن را enqueue نمی‌کرد و هیچ jobی در crontab نبود. یعنی یک وعده‌ی
 * اعلام‌شده که هرگز تحویل نمی‌شد.
 *
 * پاسخ عمداً تفکیکِ کامل می‌دهد (`scanned`/`sent`/`skipped_*`) نه فقط یک
 * عدد: «۰ ارسال» می‌تواند یعنی «رزروی نبود» یا «همه انصراف داده بودند» یا
 * «همه دیرهنگام رزرو کرده بودند» — و این سه تا از هم قابلِ تشخیص نیستند
 * مگر شمرده شوند.
 */
async function POST_impl(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;
    const result = await sendDueReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
export const POST = withApiMetrics('/api/v1/maintenance/reminders', POST_impl);
// Vercel Cron از GET استفاده می‌کند؛ به همان منطقِ POSTِ شمرده‌شده وصل است.
export const GET = POST;
