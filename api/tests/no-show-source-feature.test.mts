import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const {
  buildFeatureVector, NO_SHOW_FEATURE_NAMES, checkChannelBias,
} = await import('../src/lib/no-show-model.ts');
const { trainLogisticRegression } = await import('../src/lib/ml-core.ts');
import type { RawFeatureInput } from '../src/lib/ml-core.ts';

// ═══════════════════════════════════════════════════════════════════════
//  ویژگیِ «کانالِ ثبتِ رزرو» باید روی مقداری بنا شود که واقعاً نوشته می‌شود
//
//  ⚠️ باگی که این فایل قفلش می‌کند (۲۰۲۶-۰۸-۲۵، با grep روی کلِ src اثبات
//  شد): درایه‌ی ۹ بردار `input.source === 'phone'` بود، ولی هیچ‌جا در کلِ
//  کدبیس `'phone'` در ستونِ `source` نوشته نمی‌شد —
//    • reservations/route.ts → `'app'` یا `'manual'`
//    • lib/reservations.ts (walk-in) → `'walkin'`
//    • و تایپِ ورودی فقط `'app' | 'manual'` را می‌پذیرد
//
//  نتیجه‌ی دقیق و دو لایه‌ای:
//   ۱) یکی از ۱۱ ویژگیِ غیرِبایاس یک **ستونِ ثابتِ صفر** بود. در gradient
//      descent، مشتقِ وزنِ یک ستونِ صفر همیشه صفر است ⇒ آن وزن هرگز از
//      مقدارِ اولیه تکان نمی‌خورد. یعنی ظرفیتِ مدل روی کاغذ ۱۲ بود و در عمل ۱۱.
//   ۲) نیمی از گیتِ بایاسِ کانالی روی همان ستون بنا بود ⇒ `staffEnteredGap`
//      (آن‌موقع `phoneSourceGap`) *ساختاراً* همیشه ۰ ⇒ یک گاردِ ایمنیِ ظاهری.
//
//  تست‌های زیر هر دو لایه را جدا می‌سنجند، به‌علاوه‌ی یک قفلِ ساختاری تا
//  ویژگی دوباره به مقداری که کسی نمی‌نویسد گره نخورد.
// ═══════════════════════════════════════════════════════════════════════

const iStaff = NO_SHOW_FEATURE_NAMES.indexOf('staffEntered');

function feat(source: string): RawFeatureInput {
  return {
    hasUserId: true, priorTotal: 0, priorNoShowRate: 0,
    leadMinutes: 240, partySize: 2, source,
    slotStart: new Date('2026-05-10T16:00:00Z'),
  };
}

describe('درایه‌ی کانال روی مقدارِ واقعیِ ستونِ source بنا شده', () => {
  test('نامِ ویژگی در فهرست هست و اندیسش معتبر است', () => {
    assert.ok(iStaff > 0, 'staffEntered باید در NO_SHOW_FEATURE_NAMES باشد');
    assert.equal(NO_SHOW_FEATURE_NAMES.includes('phoneSource' as never), false,
      'نامِ قدیمی نباید برگردد — مقدارش را هیچ نویسنده‌ای تولید نمی‌کند');
  });

  test('`manual` ⇒ ۱ و `app`/`walkin` ⇒ ۰ (درایه دیگر ثابت نیست)', () => {
    assert.equal(buildFeatureVector(feat('manual'))[iStaff], 1);
    assert.equal(buildFeatureVector(feat('app'))[iStaff], 0);
    assert.equal(buildFeatureVector(feat('walkin'))[iStaff], 0);
  });

  test('`phone` دیگر معنایی ندارد — درایه ۰ می‌ماند', () => {
    // کنترلِ مثبت برایِ خودِ رفع: اگر کسی تعریف را به `'phone'` برگرداند،
    // این ۱ می‌شود و تستِ `manual` بالا هم صفر ⇒ هر دو قرمز.
    assert.equal(buildFeatureVector(feat('phone'))[iStaff], 0);
  });
});

describe('ستون دیگر ثابتِ صفر نیست، پس گرادیانش می‌تواند یاد بگیرد', () => {
  test('روی دادهٔ مصنوعیِ «رزروِ پرسنل پرریسک‌تر است»، وزنِ این ویژگی از صفر جدا می‌شود', () => {
    // ⚠️ ادعایِ سنجیده‌شده دقیقاً همین است و نه بیشتر: «این ستون **قابلِ
    // یادگیری** است». هیچ ادعایی درباره‌ی اینکه دادهٔ واقعیِ رزرونو چنین
    // الگویی دارد نمی‌شود — آن فقط با دفترِ پیش‌بینیِ تولید معلوم می‌شود.
    const rows: { f: RawFeatureInput; y: 0 | 1 }[] = [];
    for (let i = 0; i < 200; i++) {
      const staffEntered = i % 2 === 0;
      rows.push({
        f: feat(staffEntered ? 'manual' : 'app'),
        // نرخِ no-show: ۶۰٪ برایِ رزروِ پرسنل، ۱۰٪ برایِ اپ — الگویِ معلوم
        y: (staffEntered ? (i % 10 < 6) : (i % 10 < 1)) ? 1 : 0,
      });
    }
    const w = trainLogisticRegression(rows.map((r) => buildFeatureVector(r.f)), rows.map((r) => r.y));

    assert.ok(Math.abs(w[iStaff]) > 0.2,
      `وزنِ staffEntered باید از صفر جدا شود، شد ${w[iStaff]}`);
    assert.ok(w[iStaff] > 0, 'جهتِ وزن باید با الگویِ دادهٔ ساخته‌شده بخواند');

    // کنترلِ منفی: با تعریفِ قدیمی (`source==='phone'`) همین دیتاست ستونِ
    // کاملاً صفر می‌ساخت و وزن دقیقاً روی مقدارِ اولیه می‌ماند.
    const legacyColumn = rows.map((r) => (r.f.source === 'phone' ? 1 : 0));
    assert.equal(legacyColumn.reduce((a, b) => a + b, 0), 0,
      'اثباتِ خودِ باگ: ستونِ تعریفِ قدیمی روی دادهٔ واقعیِ همین کدبیس همیشه صفر است');
  });
});

describe('گیتِ بایاسِ کانالی حالا واقعاً می‌گزد', () => {
  test('وزنِ بزرگ روی staffEntered ⇒ گپِ غیرصفر و ردِ فعال‌سازی', () => {
    const w = new Array(NO_SHOW_FEATURE_NAMES.length).fill(0);
    w[iStaff] = 4;
    const r = checkChannelBias(w);
    assert.notEqual(r.staffEnteredGap, 0, 'گپ باید غیرصفر باشد — پیش از v4 ساختاراً صفر بود');
    assert.equal(r.biased, true);
    assert.match(r.reason, /پرسنل/);
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('قفلِ ساختاری: مقدارِ ویژگی باید نوشته شود', () => {
  const srcRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (p.endsWith('.ts')) out.push(p);
    }
    return out;
  }

  test('هیچ‌جای src رزروی با source برابرِ `phone` نمی‌سازد', () => {
    // اگر روزی کسی واقعاً `source: 'phone'` بنویسد، این تست عمداً قرمز
    // می‌شود تا تصمیم گرفته شود ویژگی به کدام مقدار گره بخورد — نه اینکه
    // بی‌صدا دو کانالِ متفاوت زیرِ یک درایه قاطی شوند.
    const hits = walk(srcRoot)
      .filter((p) => /source:\s*'phone'/.test(readFileSync(p, 'utf8')));
    assert.deepEqual(hits, []);
  });

  test('مسیرِ رزروِ پرسنل هنوز `manual` می‌نویسد (وگرنه ویژگی دوباره صفر می‌شود)', () => {
    const route = readFileSync(join(srcRoot, 'app/api/v1/reservations/route.ts'), 'utf8');
    assert.match(route, /source:[^\n]*'manual'/,
      'اگر مقدارِ نوشته‌شده عوض شد، buildFeatureVector هم باید با آن هم‌تراز و نسخه بالا برود');
  });
});
