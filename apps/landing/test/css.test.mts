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

describe('تیترِ دوتُنی', () => {
  // باگِ واقعی (تا ۰۹-۱۲): .text-gradient روی پوسته color:transparent و
  // background-clip:text می‌گذاشت، ولی کلمه‌ی متحرکِ داخلش transform داشت و
  // لایه‌ی جدا می‌ساخت؛ پس‌زمینه‌ی برش‌خورده به آن نمی‌رسید و نیمی از تیترِ
  // هیرو نامرئی می‌شد. ۰۹-۱۳ نیمه‌ی دوم یک رنگِ واقعی (خاکستری) گرفت و ورودِ
  // کلمه‌به‌کلمه رفت — این تست جلوی بازگشتِ همان کلاسِ باگ را می‌گیرد: هر
  // قاعده‌ای که به .text-gradient متنِ شفاف بدهد قرمز است.
  test('.text-gradient رنگِ واقعی دارد و هرگز متنِ شفاف نمی‌گیرد', () => {
    const rules = [...(globals + site).matchAll(/([^{}]*\.text-gradient[^{}]*)\{([^}]*)\}/g)];
    assert.ok(rules.length > 0, 'قاعده‌ی .text-gradient باید وجود داشته باشد');
    assert.ok(rules.some((r) => /(^|;)\s*color:\s*var\(--text-/.test(r[2])), 'باید یک color از توکن‌های متن داشته باشد');
    for (const r of rules) {
      assert.doesNotMatch(r[2], /color:\s*transparent/, `متنِ شفاف در «${r[1].trim()}»`);
      assert.doesNotMatch(r[2], /background-clip:\s*text/, `برشِ پس‌زمینه در «${r[1].trim()}»`);
    }
  });
});

describe('بخشِ «شب»', () => {
  // باگِ واقعی (۰۹-۱۳، سنجیده با getComputedStyle): کروم light-dark() ِ درونِ
  // custom property را روی عنصرِ اعلان‌کننده resolve می‌کند. توکن‌ها فقط روی
  // :root بودند، پس `.is-night { color-scheme: dark }` تیترِ بخشِ مشکی را
  // rgb(29, 29, 31) می‌داد — جوهر روی مشکی. رفع: همان اعلان روی .is-night هم.
  test('توکن‌های معنایی روی .is-night دوباره اعلان می‌شوند', () => {
    const m = /:root,\s*\.is-night\s*\{([^}]*)\}/.exec(globals);
    assert.ok(m, 'بلوکِ توکن‌های معنایی باید انتخابگرِ «:root, .is-night» داشته باشد');
    for (const token of ['--bg', '--surface-2', '--text-1', '--text-2', '--border', '--brand-ink']) {
      assert.match(m[1], new RegExp(`${token}:\\s*light-dark\\(`), `${token} باید در همان بلوک باشد`);
    }
  });

  test('جزیره‌ی تیره color-scheme: dark دارد', () => {
    assert.match(globals, /\.is-night\s*\{[^}]*color-scheme:\s*dark/);
  });
});

/** زنجیره‌ی at-ruleهایی که یک موقعیت در CSS داخلشان است (با شمارشِ آکولاد). */
function enclosingAtRules(css: string, index: number): string[] {
  const stack: string[] = [];
  let preludeStart = 0;
  for (let i = 0; i < index; i++) {
    const ch = css[i];
    if (ch === '{') { stack.push(css.slice(preludeStart, i).trim()); preludeStart = i + 1; }
    else if (ch === '}') { stack.pop(); preludeStart = i + 1; }
    else if (ch === ';') { preludeStart = i + 1; }
  }
  return stack.filter((p) => p.startsWith('@'));
}

describe('حرکتِ اسکرول‌محور', () => {
  // قاعده‌ی سراسریِ کاهشِ حرکت در globals فقط animation-duration را صفر
  // می‌کند؛ انیمیشنی که به scroll()/view() بسته است duration ندارد و از آن
  // قاعده **سالم می‌گذرد** (برای موزاییکِ ۰۹-۱۲ همین دیده شد). پس هر
  // animation-timeline فقط داخلِ «prefers-reduced-motion: no-preference» مجاز
  // است، و داخلِ @supports تا مرورگرِ بدونِ پشتیبانی چیدمانِ ثابت ببیند.
  // کامنت‌ها با فاصله جایگزین می‌شوند (خط‌ها حفظ، تا شماره‌ی خطِ پیامِ خطا درست بماند)
  const css = site.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  // فقط اعلان (بعد از «{» یا «;»)، نه متنِ شرطِ `@supports (animation-timeline: …)`
  const uses = [...css.matchAll(/[{;]\s*animation-timeline:\s*[^;{}]+;/g)]
    .map((m) => ({ index: (m.index ?? 0) + m[0].indexOf('animation-timeline') }));

  test('دست‌کم یک انیمیشنِ اسکرول‌محور هست (وگرنه این گارد چیزی نمی‌سنجد)', () => {
    assert.ok(uses.length >= 2, `فقط ${uses.length} اعلانِ animation-timeline پیدا شد`);
  });

  test('هر animation-timeline داخلِ no-preference و @supports است', () => {
    for (const u of uses) {
      const chain = enclosingAtRules(css, u.index ?? 0);
      const line = css.slice(0, u.index).split('\n').length;
      assert.ok(chain.some((p) => /prefers-reduced-motion:\s*no-preference/.test(p)), `site.css:${line} بیرون از no-preference است`);
      assert.ok(chain.some((p) => /@supports\s*\(animation-timeline/.test(p)), `site.css:${line} بیرون از @supports است`);
    }
  });

  test('سنجاقِ اسکرولِ زنده هم فقط در همان بلوک است — بیرونش چیدمانِ ثابت', () => {
    const decl = /view-timeline:\s*--ls/.exec(css);
    assert.ok(decl, 'view-timeline: --ls باید تعریف شده باشد');
    const chain = enclosingAtRules(css, decl.index);
    assert.ok(chain.some((p) => /no-preference/.test(p)) && chain.some((p) => /@supports/.test(p)));
    const sticky = /\.ls__stage\s*\{[^}]*position:\s*sticky/.exec(css);
    assert.ok(sticky, '.ls__stage باید sticky داشته باشد');
    assert.ok(enclosingAtRules(css, sticky.index).some((p) => /no-preference/.test(p)), 'sticky بیرون از no-preference است');
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
