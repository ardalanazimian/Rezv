import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  صداقتِ مسیرِ ایمیل — دومین «سکوتِ خطرناک» بعد از کلیدِ کاوه‌نگار
//
//  ⚠️ چیزی که این فایل قفل می‌کند (یافته‌ی ۲۰۲۶-۰۸-۲۵):
//  `sendEmail` **هرگز ایمیلی نمی‌فرستاد** — فراخوانِ واقعی کامنت شده بود —
//  و در هر دو شاخه بی‌صدا و «موفق» برمی‌گشت، بدونِ هیچ متریکی. شاخه‌ی
//  *با کلید* حتی خطِ `[EMAIL:ارسال]` را لاگ می‌کرد: اپراتوری که کلید را
//  تنظیم می‌کرد، در لاگ کلمه‌ی «ارسال» را می‌دید برای ایمیلی که نرفته بود.
//
//  کلِ قیفِ فروشِ B2B از این مسیر می‌گذرد (درخواستِ دمو و خرید، فعال‌سازیِ
//  اشتراک، پیامِ فرمِ تماس به صندوقِ فروش). یعنی سرنخ‌ها بی‌صدا گم می‌شدند و
//  هیچ سیگنالی هم تولید نمی‌شد.
//
//  ── مرزِ صداقتِ خودِ این فایل ──
//  اینجا `fetch` جایگزین می‌شود. پس ثابت می‌کند «کد درخواستِ درست را به
//  SendGrid می‌سازد و شکست را بلند اعلام می‌کند» — نه اینکه ایمیل واقعاً به
//  صندوقِ کسی می‌رسد. آن فقط با یک کلیدِ واقعی قابلِ تأیید است و تا آن موقع
//  وضعیت **آماده** است، نه **فعال**.
// ═══════════════════════════════════════════════════════════════════════

const { sendEmail, emailTransportReady, sendPush } = await import('../src/lib/notify.ts');
const { metrics } = await import('../src/lib/metrics.ts');

/** شمارشِ فعلیِ یک متریک از خروجیِ متنیِ Prometheus. */
function counterTotal(name: string): number {
  const line = metrics[name as keyof typeof metrics] as { render(): string };
  let sum = 0;
  for (const l of line.render().split('\n')) {
    if (l.startsWith('#')) continue;
    const v = Number(l.trim().split(/\s+/).pop());
    if (Number.isFinite(v)) sum += v;
  }
  return sum;
}

let calls: { url: string; init: RequestInit }[] = [];
const ENV_KEYS = ['EMAIL_API_KEY', 'EMAIL_FROM', 'NODE_ENV'] as const;
let saved: Record<string, string | undefined> = {};
let savedFetch: typeof globalThis.fetch;

// ⚠️ این دو هوک عمداً **داخلِ هر describe** نصب می‌شوند، نه در سطحِ فایل —
// و این یک درسِ گران بود، نه سلیقه.
//
// `npm test` همه‌ی فایل‌های تست را در **یک پروسه** import می‌کند
// (`tests/_all.runner.mts`). در node:test، هوکی که بیرونِ هر `describe`
// ثبت شود به سوئیتِ **ریشه** می‌چسبد و برایِ *تک‌تکِ* تست‌های کلِ پروسه
// اجرا می‌شود. نسخه‌ی اولِ همین فایل هوک‌ها را در سطحِ فایل داشت و
// `globalThis.fetch` را بعد از **هر** تست به نسخه‌ی واقعی برمی‌گرداند —
// یعنی stubِ `payments.integration` و `zarinpal` را وسطِ کارشان نابود
// می‌کرد. نتیجه: ۲۹ تستِ کاملاً بی‌ربط قرمز شدند، همه با مدتِ اجرای
// زیرِ یک میلی‌ثانیه (یعنی اصلاً اجرا نشدند).
//
// همچنین `savedFetch` هنگامِ نصب خوانده می‌شود، نه در زمانِ import: اگر
// فایلِ دیگری fetch را قانوناً stub کرده باشد، ما همان را برمی‌گردانیم،
// نه نسخه‌ی اصلیِ موتور.
function installHooks() {
  beforeEach(() => {
    calls = [];
    savedFetch = globalThis.fetch;
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  });
  afterEach(() => {
    globalThis.fetch = savedFetch;
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
  });
}

/** fetchِ جعلی که پاسخِ دلخواه می‌دهد و درخواست را ثبت می‌کند. */
function stubFetch(responder: () => Response | Promise<Response>) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return responder();
  }) as unknown as typeof fetch;
}

describe('مسیرِ ایمیل — بدونِ کلید', () => {
  installHooks();

  test('🔴 بدونِ کلید هیچ درخواستی به بیرون نمی‌رود و شکست **شمرده** می‌شود', async () => {
    // نکته‌ی اصلی: نه فقط «نمی‌فرستد» — بلکه دیگر ساکت هم نیست. سکوت همان
    // چیزی بود که باعث شد ماه‌ها کسی نفهمد قیفِ فروش خالی است.
    delete process.env.EMAIL_API_KEY;
    stubFetch(() => new Response('', { status: 202 }));
    const before = counterTotal('emailFailed');

    await sendEmail('a@example.com', 'موضوع', 'متن');

    assert.equal(calls.length, 0, 'بدونِ کلید نباید هیچ درخواستی برود');
    assert.equal(counterTotal('emailFailed'), before + 1, 'باید دقیقاً یک شکست شمرده شود');
  });

  test('🔴 و هرگز به‌عنوانِ «ارسال‌شده» شمرده نمی‌شود', async () => {
    // این تستِ آینه‌ی تستِ بالاست: بدونِ آن، «همیشه هر دو متریک را زیاد کن»
    // هم سبز می‌شد.
    delete process.env.EMAIL_API_KEY;
    const before = counterTotal('emailSent');
    await sendEmail('a@example.com', 'موضوع', 'متن');
    assert.equal(counterTotal('emailSent'), before, 'شمارنده‌ی ارسال نباید تکان بخورد');
  });

  test('emailTransportReady واقعیت را می‌گوید', async () => {
    // مسیرهایی که نتیجه‌شان به رسیدنِ ایمیل وابسته است باید بتوانند بپرسند.
    delete process.env.EMAIL_API_KEY;
    assert.equal(emailTransportReady(), false);
    process.env.EMAIL_API_KEY = 'SG.test';
    assert.equal(emailTransportReady(), true);
  });
});

describe('مسیرِ ایمیل — با کلید', () => {
  installHooks();

  test('🔴 درخواستِ واقعی به SendGrid ساخته می‌شود (نه فقط یک لاگ)', async () => {
    // این دقیقاً همان چیزی است که نبود: فراخوان کامنت شده بود.
    process.env.EMAIL_API_KEY = 'SG.test-key';
    process.env.EMAIL_FROM = 'sales@rezervno.ir';
    stubFetch(() => new Response('', { status: 202 }));
    const before = counterTotal('emailSent');

    await sendEmail('lead@example.com', 'درخواستِ خرید RZ-1', 'متنِ سفارش');

    assert.equal(calls.length, 1, 'باید دقیقاً یک درخواست برود');
    assert.equal(calls[0].url, 'https://api.sendgrid.com/v3/mail/send');
    assert.equal(calls[0].init.method, 'POST');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer SG.test-key');
    const sent = JSON.parse(String(calls[0].init.body));
    assert.equal(sent.personalizations[0].to[0].email, 'lead@example.com');
    assert.equal(sent.from.email, 'sales@rezervno.ir', 'EMAIL_FROM باید رعایت شود');
    assert.equal(sent.subject, 'درخواستِ خرید RZ-1');
    assert.equal(sent.content[0].value, 'متنِ سفارش', 'متنِ ایمیل نباید گم شود');
    assert.equal(counterTotal('emailSent'), before + 1);
  });

  test('⚠️ ۲۰۲ (نه ۲۰۰) موفقیتِ SendGrid است', async () => {
    // اگر کسی شرط را به `status === 200` عوض کند، هر ایمیلِ موفق «ناموفق»
    // شمرده می‌شود و آلارمِ کاذب می‌دهد.
    process.env.EMAIL_API_KEY = 'SG.k';
    stubFetch(() => new Response('', { status: 202 }));
    const sentBefore = counterTotal('emailSent');
    const failBefore = counterTotal('emailFailed');
    await sendEmail('x@example.com', 'س', 'م');
    assert.equal(counterTotal('emailSent'), sentBefore + 1);
    assert.equal(counterTotal('emailFailed'), failBefore, 'نباید شکست شمرده شود');
  });

  test('🔴 ردِ ارائه‌دهنده (۴۰۱) شکست شمرده می‌شود و throw نمی‌کند', async () => {
    // کلیدِ نامعتبر با retry درست نمی‌شود؛ retry فقط صف را می‌بندد.
    process.env.EMAIL_API_KEY = 'SG.bad';
    stubFetch(() => new Response('unauthorized', { status: 401 }));
    const before = counterTotal('emailFailed');
    await sendEmail('x@example.com', 'س', 'م');   // نباید throw کند
    assert.equal(counterTotal('emailFailed'), before + 1);
  });

  test('🔴 خطای شبکه throw می‌شود تا صف دوباره تلاش کند', async () => {
    // ⚠️ قراردادِ worker (lib/worker.ts): throw یعنی retry، return یعنی
    // «انجام شد». بلعیدنِ خطای شبکه یعنی ایمیل برای همیشه گم می‌شود — همان
    // اشتباهی که نسخه‌ی قبلی می‌کرد (کلِ try/catch را می‌بلعید).
    process.env.EMAIL_API_KEY = 'SG.k';
    globalThis.fetch = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    const before = counterTotal('emailFailed');
    await assert.rejects(
      () => sendEmail('x@example.com', 'س', 'م'),
      /ECONNRESET/,
      'خطای شبکه باید به worker برسد، نه اینکه بلعیده شود',
    );
    assert.equal(counterTotal('emailFailed'), before + 1);
  });
});

describe('push — صادقانه اعلام‌نشده، نه جعلی', () => {
  installHooks();

  test('🔴 push ارسال نمی‌شود و همین **شمرده** می‌شود', async () => {
    // ترنسپورتِ push ساخته نشده. کارِ درست ساختنِ یک پیاده‌سازیِ جعلی نیست،
    // بلکه ساکت‌نبودن است. مرزِ صداقت در API از قبل درست بود:
    // /me/push-subscribe فیلدِ `ready` را همیشه false برمی‌گرداند.
    const before = counterTotal('pushNotSent');
    await sendPush('user-1', 'عنوان', 'متن');
    assert.equal(counterTotal('pushNotSent'), before + 1);
  });
});
