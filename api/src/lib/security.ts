import { lookup } from 'dns/promises';
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
function isPrivateIp(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;   // private / loopback / this-host
    if (a === 169 && b === 254) return true;             // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;    // private
    if (a === 192 && b === 168) return true;             // private
    if (a === 100 && b >= 64 && b <= 127) return true;   // CGNAT (RFC 6598)
    if (a >= 224) return true;                           // multicast / reserved
    return false;
  }
  const low = ip.toLowerCase();
  if (low === '::1' || low === '::') return true;         // loopback / unspecified
  if (low.startsWith('fe80')) return true;               // link-local
  if (low.startsWith('fc') || low.startsWith('fd')) return true; // unique-local
  const mapped = low.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return false;
}

export async function assertPublicHttpUrl(rawUrl: string): Promise<void> {
  if (process.env.ALLOW_PRIVATE_WEBHOOKS === 'true') return; // opt-out صریح برای self-hosted
  let u: URL;
  try { u = new URL(rawUrl); } catch { throw Err.validation('آدرس webhook نامعتبر است'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw Err.validation('پروتکل webhook باید http یا https باشد');
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // IPv6 را از [] در بیاور
  if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal') {
    throw Err.validation('آدرس webhook مجاز نیست (شبکه‌ی داخلی)');
  }
  if (isPrivateIp(host)) throw Err.validation('آدرس webhook مجاز نیست (شبکه‌ی داخلی)');
  let address: string;
  try { ({ address } = await lookup(host)); }
  catch { throw Err.validation('آدرس webhook قابل‌resolve نیست'); }
  if (isPrivateIp(address)) throw Err.validation('آدرس webhook مجاز نیست (شبکه‌ی داخلی)');
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
