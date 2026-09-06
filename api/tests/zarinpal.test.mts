import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// merchant_id/sandbox از platform_settings (DB) با fallback به env خوانده
// می‌شوند (platform-settings.ts). این فایل هیچ ردیفی در platform_settings
// نمی‌سازد، پس همیشه از مسیرِ fallbackِ env عبور می‌کند — دقیقاً همان مسیری
// که در استقرارِ بدونِ تنظیمِ پنلِ شرکت هم اجرا می‌شود.
process.env.ZARINPAL_MERCHANT_ID = 'test-merchant-id';
delete process.env.ZARINPAL_SANDBOX;

// ═══════════════════════════════════════════════════════════════════════
//  lib/zarinpal.ts — قبل از این فایل صفر پوششِ تست داشت، با اینکه مستقیماً
//  پول را لمس می‌کند (بندِ ۲۳ی پروتکلِ ممیزی صراحتاً idempotency/currency را
//  می‌خواهد). خودِ HTTPِ زرین‌پال با موکِ global.fetch شبیه‌سازی می‌شود —
//  الگویی که تا امروز در این ریپو وجود نداشت.
//
//  ⚠️ چیزی که این فایل قفل می‌کند، نه فقط تست می‌کند: کامنتِ خودِ فایل
//  می‌گوید «اگر currency صریحاً IRT نباشد، زرین‌پال amount را ریال تفسیر
//  می‌کند — یعنی ۱/۱۰ِ چیزی که سیستم فکر می‌کند دریافت کرده». این یک باگِ
//  مالیِ ساکت است؛ اگر یک رفکتور روزی این فیلد را حذف کند، تستِ زیر می‌شکند،
//  نه صورتحسابِ یک مشتری.
// ═══════════════════════════════════════════════════════════════════════

const { requestPayment, verifyPayment } = await import('../src/lib/zarinpal');

const ORIGINAL_FETCH = globalThis.fetch;

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[];

/** جایگزینِ fetch با پاسخِ ثابت؛ بدنه‌ی هر درخواست برایِ اسرتیون ذخیره می‌شود. */
function stubFetch(resp: { ok: boolean; status?: number; json: unknown }) {
  calls = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : {} });
    return {
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 500),
      json: async () => {
        if (resp.json instanceof Error) throw resp.json;
        return resp.json;
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

// ─────────────────────────────────────────────────────────────────────
describe('zarinpal.requestPayment', () => {
  // ⚠️ بازیابیِ fetch تا ۲۰۲۶-۰۸-۲۶ یک `after`ِ **ریشه‌ای** بود. هوکِ ریشه به
  // سوئیتِ ریشه می‌چسبد و رانرِ ما تک-process است، پس آن بازیابی فقط در
  // **پایانِ کلِ رانِ ۱۳۸۷ تستی** اجرا می‌شد — یعنی از اولین تستِ این فایل به
  // بعد، `globalThis.fetch` برایِ همه‌ی تست‌های بعدیِ سوئیت stub می‌ماند و هر
  // درخواستِ واقعیِ آن‌ها یک ۲۰۰ِ ساختگیِ زرین‌پال‌شکل می‌گرفت (سبزِ به‌دلیلِ
  // غلط). حالا بعد از هر تستِ همین describe بازیابی می‌شود.
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

  test('⚠️ همیشه currency=IRT می‌فرستد (بدونش مبلغ ۱۰ برابر برداشت می‌شود)', async () => {
    stubFetch({ ok: true, json: { data: { code: 100, authority: 'A' + '0'.repeat(35) } } });
    await requestPayment({ amountToman: 50_000, description: 'تست', callbackUrl: 'https://x/callback' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.currency, 'IRT');
    assert.equal(calls[0].body.amount, 50_000, 'amount باید دقیقاً همان تومانِ ورودی باشد، بدونِ ضرب/تقسیم');
  });

  test('sandbox=false (پیش‌فرض) به دامنه‌ی تولیدِ زرین‌پال می‌رود', async () => {
    stubFetch({ ok: true, json: { data: { code: 100, authority: 'AUTH1' } } });
    const out = await requestPayment({ amountToman: 1000, description: 'x', callbackUrl: 'https://x/callback' });
    assert.match(calls[0].url, /^https:\/\/payment\.zarinpal\.com\//);
    assert.equal(out.redirectUrl, 'https://payment.zarinpal.com/pg/StartPay/AUTH1');
    assert.equal(out.authority, 'AUTH1');
  });

  test('sandbox=true به دامنه‌ی sandbox می‌رود (نه تولید — پولِ واقعی جابه‌جا نشود)', async () => {
    process.env.ZARINPAL_SANDBOX = 'true';
    stubFetch({ ok: true, json: { data: { code: 100, authority: 'AUTH1' } } });
    const out = await requestPayment({ amountToman: 1000, description: 'x', callbackUrl: 'https://x/callback' });
    assert.match(calls[0].url, /^https:\/\/sandbox\.zarinpal\.com\//);
    assert.equal(out.redirectUrl, 'https://sandbox.zarinpal.com/pg/StartPay/AUTH1');
    delete process.env.ZARINPAL_SANDBOX;
  });

  test('⚠️ بدونِ merchant_id (نه env نه DB) خطا می‌دهد و اصلاً fetch صدا زده نمی‌شود', async () => {
    const orig = process.env.ZARINPAL_MERCHANT_ID;
    delete process.env.ZARINPAL_MERCHANT_ID;
    stubFetch({ ok: true, json: { data: { code: 100, authority: 'AUTH1' } } });
    await assert.rejects(() => requestPayment({ amountToman: 1000, description: 'x', callbackUrl: 'https://x/callback' }));
    assert.equal(calls.length, 0, 'بدونِ merchant_id نباید هیچ درخواستی به زرین‌پال برود');
    process.env.ZARINPAL_MERCHANT_ID = orig;
  });

  test('پاسخِ ناموفقِ زرین‌پال (code≠100) خطا می‌دهد، نه یک authority نامعتبر را برمی‌گرداند', async () => {
    stubFetch({ ok: true, json: { data: { code: -9, message: 'merchant نامعتبر' } } });
    await assert.rejects(() => requestPayment({ amountToman: 1000, description: 'x', callbackUrl: 'https://x/callback' }));
  });

  test('پاسخِ بدونِ authority خطا می‌دهد', async () => {
    stubFetch({ ok: true, json: { data: { code: 100 } } });
    await assert.rejects(() => requestPayment({ amountToman: 1000, description: 'x', callbackUrl: 'https://x/callback' }));
  });

  test('HTTPِ ناموفق (شبکه/۵۰۰) هم خطا می‌دهد', async () => {
    stubFetch({ ok: false, status: 500, json: null });
    await assert.rejects(() => requestPayment({ amountToman: 1000, description: 'x', callbackUrl: 'https://x/callback' }));
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('zarinpal.verifyPayment', () => {
  // ⚠️ بازیابیِ fetch تا ۲۰۲۶-۰۸-۲۶ یک `after`ِ **ریشه‌ای** بود. هوکِ ریشه به
  // سوئیتِ ریشه می‌چسبد و رانرِ ما تک-process است، پس آن بازیابی فقط در
  // **پایانِ کلِ رانِ ۱۳۸۷ تستی** اجرا می‌شد — یعنی از اولین تستِ این فایل به
  // بعد، `globalThis.fetch` برایِ همه‌ی تست‌های بعدیِ سوئیت stub می‌ماند و هر
  // درخواستِ واقعیِ آن‌ها یک ۲۰۰ِ ساختگیِ زرین‌پال‌شکل می‌گرفت (سبزِ به‌دلیلِ
  // غلط). حالا بعد از هر تستِ همین describe بازیابی می‌شود.
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

  test('⚠️ همیشه currency=IRT و amount+authority درست می‌فرستد', async () => {
    stubFetch({ ok: true, json: { data: { code: 100, ref_id: 123456 } } });
    await verifyPayment({ authority: 'AUTH1', amountToman: 50_000 });
    assert.equal(calls[0].body.currency, 'IRT');
    assert.equal(calls[0].body.amount, 50_000);
    assert.equal(calls[0].body.authority, 'AUTH1');
  });

  test('code=100 → موفق، refId و cardPan را برمی‌گرداند', async () => {
    stubFetch({ ok: true, json: { data: { code: 100, ref_id: 123456, card_pan: '603799******1234' } } });
    const out = await verifyPayment({ authority: 'AUTH1', amountToman: 1000 });
    assert.equal(out.success, true);
    assert.equal(out.refId, '123456');
    assert.equal(out.cardPan, '603799******1234');
  });

  test('⚠️ code=101 (verifyِ تکراری) هم موفق حساب می‌شود — نه خطا', async () => {
    // ⚠️ بدونِ این idempotency، رفرشِ صفحه بعد از پرداختِ موفق یک بارِ دیگر
    //    callback را صدا می‌زد و پرداختِ قبلاً موفق را «ناموفق» گزارش می‌کرد.
    stubFetch({ ok: true, json: { data: { code: 101, ref_id: 123456 } } });
    const out = await verifyPayment({ authority: 'AUTH1', amountToman: 1000 });
    assert.equal(out.success, true);
    assert.equal(out.refId, '123456');
  });

  test('کدهای دیگر → ناموفق برمی‌گرداند، throw نمی‌کند (تصمیمِ نهایی با فراخوان است)', async () => {
    stubFetch({ ok: true, json: { data: { code: -1 } } });
    const out = await verifyPayment({ authority: 'AUTH1', amountToman: 1000 });
    assert.equal(out.success, false);
    assert.equal(out.refId, undefined);
  });

  test('پاسخِ غیرِJSON یا خرابِ درگاه → ناموفقِ صادقانه، نه کرش', async () => {
    stubFetch({ ok: true, json: new Error('bad json') });
    const out = await verifyPayment({ authority: 'AUTH1', amountToman: 1000 });
    assert.equal(out.success, false);
  });

  test('⚠️ بدونِ merchant_id خطا می‌دهد و fetch صدا زده نمی‌شود', async () => {
    const orig = process.env.ZARINPAL_MERCHANT_ID;
    delete process.env.ZARINPAL_MERCHANT_ID;
    stubFetch({ ok: true, json: { data: { code: 100, ref_id: 1 } } });
    await assert.rejects(() => verifyPayment({ authority: 'AUTH1', amountToman: 1000 }));
    assert.equal(calls.length, 0);
    process.env.ZARINPAL_MERCHANT_ID = orig;
  });
});
