import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listBannedIps, unbanIp, enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

const bodySchema = z.object({ ip: z.string().min(1).max(64) });

/** GET /api/v1/admin/security/banned-ips — IPهایِ الان‌بن‌شده (بنِ خودکارِ ریت‌لیمیت) */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const items = await listBannedIps();
    return NextResponse.json({ items });
  } catch (e) { return errorResponse(e); }
}

/** POST /api/v1/admin/security/banned-ips — لغوِ دستیِ بنِ یک IP · بدنه: { ip } */
export async function POST(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { ip } = await parseBody(req, bodySchema);
    const removed = await unbanIp(ip);
    await audit({ action: 'security.rate_limit', actorId: admin.sub, actorType: 'admin', ip: clientIp(req), detail: { operation: 'unban_ip', ip, removed } });
    return NextResponse.json({ ok: true, removed });
  } catch (e) { return errorResponse(e); }
}
