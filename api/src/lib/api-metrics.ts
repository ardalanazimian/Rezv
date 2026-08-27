import { recordHttp, metrics } from './metrics';
import { withTrace, newTraceId } from './logger';

// ═══════════════════════════════════════════════════════════════════════
//  withApiMetrics — شمارشِ HTTP برای routeهایی که از withRestaurantAuth
//  رد نمی‌شوند (کاتالوگِ عمومی، احراز هویت، پرداخت، مسیرهای مشتری، ادمینِ
//  پلتفرم، نگهداری، …).
//
//  ⚠️ باگی که این فایل از آن زاده شد (۲۰۲۶-۰۸-۲۵):
//  `recordHttp()` فقط و فقط داخلِ `with-restaurant-auth.ts` صدا زده می‌شد.
//  یعنی سه متریکِ پایه‌ی RED — `rezervno_http_requests_total`،
//  `rezervno_http_errors_total`، `rezervno_http_request_duration_seconds` —
//  فقط پنلِ رستوران را می‌دیدند. هر درخواستِ کاتالوگ، جست‌وجو، ورود، رزروِ
//  مشتری، پرداخت و ادمین **اصلاً شمرده نمی‌شد**.
//  نتیجه‌ی عملی: هر دو آلارمِ `HighErrorRate` و `HighLatencyP95` در
//  `observability/alerts.yml` روی زیرمجموعه‌ای از ترافیک محاسبه می‌شدند؛
//  یک قطعیِ کاملِ مسیرِ رزروِ مشتری هیچ آلارمی تولید نمی‌کرد.
//
//  ── چرا route-wrapper و نه middleware (تصمیمِ معماری) ──
//  ۱) Next.js ۱۶: `middleware.js` به `proxy.js` تغییرِ نام داده و طبقِ
//     `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
//     تنها کارهای ممکن در آن لایه «rewrite / redirect / تغییرِ هدر /
//     پاسخِ مستقیم» است. middleware **پیش از** handler اجرا می‌شود و
//     `NextResponse.next()` یک دستور است، نه پاسخِ downstream — پس
//     **status و مدتِ واقعیِ پاسخ در آن لایه اصلاً در دسترس نیست**.
//     بدونِ status و duration، دقیقاً همان دو آلارمی که خراب بودند
//     ساخته نمی‌شوند.
//  ۲) رجیستریِ متریک in-memory و per-module است. باندلِ middleware/proxy
//     از باندلِ route handlerها جداست، پس شمارنده‌ای که آنجا زیاد شود در
//     خروجیِ `GET /api/metrics` (که خودش یک route handler است) دیده
//     نمی‌شود.
//  ۳) `api/src/middleware.ts` طبقِ قواعدِ پروژه یک فایلِ حساسِ امنیتی است
//     (هدرهای امنیتی/CORS/CSRF) و بدونِ ضرورت دست نمی‌خورد.
//
//  ── ضدِ دوباره‌شماری ──
//  `withRestaurantAuth` خودش `recordHttp` را صدا می‌زند و **تنها** نقطه‌ی
//  شمارشِ آن دسته routeهاست. این wrapper هرگز نباید رویِ handlerی گذاشته
//  شود که از `withRestaurantAuth`/`withStaffAuth` رد می‌شود. گاردِ خودکار:
//  `api/tests/observability-coverage.test.mts` (بندِ «هیچ routeی دوبار
//  شمرده نمی‌شود»).
//
//  ── کاردینالیتی ──
//  برچسبِ `route` عمداً **الگویِ ثابتِ فایل‌سیستمیِ Next** است
//  (`/api/v1/reservations/[code]`)، نه `new URL(req.url).pathname`. یعنی
//  مقدارِ متغیر ساختاراً نمی‌تواند وارد برچسب شود — نه با کدِ رزرو، نه با
//  اسلاگِ رستوران (که regexِ `normalizeRoute` هم نمی‌گرفتش). سقفِ سختِ
//  `MAX_ROUTE_LABELS` در `metrics.ts` خطِ دفاعِ دوم است.
//
//  ── SSE/streaming ──
//  این wrapper **بدنه‌ی درخواست یا پاسخ را نه می‌خواند و نه بافر می‌کند**؛
//  فقط `res.status` و زمانِ رسیدن به هدر را می‌گیرد و همان شیء `Response`
//  را دست‌نخورده برمی‌گرداند. برای پاسخِ استریمی این یعنی «زمان تا اولین
//  بایت»، نه طولِ عمرِ استریم — که رفتارِ درستِ یک متریکِ RED است.
// ═══════════════════════════════════════════════════════════════════════

/**
 * @param routePattern الگویِ مسیر، دقیقاً مطابقِ ساختارِ پوشه‌ی Next
 *   (مثلاً `/api/v1/waitlist/[id]/accept`). هرگز pathnameِ خامِ درخواست.
 */
export function withApiMetrics<A extends unknown[]>(
  routePattern: string,
  handler: (req: Request, ...rest: A) => Response | Promise<Response>,
): (req: Request, ...rest: A) => Promise<Response> {
  return async (req: Request, ...rest: A): Promise<Response> => {
    const traceId = req.headers.get('x-trace-id') || newTraceId();
    const started = Date.now();
    metrics.activeRequests.inc();
    return withTrace({ traceId, route: routePattern }, async () => {
      // اگر handler استثنا پرتاب کند (به‌جای برگرداندنِ پاسخ)، Next آن را
      // ۵۰۰ می‌کند — پس مقدارِ اولیه هم ۵۰۰ است تا متریک دروغ نگوید.
      let status = 500;
      try {
        const res = await handler(req, ...rest);
        status = res.status;
        // هدرِ ردیابی؛ روی پاسخ‌های immutable (مثلِ Response.redirect) بی‌صدا رد می‌شود.
        try { res.headers.set('x-trace-id', traceId); } catch { /* immutable headers */ }
        return res;
      } finally {
        metrics.activeRequests.dec();
        recordHttp(req.method, routePattern, status, (Date.now() - started) / 1000);
      }
    });
  };
}
