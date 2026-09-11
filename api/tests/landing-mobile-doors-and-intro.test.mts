// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  DS-009 L1 + L4 — لندینگ: درهای موبایل و پرده‌ی ورود
//
//  ⚠️ **این فایل ادعای اصلی را نمی‌سنجد و عمداً نمی‌تواند.** هر دو ادعا رفتارِ
//  مرورگرند:
//    L1: هر `.door` در ۳۹۰px ارتفاعِ محتوایش را داشته باشد و متنش بریده نشود
//        → `tools/measure-landing-doors.mjs` روی سرورِ زنده (exit 1 اگر نه)
//    L4: پرده در ~۰٫۴s برداشته شود و با reduced-motion اصلاً رندر نشود
//        → `tools/measure-landing-lcp.mjs`
//  این‌جا فقط ناوردای **منبع** پین می‌شود — اگر بشکنند رفتار حتماً شکسته است،
//  ولی سبزشان «کار می‌کند» را ثابت نمی‌کند.
//
//  ⚠️ L1 یک درسِ مستقل هم دارد که باید این‌جا بماند: نقص فقط زیرِ **Turbopack**
//  دیده می‌شد. یک منبع، دو باندلر، دو CSSِ متفاوت:
//      webpack   → flex-basis: 0%   → در ستونِ با ارتفاعِ نامعین = content → سالم
//      Turbopack → flex-basis: 0px  → صفرِ معین → ۴۲px، متنِ بریده
//  اندازه‌گیریِ اول روی `next dev --webpack` بود (Turbopack روی worktreeِ
//  جانکشن‌دار پنیک می‌کرد) و «بازتولید نشد» داد؛ CEO گرفت که Next 16 پیش‌فرض
//  Turbopack است و هیچ اسکریپتی عوضش نمی‌کند، پس آنچه سنجیده شده بود مسیری
//  بود که منتشر نمی‌شود. **وقتی دو اندازه‌گیری نمی‌خوانند، اول محیط را یکی کن.**
// ═══════════════════════════════════════════════════════════════════════

const ROOT = new URL('../../', import.meta.url);
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, ROOT)), 'utf8');
const stripCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

describe('DS-009 L1 — درهای انتخابِ نقش روی موبایل (ناوردای منبع)', () => {
  test('⚠️ در بلوکِ موبایل، پایه‌ی flexِ در «auto» است نه صفر', () => {
    const css = stripCss(read('apps/landing/app/site.css'));
    // ⚠️ نه اولین بلوکِ 900px — **بلوکی که درها را ستونی می‌کند**. نسخه‌ی اولِ این
    // تست `indexOf` می‌زد و به بلوکِ دیگری از همان breakpoint (خط ۱۴۸۸) می‌رسید
    // که `.door` نداشت، پس روی رفعِ درست هم قرمز بود. همان خطای «اولین صداکننده
    // به‌جای تعریف» که قبلاً در `openBookingFlow` هم کرده بودم.
    const anchor = css.indexOf('.doors { flex-direction: column');
    assert.notEqual(anchor, -1, 'قاعده‌ی ستونی‌کردنِ درها پیدا نشد — breakpoint یا شکلِ قاعده عوض شده؟');
    const i = css.lastIndexOf('@media (max-width: 900px)', anchor);
    assert.notEqual(i, -1, 'قاعده‌ی ستونی داخلِ بلوکِ 900px نیست');
    // بلوک تا اولین «}» در ستونِ اول
    const block = css.slice(i, css.indexOf('\n}', i));
    assert.match(block, /\.door[^{]*\{[^}]*flex:\s*0\s+0\s+auto/,
      'در بلوکِ موبایل `.door` باید `flex: 0 0 auto` داشته باشد؛ با `flex-grow: 1` روی پایه‌ی صفرِ '
      + 'دسکتاپ، Turbopack ارتفاعِ در را به پدینگ (۴۲px) می‌رساند');
    assert.ok(!/flex-grow:\s*1/.test(block.slice(block.indexOf('.door'))),
      '`flex-grow: 1`ِ قدیمی نباید در بلوکِ موبایل بماند — پایه‌ی صفر را زنده نگه می‌دارد');
  });

  test('⚠️ پایه‌ی دسکتاپ دست‌نخورده است (ردیفِ مساوی‌شونده باید بماند)', () => {
    const css = stripCss(read('apps/landing/app/site.css'));
    const i = css.indexOf('\n.door {');
    assert.notEqual(i, -1);
    const rule = css.slice(i, css.indexOf('}', i));
    assert.match(rule, /flex:\s*1\s+1\s+0\b/, 'روی دسکتاپ درها باید عرض را مساوی تقسیم کنند — این رفع فقط ستون را عوض می‌کند');
  });
});

describe('DS-009 L4 — پرده‌ی ورود: یک دستگیره، ۰٫۴ ثانیه (ناوردای منبع)', () => {
  const css = stripCss(read('apps/landing/app/globals.css'));
  const intro = css.slice(css.indexOf('.intro {'), css.indexOf('html[data-intro='));

  test('⚠️ زمانِ کل یک متغیر است و مقدارش ۰٫۴s (حکمِ مالک)', () => {
    assert.match(intro, /--intro-t:\s*0?\.4s/, 'دستگیره باید 0.4s باشد — حکمِ مالک ۲۰۲۶-۰۹-۱۱');
    assert.match(intro, /\.intro\s*\{[^}]*animation-delay:\s*var\(--intro-t\)/, 'برداشتنِ پرده باید به دستگیره بند باشد');
  });

  test('⚠️ هیچ زمانِ ثابتی در کورئوگرافی نمانده — همه نسبتی از دستگیره‌اند', () => {
    // «تأخیرِ جفت‌شده»: اگر یکی ثابت بماند، با کوتاه‌شدنِ پرده وسطِ کار قطع می‌شود.
    const fixed = [...intro.matchAll(/animation(?:-duration|-delay)?:\s*[^;]*?\b(\d*\.?\d+)(s|ms)\b/g)]
      .map((m) => m[0]).filter((s) => !/var\(--intro-t\)/.test(s) && !/10ms/.test(s));
    assert.deepEqual(fixed, [], 'زمان‌های ثابتِ جامانده در پرده: ' + fixed.join(' | '));
  });

  test('⚠️ آخرین تیغه دقیقاً همان لحظه‌ی برداشتنِ پرده تمام می‌شود', () => {
    // ⅓ + 5×¹⁄₂₄ + ¹¹⁄₂₄ = 1 × --intro-t  ← اگر کسی نسبت‌ها را عوض کند، این می‌گیرد
    const dur = intro.match(/\.intro__bar\s*\{[^}]*animation-duration:\s*calc\(var\(--intro-t\)\s*\*\s*(\d+)\s*\/\s*(\d+)\)/);
    const del = intro.match(/\.intro__bar\s*\{[^}]*animation-delay:\s*calc\(var\(--intro-t\)\s*\/\s*(\d+)\s*\+\s*var\(--i\)\s*\*\s*var\(--intro-t\)\s*\/\s*(\d+)\)/);
    assert.ok(dur && del, 'شکلِ مدت/تأخیرِ تیغه با الگو نمی‌خواند');
    const end = 1 / Number(del![1]) + 5 / Number(del![2]) + Number(dur![1]) / Number(dur![2]);
    assert.ok(Math.abs(end - 1) < 1e-9, `آخرین تیغه در ${end.toFixed(4)} × --intro-t تمام می‌شود، باید دقیقاً 1 باشد`);
  });

  test('⚠️ reduced-motion پرده را کلاً حذف می‌کند (منبع؛ در مرورگر هم سنجیده شد)', () => {
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.intro\s*\{\s*display:\s*none/,
      'با کاهشِ حرکت، .intro باید display:none باشد');
  });
});
