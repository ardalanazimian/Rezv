import { lookup } from 'dns/promises';
import { lookup as dnsLookupCb, type LookupAddress, type LookupOptions } from 'dns';
import { redis } from './redis';
import { Err } from './errors';

// ═══════════════════════════════════════════════════════════
//  ابزارهای امنیتی — Refresh revocation + Input validation
//  طبق OWASP: A01 (Access Control), A03 (Injection), A07 (Auth)
// ═══════════════════════════════════════════════════════════

// ── لیست سیاه refresh token (revocation) ──
// وقتی کاربر logout می‌کند یا توکن مشکوک است، jti بلاک می‌شود.
export async function revokeRefreshToken(jti: string, ttlSec = 30 * 86_400): Promise<void> {
  await redis.set(`revoked:${jti}`, '1', 'EX', ttlSec);
}
export async function isRefreshRevoked(jti?: string): Promise<boolean> {
  if (!jti) return false;
  const v = await redis.get(`revoked:${jti}`);
  return v === '1';
}

// ── اعتبارسنجی ورودی (دفاع در عمق برابر injection و داده‌ی بدفرم) ──
export const Validate = {
  // رشته‌ی متنی با سقف طول (جلوگیری از DoS با ورودی بزرگ)
  str(v: unknown, field: string, opts: { min?: number; max?: number } = {}): string {
    if (typeof v !== 'string') throw Err.validation(`${field} باید رشته باشد`);
    const s = v.trim();
    const { min = 0, max = 500 } = opts;
    if (s.length < min) throw Err.validation(`${field} خیلی کوتاه است`);
    if (s.length > max) throw Err.validation(`${field} خیلی بلند است (حداکثر ${max} کاراکتر)`);
    return s;
  },
  // عدد صحیح در بازه
  int(v: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (!Number.isInteger(n)) throw Err.validation(`${field} باید عدد صحیح باشد`);
    const { min = -Infinity, max = Infinity } = opts;
    if (n < min || n > max) throw Err.validation(`${field} خارج از محدوده‌ی مجاز است`);
    return n;
  },
  // شناسه‌ی UUID (جلوگیری از تزریق در پارامتر مسیر)
  uuid(v: unknown, field: string): string {
    const s = String(v);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      throw Err.validation(`${field} نامعتبر است`);
    }
    return s;
  },
  // تاریخ ISO (YYYY-MM-DD)
  dateStr(v: unknown, field: string): string {
    const s = String(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Err.validation(`${field} باید تاریخ معتبر باشد`);
    return s;
  },
  // ساعت (HH:MM)
  timeStr(v: unknown, field: string): string {
    const s = String(v);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw Err.validation(`${field} باید ساعت معتبر باشد`);
    return s;
  },
  // آرایه با سقف طول
  array<T>(v: unknown, field: string, maxLen = 100): T[] {
    if (!Array.isArray(v)) throw Err.validation(`${field} باید آرایه باشد`);
    if (v.length > maxLen) throw Err.validation(`${field} بیش از حد بزرگ است`);
    return v as T[];
  },
};

// ── گارد SSRF برای URLهای کاربر (webhook خروجی) ──
// یک تنانت می‌تواند URL دلخواه ثبت کند؛ بدون این گارد، worker می‌تواند وادار به
// درخواست به شبکه‌ی داخلی/metadata (169.254.169.254) شود (SSRF, OWASP A10).
// events.ts علاوه بر این با redirect:'manual' جلوی دور زدن از طریق ریدایرکت را می‌گیرد.
// self-hosted که عمداً webhook داخلی می‌خواهد: ALLOW_PRIVATE_WEBHOOKS=true.
function isPrivateV4(a: number, b: number): boolean {
  if (a === 10 || a === 127 || a === 0) return true;   // private / loopback / this-host
  if (a === 169 && b === 254) return true;             // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;    // private
  if (a === 192 && b === 168) return true;             // private
  if (a === 100 && b >= 64 && b <= 127) return true;   // CGNAT (RFC 6598)
  if (a >= 224) return true;                            // multicast / reserved
  return false;
}

/** یک IPv6 (فشرده/گسترده، با یا بدونِ IPv4ِ نقطه‌ای در دُم) → ۸ هگزتتِ عددی، یا null. */
function expandIPv6(input: string): number[] | null {
  let s = input.trim().toLowerCase();
  if (!s.includes(':')) return null;
  // IPv4ِ نقطه‌ایِ دُم (مثلِ ::ffff:169.254.169.254 یا 64:ff9b::1.2.3.4) → دو هگزتت
  const tailV4 = s.match(/:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (tailV4) {
    const o = tailV4.slice(1).map(Number);
    if (o.some((n) => n > 255)) return null;
    s = s.slice(0, s.length - tailV4[0].length) + ':' +
        (((o[0] << 8) | o[1]).toString(16)) + ':' + (((o[2] << 8) | o[3]).toString(16));
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const hasGap = halves.length === 2;
  const tail = hasGap ? (halves[1] ? halves[1].split(':') : []) : [];
  let groups: string[];
  if (hasGap) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (g === '' ? NaN : parseInt(g, 16)));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return nums;
}

export function isPrivateIp(ip: string): boolean {
  const s = ip.trim().toLowerCase();
  const dm = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dm) {
    const o = dm.slice(1).map(Number);
    if (o.some((n) => n > 255)) return false;
    return isPrivateV4(o[0], o[1]);
  }
  // RT-31: hostnames (no ':') are never IP literals — the fc/fd check used to wrongly
  // flag `fcbarcelona.com`. Only strings that are actually IPv6 get the range checks.
  if (!s.includes(':')) return false;
  const g = expandIPv6(s);
  if (!g) return false;
  // ::/0..1 loopback / unspecified
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0 && g[6] === 0 && (g[7] === 0 || g[7] === 1)) return true;
  if ((g[0] & 0xffc0) === 0xfe80) return true;           // fe80::/10 link-local
  if ((g[0] & 0xfe00) === 0xfc00) return true;           // fc00::/7 unique-local
  // RT-31 follow-up: check the EMBEDDED IPv4 of every wrapper form, in the expanded
  // (canonical) address — so uncompressed `0:0:0:0:0:ffff:a9fe:a9fe`, 6to4 and NAT64 are
  // all caught, not just the `::ffff:` literal the URL parser happens to normalise.
  // isPrivateV4 only needs the first two octets, which live in a single hextet.
  const embedded = (hextet: number) => isPrivateV4((hextet >> 8) & 255, hextet & 255);
  // ::ffff:0:0/96  IPv4-mapped
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) return embedded(g[6]);
  // 2002::/16  6to4 — embedded IPv4 is the next 32 bits (g[1] holds its first two octets)
  if (g[0] === 0x2002) return embedded(g[1]);
  // 64:ff9b::/96  NAT64 — embedded IPv4 is the low 32 bits
  if (g[0] === 0x0064 && g[1] === 0xff9b) return embedded(g[6]);
  return false;
}

/**
 * نامِ میزبان‌های داخلی که هرگز نباید webhook برود — پیش از resolve (fast fail).
 * فقط نام و IPِ لفظی را می‌سنجد؛ resolveِ واقعی و pinning در `safeLookup` است.
 */
export function isBlockedWebhookHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === 'metadata' || h === 'metadata.google.internal') return true;
  if (h.endsWith('.internal') || h.endsWith('.local')) return true;
  return isPrivateIp(h); // literal private/loopback/link-local/mapped IP (hostnames → false)
}

/**
 * lookup سازگار با `http(s).request({ lookup })`. در **زمانِ اتصال** صدا زده می‌شود، پس
 * همان resolveی که اینجا اعتبارسنجی می‌شود دقیقاً همانی است که سوکت به آن وصل می‌شود —
 * پنجره‌ی TOCTOU/DNS-rebinding بسته می‌شود (برخلافِ resolve-سپس-fetch(hostname) که دو
 * resolveِ مستقل داشت). هر آدرسِ برگشتی با همان `isPrivateIp` مشترک سنجیده می‌شود.
 */
export function safeLookup(
  hostname: string,
  options: unknown,
  callback: (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void,
): void {
  const guarded = process.env.ALLOW_PRIVATE_WEBHOOKS !== 'true';
  dnsLookupCb(hostname, options as LookupOptions, (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family: number) => {
    if (err) { callback(err); return; }
    if (guarded) {
      const addrs: LookupAddress[] = Array.isArray(address) ? address : [{ address: address as string, family }];
      for (const a of addrs) {
        if (isPrivateIp(a.address)) {
          const e: NodeJS.ErrnoException = new Error(`آدرس webhook به شبکه‌ی داخلی resolve شد (${a.address})`);
          e.code = 'EAI_BLOCKED';
          callback(e); return;
        }
      }
    }
    callback(null, address, family);
  });
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  if (process.env.ALLOW_PRIVATE_WEBHOOKS === 'true') return; // opt-out صریح برای self-hosted
  let u: URL;
  try { u = new URL(rawUrl); } catch { throw Err.validation('آدرس webhook نامعتبر است'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw Err.validation('پروتکل webhook باید http یا https باشد');
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // IPv6 را از [] در بیاور
  if (isBlockedWebhookHost(host)) throw Err.validation('آدرس webhook مجاز نیست (شبکه‌ی داخلی)');
  // پیش‌بررسیِ resolve (fail fast با پیامِ روشن). گاردِ قطعیِ ضدِ rebinding خودِ
  // `safeLookup` در زمانِ اتصال است — این‌جا فقط برای پیامِ خطای بهتر می‌ماند.
  let addresses: LookupAddress[];
  try { addresses = await lookup(host, { all: true }); }
  catch { throw Err.validation('آدرس webhook قابل‌resolve نیست'); }
  for (const a of addresses) {
    if (isPrivateIp(a.address)) throw Err.validation('آدرس webhook مجاز نیست (شبکه‌ی داخلی)');
  }
}

// ── محدودیت اندازه‌ی بدنه‌ی درخواست (جلوگیری از DoS) ──
const MAX_BODY_BYTES = 100 * 1024; // 100KB
export async function safeJson(req: Request): Promise<any> {
  const len = req.headers.get('content-length');
  if (len && parseInt(len, 10) > MAX_BODY_BYTES) {
    throw Err.validation('حجم درخواست بیش از حد مجاز است');
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw Err.validation('حجم درخواست بیش از حد مجاز است');
  try { return text ? JSON.parse(text) : {}; }
  catch { throw Err.validation('بدنه‌ی JSON نامعتبر است'); }
}

// ═══════════════════════════════════════════════════════════════════════
//  ALLOWED_ORIGINS — تجزیه و اعتبارسنجی در یک جا
//
//  ⚠️ یافته‌ی ممیزیِ ۲۰۲۶-۰۸-۱۹ (زنده، با مرورگرِ واقعی): بدترین حالتِ خرابیِ
//  این متغیر «تنظیم‌نشدن» نیست — گاردِ production آن را می‌گیرد. بدترین حالت
//  «تنظیم‌شدنِ غلط» است، چون هیچ خطایی تولید نمی‌کند: مرورگر درخواست را بلاک
//  می‌کند، اپِ مشتری صادقانه به دادهٔ نمونه برمی‌گردد و هر کارت را «نمونه»
//  برچسب می‌زند — یعنی همه‌ی بازدیدکننده‌ها به‌جای رستورانِ واقعی، محتوایِ
//  نمونه می‌بینند و هیچ‌کس متوجه نمی‌شود.
//
//  کلیدِ ماجرا: هدرِ `Origin` که مرورگر می‌فرستد **همیشه** دقیقاً
//  `scheme://host[:port]` است — بدونِ اسلشِ پایانی، بدونِ مسیر، بدونِ query.
//  پس مقایسه‌ی رشته‌ایِ ما با هر چیزِ دیگری هرگز مچ نمی‌شود. این تابع دقیقاً
//  همان اشتباه‌هایی را می‌گیرد که در عمل رخ می‌دهند.
// ═══════════════════════════════════════════════════════════════════════

export type OriginsParse = { valid: string[]; problems: string[] };

/** ورودیِ خامِ ALLOWED_ORIGINS را به originهای معتبر + فهرستِ ایرادها تبدیل می‌کند. */
export function parseAllowedOrigins(raw: string | undefined | null): OriginsParse {
  const valid: string[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const entry of (raw ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
    if (entry === '*') {
      problems.push('«*» مجاز نیست — CORS با اعتبارنامه‌ی واقعی نباید همه‌جا باز باشد؛ دامنه‌ها را صریح بنویس.');
      continue;
    }
    if (!/^https?:\/\//i.test(entry)) {
      problems.push(`«${entry}» بدونِ scheme است — مرورگر Origin را همیشه با https:// یا http:// می‌فرستد.`);
      continue;
    }
    let u: URL;
    try { u = new URL(entry); }
    catch { problems.push(`«${entry}» یک URLِ معتبر نیست.`); continue; }

    // origin استانداردِ خودِ URL: scheme://host[:port] و بس.
    const canonical = u.origin;
    if (entry !== canonical) {
      problems.push(`«${entry}» با originِ استاندارد فرق دارد؛ درستش «${canonical}» است (بدونِ اسلشِ پایانی و بدونِ مسیر).`);
      continue;
    }
    if (seen.has(canonical)) continue;   // تکراری، ایراد نیست
    seen.add(canonical);
    valid.push(canonical);
  }
  return { valid, problems };
}

// ═══════════════════════════════════════════════════════════════════════
//  CSRF — تصمیمِ خالصِ «این درخواستِ تغییردهنده مجاز است؟»
//
//  چرا اینجا و نه داخلِ middleware: middleware به next/server و ioredis گره
//  خورده و در تستِ واحد قابلِ صدا زدن نیست. همان الگویِ parseAllowedOrigins
//  بالا — منطق اینجا خالص و تست‌پذیر، و middleware فقط هدرها را می‌خواند.
//
//  ⚠️ باگِ رفع‌شده: شرطِ قبلی `allowed.length > 0 && origin && !allowed.includes(origin)`
//  بود — یعنی درخواستِ mutating **بدونِ** هدرِ Origin همیشه رد نمی‌شد و بی‌صدا
//  عبور می‌کرد. دقیقاً همان حالتی که یک POSTِ فرمِ ساده‌ی cross-site می‌سازد.
//  (auth با Bearer است پس این لایه دفاع در عمق است، ولی گاردی که ساده‌ترین
//  راهِ دور زدنش «هدر را نفرست» باشد اصلاً گارد نیست.)
//
//  قاعده‌ی جدید، صادقانه — به ترتیب:
//   ۱. Origin هست  → باید در ALLOWED_ORIGINS باشد، وگرنه رد.
//   ۲. Origin نیست ولی `Sec-Fetch-Site: same-origin|same-site` → مجاز.
//      این هدر را خودِ مرورگر می‌گذارد و JSِ صفحه نمی‌تواند جعلش کند
//      (forbidden header name)، پس ادعایِ «هم‌مبدأ» قابلِ اتکاست.
//   ۳. Origin نیست ولی `Referer` داریم که originش در فهرست است → مجاز.
//      (پستِ فرمِ same-origin در مرورگرهای قدیمی‌تر Origin نمی‌فرستد ولی
//      Referer می‌فرستد.)
//   ۴. Origin نیست ولی درخواست هدرِ «غیرِ ساده» دارد (Authorization یا
//      x-maintenance-key) → مجاز. استدلال: فرمِ ساده‌ی cross-site اصلاً
//      نمی‌تواند هدرِ سفارشی بگذارد؛ هر کلاینتی که می‌گذارد یا مرورگر است
//      (که آن‌وقت preflight خورده و CORS بالا سنجیدش) یا اصلاً مرورگر نیست
//      و CSRF برایش بی‌معناست. این بند عمداً هست چون کرونِ واقعی همین است:
//      `cron/run.sh` با curl و هدرِ x-maintenance-key POST می‌زند، بدونِ
//      Origin — بدونِ این بند، کلِ کرونِ نگه‌داری بی‌صدا ۴۰۳ می‌شد
//      (curl -sf هیچ خطایی چاپ نمی‌کند).
//   ۵. هیچ‌کدام → رد. یعنی درخواستِ بی‌نشانه دیگر عبور نمی‌کند.
//
//  آنچه این لایه **نمی‌پوشاند** (صریح): وقتی ALLOWED_ORIGINS خالی است، هیچ
//  چکی انجام نمی‌شود — گاردِ production در middleware جلوی آن حالت را
//  می‌گیرد، نه این تابع.
// ═══════════════════════════════════════════════════════════════════════

export type CsrfSignals = {
  origin: string | null;
  secFetchSite: string | null;
  referer: string | null;
  /** آیا هدری دارد که وجودش یعنی درخواست «ساده» نبوده (Authorization / x-maintenance-key)؟ */
  hasNonSimpleHeader: boolean;
};

export type CsrfVerdict = {
  allowed: boolean;
  /** دلیلِ ماشین‌خوان — برای لاگ و برای تست، تا «چرا» هم قفل شود نه فقط «چه». */
  reason:
    | 'no_allowlist'          // ALLOWED_ORIGINS تنظیم نشده → این لایه خاموش است
    | 'origin_allowed'
    | 'origin_rejected'
    | 'sec_fetch_same_site'
    | 'referer_allowed'
    | 'non_simple_header'     // کلاینتِ غیرمرورگری/preflight-شده (مثلِ کرون)
    | 'no_trusted_signal';    // هیچ نشانه‌ای نداشت → رد
};

/** تصمیمِ CSRF برای یک درخواستِ **تغییردهنده** (POST/PATCH/PUT/DELETE). */
export function checkMutatingOrigin(s: CsrfSignals, allowed: string[]): CsrfVerdict {
  if (allowed.length === 0) return { allowed: true, reason: 'no_allowlist' };

  if (s.origin) {
    return allowed.includes(s.origin)
      ? { allowed: true, reason: 'origin_allowed' }
      : { allowed: false, reason: 'origin_rejected' };
  }

  const site = s.secFetchSite?.trim().toLowerCase();
  if (site === 'same-origin' || site === 'same-site') {
    return { allowed: true, reason: 'sec_fetch_same_site' };
  }

  if (s.referer) {
    try {
      if (allowed.includes(new URL(s.referer).origin)) {
        return { allowed: true, reason: 'referer_allowed' };
      }
    } catch { /* Referer بدفرم = هیچ نشانه‌ای؛ به بندِ بعد برو */ }
  }

  if (s.hasNonSimpleHeader) return { allowed: true, reason: 'non_simple_header' };

  return { allowed: false, reason: 'no_trusted_signal' };
}
