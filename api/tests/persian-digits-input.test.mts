import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  ارقامِ فارسی در ورودی‌های انسانی (شماره، کدِ OTP، تاریخ، ساعت)
//
//  ⚠️ باگی که این فایل قفل می‌کند (ممیزیِ قراردادِ فرانت↔بک، ۲۰۲۶-۰۹-۱۳):
//  `\d`ِ جاوااسکریپت فقط 0–9ِ ASCII است. «۰۹۱۲۳۴۵۶۷۸۹» — که کیبوردِ فارسی
//  تایپ می‌کند و placeholderِ همان فرم‌ها نشانش می‌دهد — از `zPhone` ۴۲۲
//  می‌گرفت، و `normalizePhone` با `\D` کلِ رقم‌ها را پاک می‌کرد. پنج مسیرِ
//  فرانت پیش از ارسال تبدیل نمی‌کردند: دعوتِ دوست (apps/customer rewards.js)،
//  کارتِ هدیه، جست‌وجوی مشتری/نشان در پنلِ شرکت (api.js:88)، واک‌این و رزروِ
//  دستی در پنلِ رستوران.
//
//  هر ادعا یک کنترلِ مثبت (ASCII هنوز پذیرفته) و یک کنترلِ منفی (بدشکلِ
//  فارسی هنوز رد) دارد، تا «پذیرفتنِ هر چیز» هم از تست رد نشود.
// ═══════════════════════════════════════════════════════════════════════

const { toAsciiDigits } = await import('../src/lib/validate');
const { zPhone, zOtpCode, zDateStr, zTimeStr, z } = await import('../src/lib/schemas');
const { normalizePhone } = await import('../src/lib/otp');

describe('toAsciiDigits', () => {
  test('فارسی و عربی-هندی به ASCII؛ بقیه دست‌نخورده', () => {
    assert.equal(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹'), '0123456789');
    assert.equal(toAsciiDigits('٠١٢٣٤٥٦٧٨٩'), '0123456789');
    assert.equal(toAsciiDigits('+۹۸ ۹۱۲-abc'), '+98 912-abc');
  });
});

describe('zPhone / normalizePhone با ارقامِ فارسی', () => {
  test('شماره‌ی فارسی پذیرفته و به ASCII برگردانده می‌شود', () => {
    assert.equal(zPhone.parse('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
    assert.equal(z.object({ phone: zPhone }).parse({ phone: ' ۰۹۱۲ ۳۴۵ ۶۷۸۹ ' }).phone, '0912 345 6789');
  });
  test('کنترلِ مثبت: ASCII بی‌تغییر', () => {
    assert.equal(zPhone.parse('09123456789'), '09123456789');
  });
  test('کنترلِ منفی: فارسیِ کوتاه یا آلوده هنوز رد می‌شود', () => {
    assert.throws(() => zPhone.parse('۱۲۳'));
    assert.throws(() => zPhone.parse('<b>۰۹۱۲۳۴۵۶۷۸۹</b>'));
  });
  test('normalizePhone شماره‌ی فارسی را به +98 می‌رساند (پیش‌تر `\D` همه را پاک می‌کرد)', () => {
    assert.equal(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹'), '+989123456789');
    assert.equal(normalizePhone('09123456789'), '+989123456789');
    assert.throws(() => normalizePhone('۰۹۱۲'));
  });
});

describe('zOtpCode / zDateStr / zTimeStr با ارقامِ فارسی', () => {
  test('پذیرفته و ASCII', () => {
    assert.equal(zOtpCode.parse('۱۲۳۴۵۶'), '123456');
    assert.equal(zDateStr.parse('۲۰۲۶-۰۹-۱۳'), '2026-09-13');
    assert.equal(zTimeStr.parse('۱۹:۳۰'), '19:30');
  });
  test('کنترلِ منفی: قالبِ غلط هنوز رد', () => {
    assert.throws(() => zTimeStr.parse('۲۵:۰۰'));
    assert.throws(() => zOtpCode.parse('۱۲'));
  });
});
