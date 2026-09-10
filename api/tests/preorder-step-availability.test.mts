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

/** `bookStepLoading` را با `esc`/`bk`ِ تزریق‌شده **واقعاً اجرا** می‌کند. */
function loadingHtml(r: unknown, bk: unknown): string {
  const i = BOOKING.indexOf('function bookStepLoading(r){');
  assert.notEqual(i, -1, 'bookStepLoading پیدا نشد — نامش عوض شده؟');
  const body = BOOKING.slice(i, BOOKING.indexOf('\n}', i) + 2);
  return new Function('esc', 'bk', `${body}; return bookStepLoading(${JSON.stringify(r)});`)(
    (s: unknown) => String(s ?? ''), bk,
  ) as string;
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
    const decide = fn.indexOf('menuUnavailable');
    assert.notEqual(ask, -1,
      'openBookingFlow حالتِ «نمی‌دانم» را تشخیص نمی‌دهد ⇒ نامعلوم را «ندارد» می‌خواند');
    assert.ok(ask < decide,
      'بارگذاریِ جزئیات باید **پیش از** تصمیم باشد؛ بعد از آن بی‌اثر است');
    assert.match(fn, /await\s+loadRestaurantDetail/,
      'باید واقعاً جزئیات را بگیرد، نه اینکه فقط پرچم را ببیند');
  });

  test('⚠️ بازخورد پیش از شبکه — چیپِ ساعت نباید مرده به‌نظر برسد', () => {
    // ⚠️ این ردیف را طراح روی نسخه‌ی اولِ رفعِ من گرفت و حق داشت: مسیرِ فید
    // **همان مسیرِ سریع** است، و من با `async` کردنِ تابع، بازشدنِ شیت را
    // پشتِ یک رفت‌وبرگشتِ شبکه بردم. روی شبکه‌ی کند، کاربر می‌زند و هیچ
    // اتفاقی نمی‌افتد — یعنی یک نقص را با نقصِ دیگری عوض کرده بودم.
    const code = codeOnly(BOOKING);
    const i = code.search(/(?:export\s+)?(?:async\s+)?function\s+openBookingFlow\s*\(/);
    const fn = code.slice(i, code.indexOf('\n}', i));
    const paint = fn.indexOf('openSheet(');
    const net = fn.indexOf('await');
    assert.notEqual(paint, -1, 'هیچ شیتی باز نمی‌شود؟');
    assert.ok(net === -1 || paint < net,
      'اولین openSheet باید **پیش از** اولین await باشد، وگرنه زدنِ چیپ بی‌پاسخ می‌ماند');
  });

  test('⚠️ اسکلت فقط چیزی را می‌پوشاند که نمی‌دانیم', () => {
    // ⚠️ قاعده‌ی طراح، و نسخه‌ی اولِ من نقضش می‌کرد: شیتِ سراسر-اسکلت خطرِ
    // «خراب است» خوانده‌شدن دارد، و نامِ رستوران و تاریخ·ساعت·تعداد در این
    // لحظه **کاملاً معلوم‌اند** (از رکوردِ فید و از `bk` که هر دو صداکننده
    // پیش از فراخوانی ست می‌کنند). پنهان‌کردنِ دانسته پشتِ shimmer، تأخیرِ
    // ادراک‌شده را بی‌دلیل بالا می‌برد.
    const html = loadingHtml(
      { n: 'کافه تهران' },
      { date: 'پنجشنبه ۱۹ شهریور', time: '۲۰:۳۰', party: '۴ نفر' },
    );
    assert.match(html, /کافه تهران/, 'نامِ رستوران معلوم است و باید فوراً دیده شود');
    assert.match(html, /پنجشنبه ۱۹ شهریور/, 'تاریخ معلوم است');
    assert.match(html, /۲۰:۳۰/, 'ساعت معلوم است');
    assert.match(html, /۴ نفر/, 'تعداد معلوم است');
    assert.match(html, /class="sk"/, 'بدنه‌ی نامعلوم باید اسکلت باشد');
    // و آنچه نباید باشد:
    assert.doesNotMatch(html, /stepBars|step-bar/,
      'نوارِ مرحله نباید پیش از دانستنِ شمارش رندر شود — جهتِ دیررس از نبودِ جهت بدتر است');
    assert.doesNotMatch(html, /تأیید اطلاعات/,
      'عنوانِ مخصوصِ گام باید همراهِ بدنه بیاید، نه در سرتیترِ زودرس');
  });

  test('⚠️ اگر bk خالی باشد، سرتیتر ادعای جعلی نمی‌سازد', () => {
    // مسیرهای دیگر ممکن است bk را ست نکرده باشند؛ نباید « · · » یا یک
    // رشته‌ی نصفه نشان داده شود.
    const html = loadingHtml({ n: 'کافه تهران' }, {});
    assert.match(html, /کافه تهران/);
    assert.doesNotMatch(html, /·/, 'بدونِ داده، جداکننده‌ی خالی هم نباید رندر شود');
  });

  test('⚠️ وقتی می‌دانیم، هیچ رفت‌وبرگشتی نمی‌رود (مسیرِ سریع سریع می‌ماند)', () => {
    const code = codeOnly(BOOKING);
    const i = code.search(/(?:export\s+)?(?:async\s+)?function\s+openBookingFlow\s*\(/);
    const fn = code.slice(i, code.indexOf('\n}', i));
    // شرطِ «می‌دانیم» باید کلِ بلوکِ شبکه را در بر بگیرد، نه اینکه await
    // بی‌قیدوشرط اجرا شود.
    assert.match(fn, /if\s*\(\s*!known\s*\)/,
      'بلوکِ بارگذاری باید پشتِ شرطِ «نمی‌دانیم» باشد');
    assert.ok(fn.indexOf('const known') < fn.indexOf('await'),
      'تشخیصِ «می‌دانیم» باید پیش از هر awaitی باشد');
    // و بولینِ فید (اگر روزی بیاید) باید همان‌جا حساب شود.
    assert.match(fn, /hasOrderableMenu/,
      'بولینِ فید باید در تشخیصِ «می‌دانیم» دیده شود — وگرنه وقتی سرور بدهدش، ' +
      'اپ همچنان بی‌دلیل درخواست می‌فرستد');
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
