import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ endpointِ متریک — تستِ خالص (بدونِ DB)
//
//  ⚠️ باگی که این فایل از آن زاده شد (۲۰۲۶-۰۸-۲۱): گاردِ توکن **شرطی** بود
//  (`if (process.env.METRICS_TOKEN)`) — یعنی اگر متغیر ست نمی‌شد، endpoint
//  کاملاً عمومی بود. middleware هم جلویش را نمی‌گیرد: چکِ Origin فقط روی
//  متدهای تغییردهنده اجرا می‌شود و این یک GET است.
//
//  خروجیِ Prometheus نام همه‌ی routeها، نرخِ خطای هرکدام، طولِ صف‌ها و
//  متریک‌های مدل را دارد — نقشه‌ی نسبتاً کاملی از ساختارِ داخلی.
//
//  این همان کلاسِ باگی است که برایِ ALLOWED_ORIGINS بسته شده بود، ولی
//  خواهرش باز مانده بود: یکی fail-fast، دیگری fail-open.
//  شرحِ کامل در KNOWN_LIMITATIONS §2r.
// ═══════════════════════════════════════════════════════════════════════

const ORIGINAL_TOKEN = process.env.METRICS_TOKEN;
const ORIGINAL_ENV = process.env.NODE_ENV;

/** تنظیمِ موقتِ محیط — Node تایپِ NODE_ENV را readonly می‌داند، پس cast لازم است. */
function setEnv(token: string | undefined, nodeEnv: string) {
  if (token === undefined) delete process.env.METRICS_TOKEN;
  else process.env.METRICS_TOKEN = token;
  (process.env as Record<string, string>).NODE_ENV = nodeEnv;
}

/** importِ تازه‌ی route در هر فراخوانی لازم نیست — handler محیط را در زمانِ درخواست می‌خواند. */
async function callMetrics(authHeader?: string): Promise<Response> {
  const { GET } = await import('../src/app/api/metrics/route.ts');
  return GET(new Request('https://example.invalid/api/metrics', {
    headers: authHeader ? { authorization: authHeader } : {},
  }));
}

afterEach(() => {
  setEnv(ORIGINAL_TOKEN, ORIGINAL_ENV ?? 'test');
});

describe('endpointِ متریک — گاردِ توکن', () => {
  test('⚠️ در production بدونِ توکن سرو نمی‌شود (رفعِ fail-open)', async () => {
    // ⚠️ قفلِ اصلیِ باگ. پیش از رفع، همین حالت ۲۰۰ و کلِ متریک‌ها را برمی‌گرداند.
    setEnv(undefined, 'production');
    const res = await callMetrics();
    assert.equal(res.status, 503, 'باید بسته باشد، نه عمومی');
    const body = await res.text();
    assert.match(body, /METRICS_TOKEN/, 'پیام باید به اپراتور بگوید چه چیزی کم است');
    assert.doesNotMatch(body, /^# HELP/m, 'هیچ متریکی نباید لو برود');
  });

  test('در توسعه بدونِ توکن باز می‌ماند (راحتیِ محلی)', async () => {
    setEnv(undefined, 'development');
    const res = await callMetrics();
    assert.equal(res.status, 200, 'در غیرِproduction نباید مزاحمِ توسعه شود');
  });

  test('با توکنِ درست سرو می‌شود', async () => {
    setEnv('secret-token-abc', 'production');
    const res = await callMetrics('Bearer secret-token-abc');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/plain/);
  });

  test('توکنِ غلط → ۴۰۱', async () => {
    setEnv('secret-token-abc', 'production');
    assert.equal((await callMetrics('Bearer wrong-token-xyz')).status, 401);
  });

  test('بدونِ هدرِ Authorization وقتی توکن لازم است → ۴۰۱', async () => {
    setEnv('secret-token-abc', 'production');
    assert.equal((await callMetrics()).status, 401);
  });

  test('توکنِ درست ولی بدونِ پیشوندِ Bearer → ۴۰۱', async () => {
    setEnv('secret-token-abc', 'production');
    assert.equal((await callMetrics('secret-token-abc')).status, 401);
  });

  test('⚠️ پیشوندِ درستِ ناقص هم رد می‌شود (نه مقایسه‌ی جزئی)', async () => {
    // ⚠️ اگر روزی کسی مقایسه را به startsWith عوض کند، این می‌گیردش.
    setEnv('secret-token-abc', 'production');
    assert.equal((await callMetrics('Bearer secret-token-ab')).status, 401);
    assert.equal((await callMetrics('Bearer secret-token-abcd')).status, 401);
  });

  test('توکنِ فقط-فاصله مثلِ ست‌نشده رفتار می‌کند', async () => {
    // `.trim()` جلوی این را می‌گیرد که یک مقدارِ خالیِ تصادفی در .env
    // به‌عنوانِ «توکنِ معتبر» تفسیر شود و همه چیز را با توکنِ خالی باز کند.
    setEnv('   ', 'production');
    assert.equal((await callMetrics()).status, 503, 'باید مثلِ ست‌نشده بسته شود');
  });

  test('گاردْ متریک‌ها را وقتی مجاز است واقعاً برمی‌گرداند (کنترلِ مثبت)', async () => {
    // بدونِ این، تابعی که *همیشه* ۴۰۱/۵۰۳ بدهد هم بقیه‌ی تست‌ها را پاس می‌کرد.
    setEnv('secret-token-abc', 'production');
    const body = await (await callMetrics('Bearer secret-token-abc')).text();
    assert.ok(body.length > 0, 'بدنه نباید خالی باشد');
  });
});
