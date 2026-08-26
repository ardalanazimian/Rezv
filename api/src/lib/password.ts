import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer, salt: string | Buffer, keylen: number, opts?: { N?: number; r?: number; p?: number; maxmem?: number },
) => Promise<Buffer>;

// ═══════════════════════════════════════════════════════════════════════
//  هشِ رمزِ عبور — scryptِ داخلیِ Node، بدونِ وابستگیِ تازه
//
//  ⚠️ چرا scrypt و **نه** الگویِ hash موجودِ همین مخزن: `lib/otp.ts` برای کدِ
//  یک‌بارمصرف از `sha256(code + JWT_SECRET)` استفاده می‌کند و آنجا درست است
//  — کد دو دقیقه عمر دارد و ۵ تلاش بیشتر نمی‌گیرد. رمزِ عبور برعکس است:
//  ماه‌ها زنده می‌ماند و اگر دیتابیس نشت کند مهاجم زمانِ نامحدود دارد. یک
//  sha256 روی GPU میلیاردها حدس در ثانیه می‌دهد؛ scrypt عمداً کند و
//  حافظه‌بر است. **هرگز** رمز را با تابعِ hash‌ِ otp.ts نگه ندار.
//
//  چرا scrypt و نه bcrypt/argon2: هر دو وابستگیِ نیتیو می‌خواهند. scrypt در
//  خودِ Node هست (`crypto.scrypt`)، استانداردِ RFC 7914 است، و برای این
//  کاربرد کاملاً کافی. یک وابستگیِ کمتر یعنی یک سطحِ حمله‌ی زنجیره‌ی تأمینِ
//  کمتر.
//
//  پارامترها: N=2^15 (۳۲۷۶۸)، r=8، p=1 ⇒ حدودِ ۳۲MB حافظه به‌ازای هر
//  محاسبه. `maxmem` صریح ست شده چون پیش‌فرضِ Node (۳۲MB) دقیقاً روی مرز
//  است و بدونِ آن گاهی `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` می‌دهد.
//
//  قالبِ ذخیره — همه‌چیز در یک رشته، تا چرخشِ پارامترها بعداً ممکن باشد
//  بدونِ مهاجرتِ دیتابیس:
//      scrypt$N$r$p$<salt-base64>$<hash-base64>
//  `verifyPassword` پارامترها را از خودِ رشته می‌خواند، نه از ثابت‌های
//  بالا — پس رمزهای قدیمی بعد از سخت‌ترکردنِ پارامترها همچنان کار می‌کنند.
// ═══════════════════════════════════════════════════════════════════════

const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;
const MAXMEM = 64 * 1024 * 1024;

/** حداقلِ طولِ رمز. کوتاه‌تر از این پذیرفته نمی‌شود. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * چرا سقفِ طول: scrypt روی ورودیِ بلند هم کار می‌کند ولی یک رمزِ چندمگابایتی
 * یک DoSِ ارزان است (هر تلاشِ ورود CPU می‌سوزاند). ۱۲۸ کاراکتر برای هر
 * عبارتِ عبورِ واقعی بیش از کافی است.
 */
export function passwordPolicyError(plain: string): string | null {
  if (typeof plain !== 'string' || plain.length < MIN_PASSWORD_LENGTH) {
    return `رمز باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`;
  }
  if (plain.length > MAX_PASSWORD_LENGTH) {
    return `رمز نباید بیشتر از ${MAX_PASSWORD_LENGTH} کاراکتر باشد`;
  }
  return null;
}

/** رمزِ خام را به رشته‌ی قابلِ‌ذخیره تبدیل می‌کند. */
export async function hashPassword(plain: string): Promise<string> {
  const err = passwordPolicyError(plain);
  if (err) throw new Error(err);
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(plain, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * مقایسه‌ی رمزِ خام با رشته‌ی ذخیره‌شده.
 *
 * ⚠️ همیشه `false` برمی‌گرداند و **هرگز پرتاب نمی‌کند** — حتی روی رشته‌ی
 * خراب. دلیلش این است که این تابع روی مسیرِ ورود است: تفاوتِ «استثنا» و
 * «false» از بیرون قابلِ‌مشاهده است (۵۰۰ در برابر ۴۰۱) و به مهاجم می‌گوید
 * کدام حساب رمزِ ذخیره‌شده‌ی معیوب دارد.
 */
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || typeof plain !== 'string' || plain.length === 0) return false;
  if (plain.length > MAX_PASSWORD_LENGTH) return false;
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const n = Number(parts[1]); const r = Number(parts[2]); const p = Number(parts[3]);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    // سقفِ ایمنی: پارامترِ دست‌کاری‌شده نباید بتواند سرور را با یک محاسبه‌ی
    // غول‌پیکر از پا دربیاورد.
    if (n > 1 << 20 || r > 32 || p > 16) return false;
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = await scrypt(plain, salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
    // هم‌طول‌اند (طول از خودِ `expected` گرفته شد) پس مقایسه‌ی constant-time امن است.
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ── نامِ کاربری ──
// ⚠️ **همیشه** با این تابع نرمال کن، هم موقعِ نوشتن و هم موقعِ خواندن.
// ستونِ DB یکتاست؛ اگر یک مسیر نرمال کند و مسیرِ دیگر نه، `Ardalan` و
// `ardalan` دو حسابِ متفاوت می‌شوند و قیدِ یکتایی هیچ‌کدام را نمی‌گیرد.
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/;

export function normalizeUsername(raw: string): string {
  return String(raw ?? '').trim().toLowerCase();
}

export function usernamePolicyError(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (!USERNAME_RE.test(u)) {
    return 'نام کاربری باید ۳ تا ۳۲ کاراکتر و فقط شاملِ حروفِ انگلیسی، رقم، نقطه، خط تیره و زیرخط باشد (شروع و پایان با حرف یا رقم)';
  }
  return null;
}
