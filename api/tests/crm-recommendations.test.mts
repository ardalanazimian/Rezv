import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { recommendContact, rankCrmRecommendations } = await import('../src/lib/crm-recommendations.ts');

// ═══════════════════════════════════════════════════════════════════════
//  موتورِ توصیه‌یِ CRM (فازِ ۲ AI) — قانون‌محور، بدونِ DB. هر تست یک قانون
//  را قفل می‌کند؛ ترتیبِ اولویت‌ها (VIP > churned-با-ارزش > at_risk >
//  no-showِ تکرارشونده > تازه‌وارد) عمداً همین‌جا هم سنجیده می‌شود.
// ═══════════════════════════════════════════════════════════════════════

function baseSignal(overrides: Partial<Parameters<typeof recommendContact>[0]> = {}) {
  return {
    userId: 'u1', name: 'مشتریِ نمونه', phone: '+989120000000', isVip: false,
    segment: 'active', churnRiskScore: 0, noShowRatePct: 0, totalVisits: 5,
    predictedClvToman: 0, intelligenceTier: null, daysSinceLastVisit: 5,
    ...overrides,
  };
}

describe('recommendContact', () => {
  test('مشتریِ سالم و فعال → هیچ توصیه‌ای (null)', () => {
    assert.equal(recommendContact(baseSignal()), null);
  });

  test('VIP با ریسکِ ریزشِ بالا → تماسِ فوری', () => {
    const r = recommendContact(baseSignal({ isVip: true, churnRiskScore: 60, segment: 'vip' }));
    assert.ok(r);
    assert.equal(r!.channel, 'call');
    assert.equal(r!.urgency, 'high');
  });

  test('VIP با ریسکِ ریزشِ پایین → توصیه‌ای نیست (VIPِ سالم دست‌نخورده می‌ماند)', () => {
    const r = recommendContact(baseSignal({ isVip: true, churnRiskScore: 10, segment: 'vip' }));
    assert.equal(r, null);
  });

  test('از‌دست‌رفته با ارزشِ سابقاً بالا (intelligenceTier=high) → پیامکِ بازگشت', () => {
    const r = recommendContact(baseSignal({ segment: 'churned', intelligenceTier: 'high', churnRiskScore: 90 }));
    assert.ok(r);
    assert.equal(r!.channel, 'sms');
    assert.equal(r!.urgency, 'medium');
  });

  test('از‌دست‌رفته با CLVِ بالا (حتی بدونِ intelligenceTier) → پیامکِ بازگشت', () => {
    const r = recommendContact(baseSignal({ segment: 'churned', predictedClvToman: 900_000, churnRiskScore: 90 }));
    assert.ok(r);
    assert.equal(r!.channel, 'sms');
  });

  test('در‌خطرِ‌ریزش (at_risk) → پیامکِ یادآوری، متوسط', () => {
    const r = recommendContact(baseSignal({ segment: 'at_risk', churnRiskScore: 50 }));
    assert.ok(r);
    assert.equal(r!.channel, 'sms');
    assert.equal(r!.urgency, 'medium');
  });

  test('الگویِ عدم‌حضورِ تکرارشونده (>=3 بازدید، no-show>=۴۰٪) → تماسِ تأیید', () => {
    const r = recommendContact(baseSignal({ noShowRatePct: 50, totalVisits: 4 }));
    assert.ok(r);
    assert.equal(r!.channel, 'call');
  });

  test('یک no-showِ تصادفی (فقط ۱ بازدید) → توصیه نمی‌شود (الگو نیست)', () => {
    const r = recommendContact(baseSignal({ noShowRatePct: 100, totalVisits: 1, daysSinceLastVisit: 40 }));
    assert.equal(r, null); // چون totalVisits===1 && daysSinceLastVisit>30 هم شرطِ تازه‌وارد رو رد می‌کنه
  });

  test('تازه‌وارد با یک بازدیدِ اخیر، بدونِ پیگیری → پیامِ خوش‌آمد، کم', () => {
    const r = recommendContact(baseSignal({ totalVisits: 1, daysSinceLastVisit: 10, churnRiskScore: 0 }));
    assert.ok(r);
    assert.equal(r!.channel, 'sms');
    assert.equal(r!.urgency, 'low');
  });

  test('تازه‌وارد با یک بازدیدِ خیلی قدیمی (>30 روز) → دیگه «تازه» حساب نمی‌شه', () => {
    const r = recommendContact(baseSignal({ totalVisits: 1, daysSinceLastVisit: 45, churnRiskScore: 0 }));
    assert.equal(r, null);
  });

  test('اولویت: VIPِ پرریسک باید بالاتر از at_risk معمولی باشد', () => {
    const vip = recommendContact(baseSignal({ isVip: true, churnRiskScore: 60, segment: 'vip' }))!;
    const atRisk = recommendContact(baseSignal({ segment: 'at_risk', churnRiskScore: 50 }))!;
    assert.ok(vip.priority > atRisk.priority);
  });
});

describe('rankCrmRecommendations', () => {
  test('فقط مشتری‌هایی که واقعاً توصیه دارند برمی‌گردند، بقیه فیلتر می‌شوند', () => {
    const list = rankCrmRecommendations([
      baseSignal({ userId: 'healthy' }),
      baseSignal({ userId: 'vip_risk', isVip: true, churnRiskScore: 60, segment: 'vip' }),
      baseSignal({ userId: 'at_risk', segment: 'at_risk', churnRiskScore: 50 }),
    ]);
    assert.equal(list.length, 2);
    assert.ok(!list.some((r) => r.user_id === 'healthy'));
  });

  test('بالاترین اولویت اول می‌آید (VIP قبل از at_risk)', () => {
    const list = rankCrmRecommendations([
      baseSignal({ userId: 'at_risk', segment: 'at_risk', churnRiskScore: 50 }),
      baseSignal({ userId: 'vip_risk', isVip: true, churnRiskScore: 60, segment: 'vip' }),
    ]);
    assert.equal(list[0].user_id, 'vip_risk');
  });
});
