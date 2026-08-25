import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  بدونِ ترانسپورتِ پیامک، ورود باید **صریح** شکست بخورد — نه بی‌صدا
//
//  ⚠️ خطرناک‌ترین حالتِ سکوت در کلِ سیستم (یافته‌ی ۲۰۲۶-۰۸-۲۵):
//  اگر `KAVENEGAR_API_KEY` تنظیم نباشد، `sendSmsNow` بی‌صدا برمی‌گشت و
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

const ORIG_ENV = process.env.NODE_ENV;
const ORIG_KEY = process.env.KAVENEGAR_API_KEY;
const ORIG_DEV = process.env.OTP_DEV_MODE;

const made: string[] = [];
async function freshPhone() {
  const p = fixturePhone('0930');
  made.push(p);
  return p;
}

beforeEach(async () => {
  // سطلِ ریت‌لیمیت را پاک کن تا تست‌ها همدیگر را نشکنند
  for (const pat of ['*otp*', '*rl:*']) {
    const k = await redis.keys(pat);
    if (k.length) await redis.del(...k);
  }
});

after(async () => {
  process.env.NODE_ENV = ORIG_ENV;
  if (ORIG_KEY === undefined) delete process.env.KAVENEGAR_API_KEY;
  else process.env.KAVENEGAR_API_KEY = ORIG_KEY;
  if (ORIG_DEV === undefined) delete process.env.OTP_DEV_MODE;
  else process.env.OTP_DEV_MODE = ORIG_DEV;
  for (const p of made) {
    await db.otpCode.deleteMany({ where: { phone: { contains: p.slice(1) } } }).catch(() => {});
  }
});

describe('ترانسپورتِ پیامک — fail-closed در تولید', () => {

  test('⚠️ در production بدونِ KAVENEGAR_API_KEY، درخواستِ OTP صریحاً شکست می‌خورد', async () => {
    // بدونِ این گارد، این فراخوان بی‌صدا موفق می‌شد و کاربر برای همیشه
    // منتظرِ پیامکی می‌ماند که هرگز فرستاده نشده.
    process.env.NODE_ENV = 'production';
    delete process.env.KAVENEGAR_API_KEY;
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
  });

  test('کنترلِ منفی: با کلیدِ تنظیم‌شده، درخواستِ OTP کار می‌کند', async () => {
    // بدونِ این، «همیشه ۵۰۳ بده» هم سبز می‌شد و ورود کاملاً می‌مرد.
    process.env.NODE_ENV = 'production';
    process.env.KAVENEGAR_API_KEY = 'test-key-not-real';
    delete process.env.OTP_DEV_MODE;
    const out = await requestOtp(await freshPhone());
    assert.deepEqual(out, {}, 'در production نباید کد را برگرداند، ولی باید موفق شود');
  });

  test('کنترلِ منفی: در توسعه بدونِ کلید همچنان کار می‌کند', async () => {
    // محیطِ توسعه/CI نباید به کلیدِ واقعیِ کاوه‌نگار نیاز داشته باشد.
    process.env.NODE_ENV = 'test';
    delete process.env.KAVENEGAR_API_KEY;
    process.env.OTP_DEV_MODE = 'true';
    const out = await requestOtp(await freshPhone());
    assert.ok(out.devCode, 'در حالتِ dev کد باید برگردد تا تست بدونِ پیامک کار کند');
  });

  test('smsTransportReady وضعیتِ واقعیِ کلید را می‌گوید', () => {
    delete process.env.KAVENEGAR_API_KEY;
    assert.equal(smsTransportReady(), false);
    process.env.KAVENEGAR_API_KEY = 'x';
    assert.equal(smsTransportReady(), true);
    delete process.env.KAVENEGAR_API_KEY;
  });
});
