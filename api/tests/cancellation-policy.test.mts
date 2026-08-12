import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { computeResolvedPolicy } = await import('../src/lib/cancellation-policy.ts');

const BASE = { freeCancelHours: 24, partialPenaltyHours: 2, partialPenaltyPct: 50, depositRequired: false, autoConfirm: true };

describe('computeResolvedPolicy', () => {
  test('بدونِ هیچ سیگنالی → دقیقاً همون basePolicy', () => {
    const r = computeResolvedPolicy({
      basePolicy: BASE, demandRatio: null, eventOverride: null,
      reputationTier: 'bronze', strikeCount: 0, hasActiveAbuseFlag: false,
    });
    assert.equal(r.freeCancelHours, 24);
    assert.equal(r.depositRequired, false);
    assert.equal(r.autoConfirm, true);
    assert.deepEqual(r.appliedLayers, []);
  });

  test('basePolicy=null → پیش‌فرضِ سراسری استفاده می‌شه', () => {
    const r = computeResolvedPolicy({
      basePolicy: null, demandRatio: null, eventOverride: null,
      reputationTier: 'bronze', strikeCount: 0, hasActiveAbuseFlag: false,
    });
    assert.equal(r.freeCancelHours, 24);
    assert.equal(r.partialPenaltyPct, 50);
  });

  test('تقاضایِ بالا (ratio=1.3) → بیعانه‌ی اجباری + پنجره‌ی حداقل ۴۸ ساعته', () => {
    const r = computeResolvedPolicy({
      basePolicy: BASE, demandRatio: 1.3, eventOverride: null,
      reputationTier: 'bronze', strikeCount: 0, hasActiveAbuseFlag: false,
    });
    assert.equal(r.depositRequired, true);
    assert.equal(r.freeCancelHours, 48);
    assert.ok(r.appliedLayers.includes('dynamic_demand_high'));
  });

  test('تقاضایِ زیرِ آستانه (ratio=1.1) → بدونِ اثر', () => {
    const r = computeResolvedPolicy({
      basePolicy: BASE, demandRatio: 1.1, eventOverride: null,
      reputationTier: 'bronze', strikeCount: 0, hasActiveAbuseFlag: false,
    });
    assert.equal(r.depositRequired, false);
    assert.deepEqual(r.appliedLayers, []);
  });

  test('Platinum معمولی (بدونِ تقاضایِ بالا) → بیعانه معاف + پنجره‌ی کوتاه‌تر', () => {
    const withDeposit = { ...BASE, depositRequired: true };
    const r = computeResolvedPolicy({
      basePolicy: withDeposit, demandRatio: null, eventOverride: null,
      reputationTier: 'platinum', strikeCount: 0, hasActiveAbuseFlag: false,
    });
    assert.equal(r.depositRequired, false);
    assert.equal(r.freeCancelHours, 12); // 24 - 12
    assert.ok(r.appliedLayers.includes('tier_leniency_deposit_waived'));
    assert.ok(r.appliedLayers.includes('tier_leniency_shorter_window'));
  });

  test('Bronze/Silver از لایه‌ی تخفیف بی‌اثرن', () => {
    const withDeposit = { ...BASE, depositRequired: true };
    const r = computeResolvedPolicy({
      basePolicy: withDeposit, demandRatio: null, eventOverride: null,
      reputationTier: 'silver', strikeCount: 0, hasActiveAbuseFlag: false,
    });
    assert.equal(r.depositRequired, true);
  });

  test('مثالِ اصلیِ طراحی: شبِ ولنتاین (تقاضایِ حاد + رویدادِ ویژه) → حتی Platinum بیعانه می‌ده', () => {
    // basePolicy رستوران: بدونِ بیعانه. رویدادِ ویژه override می‌کنه به بیعانه‌ی
    // اجباری + پنجره‌ی ۷۲ساعته. مشتری Platinumه.
    const r = computeResolvedPolicy({
      basePolicy: BASE,
      demandRatio: 1.7, // بالایِ EXTREME_DEMAND_MULTIPLIER (۱.۶) → قفلِ deposit
      eventOverride: { depositRequired: true, freeCancelHours: 72 },
      reputationTier: 'platinum',
      strikeCount: 0,
      hasActiveAbuseFlag: false,
    });
    assert.equal(r.depositRequired, true, 'حتی Platinum معاف نمی‌شه چون deposit قفل شده (هم از تقاضایِ حاد هم از رویداد)');
    assert.equal(r.freeCancelHours, 72, 'override رویدادِ ویژه رویِ freeCancelHours غالبه');
  });

  test('abuse همیشه آخر برنده‌ست — حتی اگه Platinum تخفیف داده باشه', () => {
    const withDeposit = { ...BASE, depositRequired: true, autoConfirm: true };
    const r = computeResolvedPolicy({
      basePolicy: withDeposit, demandRatio: null, eventOverride: null,
      reputationTier: 'platinum', strikeCount: 3, hasActiveAbuseFlag: false,
    });
    assert.equal(r.depositRequired, true, 'abuse دوباره بیعانه رو اجباری می‌کنه حتی بعدِ تخفیفِ tier');
    assert.equal(r.autoConfirm, false);
    assert.ok(r.appliedLayers.includes('tier_leniency_deposit_waived'), 'لایه‌ی تخفیف واقعاً اجرا شده بود');
    assert.ok(r.appliedLayers.includes('abuse_override'), 'ولی abuse در آخر دوباره override کرده');
  });

  test('hasActiveAbuseFlag به‌تنهایی هم کافیه (بدونِ رسیدن به ۳ strike)', () => {
    const r = computeResolvedPolicy({
      basePolicy: BASE, demandRatio: null, eventOverride: null,
      reputationTier: 'bronze', strikeCount: 0, hasActiveAbuseFlag: true,
    });
    assert.equal(r.depositRequired, true);
    assert.equal(r.autoConfirm, false);
  });

  test('رویدادِ ویژه بدونِ override برایِ یه فیلدِ خاص، اون فیلد رو دست‌نخورده می‌ذاره', () => {
    const r = computeResolvedPolicy({
      basePolicy: BASE, demandRatio: null, eventOverride: { depositRequired: true }, // فقط همین یکی ست شده
      reputationTier: 'bronze', strikeCount: 0, hasActiveAbuseFlag: false,
    });
    assert.equal(r.depositRequired, true);
    assert.equal(r.freeCancelHours, 24); // دست‌نخورده مونده، ولی locked شده
  });
});
