import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { computeIntelligenceScore } = await import('../src/lib/customer-intelligence.ts');

// ═══════════════════════════════════════════════════════════════════════
//  امتیازِ هوشِ مشتری (فازِ ۲ AI) — این تست‌ها فرمول را قفل می‌کنند؛ نسخه‌ی
//  SQLِ همین فرمول در lib/rfm.ts باید همیشه با این‌جا یکی بماند (رجوع کن
//  به کامنتِ بالایِ computeIntelligenceScore).
// ═══════════════════════════════════════════════════════════════════════

describe('computeIntelligenceScore', () => {
  test('بهترینِ ممکن (mScore=fScore=۵، بدونِ ریسک) → نزدیکِ ۱۰۰', () => {
    const r = computeIntelligenceScore({ mScore: 5, fScore: 5, churnRiskScore: 0, noShowRatePct: 0 });
    assert.equal(r.score, 100);
    assert.equal(r.tier, 'high');
  });

  test('بدترینِ ممکن (mScore=fScore=۱، ریسکِ کامل) → نزدیکِ صفر', () => {
    const r = computeIntelligenceScore({ mScore: 1, fScore: 1, churnRiskScore: 100, noShowRatePct: 100 });
    assert.equal(r.score, 12); // 0.35*(1*20) + 0.25*(1*20) + 0.25*0 + 0.15*0 = ۷+۵ = ۱۲
    assert.equal(r.tier, 'low');
  });

  test('RFM هنوز محاسبه نشده (null) → با مقدارِ خنثی (۳) جایگزین می‌شود، نه صفر', () => {
    const withNull = computeIntelligenceScore({ mScore: null, fScore: null, churnRiskScore: 0, noShowRatePct: 0 });
    const withNeutral = computeIntelligenceScore({ mScore: 3, fScore: 3, churnRiskScore: 0, noShowRatePct: 0 });
    assert.equal(withNull.score, withNeutral.score);
  });

  test('هیچ‌وقت خارج از بازه‌ی ۰..۱۰۰ نیست، حتی با ورودی‌های مرزی', () => {
    const r = computeIntelligenceScore({ mScore: 5, fScore: 5, churnRiskScore: -50, noShowRatePct: -50 });
    assert.ok(r.score <= 100 && r.score >= 0);
  });

  test('مرزهایِ tier: ۷۰ و ۴۰', () => {
    assert.equal(computeIntelligenceScore({ mScore: 5, fScore: 3, churnRiskScore: 10, noShowRatePct: 10 }).tier, 'high');
    assert.equal(computeIntelligenceScore({ mScore: 2, fScore: 2, churnRiskScore: 50, noShowRatePct: 30 }).tier, 'medium');
    assert.equal(computeIntelligenceScore({ mScore: 1, fScore: 1, churnRiskScore: 90, noShowRatePct: 80 }).tier, 'low');
  });

  test('ریسکِ ریزشِ بالا امتیاز را کاهش می‌دهد، حتی با ارزشِ خرجِ بالا', () => {
    const loyal = computeIntelligenceScore({ mScore: 5, fScore: 5, churnRiskScore: 0, noShowRatePct: 0 });
    const atRisk = computeIntelligenceScore({ mScore: 5, fScore: 5, churnRiskScore: 90, noShowRatePct: 0 });
    assert.ok(atRisk.score < loyal.score);
  });
});
