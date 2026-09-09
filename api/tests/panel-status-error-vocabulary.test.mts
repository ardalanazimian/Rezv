// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Err } from '../src/lib/errors.ts';

// ═══════════════════════════════════════════════════════════════════════
//  واژگانِ خطای پنلِ رستوران — `INVALID_STATUS_TRANSITION`
//
//  اسپک: `docs/audit/design/DS-003-panel-error-vocabulary.md` §۲ و §۴‑۱
//  (نشستِ Designer `rezv-f3 [54834f]`). یافته مالِ اوست؛ اجرا مالِ من.
//
//  ⚠️ نقص: `Err.invalidTransition` پیامش را از مقادیرِ **خامِ** `RStatus`
//  می‌سازد، پس مسئولِ پذیرش در پرترافیک‌ترین مسیرِ سرویس این را می‌دید:
//      «تغییر وضعیت از seated به completed مجاز نیست»
//  و ترجمه‌اش (`STATUS_META`، ۱۷ وضعیت) در **همان فایل** بود.
//
//  ⚠️ این تست **رفتاری** است، نه ساختاری: تابع از `data.js` استخراج و واقعاً
//  **اجرا** می‌شود. پنل جاوااسکریپتِ کلاسیکِ مرورگر است و import نمی‌شود، ولی
//  این تابع خالص است — پس بهانه‌ای برای بسنده‌کردن به grep وجود ندارد.
//  (چیزی که همچنان ادعا نمی‌شود: اینکه toast روی صفحه درست رندر می‌شود.)
// ═══════════════════════════════════════════════════════════════════════

const DATA_JS = fileURLToPath(new URL('../../apps/business/js/data.js', import.meta.url));

/** یک بلاکِ سطح-بالا را از منبع بیرون می‌کشد. */
function block(src: string, startsWith: string, endsWith: string): string {
  const i = src.indexOf(startsWith);
  assert.notEqual(i, -1, `بلاکِ «${startsWith}» در data.js پیدا نشد — نامش عوض شده؟`);
  const j = src.indexOf(endsWith, i);
  assert.notEqual(j, -1, `پایانِ بلاکِ «${startsWith}» پیدا نشد`);
  return src.slice(i, j + endsWith.length);
}

const SRC = readFileSync(DATA_JS, 'utf8');
const sandbox = new Function(
  `${block(SRC, 'const STATUS_META={', '\n};')}
   ${block(SRC, 'function statusChangeErrorText(err){', '\n}')}
   return { statusChangeErrorText, STATUS_META };`,
)() as {
  statusChangeErrorText: (e: unknown) => string;
  STATUS_META: Record<string, { label: string }>;
};
const { statusChangeErrorText, STATUS_META } = sandbox;

describe('واژگانِ خطای پنل — INVALID_STATUS_TRANSITION', () => {

  test('⚠️ کلیدِ خامِ انگلیسی به پرسنل نشان داده نمی‌شود', () => {
    // عینِ چیزی که سرور می‌سازد — نه یک شبیه‌سازیِ دستی.
    const real = Err.invalidTransition('seated', 'completed');
    assert.equal(real.code, 'INVALID_STATUS_TRANSITION');
    assert.match(real.message, /seated/, 'پیامِ سرور واقعاً کلیدِ خام دارد (مبنای این تست)');

    const shown = statusChangeErrorText({
      code: real.code, message: real.message, details: real.details,
    });
    assert.doesNotMatch(shown, /seated|completed/, 'کلیدِ خامِ انگلیسی نباید به پرسنل برسد');
    // ⚠️ برچسبِ انتظاری از خودِ `STATUS_META` می‌آید، نه رشته‌ی هاردکد در تست.
    // نسخه‌ی اولِ این تست «نشسته» را حدس زد در حالی که برچسبِ واقعی «سر میز»
    // است — یعنی تست قرمز شد و کد درست بود. تستی که واژه را دوباره اعلام کند،
    // خودش یک رونوشتِ دوم از همان یک فاکت است.
    assert.ok(shown.includes(STATUS_META.seated.label), 'برچسبِ فارسیِ مبدأ باید بیاید');
    assert.ok(shown.includes(STATUS_META.completed.label), 'برچسبِ فارسیِ مقصد باید بیاید');
  });

  test('⚠️ وضعیتِ ناشناخته جمله‌ی نصفه نمی‌سازد — به پیامِ سرور برمی‌گردد', () => {
    // اگر نگاشتِ پنل از بک‌اند عقب بیفتد، ساختنِ جمله‌ی نصفه آن عقب‌ماندگی را
    // **پنهان** می‌کند. پیامِ خام زشت است ولی صادق.
    const shown = statusChangeErrorText({
      code: 'INVALID_STATUS_TRANSITION',
      message: 'تغییر وضعیت از zzz به completed مجاز نیست',
      details: { from: 'zzz', to: 'completed' },
    });
    assert.match(shown, /zzz/, 'باید همان پیامِ سرور باشد، نه جمله‌ی ساختگی');
  });

  test('کدهای دیگر و حالتِ بی‌خطا دست‌نخورده می‌مانند', () => {
    assert.equal(
      statusChangeErrorText({ code: 'NOT_FOUND', message: 'رزرو پیدا نشد' }),
      'رزرو پیدا نشد',
      'برای کدهای دیگر پیامِ سرور بهترین متن است',
    );
    assert.match(statusChangeErrorText(undefined), /تغییر وضعیت ناموفق بود/);
  });

  test('⚠️ محلِ شکست واقعاً از این تابع استفاده می‌کند', () => {
    // بدونِ این، تابع می‌تواند درست باشد و هیچ‌جا صدا زده نشود.
    const code = SRC.split('\n').map((l) => {
      const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i);
    }).join('\n');
    assert.ok(
      code.includes('toast(\'\',statusChangeErrorText(res.error))'),
      'مسیرِ ردِ سرور در تغییرِ وضعیت باید از statusChangeErrorText رد شود',
    );
  });
});
