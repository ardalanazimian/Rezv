import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  DS-009 L1 + L3 — لندینگ: درهای موبایل و نوشتنِ --vel (ناوردای منبع)
//
//  ⚠️ [۲۰۲۶-۰۹-۱۱ · دستورِ ۰۵۰] این دو describe تا امروز در
//  `api/tests/landing-mobile-doors-and-intro.test.mts` بودند و در jobِ `test`ِ
//  api اجرا می‌شدند، در حالی که فقط منبعِ لندینگ را می‌خوانند. همین جداییِ
//  suite قرمزِ ۰۵۰ را پنهان کرد: نویسنده suiteِ api را زد و suiteِ لندینگ را
//  نه. حالا کنارِ `css.test.mts` در jobِ `landing` اجرا می‌شوند — یک اپ، یک
//  suite. ادعاها بی‌تغییر منتقل شدند.
//
//  ⚠️ **این فایل ادعای اصلی را نمی‌سنجد و عمداً نمی‌تواند.** هر دو ادعا رفتارِ
//  مرورگرند:
//    L1: هر `.door` در ۳۹۰px ارتفاعِ محتوایش را داشته باشد و متنش بریده نشود
//        → `tools/measure-landing-doors.mjs` روی سرورِ زنده (exit 1 اگر نه)
//    L3: اسکرولِ صفحه‌ی اول روی buildِ production در بودجه‌ی فریم بماند
//        → `tools/measure-landing-regions.mjs`
//  این‌جا فقط ناوردای **منبع** پین می‌شود — اگر بشکنند رفتار حتماً شکسته است،
//  ولی سبزشان «کار می‌کند» را ثابت نمی‌کند. regex روی منبع است، پس نمی‌بیند
//  Turbopack چه CSSی emit می‌کند.
//
//  ⚠️ L1 یک درسِ مستقل هم دارد: نقص فقط زیرِ **Turbopack** دیده می‌شد. یک منبع،
//  دو باندلر، دو CSSِ متفاوت:
//      webpack   → flex-basis: 0%   → در ستونِ با ارتفاعِ نامعین = content → سالم
//      Turbopack → flex-basis: 0px  → صفرِ معین → ۴۲px، متنِ بریده
//  اندازه‌گیریِ اول روی `next dev --webpack` بود و «بازتولید نشد» داد؛ Next 16
//  پیش‌فرض Turbopack است، پس آنچه سنجیده شده بود مسیری بود که منتشر نمی‌شود.
//  **وقتی دو اندازه‌گیری نمی‌خوانند، اول محیط را یکی کن.**
// ═══════════════════════════════════════════════════════════════════════

const stripCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const site = stripCss(readFileSync(new URL('../app/site.css', import.meta.url), 'utf8'));
const globals = stripCss(readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8'));
const motion = readFileSync(new URL('../components/site/Motion.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); }).join('\n');

describe('DS-009 L1 — درهای انتخابِ نقش روی موبایل (ناوردای منبع)', () => {
  test('⚠️ در بلوکِ موبایل، پایه‌ی flexِ در «auto» است نه صفر', () => {
    // ⚠️ نه اولین بلوکِ 900px — **بلوکی که درها را ستونی می‌کند**. نسخه‌ی اولِ این
    // تست `indexOf` می‌زد و به بلوکِ دیگری از همان breakpoint می‌رسید که `.door`
    // نداشت، پس روی رفعِ درست هم قرمز بود.
    const anchor = site.indexOf('.doors { flex-direction: column');
    assert.notEqual(anchor, -1, 'قاعده‌ی ستونی‌کردنِ درها پیدا نشد — breakpoint یا شکلِ قاعده عوض شده؟');
    const i = site.lastIndexOf('@media (max-width: 900px)', anchor);
    assert.notEqual(i, -1, 'قاعده‌ی ستونی داخلِ بلوکِ 900px نیست');
    // بلوک تا اولین «}» در ستونِ اول
    const block = site.slice(i, site.indexOf('\n}', i));
    assert.match(block, /\.door[^{]*\{[^}]*flex:\s*0\s+0\s+auto/,
      'در بلوکِ موبایل `.door` باید `flex: 0 0 auto` داشته باشد؛ با `flex-grow: 1` روی پایه‌ی صفرِ '
      + 'دسکتاپ، Turbopack ارتفاعِ در را به پدینگ (۴۲px) می‌رساند');
    assert.ok(!/flex-grow:\s*1/.test(block.slice(block.indexOf('.door'))),
      '`flex-grow: 1`ِ قدیمی نباید در بلوکِ موبایل بماند — پایه‌ی صفر را زنده نگه می‌دارد');
  });

  test('⚠️ پایه‌ی دسکتاپ دست‌نخورده است (ردیفِ مساوی‌شونده باید بماند)', () => {
    const i = site.indexOf('\n.door {');
    assert.notEqual(i, -1);
    const rule = site.slice(i, site.indexOf('}', i));
    assert.match(rule, /flex:\s*1\s+1\s+0\b/, 'روی دسکتاپ درها باید عرض را مساوی تقسیم کنند — این رفع فقط ستون را عوض می‌کند');
  });
});

describe('DS-009 L3 — --vel روی <html> نوشته نمی‌شود (ناوردای منبع)', () => {
  // ⚠️ **کمتر از ادعای واقعی.** ادعای واقعی «بودجه‌ی فریم روی buildِ production» است و
  // فقط `tools/measure-landing-regions.mjs` آن را می‌سنجد. این‌جا فقط مکانیزمِ
  // سنجیده‌شده پین می‌شود: نوشتنِ یک custom property روی ریشه در هر فریم، style
  // کلِ سند را باطل می‌کرد (trace: ۳۸٪ UpdateLayoutTree). اگر کسی آن را برگرداند،
  // این قرمز می‌شود پیش از آنکه کسی اندازه بگیرد — ولی سبزش «سریع است» را ثابت نمی‌کند.
  test('⚠️ هیچ setPropertyای برای --vel روی documentElement/root نیست', () => {
    assert.doesNotMatch(motion, /(documentElement|root)\.style\.setProperty\(\s*['"]--vel/,
      'نوشتنِ --vel روی <html> برگشته ⇒ ابطالِ style کلِ سند در هر فریمِ اسکرول (L3)');
  });

  test('⚠️ --vel روی مصرف‌کننده‌های .vel نوشته می‌شود و CSSِ مصرف‌کننده دست‌نخورده است', () => {
    assert.match(motion, /querySelectorAll<HTMLElement>\(\s*['"]\.vel['"]\s*\)/, 'باید مصرف‌کننده‌ها را پیدا کند');
    assert.match(globals, /\.vel\s*\{[^}]*var\(--vel,\s*0\)/, '`.vel` باید همچنان از var(--vel) بخواند — قرارداد عوض نشده');
    assert.match(globals, /prefers-reduced-motion:\s*reduce\)\s*\{\s*\.vel\s*\{\s*transform:\s*none/, 'reduced-motion باید کشش را خاموش نگه دارد');
  });
});
