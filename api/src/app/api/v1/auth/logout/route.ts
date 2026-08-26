import { NextResponse } from 'next/server';
import { verifyRefresh } from '@/lib/jwt';
import { revokeRefreshToken } from '@/lib/security';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { clientIp } from '@/lib/ratelimit';
import { audit } from '@/lib/audit';

import { withApiMetrics } from '@/lib/api-metrics';

// refresh اختیاری است (idempotent logout: بدون توکن هم باید 200 برگرداند)
const schema = z.object({ refresh: z.string().max(2000).optional() });

/** POST /api/v1/auth/logout — باطل‌کردن refresh token (لیست سیاه) */
async function POST_impl(req: Request) {
  const ip = clientIp(req);
  try {
    const { refresh } = await parseBody(req, schema);
    // actorId فقط وقتی معلوم است که توکن هنوز معتبر باشد؛ logoutِ بدونِ توکن
    // (یا با توکنِ منقضی) همچنان ۲۰۰ است و به‌صورتِ anonymous ثبت می‌شود.
    let actorId: string | null = null;
    let actorType: 'customer' | 'staff' | 'anonymous' = 'anonymous';
    if (refresh) {
      try {
        const payload = verifyRefresh(refresh);
        actorId = payload.sub ?? null;
        actorType = payload.kind === 'staff' ? 'staff' : 'customer';
        if (payload.jti) await revokeRefreshToken(payload.jti);
      } catch { /* توکنِ نامعتبر → logout همچنان idempotent و موفق است */ }
    }
    await audit({ action: 'auth.logout', actorId, actorType, ip, detail: { had_token: Boolean(refresh) } });
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/logout', POST_impl);
