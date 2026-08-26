import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { activateOrder, rejectOrder, setOrderStatus } from '@/lib/site-orders';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════════════════
//  PATCH /api/v1/admin/site/orders/{id} — گردشِ کارِ فعال‌سازی (پنلِ شرکت)
//
//  action:
//    activate → اشتراکِ تنانت واقعاً فعال/تمدید می‌شود (plan + planExpiresAt)
//    reject   → رد با دلیلِ ثبت‌شده
//    contact  → «تماس گرفته شد» (بدونِ اثرِ مالی)
//    cancel   → لغو
//
//  چرا یک روت با action و نه چهار مسیر: هر چهار عمل روی همان ردیف و همان
//  ماشینِ حالت‌اند؛ یک نقطه‌ی ورودی یعنی یک جای اعتبارسنجی و یک جای audit.
//
//  فعال‌سازی با قفلِ خوش‌بینانه روی tenant.version انجام می‌شود تا دو مدیرِ
//  همزمان تاریخِ انقضا را دوبار جلو نبرند.
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({ id: zUuid });
const bodySchema = z.object({
  action: z.enum(['activate', 'reject', 'contact', 'cancel'] as const),
  tenant_id: zUuid.optional(),          // فقط برای activate وقتی سفارش هنوز وصل نیست
  reason: z.string().min(3).max(500).trim().optional(),
  admin_note: z.string().max(1000).trim().optional(),
});

async function PATCH_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);
    const body = await parseBody(req, bodySchema);
    const actor = { staffId: admin.sub, ip: clientIp(req) };

    if (body.action === 'activate') {
      const result = await activateOrder(id, actor, {
        tenantId: body.tenant_id,
        adminNote: body.admin_note,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === 'reject') {
      if (!body.reason) throw Err.validation('برای رد کردن، دلیل الزامی است');
      const order = await rejectOrder(id, actor, body.reason);
      return NextResponse.json({ ok: true, order });
    }

    const order = await setOrderStatus(
      id, actor,
      body.action === 'contact' ? 'contacted' : 'cancelled',
      body.admin_note,
    );
    return NextResponse.json({ ok: true, order });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const PATCH = withApiMetrics('/api/v1/admin/site/orders/[id]', PATCH_impl);
