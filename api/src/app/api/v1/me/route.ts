import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const patchSchema = z.object({
  first_name: z.string().min(1).max(50).trim(),
  last_name: z.string().max(50).trim().optional(),
  birth_date: z.string().max(30).optional(),
});

/** GET /api/v1/me — اطلاعات کاربر فعلی */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const user = await db.user.findUnique({
      where: { id: auth.sub },
      select: { id: true, phone: true, firstName: true, lastName: true, birthDate: true, avatarUrl: true },
    });
    if (!user) throw Err.notFound('کاربر');
    return NextResponse.json({ user });
  } catch (e) { return errorResponse(e); }
}

/**
 * PATCH /api/v1/me — به‌روزرسانی پروفایل (ثبت‌نام)
 * بدنه: { first_name, last_name?, birth_date? }
 */
async function PATCH_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const b = await parseBody(req, patchSchema);

    const firstName = b.first_name;
    const data: { firstName: string; lastName?: string; birthDate?: Date } = { firstName };
    if (b.last_name != null) data.lastName = b.last_name;
    if (b.birth_date) {
      const d = new Date(b.birth_date);
      if (!isNaN(+d)) data.birthDate = d;
    }

    const user = await db.user.update({
      where: { id: auth.sub },
      data,
      select: { id: true, phone: true, firstName: true, lastName: true, birthDate: true, avatarUrl: true },
    });
    return NextResponse.json({ user });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me', GET_impl);
export const PATCH = withApiMetrics('/api/v1/me', PATCH_impl);
