import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';
import { pushTransportReady, vapidPublicKey } from '@/lib/notify';

const subscribeSchema = z.object({
  enabled: z.boolean().optional().default(true),
  token: z.string().max(2000).optional(),
  endpoint: z.string().max(1000).optional(),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(200),
  }).optional(),
});

async function POST_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const b = await parseBody(req, subscribeSchema);

    const keysJson = b.enabled && b.keys
      ? JSON.stringify(b.keys)
      : (b.enabled ? (b.token ?? null) : null);

    const row = await db.pushSubscription.upsert({
      where: { userId: auth.sub },
      create: {
        userId: auth.sub, enabled: b.enabled,
        token: keysJson,
        endpoint: b.enabled ? (b.endpoint ?? null) : null,
      },
      update: {
        enabled: b.enabled,
        token: b.enabled ? (keysJson ?? undefined) : null,
        endpoint: b.enabled ? (b.endpoint ?? undefined) : null,
      },
      select: { enabled: true, endpoint: true, token: true },
    });

    const ready = pushTransportReady() && row.enabled && !!row.endpoint && !!row.token;
    return NextResponse.json({
      ok: true,
      enabled: row.enabled,
      ready,
      vapid_public_key: vapidPublicKey(),
    });
  } catch (e) { return errorResponse(e); }
}

async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const row = await db.pushSubscription.findUnique({
      where: { userId: auth.sub },
      select: { enabled: true, endpoint: true, token: true },
    });
    const ready = pushTransportReady() && !!row?.enabled && !!row.endpoint && !!row.token;
    return NextResponse.json({
      enabled: row?.enabled ?? false,
      ready,
      vapid_public_key: vapidPublicKey(),
    });
  } catch (e) { return errorResponse(e); }
}

export const POST = withApiMetrics('/api/v1/me/push-subscribe', POST_impl);
export const GET = withApiMetrics('/api/v1/me/push-subscribe', GET_impl);
