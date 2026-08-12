import { NextResponse } from 'next/server';
import { authFromRequest, type AccessPayload } from './jwt';
import { enforceRateLimit, clientIp, RULES } from './ratelimit';
import { resolveStaffRestaurant } from './staff-helpers';
import { requirePermission, type PermissionKey } from './permissions';
import { errorResponse } from './errors';
import { withTrace, newTraceId } from './logger';
import { recordHttp, metrics } from './metrics';

// ═══════════════════════════════════════════════════════════
//  withRestaurantAuth — رفع تکرار کد (DRY) و جداسازی concern
//
//  قبل از این فایل، ۱۵+ route handler عیناً همین چهار خط را تکرار
//  می‌کردند: enforceRateLimit → authFromRequest → resolveStaffRestaurant
//  → requirePermission → try/catch errorResponse. این یک cross-cutting
//  concern است (احراز هویت/مجوز/ریت‌لیمیت)، نه منطق کسب‌وکار route —
//  جای درستش یک wrapper مشترک است، نه تکرار در هر فایل.
//
//  این تابع همان نقش middleware/guard در معماری Controller-Service را
//  بازی می‌کند: «کنترلر» (route handler) فقط منطق خاص خودش را می‌نویسد؛
//  نگرانی‌های مشترک (auth, rate-limit, RBAC, error envelope) به این
//  لایه‌ی مشترک منتقل شده‌اند.
// ═══════════════════════════════════════════════════════════

export type RestaurantHandlerContext = {
  auth: AccessPayload;
  restaurant: { id: string; name: string; clubPrefix: string };
};

type Options = {
  /** کلید rate-limit (پیش‌فرض: search — برای GET سبک). نوشتن‌ها باید RULES.auth بدهند. */
  rateLimit?: keyof typeof RULES;
  /** اگر داده شود، requirePermission روی همین کلید اجرا می‌شود (owner/manager همیشه عبور می‌کنند). */
  permission?: PermissionKey;
};

/**
 * یک route handler ساده‌ی restaurant-scoped را با لایه‌ی auth/ratelimit/RBAC/error می‌پوشاند.
 * مثال استفاده (controller واقعاً فقط منطق خودش را می‌نویسد):
 *
 *   export const GET = withRestaurantAuth({ permission: 'canViewAnalytics' }, async (req, ctx) => {
 *     const rows = await db.customerInsight.findMany({ where: { restaurantId: ctx.restaurant.id } });
 *     return NextResponse.json({ items: rows });
 *   });
 */
export function withRestaurantAuth(
  opts: Options,
  handler: (req: Request, ctx: RestaurantHandlerContext, params?: any) => Promise<NextResponse>,
) {
  return async (req: Request, routeArg?: { params: any }) => {
    // ── Observability: trace context + متریک HTTP برای هر درخواست ──
    const traceId = req.headers.get('x-trace-id') || newTraceId();
    const route = new URL(req.url).pathname;
    const started = Date.now();
    metrics.activeRequests.inc();
    return withTrace({ traceId, route }, async () => {
      let status = 200;
      try {
        const rule = RULES[opts.rateLimit ?? 'search'];
        await enforceRateLimit(clientIp(req), rule);

        const auth = authFromRequest(req);
        const restaurant = await resolveStaffRestaurant(auth, req);
        if (opts.permission) await requirePermission(auth, opts.permission);

        // ⚠️ باگِ واقعی (زنده پیدا شد ۲۰۲۶-۰۸-۱۲، حینِ تستِ endpointِ PATCH فلگِ
        // سوءاستفاده): در این نسخه‌ی Next.js، `params` یک Promise است (رجوع کن
        // به node_modules/next/dist/docs/.../route.md — «params: a promise that
        // resolves to...»). قبلاً routeArg?.params بدونِ await مستقیم به handler
        // پاس داده می‌شد، پس هر routeِ dynamic-segment که از این wrapper استفاده
        // می‌کرد (tables/[id]، tables/[id]/state، chats/[id]،
        // reservations/[code]، customers/[userId]) عملاً همیشه با پیامِ
        // «xxx: الزامی است» ۴۲۲ می‌داد — تأییدشده با یک لاگِ تشخیصیِ زنده که
        // routeArg.params instanceof Promise === true را نشان داد، نه فرض.
        const params = routeArg?.params ? await routeArg.params : undefined;
        const res = await handler(req, { auth, restaurant }, params);
        status = res.status;
        res.headers.set('x-trace-id', traceId);
        return res;
      } catch (e) {
        const res = errorResponse(e);
        status = res.status;
        res.headers.set('x-trace-id', traceId);
        return res;
      } finally {
        metrics.activeRequests.dec();
        recordHttp(req.method, route, status, (Date.now() - started) / 1000);
      }
    });
  };
}

/**
 * نسخه‌ی سبک‌تر برای routeهایی که فقط به auth کارمند (tenant-level) نیاز دارند،
 * نه به entity رستوران (مثلاً مدیریت لیست کارکنان قبل از اینکه حتی رستورانی
 * ساخته شده باشد). عمداً resolveStaffRestaurant را صدا نمی‌زند — یک کوئری
 * اضافه‌ی غیرضروری به DB نمی‌زند و edge-case تنانت بدون رستوران را نمی‌شکند.
 */
export function withStaffAuth(
  opts: { rateLimit?: keyof typeof RULES },
  handler: (req: Request, auth: AccessPayload, params?: any) => Promise<NextResponse>,
) {
  return async (req: Request, routeArg?: { params: any }) => {
    try {
      const rule = RULES[opts.rateLimit ?? 'search'];
      await enforceRateLimit(clientIp(req), rule);
      const auth = authFromRequest(req);
      // رجوع کن به همین باگ در withRestaurantAuth بالا — params یک Promise است.
      const params = routeArg?.params ? await routeArg.params : undefined;
      return await handler(req, auth, params);
    } catch (e) {
      return errorResponse(e);
    }
  };
}
