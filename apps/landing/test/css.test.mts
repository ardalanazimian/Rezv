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
    assert.match(globals, /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.intro\s*\{\s*display:\s*none/);
  });

  // تیغه‌ها باید پیش از بسته‌شدنِ پرده تمام شده باشند وگرنه وسطِ کار قطع می‌شود.
  // ⚠️ ۰۹-۱۲: از ۰۹-۱۱ همه‌ی زمان‌ها کسری از یک دستگیره (--intro-t) و به‌شکلِ
  // longhand هستند؛ این تست هنوز shorthandِ ثانیه‌ای را می‌خواند و قرمز بود
  // (regex هیچ‌چیز پیدا نمی‌کرد — «قابلِ‌خواندن باشد» می‌افتاد). حالا همان کسرها
  // را می‌خواند و به واحدِ --intro-t جمع می‌زند — همان ادعا، روی CSSِ واقعی.
  test('زمان‌بندی: آخرین تیغه نباید بعد از intro-off تمام شود', () => {
    const bar = /\.intro__bar\s*\{[\s\S]*?animation-duration:\s*calc\(var\(--intro-t\)\s*\*\s*(\d+)\s*\/\s*(\d+)\)[\s\S]*?animation-delay:\s*calc\(var\(--intro-t\)\s*\/\s*(\d+)\s*\+\s*var\(--i\)\s*\*\s*var\(--intro-t\)\s*\/\s*(\d+)\)/.exec(globals);
    const off = /\.intro\s*\{[\s\S]*?animation-name:\s*intro-off[\s\S]*?animation-delay:\s*var\(--intro-t\)/.exec(globals);
    assert.ok(bar && off, 'زمان‌بندیِ تیغه و پرده باید قابلِ‌خواندن باشد');
    const bars = 6; // با BARS در components/site/Intro.tsx یکی است
    const duration = Number(bar[1]) / Number(bar[2]);
    const start = 1 / Number(bar[3]);
    const step = 1 / Number(bar[4]);
    // همه به واحدِ --intro-t؛ پرده دقیقاً در ۱× بسته می‌شود
    const lastEnds = start + (bars - 1) * step + duration;
    assert.ok(
      lastEnds <= 1 + 0.001,
      `آخرین تیغه در ${lastEnds.toFixed(3)}× --intro-t تمام می‌شود ولی پرده در ۱× بسته می‌شود`,
    );
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
