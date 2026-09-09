// [رفعِ ویندوز ۲۰۲۶-۰۸-۲۶] fileURLToPath و نه .pathname: رویِ ویندوز pathname «/C:/…» می‌دهد
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  پنلِ کش‌بک هرگز عددی نشان ندهد که از سرور نیامده
//
//  ⚠️ یافته‌ی RT-02 (Red Team، RETEST-2026-09-09) که این فایل از آن زاده شد:
//  `staff-system.js:242` پنل را با `CB={base:8,pre:12,vip:18,wb:20}` seed
//  می‌کرد و `rCashback()` خواندنِ سرور را پشتِ `!_cbLoaded && API.getToken()`
//  می‌گذاشت. **گارد دو راه برای غلط‌بودن داشت و رفعِ قبلی فقط یکی را پوشاند:**
//  مسیرِ خطا (۴۰۳/شبکه) حالتِ خطا نشان می‌داد، ولی مسیرِ **بی‌توکن** کلِ بلاک
//  را رد می‌کرد و همان چهار عددِ هاردکد را به‌شکلِ «تنظیماتِ رستوران» رندر
//  می‌کرد.
//
//  و آن اعداد رونوشتِ کهنه‌ی پیش‌فرض‌ها هم نبودند:
//      schema.prisma:175-178  →  ۵ · ۸ · ۱۲ · ۲۰
//      پنل                    →  ۸ · ۱۲ · ۱۸ · ۲۰
//  سه‌تا از چهارتا در هیچ‌جای سیستم منشأ ندارند. به تعبیرِ کامنتِ خودِ کد:
//  «مبنای تصمیمِ مالیِ غلط» — و مخاطبش مالکی است که به ما پول می‌دهد.
//
//  چرا تستِ ساختاری: پنل جاوااسکریپتِ کلاسیک است، نه ماژولِ قابلِ import،
//  و هیچ تستِ بک‌اندی این کلاس را نمی‌بیند. همان دلیلِ
//  loyalty-tier-panel-parity.test.mts.
//
//  ⚠️ الگویِ درست از قبل در همین مخزن بود: `loyalty.js:35` تا وقتی
//  `_cbLoaded` نشده «—» نشان می‌دهد. این رفع همان انضباط را به پنلِ تنظیمات
//  می‌آورد — مکانیزمِ تازه‌ای ساخته نشد.
// ═══════════════════════════════════════════════════════════════════════

const PANELS = {
  'apps/business/js/staff-system.js':
    fileURLToPath(new URL('../../apps/business/js/staff-system.js', import.meta.url)),
  'standalone/business.html':
    fileURLToPath(new URL('../../standalone/business.html', import.meta.url)),
};

/**
 * حذفِ کامنت‌های تک‌خطی.
 * ⚠️ چرا لازم شد: نسخه‌ی اولِ این تست قرمز شد چون **کامنتِ خودِ رفع** الگوی
 * قدیمی را نقل می‌کرد («این شرط قبلاً `if(!_cbLoaded && API.getToken())` بود»).
 * تستی که مستندکردنِ تاریخچه را ممنوع کند، تستِ بدی است — پس کد بررسی می‌شود،
 * نه نثر.
 */
function codeOnly(src: string): string {
  return src.split('\n').map((l) => {
    const i = l.indexOf('//');
    return i === -1 ? l : l.slice(0, i);
  }).join('\n');
}

/** بدنه‌ی rCashback تا ابتدای تابعِ بعدی. */
function rCashbackBody(src: string): string {
  // ⚠️ مرزها روی متنِ **خام** پیدا می‌شوند و کامنت‌ها بعد از برش حذف می‌شوند.
  // نسخه‌ی اول برعکس عمل می‌کرد و خودش را خراب کرد: `codeOnly` نشانگرِ پایان
  // (`// ═══`) را هم پاک می‌کرد، پس `end` برابرِ -1 می‌شد و «بدنه» تا آخرِ فایل
  // ادامه می‌یافت — و تستِ واگرایی دو فایلِ کاملاً متفاوت را مقایسه می‌کرد.
  const start = src.indexOf('async function rCashback()');
  assert.notEqual(start, -1, 'تابعِ rCashback پیدا نشد — نامش عوض شده؟');
  const rest = src.slice(start);
  const end = rest.indexOf('\n// ═══');
  return codeOnly(end === -1 ? rest : rest.slice(0, end));
}

describe('پنلِ کش‌بک — هیچ درصدی بدونِ سرور رندر نمی‌شود', () => {

  for (const [label, path] of Object.entries(PANELS)) {
    describe(label, () => {

      test('⚠️ CB با اعدادِ هاردکد seed نمی‌شود', () => {
        const src = readFileSync(path, 'utf8');
        // هر seedِ عددی — نه فقط ۸/۱۲/۱۸/۲۰ — چون نکته «این چهار عدد» نیست،
        // «هیچ عددی که از سرور نیامده» است.
        const seeded = codeOnly(src).match(/let\s+CB\s*=\s*\{[^}]*\d[^}]*\}/);
        assert.equal(
          seeded, null,
          `CB با مقدارِ عددی seed شده: ${seeded?.[0]} — رندر می‌تواند پیش از پاسخِ سرور عدد نشان دهد`,
        );
        assert.ok(
          /let\s+CB\s*=\s*null\s*;/.test(codeOnly(src)),
          'CB باید صریح null باشد تا رندرِ عددِ ساختگی ساختاری ناممکن شود',
        );
      });

      test('⚠️ گاردِ دو-راه-برای-غلط‌بودن برنگشته است', () => {
        const src = readFileSync(path, 'utf8');
        // این دقیقاً شکلی است که RT-02 گرفت: با falsy بودنِ توکن، کلِ بلاک
        // رد می‌شود و رندر روی مقادیرِ محلی می‌افتد.
        assert.ok(
          !/if\s*\(\s*!_cbLoaded\s*&&\s*API\.getToken\(\)\s*\)/.test(codeOnly(src)),
          'گاردِ `!_cbLoaded && API.getToken()` برگشته — مسیرِ بی‌توکن دوباره بی‌صدا رد می‌شود',
        );
      });

      test('⚠️ مسیرِ بی‌توکن صریح است و برمی‌گردد، نه اینکه به رندر بیفتد', () => {
        const body = rCashbackBody(readFileSync(path, 'utf8'));
        const guard = body.indexOf('if(!API.getToken())');
        assert.notEqual(guard, -1, 'شاخه‌ی صریحِ بی‌توکن در rCashback نیست');
        const after = body.slice(guard, guard + 220);
        assert.ok(after.includes('return'), 'شاخه‌ی بی‌توکن باید return کند، نه ادامه دهد');
        // و باید پیش از ساختنِ اسلایدرها باشد.
        assert.ok(
          guard < body.indexOf('cb-sliders'),
          'گاردِ بی‌توکن بعد از رندرِ اسلایدرهاست — یعنی بی‌اثر',
        );
      });

      test('⚠️ هیچ مسیری با CBِ خالی به رندر نمی‌رسد', () => {
        const body = rCashbackBody(readFileSync(path, 'utf8'));
        assert.ok(
          body.includes('if(!CB)'),
          'گاردِ آخر (`if(!CB)`) نیست — اگر مسیرِ تازه‌ای اضافه شود، دوباره عدد نشان داده می‌شود',
        );
        assert.ok(
          body.indexOf('if(!CB)') < body.indexOf('cb-sliders'),
          'گاردِ آخر باید پیش از رندر باشد',
        );
      });
    });
  }

  test('⚠️ دو رونوشتِ rCashback از هم واگرا نشده‌اند', () => {
    // standalone/business.html یک رونوشتِ **دستی** است؛ هیچ اسکریپتی
    // تولیدش نمی‌کند. همان کلاسِ «یک واقعیت، چند رونوشت» — پس واگرایی‌شان
    // خودش یک نقص است، نه یک جزئیات.
    const bodies = Object.entries(PANELS).map(([label, p]) => {
      const b = rCashbackBody(readFileSync(p, 'utf8'))
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//'))
        .join('\n');
      return { label, b };
    });
    assert.equal(
      bodies[0].b, bodies[1].b,
      `بدنه‌ی rCashback بینِ ${bodies[0].label} و ${bodies[1].label} فرق دارد — یکی رفع شده و دیگری نه`,
    );
  });

  test('⚠️ پیش‌فرض‌های واقعی فقط در schema زندگی می‌کنند', () => {
    // اگر روزی کسی خواست پنل را دوباره seed کند، دستِ‌کم باید با منبعِ حقیقت
    // بخواند. این تست عددهای schema را ثبت می‌کند تا واگراییِ بعدی دیده شود.
    const schema = readFileSync(
      fileURLToPath(new URL('../prisma/schema.prisma', import.meta.url)), 'utf8',
    );
    const pick = (f: string) => {
      const m = schema.match(new RegExp(`${f}\\s+Int\\s+@default\\((\\d+)\\)`));
      assert.ok(m, `پیش‌فرضِ ${f} در schema پیدا نشد`);
      return Number(m![1]);
    };
    assert.deepEqual(
      { base: pick('cbBasePct'), pre: pick('cbPreorderPct'), vip: pick('cbVipPct'), wb: pick('cbWinbackPct') },
      { base: 5, pre: 8, vip: 12, wb: 20 },
      'پیش‌فرض‌های کش‌بکِ schema عوض شده‌اند — اگر عمدی است، این تست را با آگاهی به‌روز کن',
    );
  });
});
