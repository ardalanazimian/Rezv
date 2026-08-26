import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, parseQuery, z } from '@/lib/schemas';
import { COLLECTIONS, isCollection, readPublicList } from '@/lib/site-content';
import { SITE_RULES } from '@/lib/site-orders';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/site/{collection} — لیستِ عمومیِ محتوای سایت
//
//  مجموعه‌های مجاز: pages | articles | faqs | plans | testimonials |
//  banners | release-notes. فقط ردیف‌های منتشرشده برگردانده می‌شوند؛
//  پیش‌نویس هرگز از این مسیر بیرون نمی‌رود.
//
//  عمومی (بدونِ auth) و کش‌شده در Redis (TTL به‌ازای مجموعه در REGISTRY تعریف
//  شده) — منبعِ دادهٔ وب‌سایتِ عمومی (apps/seo) در حالتِ SSR/ISR.
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({ collection: z.string().min(1).max(40) });
const querySchema = z.object({
  scope: z.string().min(1).max(30).optional(),   // فقط faqs
  tag: z.string().min(1).max(40).optional(),     // فقط articles
  limit: z.number().int().min(1).max(100).optional(),
});

async function GET_impl(req: Request, { params }: { params: Promise<{ collection: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), SITE_RULES.read);
    const { collection } = parseParams(await params, paramsSchema);
    if (!isCollection(collection)) {
      throw Err.notFound(`مجموعه (مجازها: ${COLLECTIONS.join('، ')})`);
    }
    const { scope, tag, limit } = parseQuery(req, querySchema);

    const items = await readPublicList(collection, { scope, tag, limit });
    return NextResponse.json({ collection, count: items.length, items });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/site/[collection]', GET_impl);
