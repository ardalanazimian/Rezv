import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — رجوع کن به validate.test.mts برایِ دلیل.
const { rankIncentives } = await import('../src/lib/incentive-engine.ts');

const BASE = {
  segment: 'active',
  churnRiskScore: 10,
  reliabilityScore: 75,
  reputationTier: 'bronze' as const,
  hasActiveAbuseFlag: false,
  lowDemandDay: null,
  missions: [] as { id: string; title: string; kind: string; progress: number; targetCount: number; completed: boolean; claimed: boolean }[],
  rewardItems: [] as { id: string; title: string; costCoins: number; minTier: string; unlocked: boolean; inStock: boolean }[],
};

describe('rankIncentives', () => {
  test('بدونِ هیچ سیگنالی → لیستِ خالی', () => {
    const r = rankIncentives(BASE);
    assert.deepEqual(r, []);
  });

  test('ماموریتِ کامل‌شده و claim‌نشده → همیشه بالاترین اولویت', () => {
    const r = rankIncentives({
      ...BASE,
      missions: [{ id: 'm1', title: 'سه رزرو', kind: 'weekly', progress: 3, targetCount: 3, completed: true, claimed: false }],
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].kind, 'mission');
    assert.equal(r[0].ref_id, 'm1');
  });

  test('ماموریتِ کامل‌شده و claimedِ قبلی → دیگه پیشنهاد نمی‌شه', () => {
    const r = rankIncentives({
      ...BASE,
      missions: [{ id: 'm1', title: 'سه رزرو', kind: 'weekly', progress: 3, targetCount: 3, completed: true, claimed: true }],
    });
    assert.deepEqual(r, []);
  });

  test('hasActiveAbuseFlag=true → هیچ nudge/تشویقِ جدیدی، فقط جایزه‌یِ از‌قبل‌کامل‌شده', () => {
    const r = rankIncentives({
      ...BASE,
      hasActiveAbuseFlag: true,
      segment: 'new_customer',
      churnRiskScore: 90,
      lowDemandDay: { date: '2026-08-20', ratio: 0.5 },
      missions: [
        { id: 'done', title: 'کامل‌شده', kind: 'weekly', progress: 1, targetCount: 1, completed: true, claimed: false },
        { id: 'onboarding', title: 'خوش‌آمد', kind: 'onboarding', progress: 0, targetCount: 1, completed: false, claimed: false },
      ],
      rewardItems: [{ id: 'r1', title: 'جایزه', costCoins: 100, minTier: 'bronze', unlocked: true, inStock: true }],
    });
    assert.equal(r.length, 1, `فقط ماموریتِ کامل‌شده باید بمونه، گرفتیم: ${JSON.stringify(r)}`);
    assert.equal(r[0].ref_id, 'done');
  });

  test('segment=new_customer → ماموریتِ onboarding پیشنهاد می‌شه', () => {
    const r = rankIncentives({
      ...BASE,
      segment: 'new_customer',
      missions: [
        { id: 'onboarding', title: 'خوش‌آمد', kind: 'onboarding', progress: 0, targetCount: 1, completed: false, claimed: false },
        { id: 'other', title: 'ماموریتِ دیگه', kind: 'weekly', progress: 0, targetCount: 3, completed: false, claimed: false },
      ],
    });
    assert.equal(r[0].kind, 'mission');
    assert.equal(r[0].ref_id, 'onboarding');
  });

  test('churnRiskScore>=60 → نزدیک‌ترین ماموریتِ ناتمام به تکمیل پیشنهاد می‌شه (نه بعیدترین)', () => {
    const r = rankIncentives({
      ...BASE,
      churnRiskScore: 75,
      missions: [
        { id: 'far', title: 'دور', kind: 'weekly', progress: 1, targetCount: 10, completed: false, claimed: false },
        { id: 'near', title: 'نزدیک', kind: 'weekly', progress: 4, targetCount: 5, completed: false, claimed: false },
      ],
    });
    const missionSuggestions = r.filter((s) => s.kind === 'mission');
    assert.equal(missionSuggestions[0].ref_id, 'near');
  });

  test('segment=at_risk (حتی با churnRiskScore پایین) → همون قانونِ ریزش اعمال می‌شه', () => {
    const r = rankIncentives({
      ...BASE,
      segment: 'at_risk',
      churnRiskScore: 5,
      missions: [{ id: 'm1', title: 'ماموریت', kind: 'weekly', progress: 2, targetCount: 4, completed: false, claimed: false }],
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].ref_id, 'm1');
    assert.equal(r[0].reason, 'یه قدم دیگه تا جایزه‌ی بعدی');
  });

  test('reputationTier=gold/platinum + reliabilityScore>=85 → گرون‌ترین جایزه‌یِ unlocked رو highlight می‌کنه', () => {
    const r = rankIncentives({
      ...BASE,
      reputationTier: 'gold',
      reliabilityScore: 90,
      rewardItems: [
        { id: 'cheap', title: 'ارزون', costCoins: 100, minTier: 'bronze', unlocked: true, inStock: true },
        { id: 'expensive', title: 'گرون', costCoins: 500, minTier: 'silver', unlocked: true, inStock: true },
        { id: 'locked', title: 'قفل', costCoins: 1000, minTier: 'platinum', unlocked: false, inStock: true },
        { id: 'out_of_stock', title: 'ناموجود', costCoins: 900, minTier: 'silver', unlocked: true, inStock: false },
      ],
    });
    const rewardSuggestion = r.find((s) => s.kind === 'reward');
    assert.equal(rewardSuggestion?.ref_id, 'expensive');
  });

  test('reputationTier=gold ولی reliabilityScore<85 → جایزه‌ای highlight نمی‌شه (هردو شرط لازمه)', () => {
    const r = rankIncentives({
      ...BASE,
      reputationTier: 'gold',
      reliabilityScore: 80,
      rewardItems: [{ id: 'r1', title: 'جایزه', costCoins: 500, minTier: 'bronze', unlocked: true, inStock: true }],
    });
    assert.ok(!r.some((s) => s.kind === 'reward'));
  });

  test('reputationTier=bronze با reliabilityScore بالا → جایزه‌ای highlight نمی‌شه (tier هم لازمه)', () => {
    const r = rankIncentives({
      ...BASE,
      reputationTier: 'bronze',
      reliabilityScore: 99,
      rewardItems: [{ id: 'r1', title: 'جایزه', costCoins: 500, minTier: 'bronze', unlocked: true, inStock: true }],
    });
    assert.ok(!r.some((s) => s.kind === 'reward'));
  });

  test('lowDemandDay ست‌شده → off_peak_nudge اضافه می‌شه', () => {
    const r = rankIncentives({ ...BASE, lowDemandDay: { date: '2026-08-20', ratio: 0.5 } });
    assert.equal(r.length, 1);
    assert.equal(r[0].kind, 'off_peak_nudge');
    assert.ok(r[0].reason.includes('2026-08-20'));
  });

  test('lowDemandDay=null → off_peak_nudge اضافه نمی‌شه', () => {
    const r = rankIncentives({ ...BASE, lowDemandDay: null });
    assert.ok(!r.some((s) => s.kind === 'off_peak_nudge'));
  });

  test('یه ماموریت نباید دوبار پیشنهاد بشه (هم به‌عنوانِ churn-risk، هم به‌عنوانِ fallback)', () => {
    const r = rankIncentives({
      ...BASE,
      churnRiskScore: 70,
      missions: [{ id: 'm1', title: 'تنها ماموریت', kind: 'weekly', progress: 1, targetCount: 2, completed: false, claimed: false }],
    });
    const occurrences = r.filter((s) => s.ref_id === 'm1').length;
    assert.equal(occurrences, 1);
  });

  test('محدودیتِ حداکثر ۵ پیشنهاد', () => {
    const r = rankIncentives({
      ...BASE,
      segment: 'at_risk',
      lowDemandDay: { date: '2026-08-20', ratio: 0.5 },
      reputationTier: 'platinum',
      reliabilityScore: 95,
      missions: Array.from({ length: 10 }, (_, i) => ({
        id: `m${i}`, title: `ماموریت ${i}`, kind: 'weekly', progress: 1, targetCount: 2 + i, completed: false, claimed: false,
      })),
      rewardItems: [{ id: 'r1', title: 'جایزه', costCoins: 500, minTier: 'bronze', unlocked: true, inStock: true }],
    });
    assert.ok(r.length <= 5, `انتظارِ حداکثر ۵ داشتیم، گرفتیم ${r.length}`);
  });

  test('اولویت‌بندیِ کلی: mission-ready-to-claim > onboarding > churn-risk > reward > off_peak > fallback', () => {
    const r = rankIncentives({
      ...BASE,
      segment: 'new_customer',
      churnRiskScore: 80,
      reputationTier: 'platinum',
      reliabilityScore: 95,
      lowDemandDay: { date: '2026-08-20', ratio: 0.5 },
      missions: [
        { id: 'ready', title: 'آماده‌یِ claim', kind: 'weekly', progress: 3, targetCount: 3, completed: true, claimed: false },
        { id: 'onboarding', title: 'خوش‌آمد', kind: 'onboarding', progress: 0, targetCount: 1, completed: false, claimed: false },
        { id: 'churn', title: 'ریسکِ ریزش', kind: 'weekly', progress: 1, targetCount: 2, completed: false, claimed: false },
      ],
      rewardItems: [{ id: 'rw', title: 'جایزه', costCoins: 500, minTier: 'bronze', unlocked: true, inStock: true }],
    });
    const order = r.map((s) => s.ref_id ?? s.kind);
    assert.deepEqual(order, ['ready', 'onboarding', 'churn', 'rw', 'off_peak_nudge']);
  });
});
