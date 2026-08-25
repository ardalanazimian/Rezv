import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { db } from './db';
import { enforceRateLimit, RULES } from './ratelimit';
import { Err } from './errors';
import { enqueueSms, smsTransportReady } from './sms';

const hash = (s: string) => createHash('sha256').update(s + process.env.JWT_SECRET).digest('hex');

// مقایسه‌ی constant-time دو hash هم‌طول (ASVS V2.9 / CWE-208).
// هرچند ورودی قبل از مقایسه hash می‌شود (پس نشت زمانی مستقیم plaintext را لو نمی‌دهد)،
// مقایسه‌ی امن یک لایه‌ی دفاعی استاندارد است و هزینه‌ای ندارد.
function hashEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (/^09\d{9}$/.test(d)) return '+98' + d.slice(1);
  if (/^989\d{9}$/.test(d)) return '+' + d;
  if (/^\+989\d{9}$/.test(raw)) return raw;
  throw Err.validation('شماره موبایل معتبر نیست (مثال: 09123456789)');
}

export async function requestOtp(rawPhone: string): Promise<{ devCode?: string }> {
  const phone = normalizePhone(rawPhone);
  // سقفِ per-phone — حالا از همان `RULES` مشترک، نه پیاده‌سازیِ دستیِ دوم.
  // ⚠️ تا امروز اینجا یک incr/expireِ دست‌ساز بود که **دقیقاً** همان قاعده‌ی
  // `RULES.otpPerPhone` (۳ در ۱۰ دقیقه) را تکرار می‌کرد. دو پیاده‌سازیِ موازی
  // برای یک قاعده یعنی هر تغییرِ آینده باید در دو جا انجام شود — و یکی‌شان
  // فراموش می‌شود. ضمناً نسخه‌ی دستی از `rateLimitWithFallback` رد نمی‌شد،
  // پس با Redisِ خاموش بی‌صدا **باز** می‌شد (fail-open) در حالی که مسیرِ
  // مشترک fallbackِ حافظه‌ای دارد.
  await enforceRateLimit(phone, RULES.otpPerPhone);

  const code = String(randomInt(100000, 1000000)); // ۶ رقمی (۹۰۰هزار فضا — مقاوم‌تر در برابر brute-force)
  await db.otpCode.upsert({
    where: { phone },
    create: { phone, codeHash: hash(code), expiresAt: new Date(Date.now() + 2 * 60_000) },
    update: { codeHash: hash(code), expiresAt: new Date(Date.now() + 2 * 60_000), attempts: 0 },
  });
  // حالت dev: کد روی صفحه برمی‌گردد، پس نیازی به پیامک (و کاوه‌نگار) نیست.
  // این باعث می‌شود لاگین بدون هیچ وابستگی خارجی کار کند — برای تست قبل از راه‌اندازی SMS.
  // production حتماً پیامک می‌فرستد و کد را برنمی‌گرداند.
  // ⚠️ گاردِ fail-closed (یافته‌ی ۲۰۲۶-۰۸-۲۵): اگر ترانسپورتِ پیامک آماده
  // نباشد، **قبل از** ادعای موفقیت شکست بخور. بدونِ این، مسیر ۲۰۴ِ موفق
  // برمی‌گرداند در حالی که هیچ پیامکی نرفته و — چون OTP_DEV_MODE در
  // production استثنا می‌دهد — هیچ راهِ دیگری هم برای گرفتنِ کد نیست.
  // نتیجه: کلِ محصول غیرقابلِ‌استفاده، بدونِ هیچ خطای قابلِ‌مشاهده‌ای.
  // همان الگویِ ALLOWED_ORIGINS در middleware: بسته، نه بازِ خاموش.
  if (process.env.NODE_ENV === 'production' && !smsTransportReady()) {
    throw Err.serviceUnavailable('ارسال پیامک موقتاً در دسترس نیست؛ کمی بعد دوباره تلاش کنید');
  }

  const devMode = process.env.OTP_DEV_MODE === 'true';
  // ⚠️ فیکسِ حسابرسیِ ۲۰۲۶-۰۷-۱۹ (FINAL-PRODUCTION-AUDIT.md بخشِ ۳): قبلاً اینجا فقط
  // console.warn بود و چیزی جلوی OTP_DEV_MODE=true در production را نمی‌گرفت — یعنی
  // endpoint وریفای کدِ OTP را مستقیم در پاسخِ API برمی‌گرداند (auth bypass کامل).
  // حالا fail-fast: اگر این ترکیبِ خطرناک رخ دهد، پردازش OTP اصلاً متوقف می‌شود.
  if (devMode && process.env.NODE_ENV === 'production') {
    throw new Error('[SECURITY] OTP_DEV_MODE=true در production مجاز نیست. جلوگیری از bypass احراز هویت.');
  }
  if (devMode) {
    // هشدار بلند: حالت تست فعال است. این هرگز نباید در محیط واقعی روشن بماند.
    console.warn('[امنیت] OTP_DEV_MODE فعال است — کد روی صفحه برمی‌گردد و پیامک ارسال نمی‌شود. فقط برای تست!');
  } else {
    await enqueueSms({ to: phone, template: 'otp', tokens: [code] });
  }
  return devMode ? { devCode: code } : {};
}

export async function verifyOtp(rawPhone: string, code: string): Promise<string /* userId */> {
  const phone = normalizePhone(rawPhone);
  const rec = await db.otpCode.findUnique({ where: { phone } });
  if (!rec || rec.expiresAt < new Date() || rec.attempts >= 5) throw Err.otpInvalid();
  if (!hashEquals(rec.codeHash, hash(code))) {
    await db.otpCode.update({ where: { phone }, data: { attempts: { increment: 1 } } });
    throw Err.otpInvalid();
  }
  await db.otpCode.delete({ where: { phone } });
  const user = await db.user.upsert({ where: { phone }, create: { phone }, update: {} });
  return user.id;
}
