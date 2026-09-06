import { TOTP, Secret } from 'otpauth';
import { redis } from './redis';
import { createLogger } from './logger';

const log = createLogger('admin-totp');

// ═══════════════════════════════════════════════════════════════════════
//  عاملِ سومِ ورودِ مدیرِ پلتفرم — TOTP (RFC 6238)
//
//  ⚠️ این «ورود با گوگل» نیست. TOTP کاملاً **آفلاین** است: یک رازِ مشترک و
//  ساعتِ سیستم. هیچ درخواستی به `accounts.google.com` نمی‌رود و اپلیکیشنِ
//  احرازِ هویت (Google Authenticator، Aegis، …) فقط همان راز را نگه می‌دارد.
//  دلیلِ صریحِ این انتخاب: وابستگی به OAuthِ بیرونی یعنی روزی که آن سرویس در
//  دسترس نباشد، از پنلِ خودمان قفل بیرون می‌مانیم.
//
//  ── چرا این‌جا و نه داخلِ route ──
//  اعتبارنامه (نامِ کاربری و رمز) از **دیتابیس** می‌آید ولی راز فعلاً از
//  **env**. پس باید صریح باشد که راز مالِ کیست. امروز این با یک جفتِ
//  `ADMIN_TOTP_USERNAME` / `ADMIN_TOTP_SECRET` بسته می‌شود.
//
//  ⚠️ وقتی چند ادمین شد، این به یک ستونِ `totp_secret` رویِ `staff` مهاجرت
//  می‌کند. برایِ اینکه آن روز بازنویسی لازم نشود، **تنها نقطه‌ای که راز را
//  پیدا می‌کند** تابعِ `secretFor(username)` است. آن روز فقط بدنه‌ی همین یک
//  تابع عوض می‌شود (خواندن از `staff` به‌جای env) و بقیه‌ی این فایل و کلِ
//  route دست‌نخورده می‌ماند. هیچ مهاجرتی امروز زده نشده.
// ═══════════════════════════════════════════════════════════════════════

/** گامِ زمانیِ استاندارد؛ کدها هر ۳۰ ثانیه عوض می‌شوند. */
const PERIOD_SECONDS = 30;
const DIGITS = 6;
const ALGORITHM = 'SHA1';

/**
 * پنجره‌ی پذیرش: **حداکثر ±۱ گام**.
 *
 * یعنی کدِ گامِ فعلی به‌علاوه‌ی یک گام قبل و یک گام بعد — جمعاً ۹۰ ثانیه.
 * بیشتر از این، فقط فرصتِ حدس‌زدن را زیاد می‌کند بدونِ اینکه مشکلِ واقعیِ
 * اختلافِ ساعت را بهتر حل کند.
 */
const WINDOW_STEPS = 1;

/** برچسبِ نمایشی در اپلیکیشنِ احرازِ هویت. */
export const TOTP_ISSUER = 'Rezervno';

export type TotpOutcome =
  | 'ok'
  | 'disabled'        // ADMIN_LOGIN_ENABLED روشن نیست
  | 'not_configured'  // روشن است ولی راز ست نشده  → fail-closed
  | 'wrong_user'      // نامِ کاربری با صاحبِ راز یکی نیست
  | 'invalid'         // کد غلط یا خارج از پنجره
  | 'replayed';       // همین کد قبلاً در همین پنجره مصرف شده

/** آیا ورودِ سه‌عاملی اصلاً روشن است؟ پیش‌فرض: **خاموش**. */
export function adminLoginEnabled(): boolean {
  return process.env.ADMIN_LOGIN_ENABLED === 'true';
}

/**
 * تنها نقطه‌ی یافتنِ راز — نقطه‌ی مهاجرتِ آینده (رجوع به هدر).
 *
 * `null` یعنی «برایِ این نامِ کاربری رازی نداریم»، که با
 * «اصلاً پیکربندی نشده» فرق دارد و صداکننده این دو را جدا گزارش می‌کند.
 */
function secretFor(username: string): { secret: string } | null | 'unconfigured' {
  const owner = process.env.ADMIN_TOTP_USERNAME?.trim().toLowerCase();
  const secret = process.env.ADMIN_TOTP_SECRET?.trim();
  // fail-closed: روشن‌بودنِ قابلیت بدونِ راز نباید بی‌صدا به دو عاملی برگردد.
  if (!owner || !secret) return 'unconfigured';
  if (owner !== username.trim().toLowerCase()) return null;
  return { secret };
}

function totpFor(secret: string): TOTP {
  return new TOTP({
    issuer: TOTP_ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD_SECONDS,
    secret: Secret.fromBase32(secret),
  });
}

/**
 * کلیدِ ضدِ replay. شماره‌ی گامی که کد در آن معتبر بوده در کلید می‌آید، پس
 * هر کد فقط تا **پایانِ پنجره‌ی خودش** مسدود می‌ماند، نه بیشتر.
 */
function replayKey(username: string, step: number): string {
  return `admin:totp:used:${username.trim().toLowerCase()}:${step}`;
}

/**
 * اعتبارسنجیِ کدِ TOTP به‌همراهِ ضدِ replay.
 *
 * ⚠️ مقایسه‌ی خودِ کد constant-time است: `otpauth` داخلی از `validate` استفاده
 * می‌کند که رشته‌ها را با طولِ ثابت می‌سنجد و به‌جای «برابر است؟» فاصله‌ی
 * گام (`delta`) را برمی‌گرداند.
 *
 * ⚠️ هیچ‌وقت `throw` نمی‌کند: تفاوتِ استثنا و مقدارِ بازگشتی از بیرون
 * قابلِ‌مشاهده است (۵۰۰ در برابرِ ۴۰۱) و به مهاجم می‌گوید کدام حساب راز دارد.
 * همان قاعده‌ای که `verifyPassword` در `password.ts:77` رعایت می‌کند.
 */
export async function verifyAdminTotp(username: string, token: string): Promise<TotpOutcome> {
  if (!adminLoginEnabled()) return 'disabled';

  const found = secretFor(username);
  if (found === 'unconfigured') {
    log.error('ADMIN_LOGIN_ENABLED روشن است ولی ADMIN_TOTP_USERNAME/SECRET ست نشده — ورودِ مدیر بسته ماند');
    return 'not_configured';
  }
  if (found === null) return 'wrong_user';

  let delta: number | null;
  try {
    delta = totpFor(found.secret).validate({ token, window: WINDOW_STEPS });
  } catch {
    // رازِ base32ِ خراب — پیکربندیِ غلط نباید بی‌صدا بماند و نباید هم اجازه بدهد.
    log.error('ADMIN_TOTP_SECRET یک رشته‌ی base32ِ معتبر نیست — ورودِ مدیر بسته ماند');
    return 'not_configured';
  }
  if (delta === null) return 'invalid';

  // ── ضدِ replay ──
  // گامی که کد در آن معتبر بوده = گامِ فعلی + فاصله‌ای که validate گزارش کرد.
  const step = Math.floor(Date.now() / 1000 / PERIOD_SECONDS) + delta;
  const key = replayKey(username, step);
  // TTL = تا پایانِ پنجره‌ی پذیرشِ همین کد (نه بیشتر، تا کلیدها انباشته نشوند).
  const ttl = PERIOD_SECONDS * (WINDOW_STEPS + 1);

  // `set` با NX: اگر کلید از قبل باشد یعنی همین کد قبلاً مصرف شده.
  const first = await redis.set(key, '1', 'EX', ttl, 'NX');
  if (first !== 'OK') return 'replayed';

  return 'ok';
}

/** URIِ استانداردِ ثبت در اپلیکیشنِ احرازِ هویت (برایِ اسکریپتِ tools/). */
export function otpauthUri(username: string, secretBase32: string): string {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label: username,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD_SECONDS,
    secret: Secret.fromBase32(secretBase32),
  }).toString();
}
