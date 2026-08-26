import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';
// نکته: import پویا عمداً به‌جای import استاتیک استفاده شده — در ترکیب خاصی از
// نسخه‌ی tsx + Node --test در این محیط، import استاتیکِ چند-نامی از فایل‌های .ts
// گاهی نادرست resolve می‌شود (به‌ظاهر باگ در static linking، نه در خودِ سورس).
// import پویا این مرحله را دور می‌زند و قابل‌اعتماد است.
const { z } = await import('../src/lib/validate.ts');
const {
  zPhone, zUuid, zDateStr, zTimeStr, zPartySize, zReservationCode, zOtpCode,
  parseQuery, parseParams,
} = await import('../src/lib/schemas.ts');

// ═══════════════════════════════════════════════════════════
//  این‌ها تست‌های واقعی‌اند: مستقیم از src/lib import می‌کنند، نه بازتولید
//  منطق در فایل تست (که تست‌های قبلی این پروژه اشتباهاً این کار را می‌کردند
//  و در نتیجه هیچ رگرسیون واقعی در کد اصلی را نمی‌گرفتند).
// ═══════════════════════════════════════════════════════════

describe('z.string', () => {
  test('رشته‌ی معتبر با min/max رد نمی‌شود', () => {
    assert.equal(z.string().min(2).max(10).parse('salam'), 'salam');
  });
  test('کوتاه‌تر از min رد می‌شود', () => {
    assert.throws(() => z.string().min(5).parse('ab'));
  });
  test('بلندتر از max رد می‌شود', () => {
    assert.throws(() => z.string().max(3).parse('abcd'));
  });
  test('trim() فضای اضافه را حذف می‌کند', () => {
    assert.equal(z.string().trim().parse('  hi  '), 'hi');
  });
  test('regex نامعتبر رد می‌شود', () => {
    assert.throws(() => z.string().regex(/^\d+$/).parse('abc'));
  });
  test('عدد به رشته تبدیل می‌شود (پذیرش نرم)', () => {
    assert.equal(z.string().parse(123), '123');
  });
});

describe('z.number', () => {
  test('رشته‌ی عددی به عدد تبدیل می‌شود (برای query string)', () => {
    assert.equal(z.number().parse('42'), 42);
  });
  test('غیرعدد رد می‌شود', () => {
    assert.throws(() => z.number().parse('abc'));
  });
  test('.int() اعشاری را رد می‌کند', () => {
    assert.throws(() => z.number().int().parse(1.5));
  });
  test('min/max اعمال می‌شود', () => {
    assert.throws(() => z.number().min(10).parse(5));
    assert.throws(() => z.number().max(10).parse(20));
  });

  // ═══════════════════════════════════════════════════════════════════
  //  رگرسیونِ Infinity (فازِ ۲ · §۲۴ — یافته‌ی ۱۸ در docs/recovery/OPEN-FINDINGS.md)
  //
  //  `_parse` فقط `typeof n !== 'number'` و `Number.isNaN(n)` را چک می‌کرد.
  //  ولی `Infinity` هم typeofش `'number'` است و هم NaN نیست — پس از فیلتر
  //  رد می‌شد. راهِ ورودش نظری نیست: `JSON.parse('{"x":1e400}')` دقیقاً
  //  `Infinity` می‌دهد (اجرای واقعی: `1e400 -> Infinity | isFinite false`)،
  //  و مسیرِ نرمِ رشته → عدد هم `Number('1e400')` و `Number('Infinity')` را
  //  به `Infinity` تبدیل می‌کرد.
  //
  //  چرا `.int()` کافی نبود: `Number.isInteger(Infinity) === false` فقط
  //  فیلدهایی را می‌بست که `.int()` داشتند. فیلدهای `z.number()`ِ خالی
  //  (مثلِ pos_x/pos_y/rotation در restaurant/tables/[id]) بی‌حفاظ بودند و
  //  مقدار تا لایه‌ی Prisma می‌رفت ⇒ خطای خامِ ۵۰۰ به‌جای ۴۲۲.
  //
  //  کنترلِ مثبت: هر سه assertion زیر با برداشتنِ `Number.isFinite` از
  //  NumberSchema._parse قرمز می‌شوند (سنجشِ جهش انجام شد).
  // ═══════════════════════════════════════════════════════════════════
  test('Infinity رد می‌شود — حتی بدونِ .int()', () => {
    assert.throws(() => z.number().parse(Infinity));
    assert.throws(() => z.number().parse(-Infinity));
  });
  test('1e400 از JSON (که Infinity می‌شود) رد می‌شود', () => {
    const body = JSON.parse('{"pos_x":1e400}');
    assert.equal(body.pos_x, Infinity);            // کنترلِ مثبت: ورودی واقعاً Infinity است
    assert.throws(() => z.object({ pos_x: z.number() }).parse(body));
  });
  test('رشته‌ی بی‌نهایت در مسیرِ نرمِ query string رد می‌شود', () => {
    assert.throws(() => z.number().parse('1e400'));
    assert.throws(() => z.number().parse('Infinity'));
  });
  test('عددِ متناهی همچنان می‌گذرد (کنترلِ منفی — تست بیش از حد نبسته)', () => {
    assert.equal(z.number().parse(0), 0);
    assert.equal(z.number().parse(-3.5), -3.5);
    assert.equal(z.number().parse(Number.MAX_VALUE), Number.MAX_VALUE);
  });
});

describe('z.boolean', () => {
  test('رشته‌ی "true"/"false" برای query string پذیرفته می‌شود', () => {
    assert.equal(z.boolean().parse('true'), true);
    assert.equal(z.boolean().parse('false'), false);
    assert.equal(z.boolean().parse('1'), true);
    assert.equal(z.boolean().parse('0'), false);
  });
  test('رشته‌ی نامعتبر رد می‌شود', () => {
    assert.throws(() => z.boolean().parse('yes'));
  });
});

describe('z.enum', () => {
  test('مقدار در لیست پذیرفته می‌شود', () => {
    assert.equal(z.enum(['a', 'b']).parse('a'), 'a');
  });
  test('مقدار خارج از لیست رد می‌شود', () => {
    assert.throws(() => z.enum(['a', 'b']).parse('c'));
  });
});

describe('z.array', () => {
  test('آرایه‌ی معتبر پذیرفته می‌شود', () => {
    assert.deepEqual(z.array(z.number()).parse([1, 2, 3]), [1, 2, 3]);
  });
  test('غیرآرایه رد می‌شود', () => {
    assert.throws(() => z.array(z.number()).parse('not-array'));
  });
  test('عضو نامعتبر داخل آرایه رد می‌شود', () => {
    assert.throws(() => z.array(z.number()).parse([1, 'x', 3]));
  });
  test('max() تعداد عضو را محدود می‌کند', () => {
    assert.throws(() => z.array(z.number()).max(2).parse([1, 2, 3]));
  });
});

describe('z.record (برای JSON آزاد مثل trigger_config)', () => {
  test('کلیدهای دلخواه کامل حفظ می‌شوند (نه فیلتر می‌شوند)', () => {
    const input = { any_key: 'x', nested: { y: 1 } };
    assert.deepEqual(z.record().parse(input), input);
  });
});

describe('z.object', () => {
  test('فیلد اضافه (خارج از shape) نادیده گرفته می‌شود', () => {
    const schema = z.object({ a: z.string() });
    assert.deepEqual(schema.parse({ a: 'x', b: 'ignored' }), { a: 'x' });
  });
  test('فیلد الزامی غایب رد می‌شود', () => {
    assert.throws(() => z.object({ a: z.string() }).parse({}));
  });
  test('nested object درست کار می‌کند', () => {
    const schema = z.object({ guest: z.object({ name: z.string() }).optional() });
    assert.deepEqual(schema.parse({}), {});
    assert.deepEqual(schema.parse({ guest: { name: 'ali' } }), { guest: { name: 'ali' } });
  });
});

// ═══════════════════════════════════════════════════════════
//  رگرسیون حیاتی: باگ mutation مشترک.
//  قبل از رفع: .optional() روی یک const مشترک (zUuid/zPhone/...) instance
//  را mutate می‌کرد؛ یعنی یک فراخوانی .optional() در یک فایل، همان const را
//  در تمام فایل‌های دیگر هم (که بدون .optional استفاده می‌کردند) optional
//  می‌کرد — یک باگ bypass اعتبارسنجی خاموش و سراسری.
// ═══════════════════════════════════════════════════════════
describe('immutability پرایمیتیوهای مشترک (رگرسیون باگ mutation)', () => {
  test('فراخوانی .optional() روی zUuid نباید zUuid اصلی را optional کند', () => {
    const requiredSchema = z.object({ id: zUuid });
    // این فراخوانی قبلاً zUuid را globally mutate می‌کرد
    const optionalUsage = z.object({ id: zUuid.optional() });

    assert.throws(() => requiredSchema.parse({}), 'id باید هنوز الزامی باشد');
    assert.doesNotThrow(() => optionalUsage.parse({}), 'استفاده‌ی جداگانه باید optional بماند');
    // و بعد از استفاده‌ی optional، نسخه‌ی الزامی هنوز باید رد کند
    assert.throws(() => requiredSchema.parse({}), 'zUuid اصلی باید دست‌نخورده بماند');
  });

  test('همین موضوع برای zPhone', () => {
    const requiredSchema = z.object({ phone: zPhone });
    const optionalUsage = z.object({ phone: zPhone.optional() });
    assert.throws(() => requiredSchema.parse({}));
    assert.doesNotThrow(() => optionalUsage.parse({}));
    assert.throws(() => requiredSchema.parse({}), 'zPhone اصلی نباید تحت تأثیر optionalUsage قرار گرفته باشد');
  });

  test('چند بار .min()/.max() روی یک schema پایه نباید رویِ هم اثر بگذارند', () => {
    const base = z.string();
    const short = base.max(3);
    const long = base.max(100);
    assert.throws(() => short.parse('abcd'));
    assert.doesNotThrow(() => long.parse('abcd'));
    // base خودش نباید max گرفته باشد
    assert.doesNotThrow(() => base.parse('a'.repeat(50)));
  });
});

describe('پرایمیتیوهای دامنه (schemas.ts)', () => {
  test('zUuid فرمت معتبر را می‌پذیرد و تزریق را رد می‌کند', () => {
    assert.equal(zUuid.parse('550e8400-e29b-41d4-a716-446655440000'), '550e8400-e29b-41d4-a716-446655440000');
    assert.throws(() => zUuid.parse('1; DROP TABLE users'));
  });
  test('zDateStr فقط YYYY-MM-DD را می‌پذیرد', () => {
    assert.equal(zDateStr.parse('2026-06-22'), '2026-06-22');
    assert.throws(() => zDateStr.parse('22/06/2026'));
  });
  test('zTimeStr فقط HH:mm ۲۴ساعته را می‌پذیرد', () => {
    assert.equal(zTimeStr.parse('20:30'), '20:30');
    assert.throws(() => zTimeStr.parse('25:00'));
  });
  test('zPartySize بین ۱ تا ۳۰ نفر است', () => {
    assert.equal(zPartySize.parse(4), 4);
    assert.throws(() => zPartySize.parse(0));
    assert.throws(() => zPartySize.parse(31));
    assert.throws(() => zPartySize.parse(2.5));
  });
  test('zReservationCode فرمت RZ+7کاراکتر Base32 را می‌پذیرد', () => {
    assert.equal(zReservationCode.parse('RZAB23CDE'), 'RZAB23CDE');
    assert.throws(() => zReservationCode.parse('RZ123')); // کوتاه
    assert.throws(() => zReservationCode.parse('rzab23cd')); // حروف کوچک رد می‌شود (case-sensitive)
  });
  test('zOtpCode بین ۴ تا ۶ رقم را می‌پذیرد', () => {
    assert.equal(zOtpCode.parse('1234'), '1234');
    assert.equal(zOtpCode.parse('123456'), '123456');
    assert.throws(() => zOtpCode.parse('123'));
    assert.throws(() => zOtpCode.parse('1234567'));
    assert.throws(() => zOtpCode.parse('12a4'));
  });
});

describe('parseQuery / parseParams', () => {
  test('parseQuery مقادیر query string را طبق schema پارس می‌کند', () => {
    const req = new Request('https://x.test/api?limit=10&active=true', {
      headers: { 'x-real-ip': testIp() },
    });
    const schema = z.object({ limit: z.number().int(), active: z.boolean() });
    assert.deepEqual(parseQuery(req, schema), { limit: 10, active: true });
  });
  test('parseParams پارامترهای route را طبق schema اعتبارسنجی می‌کند', () => {
    const schema = z.object({ code: zReservationCode });
    assert.deepEqual(parseParams({ code: 'RZAB23CDE' }, schema), { code: 'RZAB23CDE' });
    assert.throws(() => parseParams({ code: 'bad' }, schema));
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  zPhone — گاردِ قالبِ شماره (ممیزیِ امنیت ۲۰۲۶-۰۸-۲۴، پروتکل §۲۸)
//
//  چرا: `zPhone` قبلاً `z.string().min(8).max(20).trim()` بود — هیچ قالبی را
//  الزام نمی‌کرد. سه endpointِ **عمومی و بدونِ احراز هویت**
//  (`/site/contact`, `/site/orders`, `/site/trial`) از آن استفاده می‌کنند و
//  نتیجه در پنلِ شرکت به مدیرِ پلتفرم نمایش داده می‌شود. امروز قابلِ
//  بهره‌برداری نبود (پنل همه‌جا esc می‌زند) ولی تنها دفاع، لایه‌ی رندر بود —
//  و کلاینت‌ها از سرور سخت‌گیرتر بودند، یعنی اعتبارسنجیِ واقعی سمتِ کلاینت.
//
//  ⚠️ نکته: این shim امضایِ Zodِ واقعی را ندارد — `safeParse` مقدارِ
//  `{ok,value}` می‌دهد نه `{success}`. این‌جا از همان الگویِ بقیه‌ی فایل
//  (`parse` + `assert.throws`) استفاده می‌شود.
// ═══════════════════════════════════════════════════════════════════════
describe('zPhone — قالبِ شماره سمتِ سرور الزام می‌شود (§۲۸)', () => {
  const ok = [
    '09123456789', '+989123456789', '989123456789',
    '0912 345 6789', '0912-345-6789', '02112345678',
  ];
  const bad = [
    '"><svg onload=alert(1)>',   // تزریقِ HTML
    '<img src=x onerror=y>',
    'javascript:alert(1)',
    'abc09123456789',            // حروف قاطیِ رقم
    "DROP TABLE users--",
    '123',                       // خیلی کوتاه
  ];

  test('شماره‌هایِ معتبر پذیرفته می‌شوند (رگرسیون نمی‌سازد)', () => {
    for (const v of ok) {
      assert.equal(typeof zPhone.parse(v), 'string', `باید پذیرفته شود: ${JSON.stringify(v)}`);
    }
  });

  test('ورودیِ بدشکل/خصمانه رد می‌شود', () => {
    for (const v of bad) {
      assert.throws(() => zPhone.parse(v), `باید رد شود ولی پذیرفته شد: ${JSON.stringify(v)}`);
    }
  });
});
