import { NextRequest, NextResponse } from 'next/server';
import { clientIp, rateLimitHeaders, RULES, isBanned, recordViolation, rateLimitWithFallback } from '@/lib/ratelimit';
import { parseAllowedOrigins } from '@/lib/security';

// ═══════════════════════════════════════════════════════════════════════
//  ⚠️ این middleware به ioredis (از طریق ratelimit/redis) وابسته است که به
//  سوکت TCP نیاز دارد و فقط در Node.js runtime کار می‌کند، نه Edge runtime.
//
//  این پروژه به‌صورت self-host با `next start` (سرور Node) اجرا می‌شود، پس
//  middleware در Node runtime اجرا می‌شود و ioredis کار می‌کند. اگر روی پلتفرم
//  Edge (مثل Vercel Edge) دیپلوی شود، باید این منطق به لایه‌ی route (که در Node
//  runtime اجرا می‌شود) منتقل شود یا از یک کلاینت Edge-compatible (مثل Upstash
//  REST) استفاده شود.
//
//  دفاع در عمق (باگ C7): همه‌ی فراخوان‌های وابسته به Redis در try/catch هستند و
//  در صورت خطا fail-open می‌شوند، تا حتی اگر Redis در دسترس نباشد یا محیط محدود
//  باشد، کل API با ۵۰۰ سقوط نکند (rate-limit در همان حالت توسط لایه‌ی route و
//  nginx همچنان اعمال می‌شود).
// ═══════════════════════════════════════════════════════════════════════

export const config = { matcher: '/api/:path*' };
export const runtime = 'nodejs';

// تأیید پیکربندی حیاتی در production (fail-fast) — عمداً «تنبل»، دقیقاً مثل
// accessSecret/refreshSecret در jwt.ts.
//
// چرا تنبل و نه در سطح ماژول: `next build` با NODE_ENV=production اجرا می‌شود و
// ماژولِ middleware را ارزیابی می‌کند. چکِ سطحِ ماژول باعث می‌شد buildِ Vercel و
// جابِ build در CI فقط به‌خاطر نبودِ یک متغیرِ زمانِ اجرا شکست بخورد — با خطایی که
// شبیهِ خطای کامپایل به‌نظر می‌رسد. حالا build همیشه موفق است و اگر متغیر تنظیم
// نشده باشد، نخستین درخواست در production با همین پیامِ روشن رد می‌شود؛
// یعنی رفتارِ امنیتی حفظ شده ولی زمانِ بروزش درست است.
//
// ⚠️ گسترش‌یافته (ممیزیِ ۲۰۲۶-۰۸-۱۹): این گارد قبلاً فقط «خالی‌بودن» را
// می‌گرفت. ولی خطرناک‌ترین حالت، «پرشدنِ غلط» است — و آن هیچ خطایی تولید
// نمی‌کرد. با تستِ زنده‌ی مرورگر ثابت شد: وقتی originِ اپ در این فهرست نباشد،
// مرورگر fetch را بلاک می‌کند، اپِ مشتری صادقانه به دادهٔ نمونه برمی‌گردد و
// هر کارت را «نمونه» برچسب می‌زند. یعنی سایت بالاست، خطایی در لاگ نیست، و
// همه‌ی بازدیدکننده‌ها محتوایِ نمونه می‌بینند. یک خرابیِ کاملاً خاموش.
// حالا مقدارِ غلط هم مثلِ مقدارِ خالی، در production صریحاً fail-fast می‌کند.
let _originsChecked = false;
function assertAllowedOriginsConfigured(): void {
  if (_originsChecked) return;
  if (process.env.NODE_ENV === 'production') {
    const raw = process.env.ALLOWED_ORIGINS?.trim();
    if (!raw) {
      throw new Error(
        'ALLOWED_ORIGINS در production تنظیم نشده — محافظت CSRF (چک Origin) خاموش می‌شود. ' +
        'مثلاً: ALLOWED_ORIGINS=https://rezervno.ir,https://www.rezervno.ir'
      );
    }
    const { valid, problems } = parseAllowedOrigins(raw);
    if (problems.length) {
      throw new Error(
        'ALLOWED_ORIGINS نامعتبر است — با این مقدار مرورگر درخواست‌های اپ را بلاک می‌کند و ' +
        'کاربران به‌جای دادهٔ واقعی، محتوایِ «نمونه» می‌بینند بدونِ هیچ خطای قابلِ‌مشاهده‌ای:\n  · ' +
        problems.join('\n  · ')
      );
    }
    if (valid.length === 0) {
      throw new Error('ALLOWED_ORIGINS هیچ originِ معتبری ندارد.');
    }
  }
  _originsChecked = true;
}

// پاسخ بلاک استاندارد
function blocked(message: string, status = 429, retryAfter?: number) {
  const headers: Record<string, string> = {};
  if (retryAfter) headers['Retry-After'] = String(retryAfter);
  return NextResponse.json({ ok: false, error: { code: 'BLOCKED', message } }, { status, headers });
}

// ── CORS: فقط برای originهای مجاز (ALLOWED_ORIGINS) ──
// معماری جداست (فرانتِ استاتیک روی یک دامنه، بک‌اند روی دامنه‌ی دیگر)، پس مرورگر
// برای fetchِ cross-origin به این هدرها نیاز دارد؛ بدون آن‌ها پاسخ بلاک می‌شود.
// چون auth با Bearer token است (نه کوکی)، credentials لازم نیست.
function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS).valid;
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    // ⚠️ X-Restaurant-Id اضافه شد (زنده پیدا شد ۲۰۲۶-۰۸-۱۲): پنلِ business
    // برایِ مالکِ چندشعبه‌ای این هدر رو می‌فرسته (رجوع کن به apps/business/js/
    // data.js، setActiveRestaurant/renderBranchSwitcher) — بدونِ این خط، هر
    // درخواستِ restaurant-scoped از یه originِ جدا (دقیقاً معماریِ تولیدِ واقعی:
    // app./business./api. زیردامنه‌هایِ جدا) با preflightِ CORS رد می‌شد و کلِ
    // پنلِ business خاموش می‌موند — فقط با تستِ زنده‌یِ cross-origin پیدا شد،
    // نه با فرض.
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, x-trace-id, x-maintenance-key, X-Restaurant-Id',
    'Access-Control-Max-Age': '86400',
  };
}

// ── هدرهای امنیتی روی همه‌ی پاسخ‌های API (دفاع در عمق) + CORS ──
function applySecurityHeaders(res: NextResponse, origin: string | null = null) {
  for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
  res.headers.set('X-Content-Type-Options', 'nosniff');           // جلوگیری از MIME sniffing
  res.headers.set('X-Frame-Options', 'DENY');                     // ضد clickjacking
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-XSS-Protection', '0');                       // (CSP جای این را می‌گیرد)
  res.headers.set('Cache-Control', 'no-store');                   // پاسخ API کش نشود
  // HSTS: مرورگر را وادار می‌کند فقط HTTPS استفاده کند (ضد downgrade/SSL-strip).
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  // CSP سخت‌گیرانه برای پاسخ API: هیچ منبعی نباید اجرا/بارگذاری شود (این JSON است).
  res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  // غیرفعال‌کردن APIهای حساس مرورگر روی دامنه‌ی API.
  res.headers.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(), payment=()');
  return res;
}

export async function middleware(req: NextRequest) {
  assertAllowedOriginsConfigured();  // fail-fast در نخستین درخواستِ production
  const ip = clientIp(req);
  const origin = req.headers.get('origin');

  // ── CORS preflight: قبل از هر منطقِ دیگر، به OPTIONS پاسخ بده ──
  if (req.method === 'OPTIONS') {
    return applySecurityHeaders(new NextResponse(null, { status: 204 }), origin);
  }

  // ── لایه ۱: آیا IP بن شده؟ (سریع‌ترین چک) — fail-open در صورت خطای Redis ──
  try {
    if (await isBanned(ip)) {
      return applySecurityHeaders(blocked('دسترسی شما موقتاً مسدود شده است.', 403), origin);
    }
  } catch { /* Redis در دسترس نبود → ادامه بده، nginx/route لایه‌ی بعدی‌اند */ }

  // ── لایه ۲: محافظت CSRF برای درخواست‌های تغییردهنده ──
  // API با JWT در هدر Authorization ذاتاً در برابر CSRF مقاوم است (کوکی نیست)،
  // اما چک Origin یک لایه‌ی دفاعی اضافه برای درخواست‌های mutating است.
  const method = req.method;
  if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
    const allowed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS).valid;
    // اگر لیست مجاز تعریف شده و Origin وجود دارد ولی مجاز نیست → رد.
    // نکته‌ی امنیتی: وقتی ALLOWED_ORIGINS تنظیم نشده، این چک skip می‌شود؛ در
    // production حتماً باید ALLOWED_ORIGINS ست شود (به docker-compose رجوع کن).
    if (allowed.length > 0 && origin && !allowed.includes(origin)) {
      await recordViolation(ip).catch(() => {});
      return applySecurityHeaders(blocked('منشأ درخواست مجاز نیست.', 403), origin);
    }
  }

  // ── لایه ۳: ریت‌لیمیت سراسری — اگر Redis قطع شد، fallback به in-memory (نه fail-open کامل) ──
  // A3: از rateLimitWithFallback رد می‌شه (متمرکز در ratelimit.ts) تا هم
  // middleware هم enforceRateLimitِ سطحِ route دقیقاً همون متریک/لاگِ
  // fallback رو تولید کنن — قبلاً این try/catch جدا از enforceRateLimit
  // بود و enforceRateLimit اصلاً fallback نداشت (رجوع کن به ratelimit.ts).
  const result = await rateLimitWithFallback(ip, RULES.globalPerIp, 'middleware');
  if (!result.allowed) {
    await recordViolation(ip).catch(() => {});
    return applySecurityHeaders(blocked('تعداد درخواست بیش از حد مجاز. کمی صبر کن.', 429, result.retryAfterSec), origin);
  }

  const res = applySecurityHeaders(NextResponse.next(), origin);
  for (const [k, v] of Object.entries(rateLimitHeaders(result, RULES.globalPerIp))) {
    res.headers.set(k, v);
  }
  // هدر trace-id برای ردیابی درخواست (handlerها و لاگ‌ها از آن استفاده می‌کنند)
  const traceId = req.headers.get('x-trace-id') || crypto.randomUUID().replace(/-/g, '');
  res.headers.set('x-trace-id', traceId);
  return res;
}
