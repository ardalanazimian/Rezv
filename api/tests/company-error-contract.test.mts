// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Err } from '../src/lib/errors.ts';

// ═══════════════════════════════════════════════════════════════════════
//  قراردادِ خطای پنلِ شرکت — و مکانیزمِ ۴۲۹ که دیگر رونوشت ندارد
//
//  اسپک: `docs/audit/design/DS-003-panel-error-vocabulary.md` §۴‑۳ و §۴‑۵.
//
//  ⚠️ اندازه‌گیریِ پیش از ساختن: `apps/company` از ۲۸ کدِ `errors.ts` **صفر**
//  تا را مصرف می‌کرد — بدتر از پنلِ کسب‌وکار با دوتا. ۲۵ جا پیامِ سرور را
//  نمایش می‌دادند (درست است) ولی هیچ‌جا روی `code` شاخه نمی‌زد، پس هیچ خطایی
//  به کارِ قابلِ انجام ختم نمی‌شد.
//
//  ⚠️ حساس‌ترین ردیفِ کلِ سیستم روی همین پنل است: `adminTotpLogin` سقفِ
//  **۵ در ۱۵ دقیقه** دارد (`ratelimit.ts:237`) — بلندترین پنجره — و مسیرِ
//  ورودِ مدیرِ پلتفرم است. پیش از این رفع، یک توستِ چندثانیه‌ای برای قفلِ
//  ۱۵دقیقه‌ای نشان داده می‌شد و `reset()` دکمه را فوراً آزاد می‌کرد، پس هر
//  تلاشِ دوباره **پنجره را تمدید می‌کرد**.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8');

const CO_SHARED = read('apps/company/js/rate-limit-ui.js');
const CO_SRC = read('apps/company/js/api-errors.js');
const BZ_SHARED = read('apps/business/js/rate-limit-ui.js');

// sandbox همان ترتیبِ `index.html` را بار می‌کند: rate-limit-ui پیش از api-errors.
const co = new Function(`${CO_SHARED}
${CO_SRC}
  return { CO_ERROR_MAP, CO_ERROR_ACTIONS, coErrorText, coErrorAction, coErrorIcon,
           coRateLimitText, rateLimitPlan, holdButtonForRetry };`,
)() as {
  CO_ERROR_MAP: Record<string, { admin: string | null; action: string }>;
  CO_ERROR_ACTIONS: Record<string, string>;
  coErrorText: (e: unknown, fb?: string, fa?: (n: number) => string) => string;
  coErrorAction: (e: unknown) => string;
  coErrorIcon: (e: unknown) => string;
  coRateLimitText: (e: unknown, fa?: (n: number) => string) => string;
  rateLimitPlan: (e: unknown) => { tier: string; sec: number | null; minutes?: number; countdown: boolean; holdSec: number };
  holdButtonForRetry: (btn: any, e: unknown, restore: string, fa?: (n: number) => string) => unknown;
};

describe('قراردادِ خطای پنلِ شرکت', () => {

  test('⚠️ هر کدِ نگاشت واقعاً در errors.ts وجود دارد', () => {
    const real = new Set<string>();
    for (const f of Object.values(Err as Record<string, unknown>)) {
      if (typeof f !== 'function') continue;
      try {
        const e: any = (f as (...a: unknown[]) => unknown)(1, 1);
        if (e?.code) real.add(e.code);
      } catch { /* سازنده‌ای که با این ورودی نمی‌سازد */ }
    }
    const ghosts = Object.keys(co.CO_ERROR_MAP).filter((c) => !real.has(c));
    assert.deepEqual(ghosts, [], `پنل کدی را ادعا می‌کند که سرور نمی‌دهد: ${ghosts.join(', ')}`);
  });

  test('⚠️ هر ردیف کارِ معتبر دارد، و مخاطبش مدیرِ پلتفرم است نه مهمان', () => {
    const valid = new Set(Object.values(co.CO_ERROR_ACTIONS));
    for (const [code, row] of Object.entries(co.CO_ERROR_MAP)) {
      assert.ok(valid.has(row.action), `کدِ ${code} کارِ نامعتبر دارد: ${row.action}`);
    }
    // متنِ سرور برای مشتری نوشته شده؛ جایی که متنِ اختصاصی داریم باید فرق کند.
    const unauth = Err.unauthorized();
    assert.notEqual(
      co.coErrorText({ code: unauth.code, message: unauth.message }), unauth.message,
      'جایی که متنِ مدیر داریم، نباید پیامِ مشتری تکرار شود',
    );
  });

  test('⚠️ VALIDATION/CONFLICT پیامِ سرور را بازنویسی نمی‌کنند', () => {
    // پیامِ سرور مشخص‌تر است: کدام فیلد، کدام slug، کدام نامِ کاربری.
    const v = Err.validation('نامِ رستوران الزامی است');
    assert.equal(co.coErrorText({ code: v.code, message: v.message }), v.message);
    assert.equal(co.CO_ERROR_MAP.VALIDATION.admin, null);
    assert.equal(co.CO_ERROR_MAP.CONFLICT.admin, null);
  });

  test('⚠️ قفلِ ۱۵دقیقه‌ای: عددِ ثابت، بدونِ شمارنده‌ی زنده، و «شلوغه» نمی‌گوید', () => {
    // `adminTotpLogin` = ۵ در ۱۵ دقیقه → بدترین حالتِ واقعیِ این پنل.
    const err = { code: 'RATE_LIMITED', details: { retryAfterSec: 900 } };
    const plan = co.rateLimitPlan(err);
    assert.equal(plan.tier, 'locked');
    assert.equal(plan.countdown, false, 'شمارنده‌ی ۱۵دقیقه‌ای فقط کاربر را به تماشا وامی‌دارد');
    assert.equal(plan.minutes, 15);

    const txt = co.coRateLimitText(err);
    assert.match(txt, /قفل/);
    assert.doesNotMatch(txt, /شلوغ/,
      'ورودِ ناموفقِ مدیر یعنی رمز/TOTP غلط بوده — «شلوغه» او را به تکرارِ همان کار می‌فرستد');
    assert.match(txt, /تمدید/, 'باید بگوید تلاشِ دوباره پنجره را تمدید می‌کند');
    assert.equal(co.coErrorAction(err), 'wait');
    assert.notEqual(co.coErrorAction(err), 'retry');
  });

  test('⚠️ عددِ نداده اختراع نمی‌شود', () => {
    const txt = co.coRateLimitText({ code: 'RATE_LIMITED', details: {} });
    assert.doesNotMatch(txt, /[0-9۰-۹]/);
  });

  test('⚠️ دکمه قفل می‌شود و سطحِ قفل شمارنده روی دکمه نمی‌گذارد', () => {
    const btn: any = { disabled: false, textContent: 'ورود به پنل' };
    const t = co.holdButtonForRetry(btn, { code: 'RATE_LIMITED', details: { retryAfterSec: 900 } }, 'ورود به پنل');
    assert.equal(btn.disabled, true);
    assert.equal(btn.textContent, 'ورود به پنل');
    clearTimeout(t as any);
  });

  test('⚠️ مسیرِ ورودِ TOTP واقعاً از قرارداد رد می‌شود و reset() را صدا نمی‌زند', () => {
    // `reset()` دکمه را آزاد می‌کرد — همان چیزی که قفل را بی‌اثر می‌کرد.
    const src = read('apps/company/js/intelligence.js');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); }).join('\n');
    const i = code.indexOf("res.error?.code === 'RATE_LIMITED'");
    assert.notEqual(i, -1, 'مسیرِ ورود باید ۴۲۹ را تفکیک کند');
    // ⚠️ بُرش تا **پایانِ همان شاخه** (`return;`)، نه یک پنجره‌ی ثابت.
    // نسخه‌ی اول ۶۰۰ کاراکتر می‌برید و از شاخه بیرون می‌زد، پس `reset();`ِ
    // مسیرِ «رمز غلط» را می‌دید و قرمزِ کاذب می‌داد — کد درست بود و assert
    // زیادی پهن. سومین بار در دو روز که بُرشِ بی‌مرز مرا گول زد.
    const ret = code.indexOf('return;', i);
    assert.notEqual(ret, -1, 'شاخه باید return داشته باشد');
    const block = code.slice(i, ret);
    assert.ok(block.includes('holdButtonForRetry('), 'و دکمه را نگه دارد');
    assert.ok(!/\breset\(\);/.test(block), 'reset() نباید در این شاخه صدا زده شود — دکمه را آزاد می‌کند');
  });

  test('⚠️ فایل‌ها در index.html به ترتیبِ درست ثبت شده‌اند', () => {
    const html = read('apps/company/index.html');
    const sh = html.indexOf('js/rate-limit-ui.js');
    const ae = html.indexOf('js/api-errors.js');
    const api = html.indexOf('js/api.js');
    assert.ok(sh !== -1 && ae !== -1, 'هر دو باید ثبت شده باشند');
    assert.ok(sh < ae, 'مکانیزمِ مشترک باید پیش از نگاشت بار شود');
    assert.ok(ae < api, 'و هر دو پیش از api.js');
  });

  test('⚠️ هیچ‌کدام export ندارند — یک export کلِ پنلِ کلاسیک را می‌کشد', () => {
    assert.ok(!/^\s*export\s/m.test(CO_SRC), 'api-errors.js پنلِ شرکت');
    assert.ok(!/^\s*export\s/m.test(CO_SHARED), 'نسخه‌ی globalِ rate-limit-ui.js');
  });

  test('⚠️ مکانیزمِ ۴۲۹ رونوشت ندارد — هر دو پنل بایت‌به‌بایت یکی‌اند', () => {
    // ⚠️ این مهم‌ترین assertِ این فایل است. عددهای ۱۰ و ۱۲۰ و قاعده‌ی «هرگز
    // retryِ خودکار» یک واقعیتِ واحدند؛ دو رونوشت بالاخره واگرا می‌شود —
    // همان کلاسی که این مخزن پنج بار در یک روز پرداختش. هر دو از
    // `shared/js/rate-limit-ui.js` ساخته می‌شوند، پس باید یکی باشند.
    assert.equal(CO_SHARED, BZ_SHARED,
      'نسخه‌ی پنلِ شرکت و کسب‌وکار واگرا شده — sync را دوباره اجرا کن');
    // و هیچ پنلی نباید مرزها را دوباره اعلام کند.
    for (const [label, src] of Object.entries({
      'company/api-errors.js': CO_SRC,
      'business/api-errors.js': read('apps/business/js/api-errors.js'),
    })) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); }).join('\n');
      assert.ok(!/RATE_LIMIT_(BRIEF|LOCK)_SEC\s*=/.test(code),
        `${label}: مرزها را دوباره اعلام کرده — باید از فایلِ مشترک بیایند`);
    }
  });
});
