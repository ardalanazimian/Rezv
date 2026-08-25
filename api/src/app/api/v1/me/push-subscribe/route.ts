import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

// ⚠️ گسترش‌یافته (شکاف‌سنجی لانچ، ۲۰۲۶-۰۸-۱۵): تا اینجا این route هیچ‌جا
// چیزی ذخیره نمی‌کرد (فقط رفعِ باگِ صداقتی که ادعایِ enabled:true دروغ
// می‌داد). حالا با جدولِ push_subscriptions واقعاً upsert می‌شود — یعنی
// `enabled` صادقانه یعنی «توکن/endpoint‌اش ذخیره شده».
//
// هنوز صادق است دربارهٔ چیزی که واقعاً ندارد: ارسالِ واقعیِ push (نیازمندِ
// کلید FCM/APNs — رجوع کن به lib/notify.ts) هنوز ساخته نشده، پس `ready`
// همیشه false می‌ماند تا آن زیرساخت اضافه شود. `enabled` و `ready` عمداً
// دو فیلدِ جدا هستند: یکی «ذخیره شده»، دیگری «واقعاً کار می‌کند».

const subscribeSchema = z.object({
  enabled: z.boolean().optional().default(true),
  token: z.string().max(500).optional(),      // توکنِ FCM/APNs
  endpoint: z.string().max(1000).optional(),  // Web Push endpoint
});

/** POST /api/v1/me/push-subscribe — ثبت/به‌روزرسانیِ اشتراکِ push (ذخیره‌سازیِ واقعی؛ ارسالِ واقعی هنوز نه) */
async function POST_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const b = await parseBody(req, subscribeSchema);

    // enabled:false یعنی کاربر صریحاً push را خاموش کرده — توکن/endpoint را
    // هم پاک می‌کنیم تا رکوردی از دستگاهی که دیگر نمی‌خواهد اعلان بگیرد نماند.
    const row = await db.pushSubscription.upsert({
      where: { userId: auth.sub },
      create: {
        userId: auth.sub, enabled: b.enabled,
        token: b.enabled ? (b.token ?? null) : null,
        endpoint: b.enabled ? (b.endpoint ?? null) : null,
      },
      update: {
        enabled: b.enabled,
        token: b.enabled ? (b.token ?? undefined) : null,
        endpoint: b.enabled ? (b.endpoint ?? undefined) : null,
      },
      select: { enabled: true },
    });

    return NextResponse.json({ ok: true, enabled: row.enabled, ready: false });
  } catch (e) { return errorResponse(e); }
}

/** GET /api/v1/me/push-subscribe — وضعیتِ فعلیِ اشتراکِ push */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const row = await db.pushSubscription.findUnique({ where: { userId: auth.sub }, select: { enabled: true } });
    // فعلاً ready همیشه false — تا زیرساختِ ارسالِ واقعیِ push (FCM/APNs) اضافه شود
    return NextResponse.json({ enabled: row?.enabled ?? false, ready: false });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/me/push-subscribe', POST_impl);
export const GET = withApiMetrics('/api/v1/me/push-subscribe', GET_impl);
