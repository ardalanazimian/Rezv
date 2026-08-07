import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { computePercentile } = await import('../src/lib/guest-profile.ts');

// ═══════════════════════════════════════════════════════════════════════
//  food-dna.js قبلاً «بهتر از X٪ مردم» را از یک جدولِ ثابتِ حدسی می‌ساخت —
//  حتی برایِ کاربرِ واقعی. این تست‌ها ثابت می‌کنند عددِ جدید واقعاً از رویِ
//  جمعیتِ مقایسه محاسبه می‌شود، و وقتی جمعیت خیلی کوچک است null برمی‌گردد
//  (نه یک عددِ نویزیِ گمراه‌کننده مثلِ «بهتر از ۱۰۰٪ مردم» با ۳ کاربر).
// ═══════════════════════════════════════════════════════════════════════

describe('computePercentile', () => {
  test('جمعیتِ کوچک‌تر از آستانه → null (نه عددِ نویزی)', () => {
    assert.equal(computePercentile(5, 4), null);
    assert.equal(computePercentile(19, 18), null);
  });
  test('دقیقاً روی آستانه → محاسبه می‌شود', () => {
    assert.equal(computePercentile(20, 10), 50);
  });
  test('محاسبه‌ی درست برایِ جمعیتِ بزرگ‌تر', () => {
    assert.equal(computePercentile(200, 190), 95);
    assert.equal(computePercentile(200, 0), 0);
    assert.equal(computePercentile(200, 200), 100);
  });
  test('گرد کردن به نزدیک‌ترین عدد صحیح', () => {
    assert.equal(computePercentile(3000, 1000), 33); // 33.33 → 33
  });
});
