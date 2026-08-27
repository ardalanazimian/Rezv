import { test, describe, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';
// [پورتِ ادغام ۲۰۲۶-۰۸-۲۶] ارائه‌دهنده به ملی‌پیامک مهاجرت کرد؛ «کلیدِ ترانسپورت» حالا سه متغیر است.
const MELI_KEYS = ['MELIPAYAMAK_USERNAME','MELIPAYAMAK_PASSWORD','MELIPAYAMAK_BODYID_OTP','MELIPAYAMAK_BODYID_CAMPAIGN'];
const setSmsTransport = (on) => { for (const k of MELI_KEYS) { if (on) process.env[k] = k.endsWith('OTP') ? '12345' : 'x'; else delete process.env[k]; } };

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
//
//  ⚠️ چرا هر تست شماره‌ی **تازه** می‌گیرد (باگِ واقعیِ خودِ این فایل، با
//  اجرا اثبات شد نه با حدس): `RULES.otpPerPhone` سقفِ ۳ درخواست در ۱۰
//  دقیقه روی **هر شماره** دارد. نسخه‌ی اولِ این فایل دو ثابتِ سراسری داشت و
//  ۸ بار `requestOtp` را روی همان یک شماره صدا می‌زد — از چهارمی به بعد
//  ۴۲۹ می‌گرفت و ۵ تست از ۱۰ قرمز بود. راهِ حلِ درست پاک‌کردنِ کلیدهای
//  Redis نیست (آن کار سطلِ فایل‌های دیگرِ همین رانر را هم خالی می‌کند و
//  ریت‌لیمیت را از تستِ آن‌ها پنهان می‌کند)، بلکه شماره‌ی تازه است: سطلِ
//  تازه، بدونِ دست‌زدن به وضعیتِ مشترک.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { requestOtp, verifyOtp, normalizePhone } = await import('../src/lib/otp');
const { metrics } = await import('../src/lib/metrics');

const CODE = '482913';   // ۶ رقمی — کدِ کوتاه‌تر عمداً پذیرفته نمی‌شود

/** شماره‌ی تازه برای هر تست + ثبت برای پاک‌سازیِ پایانی. */
const issued = new Set<string>();
function newPhone(prefix: string): string {
  const p = fixturePhone(prefix);
  issued.add(p);
  return p;
}

const ENV = ['BREAK_GLASS_PHONE', 'BREAK_GLASS_CODE', 'NODE_ENV', ...MELI_KEYS] as const;
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

// ⚠️ hookها عمداً **داخلِ** هر describe نصب می‌شوند، نه در سطحِ فایل: در
// `node:test` یک hookِ سطحِ‌فایل به سوئیتِ ROOT می‌چسبد و در رانرِ مشترک برای
// **همه‌ی** تست‌های همه‌ی فایل‌ها اجرا می‌شود. (این دقیقاً یک‌بار در همین
// مخزن ۲۹ تستِ بی‌ربط را قرمز کرد.)
function hooks() {
  beforeEach(() => { saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]])); });
  afterEach(() => {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
  });
}

after(async () => {
  for (const p of issued) {
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
    const bg = newPhone('0922');
    process.env.BREAK_GLASS_PHONE = bg;
    process.env.BREAK_GLASS_CODE = CODE;
    process.env.NODE_ENV = 'production';
    setSmsTransport(false);

    const before = counterTotal('breakGlassOtp');
    const res = await requestOtp(bg);

    assert.deepEqual(res, {}, 'کد نباید در پاسخِ API برگردد — صاحبِ شماره خودش می‌داندش');
    assert.equal(counterTotal('breakGlassOtp'), before + 1, 'هر استفاده باید شمرده شود');

    const userId = await verifyOtp(bg, CODE);
    assert.ok(userId, 'کدِ ثابت باید پذیرفته شود');
  });

  test('🔴 کدِ اشتباه روی همین شماره هم رد می‌شود', async () => {
    // یعنی «شماره‌ی اضطراری» به معنیِ «هر کدی قبول است» نیست.
    const bg = newPhone('0922');
    process.env.BREAK_GLASS_PHONE = bg;
    process.env.BREAK_GLASS_CODE = CODE;
    await requestOtp(bg);
    await assert.rejects(() => verifyOtp(bg, '999999'));
  });

  test('⚠️ شمارشِ تلاشِ ناموفق دور زده نمی‌شود', async () => {
    // پنج تلاشِ غلط باید کد را بسوزاند، حتی برای شماره‌ی اضطراری.
    const bg = newPhone('0922');
    process.env.BREAK_GLASS_PHONE = bg;
    process.env.BREAK_GLASS_CODE = CODE;
    await requestOtp(bg);
    for (let i = 0; i < 5; i++) await assert.rejects(() => verifyOtp(bg, '000000'));
    await assert.rejects(() => verifyOtp(bg, CODE), 'بعد از ۵ تلاش حتی کدِ درست هم نباید کار کند');
  });

  test('⚠️ ریت‌لیمیتِ per-phone برای شماره‌ی اضطراری هم دور زده نمی‌شود', async () => {
    // گاردِ «فقط تحویلِ کد را دور می‌زند، نه محدودیت‌ها را» — با عدد:
    // `RULES.otpPerPhone` سقفِ ۳ در ۱۰ دقیقه است، پس چهارمی باید ۴۲۹ بگیرد.
    const bg = newPhone('0922');
    process.env.BREAK_GLASS_PHONE = bg;
    process.env.BREAK_GLASS_CODE = CODE;
    setSmsTransport(true);
    for (let i = 0; i < 3; i++) await requestOtp(bg);
    await assert.rejects(() => requestOtp(bg), /RATE_LIMITED|بیش از حد/,
      'درخواستِ چهارم روی همان شماره باید ریت‌لیمیت شود');
  });
});

describe('🔴 گاردها — چیزهایی که نباید کار کنند', () => {
  hooks();

  test('بدونِ هیچ متغیرِ محیطی، قابلیت اصلاً وجود ندارد', async () => {
    // کنترلِ پایه: در حالتِ پیش‌فرضِ مخزن، هیچ شماره‌ای کدِ ثابت نمی‌گیرد.
    const bg = newPhone('0922');
    delete process.env.BREAK_GLASS_PHONE;
    delete process.env.BREAK_GLASS_CODE;
    setSmsTransport(true);
    await requestOtp(bg);
    await assert.rejects(() => verifyOtp(bg, CODE), 'کدِ ثابت نباید کار کند');
  });

  test('با فقط **یکی** از دو متغیر، فعال نمی‌شود', async () => {
    // ⚠️ مهم: نیمه‌پیکربندی نباید نیمه‌فعال شود. یک `BREAK_GLASS_PHONE`ِ
    // جامانده در env نباید به‌تنهایی چیزی را باز کند.
    const a = newPhone('0922');
    process.env.BREAK_GLASS_PHONE = a;
    delete process.env.BREAK_GLASS_CODE;
    setSmsTransport(true);
    await requestOtp(a);
    await assert.rejects(() => verifyOtp(a, CODE));

    const b = newPhone('0922');
    delete process.env.BREAK_GLASS_PHONE;
    process.env.BREAK_GLASS_CODE = CODE;
    await requestOtp(b);
    await assert.rejects(() => verifyOtp(b, CODE));
  });

  test('🔴 روی هیچ شماره‌ی دیگری اثر ندارد', async () => {
    // مهم‌ترین گارد: یک شماره باز می‌شود، نه یک کدِ سراسری.
    const bg = newPhone('0922');
    const other = newPhone('0923');
    process.env.BREAK_GLASS_PHONE = bg;
    process.env.BREAK_GLASS_CODE = CODE;
    setSmsTransport(true);

    await requestOtp(other);
    await assert.rejects(() => verifyOtp(other, CODE),
      'کدِ اضطراری نباید روی شماره‌ی دیگری کار کند');
  });

  test('🔴 و برای شماره‌ی دیگر در production بدونِ کلیدِ پیامک، همچنان fail-closed است', async () => {
    // یعنی گاردِ اصلیِ «بدونِ پیامک ادعای موفقیت نکن» دست‌نخورده مانده و
    // break-glass آن را برای همه باز نکرده.
    const bg = newPhone('0922');
    const other = newPhone('0923');
    process.env.BREAK_GLASS_PHONE = bg;
    process.env.BREAK_GLASS_CODE = CODE;
    process.env.NODE_ENV = 'production';
    setSmsTransport(false);

    await assert.rejects(() => requestOtp(other), /پیامک/,
      'شماره‌ی عادی باید همچنان خطای صریح بگیرد');
  });

  test('کدِ نامعتبر در پیکربندی، قابلیت را **غیرفعال** می‌کند، نه نیمه‌فعال', async () => {
    // پیکربندیِ غلط نباید به یک حالتِ عجیبِ میانی منجر شود.
    const bg = newPhone('0922');
    process.env.BREAK_GLASS_PHONE = bg;
    process.env.BREAK_GLASS_CODE = 'abcdef';   // رقم نیست
    setSmsTransport(true);
    await requestOtp(bg);
    await assert.rejects(() => verifyOtp(bg, 'abcdef'));
  });

  test('🔴 کدِ کوتاه‌تر از ۶ رقم اصلاً پذیرفته نمی‌شود', async () => {
    // ⚠️ این گاردِ اجباری است، نه توصیه: با ۴ رقم فضای کد ۱۰٬۰۰۰ است و
    // امنیتِ واقعیِ مسیر به «مخفی‌بودنِ شماره» تنزل می‌کند. چون هزینه‌ی
    // ۶ رقمی‌کردن برای صاحبِ شماره صفر است، پیکربندیِ ضعیف **رد** می‌شود
    // نه اینکه با هشدار قبول شود.
    const bg = newPhone('0922');
    process.env.BREAK_GLASS_PHONE = bg;
    process.env.BREAK_GLASS_CODE = '1234';
    setSmsTransport(true);
    await requestOtp(bg);
    await assert.rejects(() => verifyOtp(bg, '1234'),
      'کدِ ۴ رقمی نباید کار کند — قابلیت باید کاملاً غیرفعال بماند');
  });

  test('🔴 کدِ بلندتر از ۶ رقم هم پذیرفته نمی‌شود', async () => {
    // چکِ «دقیقاً ۶» است نه «حداقل ۶» — تا پیکربندی یکتا و قابلِ‌بازبینی بماند.
    const bg = newPhone('0922');
    process.env.BREAK_GLASS_PHONE = bg;
    process.env.BREAK_GLASS_CODE = '1234567';
    setSmsTransport(true);
    await requestOtp(bg);
    await assert.rejects(() => verifyOtp(bg, '1234567'));
  });

  test('شماره‌ی نامعتبر در پیکربندی هم قابلیت را غیرفعال می‌کند', async () => {
    const bg = newPhone('0922');
    process.env.BREAK_GLASS_PHONE = 'not-a-phone';
    process.env.BREAK_GLASS_CODE = CODE;
    setSmsTransport(true);
    await requestOtp(bg);
    await assert.rejects(() => verifyOtp(bg, CODE));
  });
});
