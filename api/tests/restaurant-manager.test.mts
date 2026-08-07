import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { compareToTypical, rankUtilization } = await import('../src/lib/restaurant-manager.ts');

// ═══════════════════════════════════════════════════════════════════════
//  AI Restaurant Manager — این تست‌ها فقط ریاضیاتِ خالصِ پشتِ پاسخ‌ها را
//  می‌سنجند (بدونِ DB). ادعای اصلی: هیچ آماره‌ای بدونِ سیگنالِ آماریِ کافی
//  گزارش نمی‌شود — نوسانِ کوچک «معمولی» است، تعدادِ کمِ میز/داده باعثِ
//  سکوت می‌شود، نه حدس.
// ═══════════════════════════════════════════════════════════════════════

describe('compareToTypical', () => {
  test('برابر با معمول → normal، صفر درصد', () => {
    const c = compareToTypical(20, 20);
    assert.equal(c.direction, 'normal');
    assert.equal(c.diff_pct, 0);
  });
  test('نوسانِ کوچک (زیرِ ۱۵٪) هم normal حساب می‌شود', () => {
    const c = compareToTypical(21, 20); // ۵٪+
    assert.equal(c.direction, 'normal');
  });
  test('کاهشِ محسوس (بیشتر از ۱۵٪) → lower', () => {
    const c = compareToTypical(10, 20); // -۵۰٪
    assert.equal(c.direction, 'lower');
    assert.equal(c.diff_pct, -50);
  });
  test('افزایشِ محسوس → higher', () => {
    const c = compareToTypical(30, 20); // +۵۰٪
    assert.equal(c.direction, 'higher');
    assert.equal(c.diff_pct, 50);
  });
  test('typical صفر یا منفی → normal (بدونِ تقسیم‌برصفر)', () => {
    assert.equal(compareToTypical(5, 0).direction, 'normal');
    assert.equal(compareToTypical(5, -3).direction, 'normal');
  });
  test('دقیقاً روی مرزِ ۱۵٪ → دیگر normal نیست (شرطِ normal اکیداً کوچک‌تر از ۱۵ است)', () => {
    const c = compareToTypical(17, 20); // دقیقاً -۱۵٪
    assert.equal(c.direction, 'lower');
  });
  test('کمی زیرِ مرزِ ۱۵٪ (مثلاً ۱۴٫۹٪) → هنوز normal', () => {
    const c = compareToTypical(17.02, 20); // -۱۴٫۹٪
    assert.equal(c.direction, 'normal');
  });
});

describe('rankUtilization — قاعده‌ی ایمنی', () => {
  test('کمتر از ۴ میز → آرایه‌ی خالی (مقایسه‌ی نسبی بی‌معناست)', () => {
    const r = rankUtilization([
      { number: 1, name: null, bookings_count: 10 },
      { number: 2, name: null, bookings_count: 0 },
      { number: 3, name: null, bookings_count: 5 },
    ]);
    assert.deepEqual(r, []);
  });

  test('همه صفر رزرو → آرایه‌ی خالی (میانگین صفر، مقایسه بی‌معناست)', () => {
    const tables = Array.from({ length: 5 }, (_, i) => ({ number: i + 1, name: null, bookings_count: 0 }));
    assert.deepEqual(rankUtilization(tables), []);
  });

  test('میزِ به‌وضوح کم‌استفاده زیرِ ۵۰٪ میانگین علامت می‌خورد', () => {
    const tables = [
      { number: 1, name: null, bookings_count: 20 },
      { number: 2, name: null, bookings_count: 22 },
      { number: 3, name: null, bookings_count: 18 },
      { number: 4, name: null, bookings_count: 2 }, // خیلی کمتر از بقیه
    ];
    const ranked = rankUtilization(tables);
    const t4 = ranked.find((t) => t.number === 4)!;
    assert.equal(t4.underutilized, true);
    // بقیه نباید کم‌استفاده باشند
    assert.ok(ranked.filter((t) => t.number !== 4).every((t) => !t.underutilized));
  });

  test('همه‌ی میزها نزدیکِ میانگین → هیچ‌کدام کم‌استفاده نیست', () => {
    const tables = [
      { number: 1, name: null, bookings_count: 20 },
      { number: 2, name: null, bookings_count: 22 },
      { number: 3, name: null, bookings_count: 19 },
      { number: 4, name: null, bookings_count: 21 },
    ];
    assert.ok(rankUtilization(tables).every((t) => !t.underutilized));
  });

  test('خروجی از کم‌استفاده‌ترین به پراستفاده‌ترین مرتب است', () => {
    const tables = [
      { number: 1, name: null, bookings_count: 30 },
      { number: 2, name: null, bookings_count: 5 },
      { number: 3, name: null, bookings_count: 15 },
      { number: 4, name: null, bookings_count: 40 },
    ];
    const ranked = rankUtilization(tables);
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(ranked[i].relative_to_avg_pct >= ranked[i - 1].relative_to_avg_pct);
    }
    assert.equal(ranked[0].number, 2); // کم‌استفاده‌ترین اول
  });
});
