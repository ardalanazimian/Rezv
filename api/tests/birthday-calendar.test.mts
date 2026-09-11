import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════
//  تقویمِ هدیه‌ی تولد — «یک قرارداد» (ممیزیِ ۲۰۲۶-۰۹-۱۱)
//
//  تاریخچه‌ی این فایل خودش درسِ ماجراست:
//
//  مرحله‌ی ۱ — فرمِ واک‌ینِ پنل ماهِ **شمسی** را خام می‌فرستاد و
//  `createWalkinTx` آن را در `Date.UTC(1990, m-1, d)` می‌نشاند. ستون یک
//  «ظرفِ ماه/روزِ شمسی» بود، پس cron هم شمسی مقایسه می‌کرد و درست بود.
//
//  مرحله‌ی ۲ — در ۲۰۲۶-۰۸-۲۵ تبدیل به **مرزِ فرم** منتقل شد
//  (`apps/business/js/reservations.js`، jalaliMdToGregMd): از آن روز واک‌ین
//  میلادی می‌فرستد. ولی cron به‌روز نشد و همچنان شمسی مقایسه می‌کرد — یعنی
//  رفعِ مرحله‌ی ۱ به باگِ تازه بدل شد، و این بار در جهتِ مخالف.
//
//  مرحله‌ی ۳ (امروز) — هر سه نقطه‌ی نوشتن میلادی‌اند (واک‌ین پس از تبدیل،
//  `POST /restaurant/members`، `PATCH /me`)، `lib/automation.ts` از اول
//  میلادی مقایسه می‌کرد، پس cron هم میلادیِ **تهران** مقایسه می‌کند. نمایشِ
//  شمسی فقط در مرزِ پنل می‌ماند.
//
//  ⚠️ پس این فایل دیگر «jalaliMonthDayToday را می‌سنجم» نیست؛ **قرارداد** را
//  می‌سنجد. تستِ قبلی می‌توانست سبز بماند در حالی که cron روزِ غلط شلیک
//  می‌کرد، چون فقط خودِ تابعِ تبدیل را وارسی می‌کرد نه اینکه cron کدام را
//  صدا می‌زند.
// ═══════════════════════════════════════════════════════════════════════

const SRC = new URL('../src/lib/', import.meta.url);
const { jalaliMonthDayToday } = await import('../src/lib/loyalty.ts');
const { dateInTz } = await import('../src/lib/hours.ts');

describe('قرارداد: cron میلادیِ تهران مقایسه می‌کند', () => {
  test('🔴 grantBirthdayRewards دیگر jalaliMonthDayToday را صدا نمی‌زند', () => {
    // نبودِ موضوع = خطا: اگر تابع پیدا نشد، تست باید بشکند نه رد شود.
    const src = readFileSync(new URL('loyalty.ts', SRC), 'utf8');
    const fn = src.slice(src.indexOf('export async function grantBirthdayRewards'));
    assert.ok(fn.length > 200, 'بدنه‌ی grantBirthdayRewards پیدا نشد');
    assert.ok(!/jalaliMonthDayToday\s*\(/.test(fn),
      'cron نباید ماه/روزِ شمسی را با ستونِ میلادیِ birth_date مقایسه کند');
    assert.match(fn, /dateInTz\(\s*today\s*,\s*'Asia\/Tehran'\s*\)/,
      'cron باید میلادیِ تهران بخواند (نه UTC، نه ساعتِ محلیِ سرور)');
  });

  test('هر سه نقطه‌ی نوشتن میلادی‌اند — نه فقط یکی', () => {
    // §۴c: اگر فقط cron را می‌سنجیدیم، برگشتنِ هر نویسنده به شمسی دوباره
    // همان ناهماهنگی را می‌ساخت بدونِ اینکه چیزی قرمز شود.
    const walkinForm = readFileSync(
      new URL('../../../apps/business/js/reservations.js', SRC), 'utf8');
    assert.match(walkinForm, /jalaliMdToGregMd\(/,
      'فرمِ واک‌ین باید پیش از ارسال به میلادی تبدیل کند');

    const automation = readFileSync(new URL('automation.ts', SRC), 'utf8');
    assert.match(automation, /birthDate\.getMonth\(\)/,
      'automation.ts هم باید میلادی مقایسه کند (همان قرارداد)');
  });
});

describe('dateInTz — همان چیزی که cron می‌خواند', () => {
  test('میلادیِ تهران برمی‌گرداند، نه شمسی', () => {
    // ۲۱ مارس ۲۰۲۶ = نوروز. میلادی باید ۳/۲۱ بدهد، نه ۱/۱.
    const { m, day } = dateInTz(new Date(Date.UTC(2026, 2, 21, 9, 0, 0)), 'Asia/Tehran');
    assert.equal(m, 3);
    assert.equal(day, 21);
  });

  test('⚠️ کنترلِ تمایز: شمسی و میلادی همان روز عددِ متفاوتی می‌دهند', () => {
    // بدونِ این، تستِ بالا با یک تابعِ «همیشه میلادی» *و* یک تابعِ «همیشه
    // شمسی» هردو می‌توانست پاس شود اگر تصادفاً برابر می‌شدند.
    const d = new Date(Date.UTC(2026, 2, 21, 9, 0, 0));
    assert.notEqual(jalaliMonthDayToday(d).mm, dateInTz(d, 'Asia/Tehran').m);
  });

  test('نیمه‌شبِ تهران: UTC یک روز عقب است و تهران درست می‌ماند', () => {
    // ۲۱:۰۰ UTC = ۰۰:۳۰ روزِ بعد در تهران. اگر cron از UTC می‌خواند، هدیه
    // یک روز دیر می‌رسید.
    const d = new Date(Date.UTC(2026, 5, 10, 21, 0, 0));
    assert.equal(d.getUTCDate(), 10);
    assert.equal(dateInTz(d, 'Asia/Tehran').day, 11, 'باید روزِ تهران باشد، نه UTC');
  });

  test('همیشه بازه‌ی معتبر برمی‌گرداند (نمونه‌برداریِ کلِ سال)', () => {
    for (let i = 0; i < 365; i += 7) {
      const d = new Date(Date.UTC(2026, 0, 1, 9, 0, 0) + i * 86_400_000);
      const { m, day } = dateInTz(d, 'Asia/Tehran');
      assert.ok(Number.isInteger(m) && m >= 1 && m <= 12, `ماهِ نامعتبر ${m}`);
      assert.ok(Number.isInteger(day) && day >= 1 && day <= 31, `روزِ نامعتبر ${day}`);
    }
  });
});

describe('jalaliMonthDayToday — فقط مرزِ نمایش', () => {
  test('هنوز export است (پنلِ رستوران تاریخ را شمسی نشان می‌دهد)', () => {
    // حذفش یعنی همان تبدیل جای دیگری دوباره نوشته شود — همان تکثیری که
    // کلِ این زنجیره‌ی باگ را ساخت.
    assert.equal(typeof jalaliMonthDayToday, 'function');
    const { mm, dd } = jalaliMonthDayToday(new Date(Date.UTC(2026, 2, 21, 9, 0, 0)));
    assert.equal(mm, 1, 'نوروز باید ۱ فروردین باشد');
    assert.equal(dd, 1);
  });
});
