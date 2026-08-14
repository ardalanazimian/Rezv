import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  esc() منبعِ کانونیِ ضدِّ XSS برایِ سه پنل است (shared/js/format.js —
//  رجوع کن به کامنتِ بالایِ خودِ فایل). این فایل، برخلافِ اسکریپت‌هایِ
//  پنل‌ها که classic <script> بدونِ module لود می‌شوند، خودش ES module
//  واقعی است (export function ...)، پس مستقیماً با dynamic import قابلِ
//  تست است — بدونِ نیازِ کپیِ دستیِ منطق در تست (که رگرسیونِ واقعی را نمی‌گیرد).
//
//  tools/sync-design-system.sh نسخه‌ی global (بدونِ export) را برایِ
//  business/company می‌سازد؛ چون فقط export حذف می‌شود و بدنه‌ی تابع
//  دست‌نخورده می‌ماند، تستِ این فایلِ منبع معادلِ تستِ نسخه‌هایِ sync‌شده هم هست.
// ═══════════════════════════════════════════════════════════════════════
const { esc, fa } = await import('../../shared/js/format.js');

describe('esc — escape کردنِ ورودی قبل از تزریق به HTML (ضدِّ XSS)', () => {
  test('کاراکترهایِ خطرناک به موجودیتِ HTML تبدیل می‌شوند', () => {
    assert.equal(esc('&'), '&amp;');
    assert.equal(esc('<'), '&lt;');
    assert.equal(esc('>'), '&gt;');
    assert.equal(esc('"'), '&quot;');
    assert.equal(esc("'"), '&#39;');
  });
  test('یک payloadِ کاملِ script-tag کاملاً بی‌اثر می‌شود', () => {
    assert.equal(
      esc('<script>alert(1)</script>'),
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });
  test('attribute-breakout با دابل‌کوت هم رفع می‌شود', () => {
    assert.equal(
      esc('"><img src=x onerror=alert(1)>'),
      '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;',
    );
  });
  test('رشته‌ی بی‌خطر دست‌نخورده می‌ماند', () => {
    assert.equal(esc('رستوران آبی'), 'رستوران آبی');
    assert.equal(esc('Hello World 123'), 'Hello World 123');
  });
  test('null/undefined → رشته‌ی خالی (نه "null"/"undefined" در HTML)', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
  });
  test('عدد/بولین هم به رشته تبدیل و escape می‌شود (بدونِ کرش)', () => {
    assert.equal(esc(0), '0');
    assert.equal(esc(false), 'false');
  });
  test('& باید قبل از موجودیت‌سازیِ بقیه escape شود تا دوباره‌encode نشود', () => {
    // اگر ترتیب اشتباه بود (مثلاً < را اول جایگزین می‌کرد و بعد &)، خروجی
    // برایِ ورودیِ '&lt;' به‌جایِ '&amp;lt;' چیزِ دیگری می‌شد.
    assert.equal(esc('&lt;'), '&amp;lt;');
  });
});

describe('fa — فرمتِ عدد با جداکننده‌ی هزارگانِ فارسی', () => {
  test('عددِ null/NaN → "۰" (نه کرش یا NaN خام در UI)', () => {
    assert.equal(fa(null), '۰');
    assert.equal(fa(NaN), '۰');
  });
  test('عددِ معمولی به ارقامِ فارسی با جداکننده تبدیل می‌شود', () => {
    assert.equal(fa(1000), '۱٬۰۰۰');
  });
  test('صفر عادی (نه null) هم به رقمِ فارسیِ ۰ تبدیل می‌شود', () => {
    assert.equal(fa(0), '۰');
  });
});
