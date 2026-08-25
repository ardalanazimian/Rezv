import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  ورودِ اضطراری (break-glass) — و مهم‌تر، گاردهایی که نگذارند درِ پشتی شود
//
//  ⚠️ چرا این قابلیت هست: تنها راهِ ورود به هر سه اپ OTPِ پیامکی است و
//  `OTP_DEV_MODE` در production استثنا پرتاب می‌کند. بدونِ کلیدِ کاوه‌نگار
//  **هیچ‌کس** — حتی مالکِ محصول — نمی‌تواند وارد شود.
//
//  ⚠️ و چرا بیشترِ تست‌های این فایل **منفی**اند: یک مسیرِ ورودِ ثابت، اگر
//  بدونِ گارد ساخته شود، یک درِ پشتیِ دائمی است. ارزشِ واقعیِ این فایل در
//  اثباتِ چیزهایی است که **نباید** کار کنند:
//    • بدونِ متغیرِ محیطی، اصلاً وجود نداشته باشد
//    • فقط با **هر دو** متغیر فعال شود، نه یکی
//    • روی هیچ شماره‌ی دیگری اثر نکند
//    • کدِ اشتباه را نپذیرد
//    • ریت‌لیمیت و انقضا و شمارشِ تلاش را دور نزند
//    • و **اجازه‌ی دسترسی** را دور نزند — فقط تحویلِ کد را
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { requestOtp, verifyOtp, normalizePhone } = await import('../src/lib/otp');
const { metrics } = await import('../src/lib/metrics');

const BG_PHONE = fixturePhone('0922');
const OTHER_PHONE = fixturePhone('0923');
const CODE = '1234';

const ENV = ['BREAK_GLASS_PHONE', 'BREAK_GLASS_CODE', 'NODE_ENV', 'KAVENEGAR_API_KEY'] as const;
let saved: Record<string, string | undefined> = {};

function counterTotal(name: string): number {
  const c = metrics[name as keyof typeof metrics] as { render(): string };
  let sum = 0;
  for (const l of c.render().split('\n')) {
    if (l.startsWith('#')) continue;
    const v = Number(l.trim().split(/\s+/).pop());
    if (Number.isFinite(v)) sum += v;
  }
  return sum;
}

function hooks() {
  beforeEach(async () => {
    saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
    for (const p of [BG_PHONE, OTHER_PHONE]) {
      await db.otpCode.deleteMany({ where: { phone: normalizePhone(p) } }).catch(() => {});
    }
  });
  afterEach(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
  });
}

after(async () => {
  for (const p of [BG_PHONE, OTHER_PHONE]) {
    const n = normalizePhone(p);
    await db.otpCode.deleteMany({ where: { phone: n } }).catch(() => {});
    await db.user.deleteMany({ where: { phone: n } }).catch(() => {});
  }
});

describe('ورودِ اضطراری — وقتی درست پیکربندی شده', () => {
  hooks();

  test('🔴 با هر دو متغیر، کدِ ثابت کار می‌کند و پیامکی لازم نیست', async () => {
    // این همان چیزی است که NO-GO را برای بازدیدِ پنل باز می‌کند: در
    // production بدونِ کلیدِ کاوه‌نگار، `requestOtp` معمولاً
    // `serviceUnavailable` می‌دهد. برای این یک شماره نباید بدهد.
    process.env.BREAK_GLASS_PHONE = BG_PHONE;
    process.env.BREAK_GLASS_CODE = CODE;
    process.env.NODE_ENV = 'production';
    delete process.env.KAVENEGAR_API_KEY;   // دقیقاً وضعیتِ امروز

    const before = counterTotal('breakGlassOtp');
    const res = await requestOtp(BG_PHONE);

    assert.deepEqual(res, {}, 'کد نباید در پاسخِ API برگردد — صاحبِ شماره خودش می‌داندش');
    assert.equal(counterTotal('breakGlassOtp'), before + 1, 'هر استفاده باید شمرده شود');

    const userId = await verifyOtp(BG_PHONE, CODE);
    assert.ok(userId, 'کدِ ثابت باید پذیرفته شود');
  });

  test('🔴 کدِ اشتباه روی همین شماره هم رد می‌شود', async () => {
    // یعنی «شماره‌ی اضطراری» به معنیِ «هر کدی قبول است» نیست.
    process.env.BREAK_GLASS_PHONE = BG_PHONE;
    process.env.BREAK_GLASS_CODE = CODE;
    await requestOtp(BG_PHONE);
    await assert.rejects(() => verifyOtp(BG_PHONE, '9999'));
  });

  test('⚠️ شمارشِ تلاشِ ناموفق دور زده نمی‌شود', async () => {
    // پنج تلاشِ غلط باید کد را بسوزاند، حتی برای شماره‌ی اضطراری.
    process.env.BREAK_GLASS_PHONE = BG_PHONE;
    process.env.BREAK_GLASS_CODE = CODE;
    await requestOtp(BG_PHONE);
    for (let i = 0; i < 5; i++) await assert.rejects(() => verifyOtp(BG_PHONE, '0000'));
    await assert.rejects(() => verifyOtp(BG_PHONE, CODE), 'بعد از ۵ تلاش حتی کدِ درست هم نباید کار کند');
  });
});

describe('🔴 گاردها — چیزهایی که نباید کار کنند', () => {
  hooks();

  test('بدونِ هیچ متغیرِ محیطی، قابلیت اصلاً وجود ندارد', async () => {
    // کنترلِ پایه: در حالتِ پیش‌فرضِ مخزن، هیچ شماره‌ای کدِ ثابت نمی‌گیرد.
    delete process.env.BREAK_GLASS_PHONE;
    delete process.env.BREAK_GLASS_CODE;
    process.env.KAVENEGAR_API_KEY = 'x';   // تا مسیرِ عادی throw نکند
    await requestOtp(BG_PHONE);
    await assert.rejects(() => verifyOtp(BG_PHONE, CODE), 'کدِ ثابت نباید کار کند');
  });

  test('با فقط **یکی** از دو متغیر، فعال نمی‌شود', async () => {
    // ⚠️ مهم: نیمه‌پیکربندی نباید نیمه‌فعال شود. یک `BREAK_GLASS_PHONE`ِ
    // جامانده در env نباید به‌تنهایی چیزی را باز کند.
    process.env.BREAK_GLASS_PHONE = BG_PHONE;
    delete process.env.BREAK_GLASS_CODE;
    process.env.KAVENEGAR_API_KEY = 'x';
    await requestOtp(BG_PHONE);
    await assert.rejects(() => verifyOtp(BG_PHONE, CODE));

    delete process.env.BREAK_GLASS_PHONE;
    process.env.BREAK_GLASS_CODE = CODE;
    await db.otpCode.deleteMany({ where: { phone: normalizePhone(BG_PHONE) } });
    await requestOtp(BG_PHONE);
    await assert.rejects(() => verifyOtp(BG_PHONE, CODE));
  });

  test('🔴 روی هیچ شماره‌ی دیگری اثر ندارد', async () => {
    // مهم‌ترین گارد: یک شماره باز می‌شود، نه یک کدِ سراسری.
    process.env.BREAK_GLASS_PHONE = BG_PHONE;
    process.env.BREAK_GLASS_CODE = CODE;
    process.env.KAVENEGAR_API_KEY = 'x';

    await requestOtp(OTHER_PHONE);
    await assert.rejects(() => verifyOtp(OTHER_PHONE, CODE),
      'کدِ اضطراری نباید روی شماره‌ی دیگری کار کند');
  });

  test('🔴 و برای شماره‌ی دیگر در production بدونِ کلیدِ پیامک، همچنان fail-closed است', async () => {
    // یعنی گاردِ اصلیِ «بدونِ پیامک ادعای موفقیت نکن» دست‌نخورده مانده و
    // break-glass آن را برای همه باز نکرده.
    process.env.BREAK_GLASS_PHONE = BG_PHONE;
    process.env.BREAK_GLASS_CODE = CODE;
    process.env.NODE_ENV = 'production';
    delete process.env.KAVENEGAR_API_KEY;

    await assert.rejects(() => requestOtp(OTHER_PHONE), /پیامک/,
      'شماره‌ی عادی باید همچنان خطای صریح بگیرد');
  });

  test('کدِ نامعتبر در پیکربندی، قابلیت را **غیرفعال** می‌کند، نه نیمه‌فعال', async () => {
    // پیکربندیِ غلط نباید به یک حالتِ عجیبِ میانی منجر شود.
    process.env.BREAK_GLASS_PHONE = BG_PHONE;
    process.env.BREAK_GLASS_CODE = 'abcd';   // رقم نیست
    process.env.KAVENEGAR_API_KEY = 'x';
    await requestOtp(BG_PHONE);
    await assert.rejects(() => verifyOtp(BG_PHONE, 'abcd'));
  });

  test('شماره‌ی نامعتبر در پیکربندی هم قابلیت را غیرفعال می‌کند', async () => {
    process.env.BREAK_GLASS_PHONE = 'not-a-phone';
    process.env.BREAK_GLASS_CODE = CODE;
    process.env.KAVENEGAR_API_KEY = 'x';
    await requestOtp(BG_PHONE);
    await assert.rejects(() => verifyOtp(BG_PHONE, CODE));
  });
});
