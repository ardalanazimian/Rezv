import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createBadgeDefinition, listBadgeDefinitions } from '@/lib/badges';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseQuery, z } from '@/lib/schemas';

const KEY_RE = /^[a-z][a-z0-9_]{1,49}$/;
const zBadgeKey = z.string().regex(KEY_RE, 'کلید باید فقط حروفِ کوچکِ لاتین/عدد/زیرخط باشد (مثلاً founding_member)');

const bodySchema = z.object({
  key: zBadgeKey,
  name: z.string().min(1).max(60).trim(),
  description: z.string().max(300).trim().optional(),
  icon: z.string().min(1).max(40).trim().optional(),
  color: z.string().max(20).trim().optional(),
});
const querySchema = z.object({ include_inactive: z.string().optional() });

/** GET /api/v1/admin/badges — فهرستِ همه‌ی تعریف‌هایِ نشان (پیش‌فرض فقط فعال‌ها) */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const { include_inactive } = parseQuery(req, querySchema);
    const items = await listBadgeDefinitions(include_inactive === 'true');
    return NextResponse.json({ items });
  } catch (e) { return errorResponse(e); }
}

/** POST /api/v1/admin/badges — تعریفِ نشانِ جدید (فقط ادمینِ پلتفرم) */
export async function POST(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const b = await parseBody(req, bodySchema);
    const badge = await createBadgeDefinition({ ...b, adminId: admin.sub });
    return NextResponse.json({ ok: true, badge }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
