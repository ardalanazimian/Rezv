import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { buildCustomer360 } from '@/lib/admin-customer-360';
import { errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ userId: zUuid });

/**
 * GET /api/v1/admin/users/:userId — «Customer 360» برایِ پنلِ شرکت (فازِ ۲ — B2).
 * یک نمایِ تک‌صفحه‌ای از هویت + وضعیتِ نظارتی + اقتصاد + تاریخچه — تا تیمِ
 * پلتفرم بدونِ چرخیدن بینِ چند جدول، تصمیمِ آگاهانه بگیرد.
 * برایِ جست‌وجو با شماره‌موبایل: GET /api/v1/admin/users?phone=...
 */
async function GET_impl(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const { userId } = parseParams(await params, paramsSchema);
    return NextResponse.json(await buildCustomer360(userId));
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/users/[userId]', GET_impl);
