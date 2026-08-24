import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAllowedOrigins } from '../src/lib/security.ts';

// ═══════════════════════════════════════════════════════════════════════
//  ALLOWED_ORIGINS — قفلِ رگرسیون برایِ خاموش‌ترین خرابیِ ممکنِ لانچ
//
//  چرا این فایل ساخته شد (ممیزیِ ۲۰۲۶-۰۸-۱۹): در تستِ زنده با مرورگرِ واقعی
//  دیده شد که وقتی originِ اپ در ALLOWED_ORIGINS نباشد، هیچ‌چیز «خراب» به‌نظر
//  نمی‌رسد — API بالاست، لاگ تمیز است، صفحه بدونِ خطا رندر می‌شود — ولی مرورگر
//  fetch را بلاک می‌کند و اپِ مشتری به دادهٔ نمونه برمی‌گردد. یعنی همه‌ی
//  بازدیدکننده‌ها به‌جای رستورانِ واقعی، محتوایِ «نمونه» می‌بینند.
//
//  گاردِ قبلی فقط «خالی‌بودن» را می‌گرفت، که ساده‌ترین حالت است. حالت‌هایی که
//  واقعاً در عمل رخ می‌دهند (اسلشِ پایانی، نبودِ scheme، مسیرِ اضافه) از گارد
//  رد می‌شدند و همان خرابیِ خاموش را می‌ساختند. تست‌های زیر دقیقاً همان‌ها را
//  قفل می‌کنند.
//
//  کلیدِ ماجرا: هدرِ `Origin` که مرورگر می‌فرستد همیشه دقیقاً
//  `scheme://host[:port]` است — پس هر مقدارِ دیگری هرگز مچ نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

describe('parseAllowedOrigins — پیکربندیِ درست', () => {
  test('یک originِ ساده پذیرفته می‌شود', () => {
    const r = parseAllowedOrigins('https://rezervno.ir');
    assert.deepEqual(r.valid, ['https://rezervno.ir']);
    assert.equal(r.problems.length, 0);
  });

  test('چند origin با فاصله‌ی اضافه، درست trim می‌شوند', () => {
    const r = parseAllowedOrigins(' https://rezervno.ir ,  https://www.rezervno.ir ');
    assert.deepEqual(r.valid, ['https://rezervno.ir', 'https://www.rezervno.ir']);
    assert.equal(r.problems.length, 0);
  });

  test('پورتِ صریح بخشی از origin است و حفظ می‌شود', () => {
    const r = parseAllowedOrigins('http://localhost:4101');
    assert.deepEqual(r.valid, ['http://localhost:4101']);
    assert.equal(r.problems.length, 0);
  });

  test('تکراری حذف می‌شود ولی ایراد حساب نمی‌شود', () => {
    const r = parseAllowedOrigins('https://a.ir,https://a.ir');
    assert.deepEqual(r.valid, ['https://a.ir']);
    assert.equal(r.problems.length, 0);
  });

  test('ورودیِ خالی/undefined: نه معتبر، نه ایراد', () => {
    for (const v of ['', '   ', undefined, null]) {
      const r = parseAllowedOrigins(v as string | undefined | null);
      assert.equal(r.valid.length, 0);
      assert.equal(r.problems.length, 0);
    }
  });
});

describe('parseAllowedOrigins — دقیقاً همان اشتباه‌هایی که خرابیِ خاموش می‌سازند', () => {
  test('اسلشِ پایانی گرفته می‌شود (مرورگر هرگز آن را نمی‌فرستد)', () => {
    const r = parseAllowedOrigins('https://rezervno.ir/');
    assert.equal(r.valid.length, 0, 'نباید معتبر شمرده شود');
    assert.equal(r.problems.length, 1);
    assert.match(r.problems[0], /https:\/\/rezervno\.ir/);
  });

  test('نبودِ scheme گرفته می‌شود', () => {
    const r = parseAllowedOrigins('rezervno.ir');
    assert.equal(r.valid.length, 0);
    assert.match(r.problems[0], /scheme/);
  });

  test('مسیرِ اضافه گرفته می‌شود', () => {
    const r = parseAllowedOrigins('https://rezervno.ir/app');
    assert.equal(r.valid.length, 0);
    assert.equal(r.problems.length, 1);
  });

  test('«*» رد می‌شود', () => {
    const r = parseAllowedOrigins('*');
    assert.equal(r.valid.length, 0);
    assert.match(r.problems[0], /\*/);
  });

  test('یک ورودیِ غلط، ورودی‌های درستِ کنارش را از کار نمی‌اندازد', () => {
    // مهم: پیکربندیِ نیمه‌درست نباید بی‌صدا کلِ فهرست را دور بریزد.
    const r = parseAllowedOrigins('https://ok.ir,https://bad.ir/,https://also-ok.ir');
    assert.deepEqual(r.valid, ['https://ok.ir', 'https://also-ok.ir']);
    assert.equal(r.problems.length, 1);
  });
});

describe('parseAllowedOrigins — تطابق با هدرِ واقعیِ Origin', () => {
  test('خروجی دقیقاً با چیزی که مرورگر می‌فرستد مچ می‌شود', () => {
    // ⚠️ کنترلِ مثبت: بدونِ این، همه‌ی تست‌هایِ بالا می‌توانستند با یک تابعِ
    // «همیشه رد کن» هم پاس شوند. اینجا ثابت می‌کنیم خروجی واقعاً قابلِ استفاده
    // است — همان مقایسه‌ای که middleware انجام می‌دهد.
    for (const url of ['https://rezervno.ir', 'http://localhost:4102', 'https://a.b.co:8443']) {
      const browserOrigin = new URL(url + '/some/path?q=1').origin;
      const { valid } = parseAllowedOrigins(url);
      assert.ok(valid.includes(browserOrigin), `${url} باید با originِ مرورگر (${browserOrigin}) مچ شود`);
    }
  });
});
