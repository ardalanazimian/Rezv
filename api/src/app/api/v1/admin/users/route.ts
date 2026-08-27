import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { buildCustomer360 } from '@/lib/admin-customer-360';
import { normalizePhone } from '@/lib/otp';
import { Err, errorResponse } from '@/lib/errors';
import { parseQuery, zPhone, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const querySchema = z.object({ phone: zPhone });

/**
 * GET /api/v1/admin/users?phone=... — جست‌وجویِ «Customer 360» با شماره‌موبایل
 * (تکمیل‌کننده‌ی GET /admin/users/:userId که با شناسه جست‌وجو می‌کند).
 */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const { phone } = parseQuery(req, querySchema);
    const normalized = normalizePhone(phone);
    const user = await db.user.findUnique({ where: { phone: normalized }, select: { id: true } });
    if (!user) throw Err.notFound('کاربر');
    return NextResponse.json(await buildCustomer360(user.id));
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/users', GET_impl);
