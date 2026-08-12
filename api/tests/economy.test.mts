import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — رجوع کن به تستِ validate.test.mts برایِ دلیل.
const {
  applyTimeDecayedScore,
  applyStrikeDecay,
  computeReputationTier,
  computeEventScore,
  RELIABILITY_HALF_LIFE_DAYS,
} = await import('../src/lib/economy.ts');

describe('applyTimeDecayedScore', () => {
  test('بدونِ گذشتِ زمان (Δt=0) → امتیازِ قدیمی کاملاً می‌مونه', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    assert.equal(applyTimeDecayedScore(75, now, 0, now), 75);
  });
  test('گذشتِ دقیقاً یک نیم‌عمر (۹۰ روز) → دقیقاً وسطِ قدیم و جدید', () => {
    const last = new Date('2026-01-01T00:00:00Z');
    const now = new Date(last.getTime() + RELIABILITY_HALF_LIFE_DAYS * 86_400_000);
    // decay=0.5 → 100*0.5 + 0*0.5 = 50
    assert.equal(applyTimeDecayedScore(100, last, 0, now), 50);
  });
  test('گذشتِ زمانِ خیلی زیاد → تقریباً کاملاً eventScoreِ جدید', () => {
    const last = new Date('2020-01-01T00:00:00Z');
    const now = new Date('2026-01-01T00:00:00Z');
    const r = applyTimeDecayedScore(100, last, 0, now);
    assert.ok(r <= 1, `انتظار نزدیکِ صفر داشتیم، گرفتیم ${r}`);
  });
  test('کلمپ به بازه‌ی [0,100]', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    assert.equal(applyTimeDecayedScore(100, now, 100, now), 100);
    assert.equal(applyTimeDecayedScore(0, now, 0, now), 0);
  });
});

describe('applyStrikeDecay', () => {
  test('بدونِ نقضِ قبلی (lastViolationAt=null) → دست‌نخورده', () => {
    assert.equal(applyStrikeDecay(2, null), 2);
  });
  test('strikeCount صفر → همیشه صفر می‌مونه', () => {
    assert.equal(applyStrikeDecay(0, new Date('2020-01-01'), new Date()), 0);
  });
  test('دقیقاً ۹۰ روز گذشته → یک strike کم می‌شه', () => {
    const last = new Date('2026-01-01T00:00:00Z');
    const now = new Date(last.getTime() + 90 * 86_400_000);
    assert.equal(applyStrikeDecay(3, last, now), 2);
  });
  test('۱۸۰ روز گذشته → دو strike کم می‌شه', () => {
    const last = new Date('2026-01-01T00:00:00Z');
    const now = new Date(last.getTime() + 180 * 86_400_000);
    assert.equal(applyStrikeDecay(3, last, now), 1);
  });
  test('هیچ‌وقت زیرِ صفر نمی‌ره', () => {
    const last = new Date('2020-01-01T00:00:00Z');
    const now = new Date('2026-01-01T00:00:00Z');
    assert.equal(applyStrikeDecay(1, last, now), 0);
  });
  test('کمتر از ۹۰ روز → هنوز دست‌نخورده', () => {
    const last = new Date('2026-01-01T00:00:00Z');
    const now = new Date(last.getTime() + 89 * 86_400_000);
    assert.equal(applyStrikeDecay(3, last, now), 3);
  });
});

describe('computeReputationTier', () => {
  test('پیش‌فرض: bronze', () => {
    assert.equal(computeReputationTier({ score: 75, completedCount: 0, strikeCount: 0 }), 'bronze');
  });
  test('score بالا ولی سابقه‌ی کم → هنوز bronze (نمی‌شه با یه رزرو Gold شد)', () => {
    assert.equal(computeReputationTier({ score: 100, completedCount: 1, strikeCount: 0 }), 'bronze');
  });
  test('silver: score>=70 و completedCount>=5', () => {
    assert.equal(computeReputationTier({ score: 70, completedCount: 5, strikeCount: 0 }), 'silver');
  });
  test('gold: score>=85 و completedCount>=15', () => {
    assert.equal(computeReputationTier({ score: 85, completedCount: 15, strikeCount: 1 }), 'gold');
  });
  test('platinum فقط با strikeCount=0 — حتی یک strike مانع می‌شه', () => {
    assert.equal(computeReputationTier({ score: 95, completedCount: 40, strikeCount: 1 }), 'gold');
    assert.equal(computeReputationTier({ score: 95, completedCount: 40, strikeCount: 0 }), 'platinum');
  });
});

describe('computeEventScore', () => {
  test('completed → همیشه ۱۰۰، حتی اگه actor سیستم/cron باشه', () => {
    const r = computeEventScore({
      fromStatus: 'dining', toStatus: 'completed', actor: 'cron', hoursBeforeSlot: -1, freeCancelHours: 24,
    });
    assert.deepEqual(r, { score: 100, addsStrike: false, label: 'reservation_completed' });
  });
  test('no_show → همیشه ۰ و strike، حتی اگه actor cron باشه', () => {
    const r = computeEventScore({
      fromStatus: 'running_late', toStatus: 'no_show', actor: 'cron', hoursBeforeSlot: -1, freeCancelHours: 24,
    });
    assert.deepEqual(r, { score: 0, addsStrike: true, label: 'reservation_no_show' });
  });
  test('لغوِ رستوران/staff → null (تقصیرِ مشتری نیست)', () => {
    const r = computeEventScore({
      fromStatus: 'confirmed', toStatus: 'cancelled', actor: 'staff:abc', hoursBeforeSlot: 1, freeCancelHours: 24,
    });
    assert.equal(r, null);
  });
  test('لغوِ سیستم/cron → null', () => {
    const r = computeEventScore({
      fromStatus: 'confirmed', toStatus: 'cancelled', actor: 'system', hoursBeforeSlot: 1, freeCancelHours: 24,
    });
    assert.equal(r, null);
  });
  test('لغوِ مشتری خارج از پنجره‌ی آزاد (hoursBeforeSlot < freeCancelHours) → جریمه', () => {
    const r = computeEventScore({
      fromStatus: 'confirmed', toStatus: 'cancelled', actor: 'customer:u1', hoursBeforeSlot: 2, freeCancelHours: 24,
    });
    assert.deepEqual(r, { score: 35, addsStrike: true, label: 'reservation_cancelled_late' });
  });
  test('لغوِ مشتری داخلِ پنجره‌ی آزاد → بدونِ جریمه', () => {
    const r = computeEventScore({
      fromStatus: 'confirmed', toStatus: 'cancelled', actor: 'customer:u1', hoursBeforeSlot: 48, freeCancelHours: 24,
    });
    assert.deepEqual(r, { score: 85, addsStrike: false, label: 'reservation_cancelled_in_window' });
  });
  test('لغو دقیقاً رویِ مرزِ freeCancelHours → داخلِ پنجره حساب نمی‌شه (< نه <=)', () => {
    const r = computeEventScore({
      fromStatus: 'confirmed', toStatus: 'cancelled', actor: 'customer:u1', hoursBeforeSlot: 24, freeCancelHours: 24,
    });
    assert.equal(r?.label, 'reservation_cancelled_in_window');
  });
  test('waitlist offer expired (auto_cancelled از waitlisted) → سیگنالِ ضعیف', () => {
    const r = computeEventScore({
      fromStatus: 'waitlisted', toStatus: 'auto_cancelled', actor: 'cron', hoursBeforeSlot: 5, freeCancelHours: 24,
    });
    assert.deepEqual(r, { score: 55, addsStrike: false, label: 'waitlist_offer_expired' });
  });
  test('auto_cancelled از confirmed (نه waitlisted) → null، تصمیمِ سیستمه نه مشتری', () => {
    const r = computeEventScore({
      fromStatus: 'confirmed', toStatus: 'auto_cancelled', actor: 'cron', hoursBeforeSlot: 5, freeCancelHours: 24,
    });
    assert.equal(r, null);
  });
  test('expired (هولدِ pending تایم‌اوت) → null', () => {
    const r = computeEventScore({
      fromStatus: 'pending', toStatus: 'expired', actor: 'cron', hoursBeforeSlot: 5, freeCancelHours: 24,
    });
    assert.equal(r, null);
  });
  test('rejected (تصمیمِ رستوران) → null', () => {
    const r = computeEventScore({
      fromStatus: 'pending', toStatus: 'rejected', actor: 'staff:abc', hoursBeforeSlot: 5, freeCancelHours: 24,
    });
    assert.equal(r, null);
  });
  test('انتقالِ غیرِ‌نهایی (مثلاً confirmed→preparing) → null', () => {
    const r = computeEventScore({
      fromStatus: 'confirmed', toStatus: 'preparing', actor: 'staff:abc', hoursBeforeSlot: 5, freeCancelHours: 24,
    });
    assert.equal(r, null);
  });
});
