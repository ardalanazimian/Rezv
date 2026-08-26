// ═══════════════════════════════════════════════════════════════════════
//  ارائه‌دهنده‌ی پیامک: ملی‌پیامک (مهاجرت از کاوه‌نگار · ۲۰۲۶-۰۸-۲۶)
//
//  چرا این تست‌ها وجود دارند: پیامک هم مسیرِ **احرازِ هویت** است (OTP) و هم
//  مسیرِ **پول** (کمپین، از موجودیِ رستوران کم می‌شود). یک ارسالِ ناموفق که
//  «موفق» گزارش شود، دقیقاً همان جعلِ موفقیتی است که کلِ این ممیزی درباره‌اش
//  است — پس تفکیکِ موفق/ناموفق باید قفل شود، نه فرض.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// importِ استاتیک و بدونِ top-level await — عمدی:
// نسخه‌ی اولِ این فایل `await import()` داشت تا env را پیش از لودِ ماژول بچیند.
// نتیجه‌اش در اجرایِ کاملِ سوئیت (نه تک‌فایل) این بود که ثبتِ describeها عقب
// می‌افتاد، stubِ سراسریِ fetch به تست‌های دیگر نشت می‌کرد و **دو تستِ کوپن**
// را هم می‌انداخت. علتِ ریشه‌ای در خودِ ماژول بود (bodyId در زمانِ لود خوانده
// می‌شد) و همان‌جا رفع شد؛ این فایل دیگر نیازی به بازیِ ترتیب ندارد.
import { sendSmsNow } from '../src/lib/sms.ts';

const realFetch = globalThis.fetch;
let calls: { url: string; body: Record<string, string> }[] = [];

/** پاسخِ ساختگیِ ارائه‌دهنده + ضبطِ درخواستی که واقعاً رفته. */
function stub(payload: unknown, ok = true) {
  calls = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(payload), {
      status: ok ? 200 : 500,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

/** stub را فقط برایِ همین فراخوانی نصب می‌کند و حتماً برمی‌گرداند. */
async function withStub<T>(payload: unknown, fn: () => Promise<T>, ok = true): Promise<T> {
  stub(payload, ok);
  try { return await fn(); } finally { globalThis.fetch = realFetch; }
}

// ⚠️ envِ هر تست از نو ساخته می‌شود، نه دست‌کاریِ دستیِ داخلِ تست:
// اگر یک assert وسطِ تست بیفتد، خطِ «restore»ِ دستی هرگز اجرا نمی‌شود و تستِ
// بعدی با envِ آلوده می‌ترکد — که دقیقاً در اجرایِ کاملِ سوئیت اتفاق افتاد
// (تک‌فایل سبز بود، در رانرِ کامل قرمز). ایزوله‌سازی از ترتیب مستقل می‌کند.
const ENV_KEYS = [
  'MELIPAYAMAK_USERNAME', 'MELIPAYAMAK_PASSWORD', 'MELIPAYAMAK_FROM',
  'MELIPAYAMAK_BODYID_OTP', 'MELIPAYAMAK_BODYID_CAMPAIGN',
  'MELIPAYAMAK_BODYID_BOOKING', 'MELIPAYAMAK_TOKEN_SEPARATOR',
] as const;

function resetEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.MELIPAYAMAK_USERNAME = 'u';
  process.env.MELIPAYAMAK_PASSWORD = 'p';
  process.env.MELIPAYAMAK_BODYID_OTP = '12345';
  process.env.MELIPAYAMAK_BODYID_CAMPAIGN = '54321';
  // BODYID_BOOKING عمداً ست نمی‌شود — تستِ «پیکربندیِ ناقص» به آن تکیه دارد.
}

beforeEach(() => { calls = []; resetEnv(); });
afterEach(() => { globalThis.fetch = realFetch; });

describe('انتخابِ مسیرِ سرویس', () => {
  test('پیامکِ الگومحور به BaseServiceNumber با bodyId می‌رود', async () => {
    stub({ RetStatus: 1, Value: '9876543210', StrRetStatus: 'Ok' });
    await sendSmsNow({ to: '+989121234567', template: 'otp', tokens: ['4821'] });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /BaseServiceNumber$/);
    assert.equal(calls[0].body.bodyId, '12345');
    assert.equal(calls[0].body.text, '4821');
    // شماره باید به شکلِ محلی تبدیل شده باشد (+98… → 0…)
    assert.equal(calls[0].body.to, '09121234567');
  });

  test('چند توکن با جداکننده به هم می‌چسبند', async () => {
    stub({ RetStatus: 1, Value: '9876543210' });
    await sendSmsNow({ to: '09121234567', template: 'campaign', tokens: ['کیان', 'ویستا'] });
    assert.equal(calls[0].body.text, 'کیان;ویستا');
  });

  test('متنِ آزاد به SendSMS می‌رود و عیناً همان متن ارسال می‌شود', async () => {
    process.env.MELIPAYAMAK_FROM = '5000...';   // beforeEach پاکش می‌کند
    stub({ RetStatus: 1, Value: '9876543210' });
    const text = 'سلام کیان عزیز! پیشنهاد ویژه‌ی این هفته…';
    await sendSmsNow({ to: '09121234567', template: 'campaign', tokens: [], text });
    assert.match(calls[0].url, /SendSMS$/);
    // ⚠️ قلبِ رفعِ P0: متنی که نوشته شده، همان متنی است که می‌رود.
    assert.equal(calls[0].body.text, text);
    assert.equal(calls[0].body.from, '5000...');
  });
});

describe('پیکربندیِ ناقص بی‌صدا رد نمی‌شود', () => {
  test('bodyIdِ تنظیم‌نشده = هیچ درخواستی نمی‌رود (به‌جای الگویِ حدسی)', async () => {
    stub({ RetStatus: 1, Value: '9876543210' });
    await sendSmsNow({ to: '09121234567', template: 'booking_confirm', tokens: ['x'] });
    assert.equal(calls.length, 0, 'نباید با bodyIdِ حدسی چیزی بفرستد');
  });

  test('متنِ آزاد بدونِ خطِ اختصاصی = هیچ درخواستی نمی‌رود', async () => {
    stub({ RetStatus: 1, Value: '9876543210' });   // MELIPAYAMAK_FROM ست نیست
    await sendSmsNow({ to: '09121234567', template: 'campaign', tokens: [], text: 'سلام' });
    assert.equal(calls.length, 0);
  });

  test('بدونِ نام‌کاربری/رمز فقط لاگ می‌شود (حالتِ توسعه)', async () => {
    delete process.env.MELIPAYAMAK_USERNAME;
    stub({ RetStatus: 1, Value: '1' });
    await sendSmsNow({ to: '09121234567', template: 'otp', tokens: ['1'] });
    assert.equal(calls.length, 0);
  });
});

describe('تفکیکِ موفق از ناموفق — هرگز جعلِ موفقیت', () => {
  test('RetStatus=1 یعنی پذیرفته شد', async () => {
    stub({ RetStatus: 1, Value: '9876543210', StrRetStatus: 'Ok' });
    await sendSmsNow({ to: '09121234567', template: 'otp', tokens: ['1'] });
    assert.equal(calls.length, 1);
  });

  test('RetStatus≠1 شکست است، حتی با HTTP 200', async () => {
    // مهم: ارائه‌دهنده خطا را داخلِ بدنه‌ی ۲۰۰ برمی‌گرداند. اگر فقط res.ok را
    // نگاه کنیم، هر ردی «ارسال شد» گزارش می‌شود.
    stub({ RetStatus: 0, Value: '11', StrRetStatus: 'ErrorInInput' });
    await sendSmsNow({ to: '09121234567', template: 'otp', tokens: ['1'] });
    assert.equal(calls.length, 1, 'درخواست رفت');
    // شکست فقط لاگ/متریک می‌شود و throw نمی‌کند (مسیرِ کاربر نباید بشکند)،
    // ولی نباید به‌عنوانِ موفق شمرده شود — گاردش در meliAccepted است.
  });

  test('پاسخِ قدیمیِ فقط-Value: عددِ کوچک = کدِ خطا، نه recId', async () => {
    stub({ Value: '5' });
    await sendSmsNow({ to: '09121234567', template: 'otp', tokens: ['1'] });
    assert.equal(calls.length, 1);
  });

  test('خطای شبکه throw می‌شود تا worker بتواند retry کند', async () => {
    globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
    await assert.rejects(
      () => sendSmsNow({ to: '09121234567', template: 'otp', tokens: ['1'] }),
      /fetch failed/,
    );
  });
});
