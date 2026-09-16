import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  DS-009 L1 + L3 + L4 — لندینگ: درهای موبایل، --vel، پرده‌ی ورود
//
//  ⚠️ جابه‌جا شد، ۲۰۲۶-۰۹-۱۳ — از api/tests/landing-mobile-doors-and-intro.test.mts.
//  آن فایل CSS و TSXِ `apps/landing` را می‌سنجید ولی در jobِ `api` اجرا می‌شد؛
//  کسی که روی لندینگ کار می‌کند و تست‌های لندینگ را می‌زند هرگز آن را نمی‌دید.
//  دستورِ ۰۵۰ §۵ همین را برای L4 حکم کرد؛ L1 و L3 همان کلاس‌اند، پس با هم آمدند.
//  «آخرین تیغه نه دیرتر از پرده» و «reduced-motion پرده را حذف می‌کند» این‌جا تکرار
//  نشده‌اند چون از قبل در css.test.mts هستند — یک ادعا، یک تست. «نه زودتر» ادعای
//  دیگری است و این‌جا می‌ماند.
//
//  ⚠️ **این فایل ادعای اصلی را نمی‌سنجد و عمداً نمی‌تواند.** هر سه ادعا رفتارِ
//  مرورگرند:
//    L1: هر `.door` در ۳۹۰px ارتفاعِ محتوایش را داشته باشد و متنش بریده نشود
//        → `tools/measure-landing-doors.mjs` روی سرورِ زنده (exit 1 اگر نه)
//    L3: اسکرول روی buildِ production ۶۰fps بماند → `tools/measure-landing-regions.mjs`
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

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const stripCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

describe('DS-009 L1 — درهای انتخابِ نقش روی موبایل (ناوردای منبع)', () => {
  test('⚠️ در بلوکِ موبایل، پایه‌ی flexِ در «auto» است نه صفر', () => {
    const css = stripCss(read('../app/site.css'));
    // ⚠️ نه اولین بلوکِ 900px — **بلوکی که درها را ستونی می‌کند**. نسخه‌ی اولِ این
    // تست `indexOf` می‌زد و به بلوکِ دیگری از همان breakpoint می‌رسید
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
    const css = stripCss(read('../app/site.css'));
    const i = css.indexOf('\n.door {');
    assert.notEqual(i, -1);
    const rule = css.slice(i, css.indexOf('}', i));
    assert.match(rule, /flex:\s*1\s+1\s+0\b/, 'روی دسکتاپ درها باید عرض را مساوی تقسیم کنند — این رفع فقط ستون را عوض می‌کند');
  });
});

describe('DS-009 L3 — --vel روی <html> نوشته نمی‌شود (ناوردای منبع)', () => {
  // ⚠️ **کمتر از ادعای واقعی.** ادعای واقعی «۶۰fps روی buildِ production» است و
  // فقط `tools/measure-landing-regions.mjs` آن را می‌سنجد. این‌جا فقط مکانیزمِ
  // سنجیده‌شده پین می‌شود: نوشتنِ یک custom property روی ریشه در هر فریم، style
  // کلِ سند را باطل می‌کرد (trace: ۳۸٪ UpdateLayoutTree) و p50 را از ۱۶٫۷ به
  // ۵۰ms می‌رساند. اگر کسی آن را برگرداند، این قرمز می‌شود پیش از آنکه کسی
  // اندازه بگیرد — ولی سبزش «سریع است» را ثابت نمی‌کند.
  const motion = read('../components/site/Motion.tsx')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => { const i = l.indexOf('//'); return i === -1 ? l : l.slice(0, i); }).join('\n');

  test('⚠️ هیچ setPropertyای برای --vel روی documentElement/root نیست', () => {
    assert.doesNotMatch(motion, /(documentElement|root)\.style\.setProperty\(\s*['"]--vel/,
      'نوشتنِ --vel روی <html> برگشته ⇒ ابطالِ style کلِ سند در هر فریمِ اسکرول (L3)');
  });

  // ⚠️ ۲۰۲۶-۰۹-۱۳ (DS-012): نسخه‌ی پیشینِ این تست **مکانیزم** را پین می‌کرد — «--vel روی
  // مصرف‌کننده‌های .vel نوشته می‌شود و .vel از var(--vel) می‌خواند». با بازطراحیِ لندینگ
  // (666c171) کلِ کششِ سرعتِ اسکرول رفت: نه ScrollProgress ِ نویسنده هست، نه `.vel`ِ
  // مصرف‌کننده. ادعای L3 («هیچ نوشتنِ هر فریمی روی ریشه») نه‌تنها برقرار است، بلکه
  // قوی‌تر شده: هیچ نوشتنِ هر فریمیِ --vel هیچ‌جا نیست. این تست همان قوی‌تر را پین
  // می‌کند؛ اگر کسی مکانیزم را برگرداند، این قرمز می‌شود و باید آگاهانه به شکلِ
  // قبلی (نوشتن روی مصرف‌کننده، نه ریشه) برگردد — و آن‌وقت تستِ اول هنوز مرز را نگه می‌دارد.
  test('⚠️ هیچ مکانیزمِ --vel در منبعِ لندینگ نمانده — نه نویسنده، نه مصرف‌کننده', () => {
    assert.doesNotMatch(motion, /--vel/, 'Motion.tsx نباید --vel بنویسد یا بخواند');
    for (const f of ['../app/globals.css', '../app/site.css']) {
      assert.doesNotMatch(stripCss(read(f)), /--vel\b|\.vel\b/, `${f}: کششِ اسکرول‌محورِ --vel برگشته`);
    }
    // کنترلِ مثبت: خودِ فایل هنوز چیزی را می‌خواند (نه رشته‌ی خالی)
    assert.ok(motion.includes('Reveal'), 'Motion.tsx خوانده نشد یا خالی است');
  });
});

describe('DS-009 L4 — پرده‌ی ورود: یک دستگیره، ۰٫۴ ثانیه (ناوردای منبع)', () => {
  const css = stripCss(read('../app/globals.css'));
  const start = css.indexOf('.intro {');
  const end = css.indexOf('html[data-intro=');
  const intro = start !== -1 && end > start ? css.slice(start, end) : '';

  test('بلوکِ پرده پیدا می‌شود — وگرنه بقیه‌ی تست‌ها روی رشته‌ی خالی سبز می‌شدند', () => {
    assert.notEqual(intro, '', '`.intro {` تا `html[data-intro=` در globals.css پیدا نشد');
  });

  test('⚠️ زمانِ کل یک متغیر است و مقدارش ۰٫۴s (حکمِ مالک)', () => {
    assert.match(intro, /--intro-t:\s*0?\.4s/, 'دستگیره باید 0.4s باشد — حکمِ مالک ۲۰۲۶-۰۹-۱۱');
    assert.match(intro, /\.intro\s*\{[^}]*animation-delay:\s*var\(--intro-t\)/, 'برداشتنِ پرده باید به دستگیره بند باشد');
  });

  test('⚠️ هیچ زمانِ ثابتی در کورئوگرافی نمانده — همه نسبتی از دستگیره‌اند', () => {
    // «تأخیرِ جفت‌شده»: اگر یکی ثابت بماند، با کوتاه‌شدنِ پرده وسطِ کار قطع می‌شود.
    // ⚠️ نسخه‌ی پیشین هر اعلانی را که var(--intro-t) داشت کلاً معاف می‌کرد، پس
    // `calc(var(--intro-t) * 3 / 10 + 0.1s)` — خودِ همان تأخیرِ جفت‌شده — سبز می‌شد.
    // حالا دستگیره از متن برداشته می‌شود و هر عددِ زمانیِ باقی‌مانده شکست است.
    const decls = [...intro.matchAll(/animation(?:-duration|-delay)?\s*:[^;}]*/g)].map((m) => m[0].trim());
    const bound = decls.filter((d) => d.includes('var(--intro-t)'));
    // کنترلِ مثبت: دستِ‌کم سه اعلانی که «آخرین تیغه» به آن‌ها تکیه دارد
    // (تأخیرِ پرده، مدت و تأخیرِ تیغه) باید دیده شوند؛ اسکنی که هیچ نبیند چیزی نسنجیده.
    assert.ok(bound.length >= 3, `فقط ${bound.length} اعلانِ بند به دستگیره دیده شد — الگو یا CSS عوض شده؟`);
    // تنها زمانِ مطلقِ مجاز: محوشدنِ ۱۰msِ خودِ پرده (یک پرشِ opacity، نه بخشی از کورئوگرافی).
    const fixed = decls
      .filter((d) => !/^animation-duration:\s*10ms$/.test(d))
      .filter((d) => /\d(?:\.\d+)?m?s\b/.test(d.replace(/var\(--intro-t\)/g, '')));
    assert.deepEqual(fixed, [], 'زمان‌های ثابتِ جامانده در پرده: ' + fixed.join(' | '));
  });

  test('⚠️ آخرین تیغه دقیقاً همان لحظه‌ی برداشتنِ پرده تمام می‌شود — نه زودتر', () => {
    // css.test.mts «نه دیرتر» را می‌سنجد (پرده وسطِ کار قطع نشود). این «نه زودتر» است:
    // ⅓ + 5×¹⁄₂₄ + ¹¹⁄₂₄ = 1 × --intro-t — همان قصدی که کامنتِ globals.css می‌نویسد.
    // ⚠️ نسخه‌ی اولِ همین فایل (a310ddc) این را عمداً انداخته بود؛ دو نویسنده‌ی مستقل
    // (f637948 و رفعِ کامیت‌نشده‌ی wt-rezv-a0) «دقیقاً» را پین کرده بودند، پس
    // انداختنش ساده‌سازی نبود، حذفِ یک ادعای طراحی بود.
    const BARS = 6; // با BARS در components/site/Intro.tsx یکی است
    const dur = intro.match(/\.intro__bar\s*\{[^}]*animation-duration:\s*calc\(var\(--intro-t\)\s*\*\s*(\d+)\s*\/\s*(\d+)\)/);
    const del = intro.match(/\.intro__bar\s*\{[^}]*animation-delay:\s*calc\(var\(--intro-t\)\s*\/\s*(\d+)\s*\+\s*var\(--i\)\s*\*\s*var\(--intro-t\)\s*\/\s*(\d+)\)/);
    assert.ok(dur && del, 'شکلِ مدت/تأخیرِ تیغه با الگو نمی‌خواند');
    const end = 1 / Number(del[1]) + (BARS - 1) / Number(del[2]) + Number(dur[1]) / Number(dur[2]);
    assert.ok(Math.abs(end - 1) < 1e-9, `آخرین تیغه در ${end.toFixed(4)} × --intro-t تمام می‌شود، باید دقیقاً 1 باشد`);
  });
});
