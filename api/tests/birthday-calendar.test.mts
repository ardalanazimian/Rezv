import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ «هدیه‌ی تولد در روزِ اشتباه» (فازِ ۲، پروتکل §۱۱)
//
//  زنجیره‌ی باگ (ردیابی‌شده از فرم تا cron):
//   ۱. فرمِ واک‌ینِ پنلِ رستوران ماه‌هایِ **شمسی** را با value=1..12 می‌فرستد
//      (فروردین=۱ … اسفند=۱۲) — apps/business/js/reservations.js.
//   ۲. createWalkinTx آن را `new Date(Date.UTC(1990, birthMonth-1, birthDay))`
//      ذخیره می‌کند، یعنی عددِ ماهِ شمسی در جایگاهِ ماهِ میلادی می‌نشیند.
//   ۳. grantBirthdayRewards قبلاً `today.getMonth()+1` (میلادی) را با همان
//      ستون مقایسه می‌کرد — دو مقیاسِ متفاوت.
//
//  نتیجه: متولدِ ۱ فروردین هدیه‌اش را اولِ ژانویه می‌گرفت (~۸۰ روز زودتر)،
//  و چون هدیه واقعاً ارسال می‌شد، هیچ‌کس متوجه نمی‌شد.
//
//  این تست خودِ تابعِ تبدیل را می‌سنجد (خالص، بدونِ DB).
// ═══════════════════════════════════════════════════════════════════════

const { jalaliMonthDayToday } = await import('../src/lib/loyalty.ts');

describe('jalaliMonthDayToday — مقیاسِ تقویم (§۱۱)', () => {
  test('نوروز: ۲۱ مارس ۲۰۲۶ → ۱ فروردین', () => {
    // نوروزِ ۱۴۰۵ برابرِ ۲۱ مارس ۲۰۲۶ است. ظهرِ UTC انتخاب شده تا اختلافِ
    // +۳:۳۰ تهران روز را جابه‌جا نکند.
    const { mm, dd } = jalaliMonthDayToday(new Date(Date.UTC(2026, 2, 21, 9, 0, 0)));
    assert.equal(mm, 1, 'ماه باید فروردین (۱) باشد');
    assert.equal(dd, 1, 'روز باید ۱ باشد');
  });

  test('همان تاریخ با منطقِ قدیمیِ میلادی عددِ متفاوتی می‌داد (اثباتِ باگ)', () => {
    const d = new Date(Date.UTC(2026, 2, 21, 9, 0, 0));
    const legacyMm = d.getUTCMonth() + 1;      // ۳ (مارس)
    const { mm } = jalaliMonthDayToday(d);      // ۱ (فروردین)
    assert.notEqual(
      legacyMm, mm,
      'اگر این دو برابر شوند یعنی فرضِ این رگرسیون عوض شده — تست را بازبینی کن',
    );
  });

  test('میانه‌ی سال: ۲۳ اوت ۲۰۲۶ → شهریور', () => {
    const { mm } = jalaliMonthDayToday(new Date(Date.UTC(2026, 7, 23, 9, 0, 0)));
    assert.equal(mm, 6, 'اوت باید در شهریور (۶) بیفتد');
  });

  test('همیشه بازه‌ی معتبر برمی‌گرداند (نمونه‌برداریِ کلِ سال)', () => {
    // هیچ روزی از سال نباید مقدارِ خارج از بازه یا NaN بدهد.
    for (let i = 0; i < 365; i += 7) {
      const d = new Date(Date.UTC(2026, 0, 1, 9, 0, 0) + i * 86_400_000);
      const { mm, dd } = jalaliMonthDayToday(d);
      assert.ok(Number.isInteger(mm) && mm >= 1 && mm <= 12, `ماهِ نامعتبر ${mm} برایِ ${d.toISOString()}`);
      assert.ok(Number.isInteger(dd) && dd >= 1 && dd <= 31, `روزِ نامعتبر ${dd} برایِ ${d.toISOString()}`);
    }
  });

  test('round-trip با همان قالبی که واک‌ین می‌نویسد', () => {
    // واک‌ین (ماهِ شمسی m، روزِ d) را چنین ذخیره می‌کند:
    //   new Date(Date.UTC(1990, m-1, d))
    // پس EXTRACT(MONTH) روی آن ستون دوباره همان m را می‌دهد. این تست تضمین
    // می‌کند مقایسه‌ی cron با خروجیِ jalaliMonthDayToday هم‌مقیاس است.
    const jalaliMonth = 6, jalaliDay = 1;              // ۱ شهریور
    const stored = new Date(Date.UTC(1990, jalaliMonth - 1, jalaliDay));
    assert.equal(stored.getUTCMonth() + 1, jalaliMonth, 'ستون باید همان عددِ ماهِ شمسی را نگه دارد');

    // و امروزِ متناظر (۲۳ اوت ۲۰۲۶ = ۱ شهریور ۱۴۰۵) باید همان ۶ را بدهد.
    const { mm } = jalaliMonthDayToday(new Date(Date.UTC(2026, 7, 23, 9, 0, 0)));
    assert.equal(mm, stored.getUTCMonth() + 1, 'مقایسه‌ی cron و ستون باید هم‌مقیاس باشد');
  });
});
