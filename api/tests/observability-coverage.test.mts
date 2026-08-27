// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ رصدپذیری — دو باگِ P0ِ عملیاتی که این فایل از آن‌ها زاده شد
//  (تأییدشده با اجرای زنده، ۲۰۲۶-۰۸-۲۵):
//
//  ۱) `recordHttp()` فقط در `lib/with-restaurant-auth.ts` صدا زده می‌شد.
//     یعنی سه متریکِ پایه‌ی RED فقط پنلِ رستوران را می‌دیدند. ۸ درخواستِ
//     واقعی به مسیرهای دیگر (`/restaurants/vista/availability` و
//     `/auth/otp/verify`) هیچ sampleی در `/api/metrics` تولید نکرد ⇒
//     آلارم‌های `HighErrorRate` و `HighLatencyP95` کلِ APIِ عمومی، احراز
//     هویت و پرداخت را نمی‌دیدند.
//
//  ۲) `metrics.authFailures` فقط از راهِ `audit({action:'auth.failure'})`
//     زیاد می‌شود، ولی **هیچ** routeِ احراز هویتی آن را صادر نمی‌کرد
//     (grep = صفر) ⇒ آلارمِ criticalِ brute-force مرده بود.
//
//  این تست هر دو را قفل می‌کند و علاوه بر آن سقفِ کاردینالیتیِ برچسبِ
//  `route` را (که همان لحظه یک نشتِ حافظه‌ی بالقوه است) تضمین می‌کند.
//
//  ⚠️ چند تست به Postgres/Redisِ واقعی نیاز دارند (مسیرِ verifyِ OTP و
//     ثبتِ audit). بدونِ DBِ متصل نتیجه‌شان بی‌معناست، نه «قرمز».
// ═══════════════════════════════════════════════════════════════════════

const API_ROOT = fileURLToPath(new URL('../src/app/api', import.meta.url));
const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

/** همه‌ی `route.ts`های زیرِ src/app/api */
function allRouteFiles(dir = API_ROOT, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) allRouteFiles(p, out);
    else if (name === 'route.ts') out.push(p);
  }
  return out;
}

const ROUTE_FILES = allRouteFiles();

/** خروجیِ متنیِ Prometheus → مقدارِ یک سریِ مشخص (۰ اگر نبود). */
function sampleValue(dump: string, metric: string, labelFilter?: (labels: string) => boolean): number {
  let total = 0;
  for (const line of dump.split('\n')) {
    if (!line.startsWith(metric)) continue;
    if (line.startsWith('#')) continue;
    const m = line.match(/^([a-z_]+)(?:\{([^}]*)\})?\s+(-?[\d.eE+]+)$/);
    if (!m || m[1] !== metric) continue;
    if (labelFilter && !labelFilter(m[2] ?? '')) continue;
    total += Number(m[3]);
  }
  return total;
}

/** تعدادِ سری‌های متمایزِ یک متریک که برچسبِ route آن‌ها با مقدارِ داده‌شده یکی است. */
function routeSeries(dump: string, metric: string): Set<string> {
  const seen = new Set<string>();
  for (const line of dump.split('\n')) {
    if (line.startsWith('#') || !line.startsWith(metric + '{')) continue;
    const labels = line.slice(metric.length + 1, line.indexOf('}'));
    const route = labels.match(/route="([^"]*)"/);
    if (route) seen.add(route[1]);
  }
  return seen;
}

// ── ۱) گاردِ ساختاری: هیچ routeی بدونِ شمارنده و هیچ routeی دوبار شمرده نشود ──

describe('گاردِ ساختاری — پوششِ متریکِ HTTP روی همه‌ی routeها', () => {
  test('🔴 هر route.ts دقیقاً یک wrapperِ شمارنده دارد (نه صفر، نه دوتا)', () => {
    const missing: string[] = [];
    const doubleCounted: string[] = [];

    for (const file of ROUTE_FILES) {
      const rel = file.slice(API_ROOT.length + 1);
      // endpointِ scrape عمداً خودش را نمی‌شمارد (حلقه‌ی خودارجاع + ۴۰۱های
      // scrapeِ Prometheus نرخِ خطای کلِ سامانه را آلوده می‌کرد).
      if (rel === 'metrics/route.ts') continue;

      const src = readFileSync(file, 'utf8');
      const hasApiMetrics = src.includes('withApiMetrics(');
      const hasAuthWrapper = /with(Restaurant|Staff)Auth\(/.test(src);

      if (hasApiMetrics && hasAuthWrapper) doubleCounted.push(rel);
      if (!hasApiMetrics && !hasAuthWrapper) missing.push(rel);

      // هیچ متدِ HTTPی نباید هنوز به‌شکلِ خامِ `export async function GET`
      // بیرون بیاید — آن شکل از هیچ wrapperی رد نمی‌شود.
      for (const m of HTTP_METHODS) {
        assert.ok(
          !new RegExp(`^export async function ${m}\\b`, 'm').test(src),
          `${rel}: \`export async function ${m}\` مستقیم export شده و شمرده نمی‌شود — با withApiMetrics بپوشانش`,
        );
      }
    }

    assert.deepEqual(missing, [], 'این routeها هیچ شمارنده‌ی HTTPی ندارند');
    assert.deepEqual(doubleCounted, [], 'این routeها دو wrapperِ شمارنده دارند → هر درخواست دوبار شمرده می‌شود');
  });

  test('⚠️ کنترلِ مثبت — خودِ اسکن واقعاً فایل پیدا می‌کند', () => {
    // بدونِ این، اگر allRouteFiles روزی خالی برگردد، تستِ بالا هم پاس می‌شد.
    assert.ok(ROUTE_FILES.length > 100, `انتظار >۱۰۰ فایلِ route، دیده شد ${ROUTE_FILES.length}`);
  });

  test('برچسبِ مسیرِ withApiMetrics همان مسیرِ واقعیِ فایل است (نه رشته‌ی دلخواه)', () => {
    const wrong: string[] = [];
    for (const file of ROUTE_FILES) {
      const src = readFileSync(file, 'utf8');
      // [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] جداکننده‌ی فایل‌سیستم نرمال می‌شود؛ وگرنه
      // رویِ ویندوز «\» با برچسب‌های «/»دار مقایسه و همه‌چیز قرمز می‌شد.
      const expected = ('/api' + file.slice(API_ROOT.length, file.length - '/route.ts'.length)).split('\\').join('/');
      for (const m of src.matchAll(/withApiMetrics\('([^']+)'/g)) {
        if (m[1] !== expected) wrong.push(`${file.slice(API_ROOT.length + 1)} → '${m[1]}' (باید '${expected}' باشد)`);
      }
    }
    assert.deepEqual(wrong, [], 'برچسبِ مسیر با محلِ فایل نمی‌خواند — داشبورد/آلارم به مسیرِ اشتباه اشاره می‌کند');
  });
});

// ── ۲) رفتارِ واقعی: شمارنده بعد از یک درخواستِ واقعی بالا می‌رود ──

describe('شمارنده‌ی HTTP روی routeِ بدونِ withRestaurantAuth', () => {
  test('🔴 یک درخواست به /api/v1/auth/logout هر سه متریکِ RED را زیاد می‌کند', async () => {
    const { renderMetrics } = await import('../src/lib/metrics.ts');
    const { POST } = await import('../src/app/api/v1/auth/logout/route.ts');

    const before = renderMetrics();
    const beforeReq = sampleValue(before, 'rezervno_http_requests_total', (l) => l.includes('route="/api/v1/auth/logout"'));
    const beforeDur = sampleValue(before, 'rezervno_http_request_duration_seconds_count', (l) => l.includes('route="/api/v1/auth/logout"'));

    const res = await POST(new Request('https://example.invalid/api/v1/auth/logout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }));
    assert.equal(res.status, 200, 'قابلیت نباید بشکند — logout بدونِ توکن هم ۲۰۰ است');

    const after = renderMetrics();
    const afterReq = sampleValue(after, 'rezervno_http_requests_total', (l) => l.includes('route="/api/v1/auth/logout"'));
    const afterDur = sampleValue(after, 'rezervno_http_request_duration_seconds_count', (l) => l.includes('route="/api/v1/auth/logout"'));

    // ⚠️ قفلِ اصلیِ باگ ۱. پیش از رفع، هر دو عدد صفر می‌ماندند.
    assert.equal(afterReq, beforeReq + 1, 'rezervno_http_requests_total بالا نرفت');
    assert.equal(afterDur, beforeDur + 1, 'هیستوگرامِ latency نمونه نگرفت');
    assert.match(after, /route="\/api\/v1\/auth\/logout".*status="200"|status="200".*route="\/api\/v1\/auth\/logout"/);
  });

  test('🔴 پاسخِ خطا در rezervno_http_errors_total شمرده می‌شود', async () => {
    const { renderMetrics } = await import('../src/lib/metrics.ts');
    const { GET } = await import('../src/app/api/v1/reservations/[code]/route.ts');

    const before = sampleValue(renderMetrics(), 'rezervno_http_errors_total', (l) => l.includes('route="/api/v1/reservations/[code]"'));
    // بدونِ هدرِ Authorization → ۴۰۱
    const res = await GET(
      new Request('https://example.invalid/api/v1/reservations/RZQ1W2E3'),
      { params: Promise.resolve({ code: 'RZQ1W2E3' }) },
    );
    assert.ok(res.status >= 400, `انتظار خطا، دیده شد ${res.status}`);
    const after = sampleValue(renderMetrics(), 'rezervno_http_errors_total', (l) => l.includes('route="/api/v1/reservations/[code]"'));
    assert.equal(after, before + 1, 'rezervno_http_errors_total بالا نرفت — آلارمِ HighErrorRate کور می‌ماند');
  });

  test('⚠️ هدرِ x-trace-id روی پاسخ ست می‌شود (اتصالِ لاگ به درخواست)', async () => {
    const { POST } = await import('../src/app/api/v1/auth/logout/route.ts');
    const res = await POST(new Request('https://example.invalid/api/v1/auth/logout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }));
    assert.match(res.headers.get('x-trace-id') ?? '', /^[0-9a-f]{32}$/);
  });
});

// ── ۳) کاردینالیتی ──

describe('کاردینالیتیِ برچسبِ route', () => {
  test('🔴 سه درخواست با کدهای مختلف فقط یک برچسبِ route می‌سازند', async () => {
    const { renderMetrics } = await import('../src/lib/metrics.ts');
    const { GET } = await import('../src/app/api/v1/reservations/[code]/route.ts');

    for (const code of ['RZAAA111', 'RZBBB222', 'RZCCC333']) {
      await GET(
        new Request(`https://example.invalid/api/v1/reservations/${code}`),
        { params: Promise.resolve({ code }) },
      );
    }

    const routes = routeSeries(renderMetrics(), 'rezervno_http_requests_total');
    const matching = [...routes].filter((r) => r.startsWith('/api/v1/reservations/') && r !== '/api/v1/reservations');
    // ⚠️ اگر کسی برچسب را به `new URL(req.url).pathname` برگرداند، اینجا ۳ می‌شود.
    assert.deepEqual(matching, ['/api/v1/reservations/[code]'],
      `انتظار یک برچسبِ الگو، دیده شد: ${JSON.stringify(matching)}`);
  });

  test('normalizeRoute بخش‌های پویا را جمع می‌کند (UUID/عدد/کدِ رزرو)', async () => {
    const { normalizeRoute } = await import('../src/lib/metrics.ts');
    assert.equal(normalizeRoute('/api/v1/restaurant/tables/3f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8'), '/api/v1/restaurant/tables/:id');
    assert.equal(normalizeRoute('/api/v1/admin/site/orders/42'), '/api/v1/admin/site/orders/:id');
    assert.equal(normalizeRoute('/api/v1/reservations/RZ7K2N9'), '/api/v1/reservations/:code');
  });

  test('🔴 سقفِ سختِ تعدادِ برچسب وجود دارد (ضدِ نشتِ حافظه)', async () => {
    const { capRouteLabel, routeLabelCount } = await import('../src/lib/metrics.ts');
    const startCount = routeLabelCount();
    // به‌اندازه‌ی کافی مسیرِ یکتا بساز تا حتماً از سقف رد شویم.
    let collapsed = 0;
    for (let i = 0; i < 400; i++) {
      if (capRouteLabel(`/api/__cardinality_probe__/${i}`) === '__other__') collapsed++;
    }
    assert.ok(collapsed > 0, 'هیچ مسیری در سطلِ __other__ جمع نشد — سقفی وجود ندارد');
    assert.ok(routeLabelCount() <= 300, `تعدادِ برچسب از سقف گذشت: ${routeLabelCount()} (شروع: ${startCount})`);
  });
});

// ── ۴) auth.failure واقعاً صادر می‌شود ──

describe('سیگنالِ امنیتی — rezervno_auth_failures_total', () => {
  before(() => {
    // مسیرِ verify به DB نیاز دارد؛ اگر DATABASE_URL نباشد این تست‌ها بی‌معنا
    // (نه قرمز) هستند — همان قاعده‌ی .integration در این ریپو.
    assert.ok(process.env.DATABASE_URL, 'این بخش به Postgresِ واقعی نیاز دارد');
  });

  test('🔴 یک ورودِ ناموفق (کدِ غلط) شمارنده را بالا می‌برد', async () => {
    const { renderMetrics } = await import('../src/lib/metrics.ts');
    const { POST } = await import('../src/app/api/v1/auth/otp/verify/route.ts');

    const before = sampleValue(renderMetrics(), 'rezervno_auth_failures_total');
    const res = await POST(new Request('https://example.invalid/api/v1/auth/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.77' },
      body: JSON.stringify({ phone: '09121110000', code: '000000' }),
    }));
    assert.ok(res.status >= 400, `انتظار ردِ ورود، دیده شد ${res.status}`);

    const after = sampleValue(renderMetrics(), 'rezervno_auth_failures_total');
    // ⚠️ قفلِ اصلیِ باگ ۲. پیش از رفع، این عدد همیشه صفر می‌ماند.
    assert.equal(after, before + 1, 'rezervno_auth_failures_total بالا نرفت — آلارمِ brute-force مرده است');
  });

  test('برچسبِ actor_type سطحِ حمله را جدا می‌کند', async () => {
    const { renderMetrics } = await import('../src/lib/metrics.ts');
    const { POST } = await import('../src/app/api/v1/auth/staff/verify/route.ts');
    const before = sampleValue(renderMetrics(), 'rezervno_auth_failures_total', (l) => l.includes('actor_type="staff"'));
    await POST(new Request('https://example.invalid/api/v1/auth/staff/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.78' },
      body: JSON.stringify({ phone: '09121110001', code: '000000' }),
    }));
    const after = sampleValue(renderMetrics(), 'rezervno_auth_failures_total', (l) => l.includes('actor_type="staff"'));
    assert.equal(after, before + 1, 'شکستِ ورودِ کارکنان جدا شمرده نشد');
  });

  test('⚠️ کنترلِ منفی — ورودِ موفق شمارنده‌ی شکست را بالا نمی‌برد', async () => {
    // بدونِ این، یک `inc()`ِ بی‌قید-و-شرط هم تست‌های بالا را پاس می‌کرد.
    const { renderMetrics } = await import('../src/lib/metrics.ts');
    const { audit } = await import('../src/lib/audit.ts');
    const before = sampleValue(renderMetrics(), 'rezervno_auth_failures_total');
    await audit({ action: 'auth.login', actorType: 'customer', actorId: null, ip: '203.0.113.79' });
    await audit({ action: 'auth.logout', actorType: 'customer', actorId: null, ip: '203.0.113.79' });
    const after = sampleValue(renderMetrics(), 'rezervno_auth_failures_total');
    assert.equal(after, before, 'auth.login/auth.logout نباید شمارنده‌ی شکست را زیاد کند');
  });

  test('🔴 شماره‌ی موبایل هرگز کامل در رکوردِ audit نمی‌نشیند', async () => {
    const { maskPhone } = await import('../src/lib/audit.ts');
    assert.equal(maskPhone('+989123456789'), '+98******6789');
    assert.equal(maskPhone('09121110000'), '091****0000');
    assert.equal(maskPhone(null), null);
    // ⚠️ ادعای اصلی: هیچ خروجی‌ای نباید شماره‌ی کامل باشد.
    for (const p of ['+989123456789', '09121110000', '00989123456789']) {
      assert.notEqual(maskPhone(p), p, 'شماره ماسک نشد');
      assert.ok(!maskPhone(p)!.includes(p.slice(3, -4)), 'میانه‌ی شماره لو رفت');
    }
  });

  test('🔴 مسیرهای احراز هویت واقعاً auth.* صادر می‌کنند (گاردِ ساختاری)', () => {
    const expected: Record<string, string[]> = {
      'v1/auth/otp/verify/route.ts': ['auth.login', 'auth.failure'],
      'v1/auth/staff/verify/route.ts': ['staff.login', 'auth.failure'],
      'v1/auth/admin/verify/route.ts': ['auth.login', 'auth.failure'],
      'v1/auth/logout/route.ts': ['auth.logout'],
      'v1/auth/refresh/route.ts': ['auth.failure'],
    };
    for (const [rel, actions] of Object.entries(expected)) {
      const src = readFileSync(join(API_ROOT, rel), 'utf8');
      for (const a of actions) {
        assert.ok(src.includes(`'${a}'`), `${rel} دیگر '${a}' صادر نمی‌کند — آلارمِ امنیتی دوباره کور می‌شود`);
      }
    }
  });
});
