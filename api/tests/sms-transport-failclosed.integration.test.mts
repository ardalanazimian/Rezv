import { test, describe, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  بدونِ ترانسپورتِ پیامک، ورود باید **صریح** شکست بخورد — نه بی‌صدا
//
//  ⚠️ خطرناک‌ترین حالتِ سکوت در کلِ سیستم (یافته‌ی ۲۰۲۶-۰۸-۲۵):
//  [پورتِ ادغام ۲۰۲۶-۰۸-۲۶] این تست برای کاوه‌نگار نوشته شده بود؛ ارائه‌دهنده
//  در همین ادغام به ملی‌پیامک مهاجرت کرد (SendSMS/BaseServiceNumber، bodyId).
//  «آماده‌بودنِ ترانسپورت» حالا سه متغیر است، نه یک کلید. سمانتیکِ fail-closed
//  عیناً همان است و همین تست قفلش می‌کند.
//  اگر اعتبارنامه‌ی ملی‌پیامک تنظیم نباشد، `sendSmsNow` بی‌صدا برمی‌گشت و
//  **هیچ متریکی** نمی‌خورد. زنجیره‌ی کامل:
//    کاربر شماره می‌زند → requestOtp کد می‌سازد → enqueueSms مستقیم به
//    sendSmsNow می‌رود → کلید نیست → return → route پاسخِ **۲۰۴ موفق**
//    می‌دهد → پیامکی هرگز نمی‌آید.
//  و چون `OTP_DEV_MODE` در production استثنا می‌دهد، هیچ راهِ دیگری هم برای
//  گرفتنِ کد نیست ⇒ **هیچ‌کس نمی‌تواند وارد شود** — نه مشتری، نه
//  رستوران‌دار، نه ادمین — در حالی که API بالاست، لاگ تمیز است و هیچ
//  آلارمی نمی‌زند.
//
//  همان کلاسی که CLAUDE.md §۹ درباره‌ی ALLOWED_ORIGINS ثبت کرده:
//  «مقدارِ غلط هیچ خطایی تولید نمی‌کرد — API بالا، لاگ تمیز — ولی مرورگر هر
//  fetch را بلاک می‌کرد.» قاعده: fail-closed، نه fail-openِ خاموش.
// ═══════════════════════════════════════════════════════════════════════

const { requestOtp } = await import('../src/lib/otp');
const { smsTransportReady } = await import('../src/lib/sms');
const { fixturePhone } = await import('./_phone.helper.mts');
const { db } = await import('../src/lib/db');
const { redis } = await import('../src/lib/redis');

// ── ترانسپورتِ شبکه: قطعی، نه واقعی ──
//
// ⚠️ چرا (دو بار به ما ضربه زد): این فایل تا ۲۰۲۶-۰۸-۲۸ `fetch` را stub
// نمی‌کرد. تستِ «کنترلِ منفی» عمداً اعتبارنامه ست می‌کند، پس `sendSmsNow`
// یک درخواستِ **واقعی** به `rest.payamak-panel.com` می‌زد. نتیجه:
//   • یک‌بار با `ConnectTimeoutError` قرمز شد (ناپایداریِ ثبت‌شده‌ی دورِ پنجم)
//   • یک‌بار سوکتِ باز باعثِ کرشِ teardownِ libuv روی ویندوز شد
//     (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`) و **گاردِ
//     خطِ پایه‌ی نمونه‌گیریِ جهش را مسدود کرد** — یعنی کلِ ماژولِ sms
//     اندازه‌گیری‌نشده ماند.
//
// هیچ ادعایی ضعیف نشد: ادعاها درباره‌ی رفتارِ `requestOtp` هستند
// (۵۰۳ بدونِ پیکربندی · موفقیت با پیکربندی)، نه درباره‌ی خودِ شبکه. فقط
// منبعِ خطا قطعی شد. پاسخِ ساختگی همان قراردادِ واقعیِ ملی‌پیامک است
// (`RetStatus === 1`، رجوع به `lib/sms.ts:103`).
const REAL_FETCH = globalThis.fetch;
let smsCalls = 0;
function installSmsStub() {
  smsCalls = 0;
  globalThis.fetch = (async () => {
    smsCalls++;
    return new Response(
      JSON.stringify({ RetStatus: 1, Value: '9876543210', StrRetStatus: 'Ok' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

const ORIG_ENV = process.env.NODE_ENV;
const ORIG_U = process.env.MELIPAYAMAK_USERNAME;
const ORIG_P = process.env.MELIPAYAMAK_PASSWORD;
const ORIG_B = process.env.MELIPAYAMAK_BODYID_OTP;
const setMeli = (on) => {
  for (const [k, v] of [['MELIPAYAMAK_USERNAME','u'],['MELIPAYAMAK_PASSWORD','p'],['MELIPAYAMAK_BODYID_OTP','12345']]) {
    if (on) process.env[k] = v; else delete process.env[k];
  }
};
const ORIG_DEV = process.env.OTP_DEV_MODE;

const made: string[] = [];
async function freshPhone() {
  const p = fixturePhone('0930');
  made.push(p);
  return p;
}

// ⚠️ دامِ رانرِ تک‌پروسه‌ای: after()ِ سطحِ فایل فقط در انتهای *کلِ* سوئیت
// اجرا می‌شود، نه بینِ فایل‌ها — پس هر تستی که ترانسپورت را روشن رها کند،
// همه‌ی فایل‌های بعدی را آلوده می‌کند (دو تستِ fallback دقیقاً همین‌طور
// قرمز شدند). afterEach تضمینِ per-test است.
beforeEach(async () => {
  installSmsStub();
  // سطلِ ریت‌لیمیت را پاک کن تا تست‌ها همدیگر را نشکنند
  for (const pat of ['*otp*', '*rl:*']) {
    const k = await redis.keys(pat);
    if (k.length) await redis.del(...k);
  }
});

after(async () => {
  globalThis.fetch = REAL_FETCH;
  process.env.NODE_ENV = ORIG_ENV;
  for (const [k, v] of [['MELIPAYAMAK_USERNAME', ORIG_U],['MELIPAYAMAK_PASSWORD', ORIG_P],['MELIPAYAMAK_BODYID_OTP', ORIG_B]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  if (ORIG_DEV === undefined) delete process.env.OTP_DEV_MODE;
  else process.env.OTP_DEV_MODE = ORIG_DEV;
  for (const p of made) {
    await db.otpCode.deleteMany({ where: { phone: { contains: p.slice(1) } } }).catch(() => {});
  }
});

describe('ترانسپورتِ پیامک — fail-closed در تولید', () => {
  // scoped (نه سطحِ فایل — رجوع به دامِ رانرِ الحاقی): هیچ تستی ترانسپورت را روشن رها نکند.
  afterEach(() => { setMeli(false); });


  test('⚠️ در production بدونِ اعتبارنامه‌ی ملی‌پیامک، درخواستِ OTP صریحاً شکست می‌خورد', async () => {
    // بدونِ این گارد، این فراخوان بی‌صدا موفق می‌شد و کاربر برای همیشه
    // منتظرِ پیامکی می‌ماند که هرگز فرستاده نشده.
    process.env.NODE_ENV = 'production';
    setMeli(false);
    delete process.env.OTP_DEV_MODE;

    const phone = await freshPhone();
    await assert.rejects(
      () => requestOtp(phone),
      (e: any) => {
        assert.equal(e?.code, 'SERVICE_UNAVAILABLE',
          `باید خطای صریح بدهد، نه موفقیتِ ساختگی — گرفت: ${e?.code ?? e?.message}`);
        assert.equal(e?.status, 503, 'ناتوانیِ موقتِ سرویس است، نه خطای کلاینت');
        return true;
      },
    );
    assert.equal(smsCalls, 0,
      'وقتی ترانسپورت پیکربندی نشده، نباید هیچ درخواستی به ارائه‌دهنده برود');
  });

  test('کنترلِ منفی: با کلیدِ تنظیم‌شده، درخواستِ OTP کار می‌کند', async () => {
    // بدونِ این، «همیشه ۵۰۳ بده» هم سبز می‌شد و ورود کاملاً می‌مرد.
    process.env.NODE_ENV = 'production';
    setMeli(true);
    delete process.env.OTP_DEV_MODE;
    const out = await requestOtp(await freshPhone());
    assert.deepEqual(out, {}, 'در production نباید کد را برگرداند، ولی باید موفق شود');
    // تقویتِ ادعا (نه تضعیف): حالا که ترانسپورت قطعی است، می‌شود ثابت کرد
    // ارسال **واقعاً تلاش شد** — نه اینکه بی‌صدا رد شده باشد.
    assert.equal(smsCalls, 1, 'با پیکربندیِ کامل باید دقیقاً یک ارسال تلاش شود');
  });

  test('کنترلِ منفی: در توسعه بدونِ کلید همچنان کار می‌کند', async () => {
    // محیطِ توسعه/CI نباید به کلیدِ واقعیِ کاوه‌نگار نیاز داشته باشد.
    process.env.NODE_ENV = 'test';
    setMeli(false);
    process.env.OTP_DEV_MODE = 'true';
    const out = await requestOtp(await freshPhone());
    assert.ok(out.devCode, 'در حالتِ dev کد باید برگردد تا تست بدونِ پیامک کار کند');
  });

  test('smsTransportReady وضعیتِ واقعیِ کلید را می‌گوید', () => {
    setMeli(false);
    assert.equal(smsTransportReady(), false);
    setMeli(true);
    assert.equal(smsTransportReady(), true);
    setMeli(false);
  });
});
