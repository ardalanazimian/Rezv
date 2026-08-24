import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  populationStabilityIndex, bucketize01, psiBand, PSI_BUCKETS,
} from '../src/lib/ml-core.ts';

// ═══════════════════════════════════════════════════════════════════════
//  فازِ ۷ — ریاضیاتِ خالصِ PSI (بدونِ DB)
//
//  آستانه‌ها عمداً همان‌هایِ متعارفِ صنعت‌اند (۰٫۱ / ۰٫۲۵) نه اعدادِ ابداعی،
//  و این تست‌ها همان معنا را قفل می‌کنند: توزیعِ یکسان باید ~صفر بدهد و
//  جابه‌جاییِ واقعی باید عددِ بزرگ.
// ═══════════════════════════════════════════════════════════════════════

/** دنباله‌ی قطعی (بدونِ Math.random) تا تست هیچ‌وقت flaky نشود. */
function ramp(n: number, from: number, to: number): number[] {
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / Math.max(1, n - 1));
}

describe('سطل‌بندیِ مقادیرِ ۰..۱', () => {
  test('نسبت‌ها جمعشان ۱ می‌شود', () => {
    const b = bucketize01(ramp(100, 0, 1));
    assert.equal(b.length, PSI_BUCKETS);
    assert.ok(Math.abs(b.reduce((s, x) => s + x, 0) - 1) < 1e-9);
  });

  test('مقدارِ دقیقاً ۱ در آخرین سطل می‌افتد، نه بیرونِ محدوده', () => {
    // باگِ کلاسیکِ off-by-one: floor(1 * 10) = 10 که اندیسِ نامعتبر است.
    const b = bucketize01([1, 1, 1]);
    assert.equal(b[PSI_BUCKETS - 1], 1);
  });

  test('مقادیرِ خارج از بازه clamp می‌شوند', () => {
    const b = bucketize01([-5, 7]);
    assert.equal(b[0], 0.5);
    assert.equal(b[PSI_BUCKETS - 1], 0.5);
  });

  test('آرایه‌ی خالی صفر می‌دهد، نه NaN', () => {
    assert.deepEqual(bucketize01([]), new Array(PSI_BUCKETS).fill(0));
  });
});

describe('PSI', () => {
  test('توزیعِ یکسان ≈ صفر', () => {
    const a = ramp(200, 0, 1);
    assert.ok(populationStabilityIndex(a, a) < 1e-6);
  });

  test('جابه‌جاییِ کاملِ توزیع عددِ بزرگ می‌دهد', () => {
    // پایه همه در نیمه‌ی پایین، فعلی همه در نیمه‌ی بالا.
    const psi = populationStabilityIndex(ramp(200, 0, 0.4), ramp(200, 0.6, 1));
    assert.ok(psi > 0.25, `انتظارِ جابه‌جاییِ قابل‌توجه، ولی PSI=${psi}`);
    assert.equal(psiBand(psi), 'significant');
  });

  test('جابه‌جاییِ کوچک در باندِ پایدار می‌ماند', () => {
    const psi = populationStabilityIndex(ramp(400, 0, 1), ramp(400, 0.01, 1));
    assert.ok(psi < 0.1, `انتظارِ پایدار، ولی PSI=${psi}`);
    assert.equal(psiBand(psi), 'stable');
  });

  test('ورودیِ خالی NaN می‌دهد، نه صفر', () => {
    // صفر یعنی «کاملاً پایدار» — بدترین دروغِ ممکن وقتی داده‌ای نیست.
    assert.ok(Number.isNaN(populationStabilityIndex([], [0.5])));
    assert.ok(Number.isNaN(populationStabilityIndex([0.5], [])));
  });

  test('متقارن‌نبودنِ PSI مشکلی ایجاد نمی‌کند (هر دو جهت بزرگ‌اند)', () => {
    const a = ramp(200, 0, 0.4), b = ramp(200, 0.6, 1);
    assert.ok(populationStabilityIndex(a, b) > 0.25);
    assert.ok(populationStabilityIndex(b, a) > 0.25);
  });

  test('مرزهایِ باند دقیقاً همان‌هایِ متعارف‌اند', () => {
    assert.equal(psiBand(0.099), 'stable');
    assert.equal(psiBand(0.1), 'moderate');
    assert.equal(psiBand(0.249), 'moderate');
    assert.equal(psiBand(0.25), 'significant');
  });
});
