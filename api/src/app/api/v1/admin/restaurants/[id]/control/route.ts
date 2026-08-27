import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ id: zUuid });
const bodySchema = z.object({
  action: z.enum(['activate', 'deactivate', 'set_plan', 'extend_plan', 'cancel_subscription']),
  plan: z.string().max(20).optional(),
  months: z.number().optional(),
});

/**
 * PATCH /api/v1/admin/restaurants/[id]/control — کنترل رستوران (پنل شرکت).
 * فعال/غیرفعال کردن رستوران، تغییر پلن، یا تمدید/لغو واقعی اشتراک. عملیات حساس → audit می‌شود.
 *
 * body:
 *  { action: 'activate' | 'deactivate' }
 *  { action: 'set_plan', plan: 'free'|'pro'|'enterprise' }
 *  { action: 'extend_plan', plan: 'pro'|'enterprise', months: number }  — تمدید واقعی با تاریخ انقضای جدید
 *  { action: 'cancel_subscription' }  — لغو فوری (انقضا = الان)
 */
async function PATCH_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id: restaurantId } = parseParams(await params, paramsSchema);
    const body = await parseBody(req, bodySchema);
    const action = body.action;

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, isOpen: true, tenantId: true },
    });
    if (!restaurant) throw Err.notFound('رستوران');

    let result: Record<string, unknown> = {};

    if (action === 'activate' || action === 'deactivate') {
      const isOpen = action === 'activate';
      await db.restaurant.update({ where: { id: restaurantId }, data: { isOpen } });
      result = { id: restaurantId, is_open: isOpen };
      await audit({
        action: isOpen ? 'restaurant.activated' : 'restaurant.deactivated',
        actorId: admin.sub, actorType: 'admin',
        targetId: restaurantId, restaurantId, ip: clientIp(req),
        detail: { operation: action, restaurant_name: restaurant.name },
      });
    } else if (action === 'set_plan') {
      const plan = String(body.plan ?? '').trim();
      if (!['free', 'pro', 'enterprise'].includes(plan)) {
        throw Err.validation('پلن نامعتبر است (free/pro/enterprise)');
      }
      // پلن روی tenant است (نه رستوران) — کل زنجیره را تغییر می‌دهد
      await db.tenant.update({ where: { id: restaurant.tenantId }, data: { plan: plan as any } });
      result = { tenant_id: restaurant.tenantId, plan };
      await audit({
        action: 'plan.changed', actorId: admin.sub, actorType: 'admin',
        targetId: restaurant.tenantId, restaurantId, ip: clientIp(req),
        detail: { operation: 'set_plan', plan, restaurant_name: restaurant.name },
      });
    } else if (action === 'extend_plan') {
      const plan = String(body.plan ?? '').trim();
      const months = Number(body.months);
      if (!['pro', 'enterprise'].includes(plan)) {
        throw Err.validation('برای تمدید، پلن باید pro یا enterprise باشد');
      }
      if (!Number.isInteger(months) || months <= 0 || months > 36) {
        throw Err.validation('مدت تمدید باید بین ۱ تا ۳۶ ماه باشد');
      }
      const tenant = await db.tenant.findUnique({ where: { id: restaurant.tenantId }, select: { planExpiresAt: true } });
      // اگر اشتراک هنوز فعاله، از تاریخ فعلی انقضا جلو می‌بریم (نه از امروز) تا حق خریداری‌شده هدر نره
      const base = tenant?.planExpiresAt && tenant.planExpiresAt.getTime() > Date.now() ? tenant.planExpiresAt : new Date();
      const newExpiry = new Date(base);
      newExpiry.setMonth(newExpiry.getMonth() + months);
      await db.tenant.update({
        where: { id: restaurant.tenantId },
        data: { plan: plan as any, planExpiresAt: newExpiry, trialEndsAt: null },
      });
      result = { tenant_id: restaurant.tenantId, plan, plan_expires_at: newExpiry };
      await audit({
        action: 'plan.changed', actorId: admin.sub, actorType: 'admin',
        targetId: restaurant.tenantId, restaurantId, ip: clientIp(req),
        detail: { operation: 'extend_plan', plan, months, new_expiry: newExpiry.toISOString(), restaurant_name: restaurant.name },
      });
    } else if (action === 'cancel_subscription') {
      const expired = new Date(Date.now() - 1000); // یک ثانیه قبل = منقضی فوری
      await db.tenant.update({ where: { id: restaurant.tenantId }, data: { planExpiresAt: expired } });
      result = { tenant_id: restaurant.tenantId, plan_expires_at: expired };
      await audit({
        action: 'subscription.cancelled', actorId: admin.sub, actorType: 'admin',
        targetId: restaurant.tenantId, restaurantId, ip: clientIp(req),
        detail: { operation: 'cancel_subscription', restaurant_name: restaurant.name },
      });
    } else {
      throw Err.validation('عملیات نامعتبر (activate/deactivate/set_plan/extend_plan/cancel_subscription)');
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const PATCH = withApiMetrics('/api/v1/admin/restaurants/[id]/control', PATCH_impl);
