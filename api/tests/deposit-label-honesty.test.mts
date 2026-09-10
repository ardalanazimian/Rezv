// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  BE-004/ب — بندِ «آنلاین دریافت نمی‌شود» مشتق شود، نه ادعا
//
//  یافته: Backend Engineer (`rezv-89`)، نیمه‌ی «الف» فیلد را به پاسخ آورد.
//  حکمِ CEO: «الف» تنها با «ب» به main می‌رود — گاردِ «الف» فقط **در دسترس
//  بودنِ داده** را می‌سنجد، نه صداقتِ متن را. یک گاردِ سبز کنارِ یک متنِ دروغ
//  از نبودِ گارد بدتر است.
//
//  ⚠️ نقص: `depositLabel()` می‌گفت «آنلاین دریافت نمی‌شود» — یک ادعای
//  **مثبت** درباره‌ی درگاه — در حالی که `payment_enabled` در هیچ پاسخِ
//  روبه‌مشتری‌ای نبود. اپ داده‌ی لازم برای راست‌گفتن را نداشت و با این حال
//  حرف می‌زد. همان نقصِ P1-3، یک فیلد جلوتر.
//
//  ⚠️ و تله‌ای که خودم نزدیک بود در آن بیفتم: نسخه‌ی اولِ رفعِ من برای حالتِ
//  `true` می‌گفت «پرداختِ آنلاین فعال است» — که **ادعای مثبتِ تازه‌ای** بود
//  درباره‌ی کاری که این اپ انجام نمی‌دهد: صفر فراخوان به
//  `/reservations/:code/pay`. یعنی داشتم دقیقاً همان کلاسی را می‌ساختم که
//  رفعش می‌کردم. این تست هر دو جهت را می‌بندد.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8');
const SRC = read('apps/customer/js/data/booking.js');

/** `depositLabel` را از منبع بیرون می‌کشد و **واقعاً اجرا** می‌کند. */
function depositLabel(): (r: unknown) => string {
  const i = SRC.indexOf('export function depositLabel(r){');
  assert.notEqual(i, -1, 'depositLabel پیدا نشد — نامش عوض شده؟');
  const body = SRC.slice(i, SRC.indexOf('\n}', i) + 2).replace('export ', '');
  return new Function(`${body}; return depositLabel;`)() as (r: unknown) => string;
}

const label = depositLabel();

describe('BE-004/ب — برچسبِ بیعانه از داده مشتق می‌شود', () => {

  test('⚠️ فیلد واقعاً به مشتری می‌رسد (مبنای نیمه‌ی «ب»)', () => {
    // اگر نیمه‌ی «الف» برداشته شود، این رفع بی‌پایه می‌شود و باید بداند —
    // نه اینکه بی‌صدا به حالتِ «نامعلوم» بیفتد و کسی نفهمد.
    const route = read('api/src/app/api/v1/restaurants/[slug]/route.ts');
    assert.match(route, /online_payment_enabled/,
      'اندپوینتِ مشتری این کلید را نمی‌دهد ⇒ «ب» داده‌ای برای مشتق‌شدن ندارد');
    const api = read('apps/customer/js/api.js');
    assert.match(api, /onlinePaymentEnabled:\s*apiR\.booking_policy\?\.online_payment_enabled/,
      'اپ کلید را نگاشت نمی‌کند');
    assert.match(api, /online_payment_enabled\s*\?\?\s*null/,
      '`?? null` لازم است: اندپوینتِ فهرست این کلید را نمی‌دهد، پس نامعلوم واقعی است');
  });

  test('⚠️ درگاهِ خاموش: همان جمله‌ی قبلی، ولی حالا **مشتق**', () => {
    const t = label({ depositRequired: true, onlinePaymentEnabled: false });
    assert.match(t, /آنلاین دریافت نمی‌شود/);
  });

  test('⚠️ درگاهِ روشن: «فعال است» گفته نمی‌شود — این اپ پول نمی‌گیرد', () => {
    // تله‌ای که خودم ساختم و گرفتم. `true` یعنی درگاهِ **رستوران** روشن است،
    // نه اینکه اینجا پرداخت انجام شود.
    const t = label({ depositRequired: true, onlinePaymentEnabled: true });
    assert.doesNotMatch(t, /آنلاین دریافت نمی‌شود/, 'وقتی درگاه روشن است این جمله دروغ است');
    assert.doesNotMatch(t, /پرداختِ آنلاین فعال است/,
      'ادعای مثبتِ تازه — اپ صفر فراخوان به /reservations/:code/pay دارد');
    assert.match(t, /از این اپ انجام نمی‌شود/, 'باید بگوید پرداخت اینجا انجام نمی‌شود');
  });

  test('⚠️ نامعلوم → سکوت درباره‌ی درگاه، نه حدس', () => {
    // مسیرِ فید: اندپوینتِ فهرست این کلید را نمی‌دهد.
    const t = label({ depositRequired: true, onlinePaymentEnabled: null });
    assert.match(t, /سیاستِ بیعانه دارد/, 'سیاست واقعی است و باید گفته شود');
    assert.doesNotMatch(t, /آنلاین|اپ/, 'درباره‌ی درگاه هیچ ادعایی نباید بشود');
  });

  test('⚠️ حالت‌های قبلی دست‌نخورده‌اند', () => {
    assert.match(label({ depositRequired: false }), /بدون پیش‌پرداخت/);
    assert.equal(label({}), '', 'سیاستِ نامعلوم → سکوت، همان قاعده‌ی P1-3');
  });
});
