import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  محافظ‌های CSS
//
//  اینجا رفتارِ بصری تست نمی‌شود — آن کارِ مرورگر است. اینجا فقط چند قاعده‌ی
//  حیاتی که یک‌بار واقعاً شکستند و در مرورگر پیدا شدند قفل می‌شوند تا با
//  ویرایشِ بعدی بی‌صدا برنگردند.
// ═══════════════════════════════════════════════════════════════════════

const site = readFileSync(new URL('../app/site.css', import.meta.url), 'utf8');
const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
// ادعاهای پرده روی **کد** سنجیده می‌شوند، نه روی کامنتی که آن‌ها را نقل می‌کند (منشور §4f).
// نسخه‌ی api همین را با stripCss می‌کرد؛ جابه‌جایی به suiteِ لندینگ نباید این قوت را بیندازد.
const globalsCode = globals.replace(/\/\*[\s\S]*?\*\//g, '');

describe('تیترِ گرادیانیِ متحرک', () => {
  // باگِ واقعی: .text-gradient روی پوسته color:transparent می‌گذارد، ولی
  // .kx-word__in یک transform دارد و لایه‌ی جدا می‌سازد؛ پس‌زمینه‌ی
  // برش‌خورده به آن نمی‌رسد و نیمی از تیترِ هیرو نامرئی می‌شد.
  test('کلمه‌های متحرک باید گرادیانِ خودشان را داشته باشند', () => {
    assert.match(site, /\.text-gradient\s+\.kx-word__in\s*\{[^}]*background:\s*linear-gradient/);
    assert.match(site, /\.text-gradient\s+\.kx-word__in\s*\{[^}]*background-clip:\s*text/);
  });

  test('نسخه‌ی تمِ تاریک هم باید باشد، وگرنه تیتر روی زمینه‌ی تیره کم‌جان است', () => {
    assert.match(site, /\[data-theme='dark'\]\s+\.text-gradient\s+\.kx-word__in/);
  });
});

describe('پرده‌ی ورود', () => {
  // باگِ واقعی: پرده با visibility بسته می‌شد و کروم در حالتِ fill-forwards
  // آن را اعمال نمی‌کرد؛ پرده روی صفحه می‌ماند. opacity قطعی است.
  test('بسته‌شدنِ پرده باید به opacity تکیه کند، نه فقط visibility', () => {
    const kf = /@keyframes intro-off\s*\{([^}]*\{[^}]*\}[^}]*)\}/.exec(globals);
    assert.ok(kf, 'کی‌فریمِ intro-off باید وجود داشته باشد');
    assert.match(kf[1], /opacity:\s*0/);
  });

  test('پرده نباید جلوی کلیک را بگیرد', () => {
    assert.match(globals, /\.intro\s*\{[^}]*pointer-events:\s*none/);
  });

  test('در حالتِ کاهشِ حرکت پرده اصلاً نباید رندر شود', () => {
    assert.match(globalsCode, /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.intro\s*\{\s*display:\s*none/);
  });

  // ⚠️ [L4 · ۲۰۲۶-۰۹-۱۱] پرده حالا **یک دستگیره** دارد (`--intro-t`) و همه‌ی
  // زمان‌ها نسبتی از آن‌اند؛ پس زمان‌بندی در واحدِ «× دستگیره» خوانده می‌شود،
  // نه ثانیه‌ی لفظی. نسخه‌ی قبلیِ این تست ثانیه‌ی لفظی می‌خواند و با آن
  // بازنویسی «قابلِ‌خواندن نیست» می‌داد — یعنی از f637948 تا اینجا jobِ
  // `landing → Unit tests` قرمز بود و نویسنده‌ی همان تغییر (LE) ندیده بود،
  // چون suiteِ لندینگ را زیرِ cmd.exe زده بود که glob را باز نمی‌کند.
  //
  // ⚠️ چه چیزی این تست را قرمز می‌کند و چه چیزی نه — صریح، چون مهم است:
  //   • تغییرِ **نسبت‌ها** (مثلاً مدتِ تیغه ۱۱⁄۲۴→۱۴⁄۲۴) ⇒ تیغه بعد از پرده تمام
  //     می‌شود ⇒ قرمز. همین است که «وسطِ کار قطع‌شدن» را می‌گیرد.
  //   • تغییرِ خودِ `--intro-t` (۰٫۴→۰٫۲) ⇒ همه با هم مقیاس می‌گیرند ⇒ سبز.
  //     این سبز، درست است: با یک دستگیره کوتاه‌کردنِ پرده **نمی‌تواند** تیغه را
  //     قطع کند — عینِ دلیلِ وجودِ دستگیره. مقدارِ ۰٫۴ حکمِ مالک است و جدا
  //     پین می‌شود (تستِ بعدی).
  /** `calc(var(--intro-t) * a / b)` یا `calc(var(--intro-t) / c)` یا `var(--intro-t)` → ضریب */
  const ratio = (expr: string): number => {
    const e = expr.replace(/\s+/g, '');
    if (e === 'var(--intro-t)') return 1;
    let m = /^calc\(var\(--intro-t\)\*(\d+)\/(\d+)\)$/.exec(e);
    if (m) return Number(m[1]) / Number(m[2]);
    m = /^calc\(var\(--intro-t\)\/(\d+)\)$/.exec(e);
    if (m) return 1 / Number(m[1]);
    throw new Error(`زمانِ پرده به دستگیره بند نیست یا شکلش ناشناخته است: ${expr}`);
  };

  /** پایانِ آخرین تیغه و لحظه‌ی برداشتنِ پرده، هر دو در واحدِ «× دستگیره» — روی CSSِ بی‌کامنت. */
  const curtainTiming = () => {
    const bar = /\.intro__bar\s*\{([\s\S]*?)\n\}/.exec(globalsCode);
    const intro = /\.intro\s*\{([\s\S]*?)\n\}/.exec(globalsCode);
    assert.ok(bar && intro, 'قاعده‌های .intro و .intro__bar باید قابلِ‌خواندن باشند');
    const dur = /animation-duration:\s*([^;]+);/.exec(bar![1]);
    const del = /animation-delay:\s*calc\(\s*(var\(--intro-t\)\s*\/\s*\d+)\s*\+\s*var\(--i\)\s*\*\s*(var\(--intro-t\)\s*\/\s*\d+)\s*\)/.exec(bar![1]);
    const off = /animation-delay:\s*([^;]+);/.exec(intro![1]);
    assert.ok(dur && del && off, 'زمان‌بندیِ تیغه و پرده باید قابلِ‌خواندن باشد (مدت، تأخیرِ پله‌ای، برداشتنِ پرده)');
    const bars = 6; // با BARS در components/site/Intro.tsx یکی است
    const lastEnds = ratio(`calc(${del![1]})`) + (bars - 1) * ratio(`calc(${del![2]})`) + ratio(dur![1]);
    const curtain = ratio(off![1]);
    return { lastEnds, curtain };
  };

  test('زمان‌بندی: آخرین تیغه نباید بعد از intro-off تمام شود', () => {
    const { lastEnds, curtain } = curtainTiming();
    assert.ok(
      lastEnds <= curtain + 1e-9,
      `آخرین تیغه در ${lastEnds.toFixed(4)}× دستگیره تمام می‌شود ولی پرده در ${curtain}× برداشته می‌شود — وسطِ کار قطع می‌شود`,
    );
  });
  test('آخرین تیغه دقیقاً در لحظه‌ی برداشتنِ پرده تمام می‌شود — نه زودتر', () => {
    // ⅓ + 5×¹⁄₂₄ + ¹¹⁄₂₄ = 1 × --intro-t. تستِ بالا فقط «نه دیرتر» را می‌گیرد (قطع‌شدنِ تیغه)؛
    // این یکی «نه زودتر» را هم — کوتاه‌شدنِ یک نسبت پرده را بعد از آخرین تیغه بی‌کار روی صفحه
    // نگه می‌دارد. این ادعا تا دستورِ ۰۵۰ در api/tests بود و در جابه‌جایی نباید گم شود.
    const { lastEnds, curtain } = curtainTiming();
    assert.ok(
      Math.abs(lastEnds - curtain) < 1e-9,
      `آخرین تیغه در ${lastEnds.toFixed(4)}× دستگیره تمام می‌شود و پرده در ${curtain}× برداشته می‌شود — باید برابر باشند`,
    );
  });

  test('دستگیره‌ی پرده ۰٫۴s است (حکمِ مالک، ۲۰۲۶-۰۹-۱۱) و به‌شکلِ متغیر', () => {
    assert.match(globalsCode, /\.intro\s*\{[^}]*--intro-t:\s*0?\.4s/, 'مالک ۴۰۰ms را انتخاب کرد؛ تغییرش تصمیمِ مالک است نه رفعِ فنی');
    assert.match(globalsCode, /\.intro\s*\{[^}]*animation-delay:\s*var\(--intro-t\)\s*;/,
      'پرده باید دقیقاً در ۱× دستگیره برداشته شود — وگرنه ۴۰۰msِ مالک با یک ضریب بی‌صدا عوض می‌شود');
  });

  test('هیچ زمانِ ثابتی در کورئوگرافیِ پرده نمانده — همه نسبتی از دستگیره‌اند', () => {
    // «تأخیرِ جفت‌شده»: یک عددِ ثابتِ جامانده با هر تغییرِ دستگیره از بقیه جدا می‌افتد.
    const block = globalsCode.slice(globalsCode.indexOf('.intro {'), globalsCode.indexOf('html[data-intro='));
    const fixed = [...block.matchAll(/animation(?:-duration|-delay)?:\s*[^;]*?\b(\d*\.?\d+)(s|ms)\b/g)]
      .map((m) => m[0]).filter((s) => !/var\(--intro-t\)/.test(s) && !/\b10ms\b/.test(s)); // 10ms = طولِ خودِ intro-off، عمداً ثابت
    assert.deepEqual(fixed, [], 'زمان‌های ثابتِ جامانده در پرده: ' + fixed.join(' | '));
  });
});

describe('نشانگرِ سفارشی', () => {
  // اگر cursor:none بی‌قید اعمال شود و JS اجرا نشود، کاربر نشانگر ندارد.
  test('cursor:none فقط با کلاسی که JS می‌گذارد فعال می‌شود', () => {
    assert.match(globals, /html\.has-cursor[\s\S]{0,60}cursor:\s*none/);
    assert.doesNotMatch(globals, /^\s*body\s*\{[^}]*cursor:\s*none/m);
  });

  test('ورودی‌های متنی باید نشانگرِ متن داشته باشند', () => {
    assert.match(globals, /has-cursor\s*:is\(input, textarea, \[contenteditable\]\)[\s\S]{0,60}cursor:\s*text/);
  });
});

describe('دانه‌ی فیلم', () => {
  test('نباید جلوی کلیک را بگیرد', () => {
    assert.match(globals, /\.grain\s*\{[^}]*pointer-events:\s*none/);
  });
});

describe('دروازه‌ی ورود', () => {
  // باگِ واقعی: انیمیشنِ ورودِ درها با fill-mode: both مقدارِ opacity: 1 را
  // پس از پایان نگه می‌داشت، و چون انیمیشن در آبشارِ CSS بر اعلانِ عادی غلبه
  // می‌کند، «.doors:hover .door { opacity: .58 }» هرگز اعمال نمی‌شد — یعنی
  // کلِ افکتِ کم‌رنگ‌شدنِ درهای دیگر مرده بود. فقط با اندازه‌گیریِ opacity در
  // مرورگر پیدا شد.
  test('انیمیشنِ ورودِ در نباید opacity را پس از پایان قفل کند', () => {
    // فقط خودِ اعلان، نه توضیحِ بالایش — متنِ توضیح واژه‌ی both را دارد.
    const m = /animation:\s*doorIn[^;]*;/.exec(site);
    assert.ok(m, 'انیمیشنِ doorIn باید تعریف شده باشد');
    assert.doesNotMatch(m[0], /\bboth\b/, 'fill-mode باید backwards باشد نه both');
    assert.match(m[0], /\bbackwards\b/);
  });

  // حالتِ باز نباید به state وابسته باشد: با useState افکت تا پیش از
  // hydration مرده بود و در رندرِ ایستا اصلاً کار نمی‌کرد (در نسخه‌ی آفلاین
  // دیده شد: درِ باز اشاره‌گر را دنبال نمی‌کرد).
  test('بازشدنِ در با CSS انجام می‌شود، نه با کلاسی که JS می‌گذارد', () => {
    assert.doesNotMatch(site, /\.door\.is-open/);
    assert.match(site, /\.doors:not\(:hover\):not\(:focus-within\)\s+\.door:first-child/);
  });

  test('حلقه‌ی نورانی با ماسک ساخته می‌شود، نه با روکشِ کدر', () => {
    // روکش روی پس‌زمینه‌ی نیمه‌شفافِ شیشه‌ای کار نمی‌کرد و گرادیان از پشتش
    // دیده می‌شد (یک گُوِه‌ی نارنجی روی کلِ کارت).
    assert.match(site, /\.door__edge\s*\{[\s\S]*?mask-composite:\s*exclude/);
  });

  test('در حالتِ کاهشِ حرکت، چرخشِ حلقه با همان ویژگیِ انتخابگر خنثی می‌شود', () => {
    // «.door__edge { animation: none }» به‌تنهایی می‌بازد چون
    // «.door.is-open .door__edge» ویژگیِ بالاتری دارد.
    const rm = site.slice(site.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(rm, /\.door__edge\s*\{\s*animation:\s*none/);
  });
});
