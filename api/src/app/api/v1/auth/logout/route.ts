import { NextResponse } from 'next/server';
import { verifyRefresh } from '@/lib/jwt';
import { revokeRefreshToken } from '@/lib/security';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

// refresh اختیاری است (idempotent logout: بدون توکن هم باید 200 برگرداند)
const schema = z.object({ refresh: z.string().max(2000).optional() });

/** POST /api/v1/auth/logout — باطل‌کردن refresh token (لیست سیاه) */
export async function POST(req: Request) {
  try {
    const { refresh } = await parseBody(req, schema);
    if (refresh) {
      try { const { jti } = verifyRefresh(refresh); if (jti) await revokeRefreshToken(jti); } catch {}
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
