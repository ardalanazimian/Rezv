// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  DS-002 §۳‑۱ — گامِ ۲ فقط وقتی رندر شود که چیزی برای تصمیم داشته باشد
//
//  اسپک: `docs/audit/design/DS-002-customer-booking-flow-tapcount.md §۳`
//  (نشستِ Designer). یافته مالِ اوست؛ اجرا مالِ من.
//
//  ⚠️ **این تست کوتاه‌سازیِ فلو را تأیید نمی‌کند.** استدلالِ اولِ اسپک
//  («۳ ضربه → ۲») با حکمِ مالک در ۲۰۲۶-۰۹-۰۹ («سه ضربه خوب است») **مرده**
//  است. آنچه اینجا قفل می‌شود این است: روی مسیرِ **اصلی** همان سه گام
//  می‌ماند، و گامِ بی‌تصمیم رندر نمی‌شود.
//
//  ⚠️ و این نکته‌ی ابطال‌پذیریِ خودِ Designer است، که تستِ یک‌طرفه را بی‌ارزش
//  می‌کند: assertِ «مسیرِ بی‌منو دو گام است» با **حذفِ کاملِ گامِ ۲** هم سبز
//  می‌شود و پیش‌سفارش بی‌صدا می‌میرد. پس هر دو جهت پین می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const SRC = readFileSync(
  fileURLToPath(new URL('../../apps/customer/js/data/booking.js', import.meta.url)), 'utf8',
);

/** توابعِ خالصِ فلو را از منبع بیرون می‌کشد و **واقعاً اجرا** می‌کند. */
function sandbox() {
  const pick = (start: string, end = '\n}') => {
    const i = SRC.indexOf(start);
    assert.notEqual(i, -1, `بلاکِ «${start}» پیدا نشد — نامش عوض شده؟`);
    const j = SRC.indexOf(end, i);
    return SRC.slice(i, j + end.length);
  };
  return new Function(`
    ${pick('export function orderableMenu(r){').replace('export ', '')}
    ${pick('export function bookingStepCount(r){').replace('export ', '')}
    ${pick('function stepBars(total, current){')}
    return { orderableMenu, bookingStepCount, stepBars };
  `)() as {
    orderableMenu: (r: unknown) => unknown[];
    bookingStepCount: (r: unknown) => number;
    stepBars: (total: number, current: number) => string;
  };
}

const flow = sandbox();
const bars = (html: string) => (html.match(/class="step-bar/g) || []).length;

/**
 * فقط **کد** — کامنت‌های `//` و بلاکِ `/* *\/` هر دو حذف می‌شوند.
 *
 * ⚠️ چرا بلاک هم لازم شد: نسخه‌ی اولِ این تست فقط `//` را می‌گرفت و روی
 * کامنتِ JSDocِ خودِ `openBookingFlow` افتاد — که عمداً کدِ قدیمی
 * (`openSheet(bookStep2(findR(id)))`) را نقل می‌کند. یعنی تست «دو صداکننده»
 * گزارش داد در حالی که یکی‌شان یک جمله بود. **همان کلاسی که دیروز هم
 * گرفتارش شدم: assert روی نثر، نه کد.** تستی که نقلِ تاریخچه را ممنوع کند
 * بد است؛ پس نثر حذف می‌شود، نه ممنوع.
 */
function codeOnly(src: string): string {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlocks
    .split('\n')
    .map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); })
    .join('\n');
}

describe('DS-002 §۳‑۱ — شمارِ گام‌ها از واقعیت می‌آید', () => {

  test('⚠️ رستورانِ با منویِ id-دار **سه** گام می‌ماند — تعدادِ ضربه عوض نشد', () => {
    // نیمه‌ی مهم‌ترِ ابطال‌پذیری: اگر کسی گامِ ۲ را کلاً حذف کند، این می‌افتد.
    const withMenu = { menu: [{ id: 'm1', e: '🍝', n: 'پاستا' }, { id: 'm2', e: '🥗', n: 'سالاد' }] };
    assert.equal(flow.bookingStepCount(withMenu), 3);
    assert.equal(flow.orderableMenu(withMenu).length, 2, 'هر دو آیتم باید قابلِ پیش‌سفارش باشند');
    assert.equal(bars(flow.stepBars(3, 2)), 3, 'نوار هم باید سه‌تا باشد');
  });

  test('⚠️ رستورانِ بی‌منویِ قابلِ‌سفارش **دو** گام دارد — گامِ بی‌تصمیم رندر نمی‌شود', () => {
    for (const [label, r] of Object.entries({
      'منویِ خالی': { menu: [] },
      'منوی غایب (مسیرِ فید — اندپوینتِ فهرست menu نمی‌دهد)': {},
      'آیتمِ بدونِ id (دادهٔ نمونه‌ی seed.js)': { menu: [{ e: '🍝', n: 'پاستا' }] },
      'آیتمِ ناموجود': { menu: [{ id: 'm1', out: true, e: '🍝', n: 'پاستا' }] },
    })) {
      assert.equal(flow.bookingStepCount(r), 2, `${label}: باید دو گام باشد`);
      assert.equal(flow.orderableMenu(r).length, 0, `${label}: چیزی برای تصمیم نیست`);
    }
  });

  test('⚠️ نوارِ مرحله با شمارِ واقعی می‌خواند، نه سه‌تایِ ثابت', () => {
    // نقصِ قبلی: مارک‌آپِ سه‌نواریِ هاردکد در هر دو گام. روی مسیرِ فید یعنی
    // نوار همین حالا هم **دروغ می‌گفت** — سه مرحله نشان می‌داد که یکی‌شان
    // هیچ تصمیمی نداشت.
    assert.equal(bars(flow.stepBars(2, 2)), 2);
    assert.equal(bars(flow.stepBars(3, 3)), 3);
    // آخرین نوار باید `now` باشد و قبلی‌ها `done` — نه همه‌شان خالی.
    assert.match(flow.stepBars(2, 2), /step-bar done.*step-bar now/s);
    assert.ok(!/step-bar"/.test(flow.stepBars(2, 2)), 'در گامِ آخر نوارِ خالی نباید بماند');
  });

  test('⚠️ هیچ مارک‌آپِ سه‌نواریِ هاردکدی باقی نمانده', () => {
    const code = SRC.split('\n').map((l) => {
      const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i);
    }).join('\n');
    assert.ok(
      !/<div class="steps"><div class="step-bar/.test(code),
      'نوارِ مرحله باید از stepBars() بیاید — مارک‌آپِ ثابت یعنی عددی که با واقعیت واگرا می‌شود',
    );
  });

  test('⚠️ هر دو صداکننده از یک درِ ورودیِ مشترک می‌روند', () => {
    // پیش‌تر `quickBook` و `startBook` هر دو عیناً
    // `openSheet(bookStep2(findR(id)))` داشتند — یک منطق، دو رونوشت.
    const code = codeOnly(SRC);
    assert.equal(
      (code.match(/openSheet\(bookStep2\(/g) || []).length, 1,
      'تنها یک جا مجاز است گامِ ۲ را باز کند: openBookingFlow',
    );
    assert.equal((code.match(/openBookingFlow\(id\);/g) || []).length, 2,
      'هر دو صداکننده باید از openBookingFlow بروند');
  });

  test('⚠️ پریدن از گامِ ۲ پیش‌سفارش را بی‌صدا کهنه نمی‌گذارد', () => {
    // `toBookStep3` تنها نویسنده‌ی `bk.preorder` بود و با پریدن اجرا نمی‌شود.
    const code = SRC.split('\n').map((l) => {
      const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i);
    }).join('\n');
    // ⚠️ [A1-007 · ۲۰۲۶-۰۹-۱۰] لنگر از رشته‌ی دقیق به الگو تبدیل شد، و **ادعا
    // دست‌نخورده ماند**. `openBookingFlow` حالا `async` است چون پیش از تصمیم
    // درباره‌ی منو، حالتِ «هنوز نمی‌دانم» را می‌پرسد؛ رشته‌ی دقیقِ قبلی
    // (`export function openBookingFlow(id){`) دیگر مچ نمی‌شد و این تست
    // قرمز می‌شد **بدونِ اینکه چیزی که می‌سنجد نقض شده باشد** —
    // `bk.preorder = []` هنوز هست و هنوز پیش از `openSheet(bookStep3` است.
    // یعنی قرمزیِ آن از امضا می‌آمد نه از رفتار: همان کلاسِ «تست به شکلِ کد
    // پین شده، نه به معنایش». الگو نامِ تابع را همچنان دقیق می‌خواهد، پس
    // تغییرِ نام یا حذفِ تابع همچنان درست قرمز می‌کند.
    const i = code.search(/(?:export\s+)?(?:async\s+)?function\s+openBookingFlow\s*\(/);
    assert.notEqual(i, -1, 'تعریفِ openBookingFlow پیدا نشد — نامش عوض شده یا تابع رفته؟');
    const body = code.slice(i, code.indexOf('\n}', i));
    assert.match(body, /bk\.preorder\s*=\s*\[\]/,
      'مسیرِ پرش باید bk.preorder را صریح خالی کند');
    assert.ok(body.indexOf('bk.preorder') < body.indexOf('openSheet(bookStep3'),
      'و این باید **پیش از** بازکردنِ گامِ ۳ باشد');
  });
});
