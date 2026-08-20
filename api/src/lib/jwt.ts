import jwt from 'jsonwebtoken';
import { Err } from './errors';

// ═══════════════════════════════════════════════════════════
//  JWT — سخت‌شده طبق OWASP
//   • الگوریتم صریح HS256 (جلوگیری از حمله‌ی algorithm confusion / alg:none)
//   • issuer/audience برای جلوگیری از استفاده‌ی توکن در سرویس اشتباه
//   • secretهای جدا برای access و refresh
// ═══════════════════════════════════════════════════════════

const ISS = 'rezervno';
const AUD = 'rezervno-api';
const ALG: jwt.Algorithm = 'HS256';

export type AccessPayload =
  | { sub: string; kind: 'customer' }
  | { sub: string; kind: 'staff'; tenantId: string; role: 'owner'|'manager'|'staff' };

// محتوای refresh token: علاوه بر sub/jti، هویت اصلی (kind و در صورت staff،
// tenant/role) را هم نگه می‌دارد تا هنگام refresh، access token با همان نوع
// صادر شود. (باگ C3: قبلاً refresh فقط sub داشت و access جدید همیشه customer
// می‌شد → کارمند بعد از هر refresh به customer تنزل می‌یافت و دسترسی‌اش می‌رفت.)
export type RefreshPayload =
  | { sub: string; jti: string; kind: 'customer' }
  | { sub: string; jti: string; kind: 'staff'; tenantId: string; role: 'owner'|'manager'|'staff' };

// تأیید وجود secretها در زمان بارگذاری (fail-fast اگر env ناقص باشد)
function accessSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET باید حداقل ۳۲ کاراکتر باشد');
  return s;
}
function refreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_REFRESH_SECRET باید حداقل ۳۲ کاراکتر باشد');
  return s;
}

export function signAccess(p: AccessPayload) {
  return jwt.sign(p, accessSecret(), { expiresIn: '15m', algorithm: ALG, issuer: ISS, audience: AUD });
}

/**
 * صدور refresh token. هویت اصلی (از روی access payload) درون توکن قرار می‌گیرد
 * تا refresh بتواند access هم‌نوع صادر کند. امضای قبلی (فقط sub) هم پشتیبانی
 * می‌شود: اگر فقط رشته‌ی sub داده شود، به‌عنوان customer در نظر گرفته می‌شود
 * (سازگاری با توکن‌های صادرشده‌ی قبلی).
 */
export function signRefresh(principal: AccessPayload | string) {
  const p: AccessPayload = typeof principal === 'string'
    ? { sub: principal, kind: 'customer' }
    : principal;
  // jti: شناسه‌ی یکتای توکن — برای امکان revocation (لیست سیاه)
  const jti = `${p.sub}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
  const claims = p.kind === 'staff'
    ? { sub: p.sub, jti, kind: 'staff' as const, tenantId: p.tenantId, role: p.role }
    : { sub: p.sub, jti, kind: 'customer' as const };
  return jwt.sign(claims, refreshSecret(), { expiresIn: '30d', algorithm: ALG, issuer: ISS, audience: AUD });
}

export function verifyAccess(token: string): AccessPayload {
  try {
    // الزام الگوریتم و iss/aud — توکن دستکاری‌شده رد می‌شود
    return jwt.verify(token, accessSecret(), { algorithms: [ALG], issuer: ISS, audience: AUD }) as AccessPayload;
  } catch { throw Err.unauthorized(); }
}

export function verifyRefresh(token: string): RefreshPayload {
  try {
    const decoded = jwt.verify(token, refreshSecret(), { algorithms: [ALG], issuer: ISS, audience: AUD }) as any;
    // سازگاری با توکن قدیمی که فقط { sub, jti } داشت (بدون kind) → customer در نظر بگیر.
    if (!decoded.kind) return { sub: decoded.sub, jti: decoded.jti, kind: 'customer' };
    return decoded as RefreshPayload;
  } catch { throw Err.unauthorized(); }
}

/**
 * access payload متناظر با یک refresh payload را می‌سازد (همان kind/tenant/role).
 * در مسیر refresh استفاده می‌شود تا توکن هم‌نوع صادر شود.
 */
export function accessFromRefresh(r: RefreshPayload): AccessPayload {
  return r.kind === 'staff'
    ? { sub: r.sub, kind: 'staff', tenantId: r.tenantId, role: r.role }
    : { sub: r.sub, kind: 'customer' };
}
/** از هدر Authorization: Bearer ... */
export function authFromRequest(req: Request): AccessPayload {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) throw Err.unauthorized();
  return verifyAccess(h.slice(7));
}
