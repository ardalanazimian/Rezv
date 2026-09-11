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
/** تأخیرِ تلاشِ مجددِ ریت‌لیمیت پیش از fallback (E-003). کوتاه عمداً: مسیرِ
 *  auth داغ است و یک قطعیِ واقعی نباید به تأخیرِ محسوس برای هر درخواست بدل شود. */
export const RATE_LIMIT_RETRY_DELAY_MS = 40;

export async function rateLimitWithFallback(
  identifier: string,
  rule: RateLimitRule,
  scope: 'middleware' | 'route',
  attempt: (id: string, r: RateLimitRule) => Promise<RateLimitResult> = rateLimit,
): Promise<RateLimitResult> {
  try {
    return await attempt(identifier, rule);
  } catch (firstError) {
    // ⚠️ E-003 (۲۰۲۶-۰۹-۰۹) — **یک تلاشِ مجدد پیش از fallback، و دلیلش امنیتی
    // است نه پایداری.**
    //
    // سیاستِ fallbackِ بالا برای «Redis قطع است» نوشته شد و برای آن حالت درست
    // است. ولی حالتِ واقعیِ خرابی معمولاً «Redis یک لحظه بلیپ می‌زند» است، و
    // در آن حالت این مسیر یک **ریستِ شمارنده** می‌سازد نه یک سقفِ جایگزین:
    // `rateLimitInMemory` نقشه‌ی جداگانه دارد، پس برای کلیدی که هرگز ندیده
    // `count: 1` می‌سازد و اجازه می‌دهد — در حالی که Redis از قبل سقف را پر
    // کرده بود. اثباتِ اجراشده (`RULES.otpPerPhone`, max=3، خطا فقط در تلاشِ
    // چهارم):
    //
    //     ۱ allowed r=2 · ۲ allowed r=1 · ۳ allowed r=0 · ۴ allowed r=2
    //                                                     ↑ باید رد می‌شد
    //
    // کشفش هم ارزشِ ثبت دارد: یک تستِ ریت‌لیمیت که «flake» برچسب خورده بود،
    // در ۸ اجرا دوبار افتاد و بارِ دوم در تستِ **دیگری** از همان خانواده —
    // دو ادعای مستقل که یکسان می‌افتند به محدودکننده اشاره می‌کنند، نه به
    // تست‌ها. سه نشستِ مستقل لازم شد تا از «flake» به مکانیزم برسیم.
    //
    // چرا **یک** تلاشِ مجدد و نه بیشتر: بلیپِ گذرا با یک retry از بین می‌رود،
    // ولی قطعیِ واقعی نباید به تأخیرِ چندبرابری برای هر درخواست تبدیل شود —
    // آن‌وقت سیاستِ در دسترس‌بودن را با کندی جایگزین کرده‌ایم. تأخیرِ کوتاه
    // است تا مسیرِ داغِ auth را نکشد.
    //
    // ── وضعیتِ امروزِ E-003 (به‌روزشده) ──────────────────────────────────
    // این retry حالتِ **گذرا** را می‌بندد. حالتِ «Redis واقعاً برای مدتی قطع
    // است» را بندِ بعدی می‌بندد: سطلی که *به‌خاطرِ خطای Redis* ساخته می‌شود
    // دیگر از `count: 1` شروع نمی‌کند، بلکه بدبینانه نزدیکِ سقف بذر می‌شود
    // (`pessimistic: true` پایین) — همین یک درخواست عبور می‌کند و بقیه‌ی
    // پنجره throttle می‌شود. پس قطعیِ Redis دیگر به هیچ مهاجمی سهمیه‌ی تازه
    // نمی‌دهد.
    //
    // ⚠️ آنچه همچنان پوشیده **نیست** (صادقانه):
    //  • سطل per-process است. با N اینستنس، سقفِ مؤثر در زمانِ قطعی N×۱ است
    //    (قبلاً N×max بود) — بهتر، ولی هنوز سراسری نیست.
    //  • شمارشِ پیش از قطعی منتقل نمی‌شود؛ فقط فرض می‌کنیم «احتمالاً پر بوده».
    //  • در قطعیِ طولانی این یعنی کاربرِ بی‌گناه هم throttle می‌شود. این
    //    همان تبادلِ محصولیِ E-003 است و حالا عمداً به سمتِ **امنیت** نشسته،
    //    نه به سمتِ در دسترس‌بودن — ولی نه fail-closedِ کامل: درخواستِ اول
    //    همیشه عبور می‌کند، پس سرویس هرگز صفر نمی‌شود.
    //  • سقفِ per-phoneِ OTP اصلاً به این مسیر وابسته نیست (در Postgres است،
    //    `lib/otp.ts` + `prisma/sql/083-*.sql`) و مستقل از Redis می‌ایستد.
    try {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY_MS));
      const retried = await attempt(identifier, rule);
      metrics.rateLimitRetryRecovered.inc({ prefix: rule.prefix, scope });
      return retried;
    } catch (retryError) {
      // ⚠️ این `catch` عمداً دیگر خالی نیست، و دلیلش یک ساعتِ گم‌شده است.
      // نسخه‌ی اولش `catch { }` بود. هنگام اثباتِ همین رفع، یک اجرا نشان داد
      // retry اصلاً شلیک نمی‌کند (`attempt` چهار بار صدا خورد نه پنج بار) و
      // خروجی **دقیقاً شبیهِ نبودِ رفع** بود: `allowed=true remaining=2`.
      // هر خطایی داخلِ این بلوک — از جمله یک `undefined.inc()` اگر شمارنده‌ای
      // هنوز اعلام نشده باشد — بی‌صدا بلعیده می‌شد و از بیرون «Redis واقعاً
      // قطع است» خوانده می‌شد. یعنی **یک باگ در خودِ رفع، شبیهِ همان نقصی
      // می‌شد که رفع برای بستنش نوشته شده بود**، و هیچ ردی نمی‌گذاشت.
      //
      // حالا هر شکستِ غیرمنتظره‌ی این مسیر لاگ می‌شود. اگر `attempt` واقعاً
      // به‌خاطرِ Redis خطا داده، این لاگ هم‌ارزِ همان اخطارِ پایین است و
      // پرحرفی می‌کند — که قیمتِ ارزانی است برای مسیری که اگر بی‌صدا بشکند،
      // به‌جای خطا یک **حفره‌ی امنیتی** می‌سازد.
      log.warn('rate-limit: تلاشِ مجدد هم شکست (E-003) — به fallbackِ in-memory می‌رویم', {
        prefix: rule.prefix, scope, error: (retryError as Error)?.message,
      });
    }

    log.warn('rate-limit: Redis در دسترس نیست (پس از یک تلاشِ مجدد)، fallback به سقفِ in-memory', {
      prefix: rule.prefix, scope, error: (firstError as Error).message,
    });
    metrics.rateLimitFallback.inc({ prefix: rule.prefix, scope });
    // `pessimistic` فقط از همین مسیر می‌آید — یعنی «سطل را چون Redis خطا داد
    // می‌سازیم، نه چون واقعاً درخواستِ اول است». صداکردنِ مستقیمِ
    // rateLimitInMemory (اگر روزی لازم شد) رفتارِ قبلی را دارد.
    return rateLimitInMemory(identifier, rule, { pessimistic: true });
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
  // ── ورود با رمزِ عبور (مهاجرتِ ۰۷۴) ──
  // روی **دو** بُعد اعمال می‌شود و هر دو لازم‌اند:
  //  • per-IP  — جلوی پویشِ یک مهاجم روی نام‌های کاربریِ مختلف را می‌گیرد
  //  • per-username — جلوی پویشِ توزیع‌شده (بات‌نت، IPِ چرخان) روی **یک**
  //    حساب را می‌گیرد؛ سقفِ per-IP به‌تنهایی این را نمی‌بندد.
  // ۱۰ در ۱۰ دقیقه: برای آدمی که رمزش را اشتباه می‌زند دست‌ودل‌باز، برای
  // brute-force بی‌فایده (فضای رمزِ ۸ کاراکتری در برابرِ ۱۴۴۰ حدس در روز).
  passwordLogin: { prefix: 'pwlogin',   max: 10,  windowMs: 10 * 60_000 } as RateLimitRule,
  // ── ورودِ سه‌عاملیِ مدیرِ پلتفرم (رمز + TOTP) ──
  // سخت‌گیرتر از `passwordLogin` و عمداً: این بالاترین سطحِ دسترسیِ سیستم است
  // و برخلافِ رستوران‌دار، تعدادِ کاربرانش یک نفر است — پس سقفِ پایین هیچ
  // کاربرِ واقعی‌ای را اذیت نمی‌کند. ۵ در ۱۵ دقیقه.
  //
  // مثلِ خواهرش رویِ **دو** بُعد اعمال می‌شود و هر دو لازم‌اند: per-IP جلوی
  // پویشِ یک مهاجم را می‌گیرد و per-username جلوی پویشِ توزیع‌شده (IPِ چرخان)
  // رویِ همان یک حسابِ ادمین را.
  adminTotpLogin: { prefix: 'admtotp', max: 5, windowMs: 15 * 60_000 } as RateLimitRule,
  // ── check-inِ QRِ میز (POST /api/v1/checkin) ──
  //
  // این تنها مسیرِ جهش‌دهنده‌ی وضعیتِ رزرو است که **بدونِ توکنِ کاربر** سرو
  // می‌شود: خودِ کدِ QRِ روی میز اعتبارنامه است (مهمانِ بدونِ حساب هم باید
  // بتواند بنشیند). پس سقفِ اختصاصی لازم است، نه فقط globalPerIp.
  //
  // چرا دقیقاً ۳۰ در ۶۰ ثانیه (نه بیشتر، نه کمتر) — سه قید:
  //
  //  ۱) کفِ کاربردِ واقعی: یک مهمان یک بار اسکن می‌کند و روی موبایلِ ناپایدار
  //     ۲–۳ بار هم دوباره تلاش می‌کند. در ایران CGNATِ اپراتورها یعنی صدها
  //     مشترک پشتِ یک IPِ عمومی‌اند، و یک گروهِ ۶ نفره ممکن است همگی همان
  //     استیکر را اسکن کنند. ۳۰/دقیقه ≈ ۱۰ مهمانِ متمایز در دقیقه از یک
  //     خروجیِ مشترک، هرکدام با ۳ تلاش. سقفِ تنگ‌تر یعنی ردکردنِ check-inِ
  //     واقعی — که خودش یک خرابیِ کسب‌وکاری است، نه «امنیت».
  //
  //  ۲) سقفِ brute-force: فضایِ کد ۵۰ بیت است (`genQrToken` در lib/tables.ts:
  //     ۱۰ نویسه از الفبایِ ۳۲تاییِ Base32 با randomBytes؛ 256 % 32 === 0 پس
  //     بدونِ modulo bias — اندازه‌گیریِ تجربی: ۴٫۹۹۹۹۸۵ بیت به‌ازای نویسه).
  //     ۲^۵۰ ≈ ۱٫۱۳e۱۵. با ۱۰٬۰۰۰ کدِ زنده‌ی کشوری، احتمالِ هر حدس ≈ ۸٫۹e−۱۲.
  //     ۳۰/دقیقه = ۴۳٬۲۰۰/روز ⇒ امیدِ ریاضیِ اولین برخورد برای یک IP ≈ ۷٬۱۰۰
  //     سال؛ حتی با ۱۰۰٬۰۰۰ IPِ توزیع‌شده ~۲۶ روز برای *یک* برخورد. یعنی
  //     ریت‌لیمیت اینجا خطِ دفاعِ دوم است؛ خطِ اول خودِ آنتروپی است.
  //
  //  ۳) نسبت به سقفِ سراسری: globalPerIp = ۱۲۰/دقیقه. سطلِ جدا یعنی سیلِ
  //     check-in در ۳۰ متوقف می‌شود بدونِ اینکه بقیه‌ی APIِ همان IP بسوزد،
  //     و برعکس. سقفِ مؤثر = min(۳۰, ۱۲۰).
  //
  // ⚠️ چیزی که این سقف **نمی‌گیرد** و عمداً باز مانده: کسی که یک کدِ معتبر را
  // واقعاً دارد (عکسِ استیکر) هنوز می‌تواند رزروِ همان میز را بنشاند. راهِ
  // بستنش عاملِ دوم است (guest_token روی رزرو یا QRِ رزرو-محور) که امروز در
  // اسکیما وجود ندارد — ثبت‌شده به‌عنوانِ کارِ فاز بعد، نه با سقفِ تنگ‌تر
  // پنهان‌شده.
  qrCheckin:     { prefix: 'chkin',     max: 30,  windowMs: 60_000 } as RateLimitRule,
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
//
//  ⚠️ `pessimistic` (رفعِ E-003، ۲۰۲۶-۰۹-۱۱): سطلی که **به‌خاطرِ خطای Redis**
//  ساخته می‌شود نباید از `count: 1` شروع کند. دلیلش این است که آن کلید در Redis
//  تاریخچه داشته و ما آن را از دست داده‌ایم؛ شروع از ۱ یعنی «هر قطعیِ Redis به
//  هر مهاجمی یک سهمیه‌ی کاملِ تازه می‌دهد» — دقیقاً برعکسِ کاری که یک
//  محدودکننده باید بکند. با این پرچم، سطلِ تازه نزدیکِ سقف بذر می‌شود: همین
//  درخواست عبور می‌کند (سرویس صفر نمی‌شود) و بقیه‌ی پنجره throttle است.
//  وقتی Redis سالم است این مسیر اصلاً صدا زده نمی‌شود، پس رفتارِ عادی دست‌نخورده است.
// ═══════════════════════════════════════════════════════════
const memBuckets = new Map<string, { count: number; resetAt: number }>();
let lastSweep = Date.now();

/** rate limit درون‌حافظه‌ای (fallback بدونِ Redis). همان امضای خروجیِ rateLimit.
 *  `pessimistic`: سطلِ تازه را نزدیکِ سقف بذر کن (فقط از مسیرِ قطعیِ Redis). */
/** ⚠️ نوعِ نام‌دار و نه inline: گاردِ `ratelimit-coverage.test.mts` بلوکِ
 *  `RULES` را تا آخرِ فایل اسکن می‌کند و هر `  name: {` با دو فاصله تورفتگی
 *  را یک قانونِ بی‌مصرف‌کننده می‌شمارد. `opts: { … }` دقیقاً همان شکل بود. */
type InMemoryOpts = { pessimistic?: boolean };

export function rateLimitInMemory(
  ip: string,
  rule: RateLimitRule,
  opts: InMemoryOpts = {},
): RateLimitResult {
  const now = Date.now();
  const key = `${rule.prefix}:${ip}`;

  // پاک‌سازیِ دوره‌ای کلیدهای منقضی (هر ۶۰s) تا حافظه رشد نکند
  if (now - lastSweep > 60_000) {
    for (const [k, v] of memBuckets) if (v.resetAt <= now) memBuckets.delete(k);
    lastSweep = now;
  }

  const b = memBuckets.get(key);
  if (!b || b.resetAt <= now) {
    // سطلِ تازه: در حالتِ عادی از ۱، و در حالتِ بدبینانه از خودِ سقف — یعنی
    // همین درخواست آخرین مجازِ پنجره است. (`max` و نه `max + 1`، تا سرویس در
    // قطعی کاملاً بسته نشود.)
    const count = opts.pessimistic ? rule.max : 1;
    memBuckets.set(key, { count, resetAt: now + rule.windowMs });
    return {
      allowed: true, remaining: Math.max(0, rule.max - count),
      resetAt: now + rule.windowMs, retryAfterSec: 0,
    };
  }
  b.count++;
  if (b.count > rule.max) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, resetAt: b.resetAt, retryAfterSec };
  }
  return { allowed: true, remaining: Math.max(0, rule.max - b.count), resetAt: b.resetAt, retryAfterSec: 0 };
}
