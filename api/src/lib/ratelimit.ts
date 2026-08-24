import { randomUUID } from 'crypto';
import { redis } from './redis';
import { Err } from './errors';
import { createLogger } from './logger';
import { metrics } from './metrics';
const log = createLogger('security');

/**
 * Rate Limiter — لایه‌ی دفاع در برابر سوءاستفاده و بخشی از دفاع DDoS
 * الگوریتم: Sliding Window Log با Redis sorted-set — دقیق‌تر از fixed-window
 * (مشکل مرز پنجره را ندارد) و همچنان سبک.
 */

export interface RateLimitRule {
  max: number;        // حداکثر درخواست مجاز در بازه
  windowMs: number;   // طول بازه (میلی‌ثانیه)
  prefix: string;     // پیشوند کلید
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;      // epoch ms
  retryAfterSec: number;
}

/**
 * هسته‌ی محدودکننده با Sliding Window Log.
 * sorted-set: هر درخواست یک عضو با score=timestamp.
 * اعضای قدیمی‌تر از پنجره حذف، سپس تعداد فعلی شمرده می‌شود.
 * تمام عملیات اتمیک در یک pipeline (MULTI).
 */
export async function rateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const key = `rl:${rule.prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const member = `${now}-${randomUUID()}`;

  const pipe = redis.multi();
  pipe.zremrangebyscore(key, 0, windowStart);   // ۱) حذف خارج از پنجره
  pipe.zadd(key, now, member);                  // ۲) افزودن درخواست فعلی
  pipe.zcard(key);                              // ۳) شمارش
  pipe.zrange(key, 0, 0, 'WITHSCORES');         // ۴) قدیمی‌ترین (برای resetAt)
  pipe.pexpire(key, rule.windowMs + 1000);      // ۵) TTL خودکار

  const res = await pipe.exec();
  if (!res) {
    // Redis در دسترس نبود: fail-open (سرویس قطع نشود) — باید آلارم شود
    return { allowed: true, remaining: rule.max - 1, resetAt: now + rule.windowMs, retryAfterSec: 0 };
  }

  const count = (res[2]?.[1] as number) ?? 1;
  const oldest = res[3]?.[1] as string[] | undefined;
  const oldestTs = oldest && oldest.length >= 2 ? Number(oldest[1]) : now;
  const resetAt = oldestTs + rule.windowMs;

  if (count > rule.max) {
    await redis.zrem(key, member); // این درخواست را حذف کن (منصفانه)
    const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));
    metrics.rateLimitHits.inc({ prefix: rule.prefix }); // متریکِ از قبل تعریف‌شده ولی تا این PR هیچ‌جا inc نمی‌شد
    return { allowed: false, remaining: 0, resetAt, retryAfterSec };
  }

  return { allowed: true, remaining: Math.max(0, rule.max - count), resetAt, retryAfterSec: 0 };
}

// ═══════════════════════════════════════════════════════════════════════
//  A3 (سختگیریِ acquisition-grade، ۲۰۲۶-۰۸-۱۴): هستهی مشترکِ «تلاش با
//  Redis، در صورتِ خطای واقعیِ اتصال fallback به سقفِ in-memory» — قبلاً
//  فقط middleware.ts این fallback را داشت (با یک try/catch جداگانه، بدونِ
//  متریک/لاگِ ساختاریافته)؛ enforceRateLimit (۵۹+ callerِ route-level، از
//  طریقِ withRestaurantAuth/withStaffAuth) اصلاً fallback نداشت — یعنی
//  قطعیِ Redis باعثِ throwِ خامِ rateLimit() می‌شد که فقط به یک ۵۰۰ی عمومی
//  ترجمه می‌شد، نه fail-open. این یک باگِ واقعی بود (سیاستِ مستندشده‌ی
//  fail-open فقط رویِ نیمی از سطحِ API واقعاً اجرا می‌شد)، نه صرفاً کمبودِ
//  observability — رفعش هم به‌جایِ تکرارِ try/catch در ۵۹+ فایل، همینجا
//  متمرکز شده تا هر callerِ enforceRateLimit/middleware خودکار همون سیاستِ
//  یکسان رو بگیره.
//
//  `attempt` تزریق‌پذیره (پیش‌فرض: خودِ rateLimit) — همون الگویِ
//  NoShowPredictor در reservations.ts — تا تستِ واحد بتونه بدونِ Redisِ
//  واقعی مسیرِ fallback رو با یک stub که throw می‌کنه اجرا کنه.
// ═══════════════════════════════════════════════════════════════════════
export async function rateLimitWithFallback(
  identifier: string,
  rule: RateLimitRule,
  scope: 'middleware' | 'route',
  attempt: (id: string, r: RateLimitRule) => Promise<RateLimitResult> = rateLimit,
): Promise<RateLimitResult> {
  try {
    return await attempt(identifier, rule);
  } catch (e) {
    log.warn('rate-limit: Redis در دسترس نیست، fallback به سقفِ in-memory', {
      prefix: rule.prefix, scope, error: (e as Error).message,
    });
    metrics.rateLimitFallback.inc({ prefix: rule.prefix, scope });
    return rateLimitInMemory(identifier, rule);
  }
}

/** نسخه‌ی پرتاب‌کننده: اگر از حد گذشت، خطای 429 پرتاب می‌کند. در ابتدای route صدا بزن.
 *  از rateLimitWithFallback رد می‌شه — یعنی قطعیِ Redis اینجا هم فقط سقفِ
 *  in-memory رو فعال می‌کنه، نه یک throwِ خامِ ۵۰۰. */
export async function enforceRateLimit(
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const result = await rateLimitWithFallback(identifier, rule, 'route');
  if (!result.allowed) throw Err.rateLimited(result.retryAfterSec);
  return result;
}

/**
 * استخراج IP کلاینت — امن در برابر جعل (باگ H10).
 *
 * قبلاً اولین مقدار X-Forwarded-For خوانده می‌شد که کاملاً توسط کلاینت قابل تعیین
 * است؛ مهاجم می‌توانست با ست‌کردن XFF دلخواه، سطل rate-limit تازه بگیرد (دور زدن
 * محدودیت و بن) یا IP قربانی را بن کند (DoS).
 *
 * اصلاح چندلایه:
 *  ۱) اولویت با X-Real-IP است که پروکسی معتمد (nginx) از روی اتصال واقعی
 *     ($remote_addr) ست می‌کند و کلاینت نمی‌تواند آن را جعل کند (nginx بازنویسی
 *     می‌کند نه append). CF-Connecting-IP هم مورد اعتماد Cloudflare است.
 *  ۲) اگر فقط XFF داریم، «راست‌ترین» مقدار خوانده می‌شود (نزدیک‌ترین هاپ به سرور،
 *     که پروکسی افزوده)، نه چپ‌ترین که کلاینت کنترل می‌کند.
 *
 * توجه: nginx در این پروژه XFF را با $remote_addr بازنویسی می‌کند، پس هم X-Real-IP
 * و هم XFF قابل‌اعتمادند. در استقرار بدون پروکسی معتمد، این هدرها نباید باور شوند
 * (متغیر TRUST_PROXY_HEADERS=false این را کنترل می‌کند).
 */
export function clientIp(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY_HEADERS !== 'false'; // پیش‌فرض: معتمد (پشت nginx)

  if (trustProxy) {
    // X-Real-IP: پروکسی معتمد آن را از اتصال واقعی ست می‌کند (غیرقابل جعل توسط کلاینت).
    const real = req.headers.get('x-real-ip');
    if (real) return real.trim();
    // Cloudflare
    const cf = req.headers.get('cf-connecting-ip');
    if (cf) return cf.trim();
    // XFF: راست‌ترین مقدار = هاپی که پروکسی افزوده (نه چپ‌ترینِ کلاینت‌محور).
    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
      const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
  }
  return 'unknown';
}

/** قوانین آماده. اعداد محافظه‌کارانه‌اند؛ بر اساس ترافیک واقعی تنظیم کن. */
export const RULES = {
  otpPerPhone:   { prefix: 'otp:phone', max: 3,   windowMs: 10 * 60_000 } as RateLimitRule,
  otpPerIp:      { prefix: 'otp:ip',    max: 15,  windowMs: 10 * 60_000 } as RateLimitRule,
  otpVerify:     { prefix: 'otpv',      max: 8,   windowMs: 10 * 60_000 } as RateLimitRule,
  reservation:   { prefix: 'resv',      max: 10,  windowMs: 60_000 } as RateLimitRule,
  search:        { prefix: 'srch',      max: 60,  windowMs: 60_000 } as RateLimitRule,
  globalPerIp:   { prefix: 'glob',      max: 120, windowMs: 60_000 } as RateLimitRule,
  auth:          { prefix: 'auth',      max: 20,  windowMs: 60_000 } as RateLimitRule,
} as const;

// ── سیستم بن خودکار: IP که زیاد ریت‌لیمیت بخورد، موقتاً کامل بلاک می‌شود ──
const BAN_THRESHOLD = 10;        // چند بار ریت‌لیمیت تا بن
const BAN_WINDOW_MS = 5 * 60_000; // در این بازه
const BAN_DURATION_S = 60 * 60;   // مدت بن: ۱ ساعت

/** آیا این IP بن شده؟ */
export async function isBanned(ip: string): Promise<boolean> {
  try {
    const banned = await redis.get(`ban:${ip}`);
    return banned !== null;
  } catch (e) {
    // A3: قبلاً این fail-open کاملاً بی‌صدا بود — یعنی قطعیِ Redis می‌تونست
    // بنِ فعال رو بدونِ هیچ سیگنالی دور بزنه. حالا لاگِ ساختاریافته +
    // متریکِ قابلِ‌آلارم دارد (نه تغییرِ سیاست، فقط دیدنیدن).
    log.warn('ban check: Redis در دسترس نیست، fail-open (بن اعمال نمی‌شود)', { ip, error: (e as Error).message });
    metrics.banCheckFailOpen.inc();
    return false;
  }
}

/** ثبت یک تخلف ریت‌لیمیت؛ اگر از حد گذشت، IP را بن کن. */
export async function recordViolation(ip: string): Promise<void> {
  try {
    const key = `viol:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, BAN_WINDOW_MS);
    if (count >= BAN_THRESHOLD) {
      await redis.set(`ban:${ip}`, '1', 'EX', BAN_DURATION_S);
      await redis.del(key);
      log.warn(`IP بن شد: ${ip}`, { event: 'rate_limit.auto_ban', ip, violations: count });
      metrics.rateLimitAutoBan.inc();
    }
  } catch { /* اگر redis نبود، بی‌صدا رد شو */ }
}

// ═══════════════════════════════════════════════════════════════════════
//  دیدِ ادمین رویِ بنِ خودکارِ IP (Company Control Plane، فازِ ۴)
//
//  خودِ بن از قبل کار می‌کرد (recordViolation/isBanned بالا)؛ این بخش فقط
//  دیده‌شدن/لغوِ دستی را برایِ پنلِ شرکت اضافه می‌کند — بدونِ تغییر در
//  منطقِ تشخیص/بن‌شدنِ خودکار.
// ═══════════════════════════════════════════════════════════════════════

/** فهرستِ IPهایِ الان‌بن‌شده + مدتِ باقی‌مانده (ثانیه). SCAN غیرمسدودکننده (نه KEYS). */
export async function listBannedIps(): Promise<{ ip: string; ttlSeconds: number }[]> {
  const out: { ip: string; ttlSeconds: number }[] = [];
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'ban:*', 'COUNT', 200);
      cursor = next;
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl > 0) out.push({ ip: key.slice('ban:'.length), ttlSeconds: ttl });
      }
    } while (cursor !== '0');
  } catch { /* اگر redis نبود، فهرستِ خالی */ }
  return out.sort((a, b) => b.ttlSeconds - a.ttlSeconds);
}

/** لغوِ دستیِ بنِ یک IP (+ صفرکردنِ شمارنده‌ی تخلف تا بلافاصله دوباره بن نشود). */
export async function unbanIp(ip: string): Promise<boolean> {
  try {
    const removed = await redis.del(`ban:${ip}`);
    await redis.del(`viol:${ip}`);
    return removed > 0;
  } catch { return false; }
}

/** هدرهای استاندارد RateLimit برای پاسخ. */
export function rateLimitHeaders(r: RateLimitResult, rule: RateLimitRule): Record<string, string> {
  return {
    'RateLimit-Limit': String(rule.max),
    'RateLimit-Remaining': String(r.remaining),
    'RateLimit-Reset': String(Math.ceil((r.resetAt - Date.now()) / 1000)),
  };
}

// ═══════════════════════════════════════════════════════════
//  In-Memory Rate Limit — fallback وقتی Redis در دسترس نیست.
//
//  چرا: middleware با fail-open کار می‌کند (اگر Redis قطع شود، عبور می‌دهد) تا
//  کل API سقوط نکند. ولی fail-open خالص، درِ DDoS را باز می‌گذارد. این لایه یک
//  سقفِ حداقلیِ per-process می‌گذارد که حتی بدونِ Redis کار می‌کند.
//
//  محدودیت‌ها (صادقانه): این per-instance است، نه سراسری — با چند instance، سقفِ
//  واقعی = max × تعدادِ instance. ولی همین هم بی‌نهایت بهتر از «هیچ سقفی» است و
//  یک حمله‌ی ساده را کند می‌کند تا Redis برگردد. حافظه هم خودش پاک می‌شود (پنجره‌ای).
// ═══════════════════════════════════════════════════════════
const memBuckets = new Map<string, { count: number; resetAt: number }>();
let lastSweep = Date.now();

/** rate limit درون‌حافظه‌ای (fallback بدونِ Redis). همان امضای خروجیِ rateLimit. */
export function rateLimitInMemory(ip: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const key = `${rule.prefix}:${ip}`;

  // پاک‌سازیِ دوره‌ای کلیدهای منقضی (هر ۶۰s) تا حافظه رشد نکند
  if (now - lastSweep > 60_000) {
    for (const [k, v] of memBuckets) if (v.resetAt <= now) memBuckets.delete(k);
    lastSweep = now;
  }

  const b = memBuckets.get(key);
  if (!b || b.resetAt <= now) {
    memBuckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.max - 1, resetAt: now + rule.windowMs, retryAfterSec: 0 };
  }
  b.count++;
  if (b.count > rule.max) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, resetAt: b.resetAt, retryAfterSec };
  }
  return { allowed: true, remaining: Math.max(0, rule.max - b.count), resetAt: b.resetAt, retryAfterSec: 0 };
}
