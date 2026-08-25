import { test, expect, type Page } from '@playwright/test';
import { mockApi } from './helpers/mock-api';

// ═══════════════════════════════════════════════════════════════════════
//  ممیزیِ کنتراست و تم — اندازه‌گیریِ واقعیِ رنگِ رندرشده
//
//  چرا رندرِ واقعی و نه خواندنِ CSS: یک رنگِ هاردکدِ `#0F172A` در فایلِ CSS
//  به‌خودیِ‌خود باگ نیست — شاید رویِ پس‌زمینه‌ی روشنِ برند باشد و درست. باگ
//  وقتی است که **جفتِ متن/پس‌زمینه‌ی نهایی** در یکی از دو تم خوانا نباشد.
//  فقط `getComputedStyle` بعد از رندر این را می‌داند.
//
//  همین سنجه هم‌زمان دو چیز را می‌گیرد:
//    • §17 کنتراستِ WCAG AA (۴٫۵:۱ متنِ عادی، ۳:۱ متنِ درشت)
//    • §13/§14 رنگِ هاردکدی که در تمِ تیره نمی‌چرخد — چون دقیقاً همان‌جا
//      خودش را به‌صورتِ افتِ کنتراست در یکی از دو تم نشان می‌دهد.
//
//  محدوده‌ی صادقانه‌ی این تست: متنی که پس‌زمینه‌ی **یکدست** دارد. عنصری که
//  پشتش گرادیان/تصویر است کنار گذاشته و جداگانه شمرده می‌شود (نه «پاس»).
// ═══════════════════════════════════════════════════════════════════════

type Bad = { sel: string; text: string; fg: string; bg: string; ratio: number; size: number };

async function contrastFailures(page: Page): Promise<{ bad: Bad[]; skipped: number }> {
  return page.evaluate(() => {
    const srgb = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const lum = (r: number, g: number, b: number) =>
      0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
    const parse = (s: string): [number, number, number, number] | null => {
      const m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
      return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
    };
    // رنگِ نیمه‌شفاف را رویِ رنگِ زیرین می‌نشاند (alpha compositing)
    const over = (fg: number[], bg: number[]) =>
      [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));

    const bad: Bad[] = [];
    let skipped = 0;

    // پس‌زمینه‌ی مؤثر: تا اولین جدِ کاملاً مات بالا می‌رویم و لایه‌ها را روی هم می‌گذاریم
    //
    // ⚠️ «والدِ DOM» همیشه «پس‌زمینه‌ی دیداری» نیست (یافته‌ی ۲۰۲۶-۰۸-۲۴ در
    // ممیزیِ پنل): عنصرِ `position:absolute` می‌تواند با آفستِ منفی از کادرِ
    // والدش بیرون بزند و عملاً روی چیزِ دیگری بنشیند. نمونه‌ی واقعی
    // `.bar-val{top:-22px}` بود که بالایِ میله می‌نشیند نه رویش — و اسکنر
    // رنگِ میله را پس‌زمینه گرفت و یک شکستِ **کاذب** ساخت.
    // پس هر جدی که کادرش عنصر را در بر نمی‌گیرد، رد می‌شود.
    // ⚠️ نسخه‌ی اولِ همین گارد **خیلی سخت‌گیر** بود و سه مثبتِ کاذبِ تازه ساخت:
    // شرطِ «جد باید کاملاً عنصر را در بر بگیرد» را روی همه اعمال می‌کرد، ولی در
    // یک ردیفِ اسکرولِ افقی (`overflow-x:auto`) فرزند می‌تواند از کادرِ دیده‌شده‌ی
    // والد بیرون بزند و باز هم واقعاً روی پس‌زمینه‌ی او باشد. نتیجه: هیچ جدی
    // انتخاب نمی‌شد و تابع به سفیدِ پیش‌فرض می‌افتاد — یعنی در تمِ **تیره**
    // پس‌زمینه سفید گزارش می‌شد و متنِ سفید «۱:۱» به‌نظر می‌رسید.
    // گارد حالا فقط جایی اعمال می‌شود که واقعاً می‌تواند دروغ بگوید: عنصرِ
    // `absolute`/`fixed` که با آفستِ منفی از کادرِ والد بیرون می‌پرد
    // (نمونه: `.bar-val{top:-22px}` که بالایِ میله می‌نشیند نه رویش).
    const intersects = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const effectiveBg = (el: Element): number[] | null => {
      const stack: number[][] = [];
      const er = el.getBoundingClientRect();
      const pos = getComputedStyle(el).position;
      const escapes = pos === 'absolute' || pos === 'fixed';
      let n: Element | null = el;
      while (n) {
        if (escapes && n !== el && !intersects(n.getBoundingClientRect(), er)) { n = n.parentElement; continue; }
        const st = getComputedStyle(n);
        if (st.backgroundImage && st.backgroundImage !== 'none') return null; // گرادیان/تصویر
        const c = parse(st.backgroundColor);
        if (c && c[3] > 0) {
          stack.push(c);
          if (c[3] === 1) break;
        }
        n = n.parentElement;
      }
      if (!stack.length) return [255, 255, 255];
      let acc = stack[stack.length - 1].slice(0, 3);
      for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
      return acc;
    };

    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      // فقط عنصری که خودش مستقیماً متن دارد (نه ظرفِ والد)
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => (n.textContent || '').trim())
        .join(' ')
        .trim();
      if (!own) continue;

      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      if (parseFloat(st.opacity) < 0.15) continue;    // عملاً نامرئی، عمدی
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;

      const fgRaw = parse(st.color);
      if (!fgRaw) continue;
      const bg = effectiveBg(el);
      if (!bg) { skipped++; continue; }
      const fg = fgRaw[3] < 1 ? over(fgRaw, bg) : fgRaw.slice(0, 3);

      const l1 = lum(fg[0], fg[1], fg[2]);
      const l2 = lum(bg[0], bg[1], bg[2]);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

      const size = parseFloat(st.fontSize);
      const weight = parseInt(st.fontWeight, 10) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = large ? 3 : 4.5;

      if (ratio < need) {
        const sel = el.tagName.toLowerCase()
          + (el.id ? '#' + el.id : '')
          + (typeof el.className === 'string' && el.className.trim()
              ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        bad.push({
          sel, text: own.slice(0, 28),
          fg: `rgb(${fg.map(Math.round).join(',')})`,
          bg: `rgb(${bg.map(Math.round).join(',')})`,
          ratio: Math.round(ratio * 100) / 100, size,
        });
      }
    }
    // یک سلکتور ممکن است ده‌ها بار تکرار شود؛ فقط نمونه‌ی یکتا گزارش می‌شود
    const seen = new Set<string>();
    return { bad: bad.filter((b) => !seen.has(b.sel) && seen.add(b.sel)), skipped };
  });
}

const fmt = (b: Bad[]) =>
  b.map((x) => `  ${x.sel} — «${x.text}» ${x.fg} روی ${x.bg} = ${x.ratio}:1 (${x.size}px)`).join('\n');

// عنصرهایِ گذرا (toast/snackbar) موقعِ لود `opacity:0` هستند و اسکنر — به‌درستی —
// ردشان می‌کند. ولی دقیقاً یکی از همین‌ها یک باگِ واقعی داشت که فقط با grep پیدا
// شد، نه با تست. پس قبل از سنجش، کلاسِ نمایشِ خودشان را می‌گذاریم تا واقعاً
// اندازه‌گیری شوند — نه اینکه چون پنهان‌اند «پاس» حساب شوند.
async function revealTransients(page: Page) {
  await page.evaluate(() => {
    // ⚠️ تله‌ی واقعی (۲۰۲۶-۰۸-۲۴): فقط افزودنِ کلاسِ `.show` کافی نیست — چون
    // `.toast` یک `transition` رویِ opacity دارد، `getComputedStyle` در همان
    // تیک هنوز مقدارِ **آغازِ** ترنزیشن یعنی `opacity:0` را برمی‌گرداند و
    // اسکنر عنصر را «نامرئی، رد شود» حساب می‌کند. نتیجه: تست سبز می‌شد در
    // حالی که باگ سرِ جایش بود. اول ترنزیشن/انیمیشن را خنثی می‌کنیم تا رنگِ
    // نهایی بلافاصله خوانده شود (برایِ ممیزیِ رنگِ ساکن کاملاً بی‌ضرر است).
    const kill = document.createElement('style');
    kill.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(kill);
    for (const sel of ['.toast', '.undo-snack']) {
      for (const el of Array.from(document.querySelectorAll(sel))) {
        el.classList.add('show');
        if (!(el.textContent || '').trim()) el.textContent = 'نمونه‌ی متنِ اعلان';
      }
    }
  });
}

test.describe('کنتراستِ WCAG AA در هر دو تم', () => {
  test.slow();

  for (const theme of ['dark', 'light'] as const) {
    test(`customer — تمِ ${theme}`, async ({ page }) => {
      await mockApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('http://localhost:8080/');
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(700);
      await revealTransients(page);
      const { bad, skipped } = await contrastFailures(page);
      expect(bad, `افتِ کنتراست در تمِ ${theme} (${skipped} عنصر روی گرادیان، نادیده):\n${fmt(bad)}`).toEqual([]);
    });
  }

  for (const [app, port] of [['business', 8081], ['company', 8082]] as const) {
    test(`${app} — تمِ روشن (تنها تمِ این پنل)`, async ({ page }) => {
      await mockApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`http://localhost:${port}/`);
      await page.waitForTimeout(700);
      await revealTransients(page);
      const { bad, skipped } = await contrastFailures(page);
      expect(bad, `افتِ کنتراست (${skipped} عنصر روی گرادیان، نادیده):\n${fmt(bad)}`).toEqual([]);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  سنجه‌ی دوم — «زمینه‌ی تخت‌شده»
//
//  اسکنرِ بالا محافظه‌کار است: هر عنصری که پس‌زمینه‌ی مؤثرش به یک گرادیان
//  می‌رسد را کنار می‌گذارد (چون کنتراستش به موقعیت بستگی دارد). در اپِ مشتری
//  که مِشِ گرادیان + سطحِ شیشه‌ای دارد، این یعنی ~۱۱۹ عنصر اصلاً سنجیده
//  نمی‌شدند — یک نقطه‌کورِ بزرگ که سه افتِ واقعی در آن پنهان شده بود
//  (.ai-strip-label، .event-rest، .botnav-item.active).
//
//  اینجا گرادیان‌ها را با رنگِ پایه تخت می‌کنیم تا آن عنصرها هم قابلِ‌سنجش
//  شوند. این یک **تقریب** است و صادقانه اعلامش می‌کنیم: مِش به‌صورتِ موضعی
//  روشن/تیره می‌کند، پس عددِ واقعی کمی بالا/پایین می‌شود.
//
//  دو دسته باید کنار بروند وگرنه مثبتِ کاذب می‌سازند — و برنامه‌ای تشخیص
//  داده می‌شوند، نه با لیستِ دستیِ سلکتور:
//    • عنصری که خودش پس‌زمینه‌ی گرادیانی دارد (متنِ سفید رویش درست است)
//    • متنِ گرادیانی (`background-clip:text` با `color:transparent`)
//  تخت‌کردن هر دو را می‌شکند؛ تقصیرِ سنجه است، نه باگِ محصول.
// ═══════════════════════════════════════════════════════════════════════
async function flattenedFailures(page: Page) {
  return page.evaluate(() => {
    // ۱) قبل از تخت‌کردن، آرتیفکت‌ها را علامت می‌زنیم
    const artifact = new Set<Element>();
    const paints = (el: Element) => /gradient|url\(/.test(getComputedStyle(el).backgroundImage);
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const st = getComputedStyle(el);
      const fill = (st as CSSStyleDeclaration & { webkitTextFillColor?: string }).webkitTextFillColor;
      // متنِ گرادیانی (background-clip:text) — تخت‌کردن نامرئی‌اش می‌کند
      if (st.color === 'rgba(0, 0, 0, 0)' || fill === 'rgba(0, 0, 0, 0)') { artifact.add(el); continue; }
      // نزدیک‌ترین لایه‌ای که واقعاً رنگ می‌گذارد: اگر گرادیان باشد (و ریشه‌ی
      // صفحه نباشد) این عنصر با تخت‌کردن بی‌معنا می‌شود — چه خودش، چه والدش.
      // بدونِ این، متنِ داخلِ کارتِ گرادیانی مثبتِ کاذب می‌داد؛ و بدتر، بعد از
      // رفعِ باگ در جهتِ عکس هم کاذب می‌شد. سنجه‌ی درستِ این‌ها تستِ بعدی است
      // که رنگ را با **خودِ ایستگاه‌های گرادیان** می‌سنجد.
      let n: Element | null = el;
      while (n && n !== document.body && n !== document.documentElement) {
        if (paints(n)) { artifact.add(el); break; }
        const c = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
        if (c && (c.length < 4 || +c[3] === 1)) break;   // لایه‌ی مات: از اینجا قابلِ‌سنجش است
        n = n.parentElement;
      }
    }
    const kill = document.createElement('style');
    kill.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;background-image:none!important}';
    document.head.appendChild(kill);

    const srgb = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const lum = (r: number, g: number, b: number) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
    const parse = (s: string) => { const m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
    const over = (f: number[], b: number[]) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
    const bgOf = (el: Element): number[] => {
      const stack: number[][] = []; let n: Element | null = el;
      while (n) { const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c[3] > 0) { stack.push(c); if (c[3] === 1) break; } n = n.parentElement; }
      if (!stack.length) return [255, 255, 255];
      let acc = stack[stack.length - 1].slice(0, 3);
      for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
      return acc;
    };

    const out: string[] = []; const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (artifact.has(el)) continue;
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3)
        .map((n) => (n.textContent || '').trim()).join(' ').trim();
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.15) continue;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const f0 = parse(cs.color); if (!f0) continue;
      const bg = bgOf(el); const fg = f0[3] < 1 ? over(f0, bg) : f0.slice(0, 3);
      const ratio = (Math.max(lum(fg[0], fg[1], fg[2]), lum(bg[0], bg[1], bg[2])) + 0.05)
                  / (Math.min(lum(fg[0], fg[1], fg[2]), lum(bg[0], bg[1], bg[2])) + 0.05);
      const size = parseFloat(cs.fontSize); const w = parseInt(cs.fontWeight, 10) || 400;
      if (ratio < ((size >= 24 || (size >= 18.66 && w >= 700)) ? 3 : 4.5)) {
        const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
          + (typeof el.className === 'string' && el.className.trim()
              ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
        if (seen.has(sel)) continue; seen.add(sel);
        out.push(`  ${sel} «${own.slice(0, 24)}» ${Math.round(ratio * 100) / 100}:1 (${size}px)`);
      }
    }
    return out;
  });
}

test.describe('کنتراست روی زمینه‌ی تخت‌شده (نقطه‌کورِ گرادیان)', () => {
  test.slow();
  for (const theme of ['dark', 'light'] as const) {
    test(`customer — تمِ ${theme}`, async ({ page }) => {
      await mockApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('http://localhost:8080/');
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(700);
      const bad = await flattenedFailures(page);
      expect(bad, `افتِ کنتراست (زمینه‌ی تخت‌شده) در تمِ ${theme}:\n${bad.join('\n')}`).toEqual([]);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  سنجه‌ی سوم — متن رویِ سطحِ گرادیانی (بدترین ایستگاه)
//
//  دو سنجه‌ی قبلی هیچ‌کدام این حالت را پوشش نمی‌دهند: اولی گرادیان را رد
//  می‌کند، دومی گرادیان را پاک می‌کند. ولی دقیقاً همین‌جا یک باگِ P0 زندگی
//  می‌کرد: `.ai-strip` پس‌زمینه‌اش یک گرادیانِ **روشنِ ثابت** است (عمداً مستقل
//  از تم)، در حالی که متنش رنگ را از `--t1` می‌گرفت که در تمِ تیره سفید است.
//  یعنی سفید رویِ روشن، ۱٫۱۳:۱ — و چون تمِ پیش‌فرضِ اپ تاریک است، این حالتِ
//  عادیِ کاربر بود نه یک لبه‌ی نادر.
//
//  روش: ایستگاه‌هایِ رنگیِ خودِ گرادیان از `background-image` استخراج و متن با
//  **همه‌شان** سنجیده می‌شود. بدترین نسبت ملاک است — چون متن رویِ تمامِ طولِ
//  گرادیان کشیده شده و باید همه‌جا خوانا باشد، نه فقط وسطش.
// ═══════════════════════════════════════════════════════════════════════
async function gradientTextFailures(page: Page) {
  return page.evaluate(() => {
    const srgb = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const lum = (v: number[]) => 0.2126 * srgb(v[0]) + 0.7152 * srgb(v[1]) + 0.0722 * srgb(v[2]);
    const ratio = (a: number[], b: number[]) =>
      (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    const parse = (s: string) => { const m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
    const over = (f: number[], b: number[]) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
    const stopsOf = (img: string) => {
      const out: number[][] = [];
      for (const m of img.matchAll(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/g)) {
        const a = m[4] === undefined ? 1 : +m[4];
        if (a > 0.5) out.push([+m[1], +m[2], +m[3]]);   // ایستگاهِ تقریباً شفاف پس‌زمینه نمی‌سازد
      }
      return out;
    };

    const out: string[] = []; const seen = new Set<string>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3)
        .map((n) => (n.textContent || '').trim()).join(' ').trim();
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.15) continue;
      const fill = (cs as CSSStyleDeclaration & { webkitTextFillColor?: string }).webkitTextFillColor;
      if (cs.color === 'rgba(0, 0, 0, 0)' || fill === 'rgba(0, 0, 0, 0)') continue;  // متنِ گرادیانی
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const fg = parse(cs.color); if (!fg || fg[3] < 1) continue;

      // ⚠️ متنی که فقط ایموجی/نماد است کنار می‌رود: ایموجی با رنگِ خودش رندر
      // می‌شود و `color` اصلاً رویش اثر ندارد، پس سنجشِ کنتراستِ رنگِ متن برایش
      // بی‌معناست و فقط مثبتِ کاذب می‌سازد.
      if (!/\p{L}|\p{N}/u.test(own)) continue;

      // نزدیک‌ترین لایه‌ی گرادیان؛ ولی لایه‌هایِ نیمه‌شفافِ بینِ راه باید **روی
      // گرادیان بنشینند**، نه نادیده گرفته شوند. (بدونِ این، برچسبی مثل
      // `.hcard-tag` که خودش `rgba(0,0,0,.6)` دارد، انگار مستقیم روی گرادیانِ
      // روشن است دیده می‌شد و کاذب رد می‌شد — در حالی که واقعاً ~۷:۱ است.)
      let n: Element | null = el; let img = '';
      const veil: number[][] = [];
      while (n && n !== document.documentElement) {
        const st = getComputedStyle(n);
        if (/gradient/.test(st.backgroundImage)) { img = st.backgroundImage; break; }
        const c = parse(st.backgroundColor);
        if (c && c[3] > 0) { if (c[3] === 1) break; veil.push(c); }
        n = n.parentElement;
      }
      if (!img || n === document.body) continue;      // مِشِ صفحه کارِ سنجه‌ی دوم است

      // ⚠️ محدودیتِ صادقانه‌ی این سنجه: اگر سطحِ گرادیانی یک «اسکریم» به‌صورتِ
      // شبه‌عنصر (::before/::after) داشته باشد، این تابع نمی‌تواند حسابش کند —
      // شبه‌عنصر در DOM نیست و شدتش به **جایِ عمودیِ متن** بستگی دارد.
      // نمونه‌ی واقعی: `.occ-card::after` یک اسکریمِ ۰٫۲۶→۰٫۶۲ دارد که در ممیزیِ
      // قبلی تا ۴٫۶۱:۱ تنظیم شده. بدونِ این شرط، تست آن را ۲٫۰۴:۱ گزارش می‌کرد
      // و ما را وامی‌داشت یک باگِ ناموجود را «رفع» کنیم.
      // پس این حالت **سنجیده‌نشده** اعلام می‌شود، نه «قبول».
      const hasScrim = (['::before', '::after'] as const).some((pe) => {
        const ps = getComputedStyle(n as Element, pe);
        if (ps.content === 'none') return false;
        const pc = parse(ps.backgroundColor);
        return /gradient/.test(ps.backgroundImage) || !!(pc && pc[3] > 0);
      });
      if (hasScrim) continue;

      // معافیتِ WCAG 1.4.3: «متنی که بخشی از لوگو یا نامِ برند است الزامِ
      // کنتراست ندارد». نشانِ «R» رویِ مربعِ گرادیانِ برند دقیقاً همان است.
      if ((el.className || '').toString().split(/\s+/).includes('logo-mark')) continue;
      let stops = stopsOf(img); if (!stops.length) continue;
      if (veil.length) stops = stops.map((st) => {
        let acc = st;
        for (let i = veil.length - 1; i >= 0; i--) acc = over(veil[i], acc);
        return acc;
      });

      const size = parseFloat(cs.fontSize); const w = parseInt(cs.fontWeight, 10) || 400;
      const need = (size >= 24 || (size >= 18.66 && w >= 700)) ? 3 : 4.5;
      let worst = Infinity, worstStop: number[] = [];
      for (const st of stops) { const q = ratio(fg.slice(0, 3), st); if (q < worst) { worst = q; worstStop = st; } }
      if (worst < need) {
        const sel = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '')
          + (typeof el.className === 'string' && el.className.trim()
              ? '.' + el.className.trim().split(/\s+/).join('.') : '');
        if (seen.has(sel)) continue; seen.add(sel);
        out.push(`  ${sel} «${own.slice(0, 24)}» ${Math.round(worst * 100) / 100}:1 (${size}px) `
          + `متن=rgb(${fg.slice(0, 3).join(',')}) بدترین‌ایستگاه=rgb(${worstStop.join(',')})`);
      }
    }
    return out;
  });
}

test.describe('کنتراستِ متن رویِ سطحِ گرادیانی', () => {
  test.slow();
  for (const theme of ['dark', 'light'] as const) {
    test(`customer — تمِ ${theme}`, async ({ page }) => {
      await mockApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('http://localhost:8080/');
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(700);
      const bad = await gradientTextFailures(page);
      expect(bad, `متنِ کم‌کنتراست رویِ گرادیان در تمِ ${theme}:\n${bad.join('\n')}`).toEqual([]);
    });
  }
});
