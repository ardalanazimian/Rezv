import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listBannedIps, unbanIp, enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const bodySchema = z.object({ ip: z.string().min(1).max(64) });

/** GET /api/v1/admin/security/banned-ips — IPهایِ الان‌بن‌شده (بنِ خودکارِ ریت‌لیمیت) */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const items = await listBannedIps();
    return NextResponse.json({ items });
  } catch (e) { return errorResponse(e); }
}

/** POST /api/v1/admin/security/banned-ips — لغوِ دستیِ بنِ یک IP · بدنه: { ip } */
async function POST_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { ip } = await parseBody(req, bodySchema);
    const removed = await unbanIp(ip);
    await audit({ action: 'security.rate_limit', actorId: admin.sub, actorType: 'admin', ip: clientIp(req), detail: { operation: 'unban_ip', ip, removed } });
    return NextResponse.json({ ok: true, removed });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/security/banned-ips', GET_impl);
export const POST = withApiMetrics('/api/v1/admin/security/banned-ips', POST_impl);
