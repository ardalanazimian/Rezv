// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  A1-007 — «منو ندارد» و «هنوز نمی‌دانم» یک چیز نیستند
//
//  ⚠️ این ردیف از **جاروی کلاسی** درآمد که CEO بعدِ BE-004 خواست: «تستی که
//  یک روت را پین می‌کند در حالی که اپ از فیدِ دیگری می‌خواند». همان‌جا بود،
//  یک لایه بالاتر — و این بار قربانی‌اش یک **فیچرِ کامل** بود، نه یک برچسب.
//
//  زنجیره‌ای که سنجیدم (نه استنتاج — هر حلقه grep شد):
//    discover.js:47   چیپِ ساعت روی کارتِ فید → quickBook(r.id, slot)
//    booking.js       quickBook → openBookingFlow(id) → findR(id)  ← شیءِ فید
//    restaurants/route.ts  `select` منو ندارد
//    api.js           رستورانِ زنده (`isLive`) منو را از دادهٔ نمونه قرض نمی‌گیرد
//    api.js           `menu` را **فقط** applyRestaurantDetail می‌نویسد،
//                     و آن فقط از enrichRestPage یعنی **صفحه‌ی رستوران** می‌آید
//
//  نتیجه: رستورانِ زنده‌ای با منوی واقعی، اگر از چیپِ کارت رزرو می‌شد، گامِ
//  پیش‌سفارش را **هرگز** نمی‌دید؛ همان رستوران از صفحه‌ی خودش، می‌دید. فیچر
//  بی‌صدا به مسیرِ ورود وابسته بود و هیچ خطایی هم نمی‌داد.
//
//  ⚠️ و این دقیقاً همان کلاسِ `?? false` در برابرِ `?? null` است که همین امروز
//  در BE-004/ب رفع شد: **نامعلوم به‌عنوانِ منفی مصرف شود.** آنجا یک جمله دروغ
//  می‌شد، اینجا یک قابلیت ناپدید می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8');
const BOOKING = read('apps/customer/js/data/booking.js');

function codeOnly(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); })
    .join('\n');
}

/** `orderableMenu` را از منبع بیرون می‌کشد و **واقعاً اجرا** می‌کند. */
function orderableMenu(): (r: unknown) => unknown[] {
  const i = BOOKING.indexOf('export function orderableMenu(r){');
  assert.notEqual(i, -1, 'orderableMenu پیدا نشد — نامش عوض شده؟');
  const body = BOOKING.slice(i, BOOKING.indexOf('\n}', i) + 2).replace('export ', '');
  return new Function(`${body}; return orderableMenu;`)() as (r: unknown) => unknown[];
}

describe('A1-007 — گامِ پیش‌سفارش روی دادهٔ نامعلوم حذف نمی‌شود', () => {

  test('⚠️ ابهام واقعی است: منوی نبود و منوی خالی یک خروجی می‌دهند', () => {
    // این تستِ «مبنا»ست: نشان می‌دهد چرا صرفِ شمردن کافی نیست.
    const om = orderableMenu();
    assert.equal(om({}).length, 0, 'منوی بارگذاری‌نشده ⇒ صفر');
    assert.equal(om({ menu: [] }).length, 0, 'منوی واقعاً خالی ⇒ همان صفر');
    // یعنی خودِ عدد نمی‌تواند این دو را از هم جدا کند — تمایز باید **بیرون**
    // از این تابع و پیش از تصمیم گرفته شود.
  });

  test('⚠️ روتِ فهرست منو نمی‌دهد ⇒ روی مسیرِ فید واقعاً نامعلوم است', () => {
    const list = codeOnly(read('api/src/app/api/v1/restaurants/route.ts'));
    const sel = list.slice(list.indexOf('select: {'), list.indexOf('select: {') + 900);
    assert.ok(!/\bmenu\b/.test(sel),
      'اگر روزی روتِ فهرست منو بدهد، دلیلِ این رفع عوض می‌شود و باید بازخوانی شود');
  });

  test('⚠️ ورودیِ فید واقعاً به همین تصمیم می‌رسد (نه یک مسیرِ نظری)', () => {
    // چیپِ ساعتِ کارت → quickBook، و quickBook → openBookingFlow.
    const discover = codeOnly(read('apps/customer/js/data/discover.js'));
    assert.match(discover, /quickBook\(/, 'چیپِ ساعتِ کارت باید به quickBook برود');
    const code = codeOnly(BOOKING);
    const qb = code.slice(code.indexOf('export function quickBook'));
    assert.match(qb.slice(0, qb.indexOf('\n}')), /openBookingFlow\(/,
      'quickBook باید به openBookingFlow برود — اگر نه، این تست دیگر چیزی را نمی‌سنجد');
  });

  test('⚠️ پیش از تصمیم، نامعلوم بودن **پرسیده** می‌شود', () => {
    const code = codeOnly(BOOKING);
    // ⚠️ باید **تعریف** را بگیریم نه اولین صداکننده را. اولین رخدادِ
    // «openBookingFlow» در فایل داخلِ `quickBook` است، و بریدن از آنجا یک
    // بلوکِ کوچکِ بی‌ربط می‌دهد که همیشه قرمز می‌شود — نسخه‌ی اولِ همین تست
    // دقیقاً همین را کرد و مرا به «رفع کار نمی‌کند» گمراه کرد.
    const i = code.search(/(?:export\s+)?(?:async\s+)?function\s+openBookingFlow\s*\(/);
    assert.notEqual(i, -1, 'تعریفِ openBookingFlow پیدا نشد — نامش عوض شده؟');
    const fn = code.slice(i, code.indexOf('\n}', i));
    // ترتیب مهم است: پرسش باید **قبل از** شمردن باشد، وگرنه بی‌فایده است.
    const ask = fn.indexOf('detailLoaded');
    const decide = fn.indexOf('orderableMenu');
    assert.notEqual(ask, -1,
      'openBookingFlow حالتِ «نمی‌دانم» را تشخیص نمی‌دهد ⇒ نامعلوم را «ندارد» می‌خواند');
    assert.ok(ask < decide,
      'بارگذاریِ جزئیات باید **پیش از** شمردنِ منو باشد؛ بعد از آن بی‌اثر است');
    assert.match(fn, /await\s+loadRestaurantDetail/,
      'باید واقعاً جزئیات را بگیرد، نه اینکه فقط پرچم را ببیند');
  });

  test('⚠️ رفتارِ «منو ندارد» دست‌نخورده است — این رفع فیچری اضافه نمی‌کند', () => {
    // رستورانی که واقعاً منو ندارد باید همچنان دو گامی بماند؛ اگر این تست
    // روزی قرمز شد یعنی رفع از حدِ خودش فراتر رفته.
    const code = codeOnly(BOOKING);
    assert.match(code, /orderableMenu\(r\)\.length\s*===\s*0/,
      'شاخه‌ی «منو ندارد» باید بماند');
    assert.match(code, /bookingStepCount|stepBars/,
      'شمارشِ گام‌ها باید همچنان از منو مشتق شود، نه عددِ ثابت');
  });
});
