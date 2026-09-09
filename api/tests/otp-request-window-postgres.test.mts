import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ E-003 — سقفِ درخواستِ OTP در Postgres است، نه Redis
//
//  تصمیمِ مالک ۲۰۲۶-۰۹-۰۹ (گزینه‌ی «د»): به‌جای انتخابِ تبادلِ «امنیت یا در
//  دسترس‌بودن هنگام قطعیِ Redis»، خودِ وابستگی حذف شد.
//
//  زمینه‌ای که این تست بدونِ آن بی‌معنی است:
//  سقفِ قبلی در Redis بود و یک خطای **گذرا** آن را از صفر شروع می‌کرد، چون
//  `rateLimitWithFallback` به `rateLimitInMemory` می‌افتد و آن نقشه‌ی جداگانه
//  دارد. مسیرِ کشفش سه نشست برد و از برچسبِ «flake» شروع شد.
//
//  ⚠️ و شدتش ابتدا **بیش از شواهد** گزارش شد — توسطِ خودِ CEO — و در همان روز
//  تصحیح شد. تفکیکِ درست، که این تست هم بر همان استوار است:
//
//      requestOtp  → «چند بار کد بگیری»  ← این سقف. قبلاً Redis، حالا Postgres
//      verifyOtp   → «چند بار حدس بزنی»  ← `attempts >= 5`، همیشه Postgres بوده
//
//  یعنی ریستِ Redis پنجره‌ی حدسِ کد باز نمی‌کرد؛ اجازه‌ی **گرفتنِ کدِ بیشتر**
//  می‌داد، که هزینه‌ی پیامک است. این تست همان چیزِ درست را گارد می‌کند، نه
//  ادعای بزرگ‌ترِ اولیه را.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { enforceOtpRequestWindow, normalizePhone } = await import('../src/lib/otp.ts');
const { RULES } = await import('../src/lib/ratelimit.ts');
const { readFileSync } = await import('node:fs');

const phones: string[] = [];
function freshPhone(): string {
  // ۹ رقم بعد از 09 — فضای کافی که اجراهای هم‌زمان به هم نخورند.
  const p = normalizePhone('09' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0'));
  phones.push(p);
  return p;
}

after(async () => {
  for (const p of phones) {
    await db.$executeRaw`DELETE FROM otp_request_windows WHERE phone = ${p}`.catch(() => {});
  }
});

describe('E-003 — سقفِ درخواستِ OTP', () => {
  test('دقیقاً `max` درخواست مجاز است و بعدی ۴۲۹ می‌گیرد', async () => {
    const { max } = RULES.otpPerPhone;
    const phone = freshPhone();

    for (let i = 1; i <= max; i++) {
      await enforceOtpRequestWindow(phone);   // نباید پرتاب کند
    }

    let code: string | undefined;
    let status: number | undefined;
    try { await enforceOtpRequestWindow(phone); }
    catch (e) { code = (e as { code?: string }).code; status = (e as { status?: number }).status; }

    assert.equal(code, 'RATE_LIMITED',
      `درخواستِ ${max + 1} باید رد می‌شد؛ گرفت: ${code ?? 'هیچ خطایی'}`);
    assert.equal(status, 429);
  });

  test('۵ درخواستِ کاملاً هم‌زمان: دقیقاً `max` تا عبور می‌کند — نه بیشتر، نه کمتر', async () => {
    // ⚠️ این ردیف اتمیک‌بودن را می‌سنجد، و «کمتر» به‌اندازه‌ی «بیشتر» شکست است.
    // پیاده‌سازیِ ساده‌ی «بخوان، بعد بنویس» هر دو خطا را می‌دهد: دو درخواستِ
    // هم‌زمان هر دو «۲ از ۳» می‌خوانند و یا هر دو عبور می‌کنند یا هر دو رد
    // می‌شوند. همان TOCTOUی که مسیرِ رزرو بارها بابتش هزینه داده.
    const { max } = RULES.otpPerPhone;
    const phone = freshPhone();
    const n = max + 2;

    const results = await Promise.allSettled(
      Array.from({ length: n }, () => enforceOtpRequestWindow(phone)),
    );
    const passed = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(passed, max,
      `دقیقاً ${max} تا باید عبور می‌کرد، ${passed} تا کرد — نشانه‌ی خواندن-سپس-نوشتن`);
    for (const r of rejected) {
      assert.equal((r as PromiseRejectedResult).reason?.code, 'RATE_LIMITED',
        'بازنده باید کدِ دامنه‌ای بگیرد، نه خطایِ خام');
    }
  });

  test('کوبیدنِ مداوم پنجره را برای کاربرِ واقعی دراز نمی‌کند', async () => {
    // رشدِ شمارنده در `max + 1` متوقف می‌شود. بدونِ آن، مهاجم می‌توانست با
    // درخواستِ بی‌وقفه `retryAfterSec` را همیشه تازه نگه دارد و صاحبِ شماره
    // را برای همیشه بیرون بگذارد — یک DoS که از دلِ یک گاردِ ضدِ اسپم می‌آید.
    const { max } = RULES.otpPerPhone;
    const phone = freshPhone();
    for (let i = 0; i < max + 20; i++) {
      await enforceOtpRequestWindow(phone).catch(() => {});
    }
    const row = await db.$queryRaw<Array<{ request_count: number }>>`
      SELECT request_count FROM otp_request_windows WHERE phone = ${phone}`;
    assert.equal(row[0]?.request_count, max + 1,
      `شمارنده باید در ${max + 1} متوقف شود، شد: ${row[0]?.request_count}`);
  });

  test('این مسیر دیگر به Redis وابسته نیست — ساختاری، نه رفتاری', () => {
    // ⚠️ عمداً روی **سورس** ادعا می‌شود، نه روی رفتار: یک تستِ رفتاری با Redisِ
    // سالم هم سبز می‌ماند حتی اگر مسیر هنوز صدایش بزند. آنچه تصمیمِ مالک خرید
    // «قطعِ وابستگی» بود، و تنها جایی که این دیده می‌شود خودِ کد است.
    const src = readFileSync(new URL('../src/lib/otp.ts', import.meta.url), 'utf8');
    assert.ok(!/enforceRateLimit\s*\(/.test(src),
      'requestOtp نباید دیگر ریت‌لیمیتِ Redis را صدا بزند — تصمیمِ E-003 گزینه‌ی «د»');
    assert.ok(/otp_request_windows/.test(src),
      'سقف باید از جدولِ Postgres بیاید');
  });
});
