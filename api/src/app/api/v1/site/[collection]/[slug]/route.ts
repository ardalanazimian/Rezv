import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, z } from '@/lib/schemas';
import { isCollection, readPublicDetail } from '@/lib/site-content';
import { SITE_RULES } from '@/lib/site-orders';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/site/{collection}/{slug} — یک ردیفِ محتوایی بر اساسِ اسلاگ
//
//  فقط برای مجموعه‌هایی که اسلاگ دارند (pages و articles). بقیه ۴۰۴ می‌گیرند
//  چون فهرستِ کاملشان در یک درخواستِ لیست می‌آید و مسیرِ جزئیات معنا ندارد.
//  فقط منتشرشده‌ها؛ پیش‌نویس از این مسیر دیده نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({
  collection: z.string().min(1).max(40),
  slug: z.string().min(1).max(150),
});

async function GET_impl(
  req: Request,
  { params }: { params: Promise<{ collection: string; slug: string }> },
) {
  try {
    await enforceRateLimit(clientIp(req), SITE_RULES.read);
    const { collection, slug } = parseParams(await params, paramsSchema);
    if (!isCollection(collection)) throw Err.notFound('مجموعه');

    const item = await readPublicDetail(collection, slug);
    if (!item) throw Err.notFound(collection === 'articles' ? 'مقاله' : 'صفحه');
    return NextResponse.json(item);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/site/[collection]/[slug]', GET_impl);
