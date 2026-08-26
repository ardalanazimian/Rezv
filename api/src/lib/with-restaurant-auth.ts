import { NextResponse } from 'next/server';
import { authFromRequest, type AccessPayload } from './jwt';
import { enforceRateLimit, clientIp, RULES } from './ratelimit';
import { resolveStaffRestaurant } from './staff-helpers';
import { requirePermission, type PermissionKey } from './permissions';
import { db } from './db';
import { Err, errorResponse } from './errors';
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
        // ⚠️ تنها نقطه‌ی شمارشِ HTTP برای routeهایی که از این wrapper رد
        // می‌شوند. `withApiMetrics` (lib/api-metrics.ts) مکملِ آن برای بقیه‌ی
        // routeهاست و **هرگز** نباید روی این‌ها هم گذاشته شود، وگرنه هر
        // درخواست دوبار شمرده می‌شود. گاردِ خودکار:
        // tests/observability-coverage.test.mts
        recordHttp(req.method, route, status, (Date.now() - started) / 1000);
      }
    });
  };
}

/**
 * نسخه‌ی سبک‌تر برای routeهایی که فقط به auth کارمند (tenant-level) نیاز دارند،
 * نه به entity رستوران (مثلاً مدیریت لیست کارکنان قبل از اینکه حتی رستورانی
 * ساخته شده باشد). عمداً `resolveStaffRestaurant` را صدا نمی‌زند — آن تابع اگر
 * تنانت هیچ رستورانی نداشته باشد ۴۰۴ می‌دهد و این edge-case را می‌شکند.
 *
 * ⚠️ باگِ امنیتیِ رفع‌شده (۲۰۲۶-۰۸-۲۲): «سبک‌تر» قبلاً یعنی **هیچ کوئریِ
 * دیتابیسی نداشت** — فقط امضایِ JWT بررسی می‌شد و بس. تنها مصرف‌کننده‌ی این
 * wrapper، `restaurant/staff/route.ts` است، یعنی دقیقاً همان endpointی که
 * کارکنان را اضافه/غیرفعال می‌کند. نتیجه‌اش این بود:
 *
 *   مدیری که همین حالا **غیرفعال (اخراج) شده**، تا ۱۵ دقیقه (عمرِ access
 *   token — که هیچ لیستِ ابطالی هم ندارد) هنوز می‌توانست:
 *     • `PATCH` بزند با `staff_id` خودش و `is_active: true` → **خودش را
 *       دوباره فعال کند**؛ یعنی پنجره‌ی ۱۵ دقیقه‌ای به دسترسیِ دائمی تبدیل
 *       می‌شد (گاردهایِ خودِ PATCH فقط جلوی `is_active: false` را می‌گیرند،
 *       نه `true`).
 *     • `POST` بزند و یک کارمندِ جدید با شماره‌ی موبایلِ خودش بسازد →
 *       درِ پشتیِ ماندگار، مستقل از توکنِ فعلی.
 *     • `GET` بزند و کلِ فهرستِ کارکنان و شماره‌هایشان را ببرد.
 *
 *   یعنی «اخراجِ کارمند» به‌عنوانِ یک کنترلِ امنیتی عملاً کار نمی‌کرد.
 *
 * خواهرش `withRestaurantAuth` این شکاف را نداشت، چون `resolveStaffRestaurant`
 * (که صدا می‌زند) از ۲۰۲۶-۰۸-۲۰ عضویتِ تنانت و `isActive` را چک می‌کند. اینجا
 * همان چک با یک کوئریِ سبک تکرار می‌شود — بدونِ اینکه وجودِ رستوران لازم شود.
 *
 * `role` هم از **DB** خوانده می‌شود نه از توکن، و همان را به handler می‌دهیم:
 * توکن عکسِ لحظه‌ی صدور است و `assertManagerOrOwner` در همان روت به آن تکیه
 * می‌کند. امروز مسیرِ APIی برای تغییرِ نقش وجود ندارد (پس قابلِ سوءاستفاده
 * نبود)، ولی اگر فردا اضافه شود، این لایه از قبل درست است.
 */
export function withStaffAuth(
  opts: { rateLimit?: keyof typeof RULES },
  handler: (req: Request, auth: AccessPayload, params?: any) => Promise<NextResponse>,
) {
  return async (req: Request, routeArg?: { params: any }) => {
    // ⚠️ اضافه‌شده ۲۰۲۶-۰۸-۲۵: این wrapper هم مثلِ خواهرش باید شمرده شود،
    // وگرنه `restaurant/staff` (تنها مصرف‌کننده‌اش، و یکی از حساس‌ترین
    // مسیرهایِ RBAC) در هیچ آلارمِ نرخِ خطا/تأخیر دیده نمی‌شد.
    const route = new URL(req.url).pathname;
    const started = Date.now();
    let status = 500;
    metrics.activeRequests.inc();
    try {
      const rule = RULES[opts.rateLimit ?? 'search'];
      await enforceRateLimit(clientIp(req), rule);
      const auth = await verifiedStaffAuth(req);
      // رجوع کن به همین باگ در withRestaurantAuth بالا — params یک Promise است.
      const params = routeArg?.params ? await routeArg.params : undefined;
      const res = await handler(req, auth, params);
      status = res.status;
      return res;
    } catch (e) {
      const res = errorResponse(e);
      status = res.status;
      return res;
    } finally {
      metrics.activeRequests.dec();
      recordHttp(req.method, route, status, (Date.now() - started) / 1000);
    }
  };
}

/**
 * توکن را تأیید می‌کند **و** وضعیتِ فعلیِ کارمند را از دیتابیس می‌پرسد.
 * خروجی یک `AccessPayload` با نقشِ تازه از DB است، نه نقشِ داخلِ توکن.
 *
 * برایِ مشتری (`kind: 'customer'`) بدونِ تغییر عبور می‌دهد — این wrapper
 * فقط مرزِ کارکنان را سفت می‌کند و مسیرِ مشتری گاردهای خودش را دارد.
 */
async function verifiedStaffAuth(req: Request): Promise<AccessPayload> {
  const auth = authFromRequest(req);
  if (auth.kind !== 'staff') return auth;

  const staff = await db.staff.findUnique({
    where: { id: auth.sub },
    select: { tenantId: true, role: true, isActive: true },
  });
  if (!staff) throw Err.forbidden('این حساب دیگر وجود ندارد');
  if (!staff.isActive) throw Err.forbidden('این حساب غیرفعال شده است');
  if (staff.tenantId !== auth.tenantId) throw Err.forbidden();

  return { sub: auth.sub, kind: 'staff', tenantId: staff.tenantId, role: staff.role as 'owner' | 'manager' | 'staff' };
}
