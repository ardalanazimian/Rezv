import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  پاسخِ غیرقابلِ‌پارس هرگز «ارسال شد» نیست
//
//  ⚠️ چرا این فایل ساخته شد (نمونه‌گیریِ جهش S2، ۲۰۲۶-۰۸-۲۹): جهشِ
//  `meliAccepted`:
//      if (!d) return false;   →   if (!d) return true;
//  از **هر ۷ فایلِ تستی که ماژولِ sms را لمس می‌کنند** سالم رد شد.
//
//  دلیلش هم روشن بود: همه‌ی تست‌های موجود `fetch` را با JSONِ **معتبر** stub
//  می‌کنند، پس `d` هرگز null نمی‌شود و شاخه‌ی fallback اصلاً اجرا نمی‌شود.
//
//  ولی آن شاخه دقیقاً همان‌جایی است که «جعلِ موفقیت» متولد می‌شود:
//  `sendSmsNow` بدنه را با `res.json().catch(() => null)` می‌خواند، پس هر
//  پاسخِ غیر-JSON (بدنه‌ی خالی، HTMLِ صفحه‌ی خطای پروکسی، JSONِ ناقص) به
//  `null` تبدیل می‌شود. اگر `null` «پذیرفته» حساب شود، پیامکی که هرگز
//  نرفته در متریک به‌عنوان `smsSent` ثبت می‌شود — و هیچ آلارمی نمی‌زند.
//  همان کلاسی که کامنتِ خودِ تابع (`sms.ts:97-99`) درباره‌اش هشدار می‌دهد.
//
//  دفترِ ثبت (ledger) این‌جا شمارنده‌های `metrics` است: `smsSent` در برابر
//  `smsFailed{reason:"rejected"}`. تست هر دو جهت را می‌سنجد تا گاردی که
//  «همیشه رد کند» هم پاس نشود.
// ═══════════════════════════════════════════════════════════════════════

const { sendSmsNow } = await import('../src/lib/sms');
const { metrics } = await import('../src/lib/metrics');

const REAL_FETCH = globalThis.fetch;
const ORIG = {
  u: process.env.MELIPAYAMAK_USERNAME,
  p: process.env.MELIPAYAMAK_PASSWORD,
  b: process.env.MELIPAYAMAK_BODYID_OTP,
};

/** پاسخِ خامِ دلخواه — تا بشود بدنه‌ی غیر-JSON هم شبیه‌سازی کرد. */
function stubRaw(body: string, status = 200, contentType = 'application/json') {
  globalThis.fetch = (async () => new Response(body, {
    status, headers: { 'content-type': contentType },
  })) as unknown as typeof fetch;
}

/** شمارشِ فعلیِ یک برچسبِ مشخص از رندرِ متنیِ شمارنده. */
function counterFor(counter: { render(): string }, needle: string): number {
  for (const line of counter.render().split('\n')) {
    if (line.startsWith('#') || !line.includes(needle)) continue;
    const n = Number(line.trim().split(/\s+/).pop());
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

const job = () => ({
  template: 'otp' as const,
  to: '+989370000123',
  tokens: ['1234'],
});

// ⚠️ دامِ رانرِ الحاقی (`_all.runner.mts` همه را در **یک** پروسه import
// می‌کند): هوک‌های سطحِ فایل سراسری می‌شوند. `sms-transport-failclosed`
// یک `afterEach` دارد که اعتبارنامه‌ی ملی‌پیامک را پاک می‌کند — و چون سراسری
// است، بعد از تست‌های **این** فایل هم اجرا می‌شود. اگر اعتبارنامه را فقط در
// `before` ست کنیم، از تستِ دوم به بعد `sendSmsNow` پیش از `fetch` برمی‌گردد
// و شمارنده‌ها تکان نمی‌خورند — یعنی تست بی‌صدا بی‌معنا می‌شود.
// پس هر تست محیطِ خودش را از نو می‌سازد.




describe('پاسخِ غیرقابلِ‌پارسِ ارائه‌دهنده = ارسالِ ناموفق', () => {
  // ⚠️ هوک‌ها عمداً **داخلِ** describe هستند، نه سطحِ فایل. در رانرِ الحاقی
  // (`_all.runner.mts` همه را در یک پروسه import می‌کند) هوکِ سطحِ فایل
  // سراسری می‌شود و به تست‌های فایل‌های دیگر هم می‌چسبد. نسخه‌ی اولِ همین
  // فایل دقیقاً همین را کرد: `globalThis.fetch = REAL_FETCH` سراسری شد و
  // stubِ `sms-queue-fallback-balance` را پاک کرد و آن تست را شکست.
  //
  // و برعکسش هم لازم است: `sms-transport-failclosed` یک afterEachِ سراسری
  // دارد که اعتبارنامه را پاک می‌کند، پس هر تستِ این‌جا باید محیطش را از نو
  // بسازد وگرنه `sendSmsNow` پیش از `fetch` برمی‌گردد و ادعا بی‌صدا پوچ می‌شود.
  beforeEach(() => {
    process.env.MELIPAYAMAK_USERNAME = 'u';
    process.env.MELIPAYAMAK_PASSWORD = 'p';
    process.env.MELIPAYAMAK_BODYID_OTP = '12345';
  });

  afterEach(() => {
    globalThis.fetch = REAL_FETCH;
    for (const [k, v] of [
      ['MELIPAYAMAK_USERNAME', ORIG.u],
      ['MELIPAYAMAK_PASSWORD', ORIG.p],
      ['MELIPAYAMAK_BODYID_OTP', ORIG.b],
    ] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  // هر سه شکلِ واقعیِ «بدنه‌ای که JSON نیست».
  const BAD: Array<[string, string, string]> = [
    ['بدنه‌ی کاملاً خالی', '', 'application/json'],
    ['HTMLِ صفحه‌ی خطای پروکسی', '<html><body>502 Bad Gateway</body></html>', 'text/html'],
    ['JSONِ خراب (ناقص)', '{"RetStatus": 1', 'application/json'],
  ];

  for (const [label, body, ctype] of BAD) {
    test(`${label} → smsSent زیاد نمی‌شود، smsFailed{rejected} زیاد می‌شود`, async () => {
      const sentBefore = counterFor(metrics.smsSent, 'template="otp"');
      const failBefore = counterFor(metrics.smsFailed, 'reason="rejected"');

      stubRaw(body, 200, ctype);
      await sendSmsNow(job());

      assert.equal(
        counterFor(metrics.smsSent, 'template="otp"'), sentBefore,
        'پیامکی که ارائه‌دهنده تأییدش نکرده نباید در دفتر «ارسال‌شده» ثبت شود — '
        + 'این دقیقاً همان جعلِ موفقیتی است که کلِ این ممیزی درباره‌اش است',
      );
      assert.equal(
        counterFor(metrics.smsFailed, 'reason="rejected"'), failBefore + 1,
        'باید صریح به‌عنوانِ ردشده ثبت شود، نه اینکه بی‌صدا ناپدید شود',
      );
    });
  }

  test('کنترلِ مثبت: پاسخِ معتبرِ RetStatus=1 واقعاً «ارسال‌شده» ثبت می‌شود', async () => {
    // بدونِ این، گاردی که **همیشه** رد کند هم سه تستِ بالا را پاس می‌کرد و
    // ما یک ترانسپورتِ کاملاً مرده را «امن» می‌خواندیم.
    const sentBefore = counterFor(metrics.smsSent, 'template="otp"');
    const failBefore = counterFor(metrics.smsFailed, 'reason="rejected"');

    stubRaw(JSON.stringify({ RetStatus: 1, Value: '9876543210', StrRetStatus: 'Ok' }));
    await sendSmsNow(job());

    assert.equal(counterFor(metrics.smsSent, 'template="otp"'), sentBefore + 1,
      'پاسخِ معتبر باید ارسالِ موفق ثبت کند');
    assert.equal(counterFor(metrics.smsFailed, 'reason="rejected"'), failBefore,
      'و نباید هم‌زمان شکست ثبت کند');
  });
});
