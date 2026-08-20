import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { recordPrediction, recordOutcome, MIN_RESOLVED_FOR_ACCURACY } from '../src/lib/prediction-ledger.ts';
import {
  detectPerformanceDrift, detectOutputDrift,
  PERFORMANCE_DRIFT_THRESHOLD, MIN_SAMPLES_FOR_PSI,
} from '../src/lib/model-drift.ts';

// ═══════════════════════════════════════════════════════════════════════
//  فازِ ۷ — تشخیصِ رانش رویِ دادهٔ واقعیِ دفتر
//
//  آنچه اثبات می‌شود: رانش از رویِ همان چیزی محاسبه می‌شود که فازهای ۵ و ۶
//  ثبت می‌کنند — نه از یک منبعِ جدید. و مهم‌تر: وقتی شواهد کافی نیست،
//  «پایدار» گزارش نمی‌شود بلکه صریحاً insufficient_data برمی‌گردد.
//
//  هر ادعایِ منفی با کنترلِ مثبت جفت شده تا تست به‌طورِ توخالی سبز نشود.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `dr-${randomUUID().slice(0, 8)}`;
let tenantId: string;
/** رستورانی که مدلش رانش کرده. */
let driftedId: string, driftedRunId: string;
/** رستورانی که مدلش سالم مانده — کنترلِ مثبت. */
let healthyId: string, healthyRunId: string;
/** رستورانی بدونِ مدلِ فعال. */
let noModelId: string;
/** رستورانی با نتیجه‌ی کمتر از کف — عمداً جدا، تا چند نتیجه‌ی بدِ آزمایشی
 *  میانگینِ رستورانِ «سالم» را خراب نکند و کنترلِ مثبت بی‌معنا نشود. */
let smallId: string, smallRunId: string;

const HOLDOUT_BRIER = 0.10;

async function makeRestaurant(slugSuffix: string, name: string): Promise<string> {
  const r = await db.restaurant.create({
    data: { tenantId, slug: `${TAG}-${slugSuffix}`, name, timezone: 'Asia/Tehran',
            clubPrefix: 'DR', isOpen: true },
    select: { id: true },
  });
  return r.id;
}

async function activateModel(restaurantId: string, holdoutBrier: number): Promise<string> {
  const run = await db.modelTrainingRun.create({
    data: {
      restaurantId, kind: 'no_show', sampleSize: 200,
      metrics: { learnedBrier: holdoutBrier, staticBrier: 0.2 },
      isActive: true, reason: '[DEMO] اجرا برای تستِ رانش',
    },
    select: { id: true },
  });
  await db.restaurantNoShowModel.create({
    data: {
      restaurantId, weights: [-1, 0, 1.5, 0.5, 0, 0.3, 0], sampleSize: 200, positiveCount: 40,
      learnedBrier: holdoutBrier, staticBrier: 0.2, isActive: true, activeRunId: run.id,
    },
  });
  return run.id;
}

/** ثبتِ n پیش‌بینی با خطایِ مربعِ معلوم، بستهٔ همان نسخه. */
async function seedResolved(opts: {
  restaurantId: string; runId: string; count: number;
  predicted: number; observed: number; daysAgo?: number;
}): Promise<void> {
  const at = new Date(Date.now() - (opts.daysAgo ?? 3) * 86_400_000);
  for (let i = 0; i < opts.count; i++) {
    const entityId = randomUUID();
    const id = await recordPrediction({
      restaurantId: opts.restaurantId, predictionType: 'no_show',
      entityType: 'reservation', entityId, modelSource: 'learned',
      modelRunId: opts.runId, featureVersion: 'no_show/v1',
      predictedValue: opts.predicted, confidence: 'high', horizonAt: at,
    });
    assert.ok(id, 'ثبتِ پیش‌بینیِ آزمایشی باید موفق باشد');
    // generated_at پیش‌فرض now() است؛ برای پنجره‌ی «اخیر» همین درست است.
    const r = await recordOutcome({
      entityType: 'reservation', entityId,
      observedValue: opts.observed, source: 'reservation_status',
    });
    assert.equal(r, 'recorded');
  }
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  driftedId = await makeRestaurant('bad', '[DEMO] رستورانِ مدلِ رانش‌کرده');
  healthyId = await makeRestaurant('good', '[DEMO] رستورانِ مدلِ سالم');
  noModelId = await makeRestaurant('none', '[DEMO] رستورانِ بدونِ مدل');
  smallId = await makeRestaurant('small', '[DEMO] رستورانِ نمونه‌ی کم');
  driftedRunId = await activateModel(driftedId, HOLDOUT_BRIER);
  healthyRunId = await activateModel(healthyId, HOLDOUT_BRIER);
  smallRunId = await activateModel(smallId, HOLDOUT_BRIER);
});

after(async () => {
  const ids = [driftedId, healthyId, noModelId, smallId];
  await db.restaurantNoShowModel.deleteMany({ where: { restaurantId: { in: ids } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('رانشِ کارایی — Brierِ تولید در برابرِ هولدآوتِ آموزش', () => {
  test('بدونِ مدلِ فعال، حکم insufficient_data است نه «پایدار»', async () => {
    const d = await detectPerformanceDrift({ restaurantId: noModelId });
    assert.equal(d.verdict, 'insufficient_data');
    assert.equal(d.productionBrier, null);
    assert.match(d.reason, /heuristic/);
  });

  test('با نتیجه‌ی کمتر از کف، باز هم insufficient_data', async () => {
    // کنترلِ منفی برای «کفِ نمونه»: چند نتیجه‌ی خیلی بد ثبت می‌کنیم؛
    // اگر کف کار نکند، این باید فوراً «drifted» بدهد.
    await seedResolved({
      restaurantId: smallId, runId: smallRunId,
      count: 3, predicted: 0.9, observed: 0,   // خطایِ مربع = ۰٫۸۱
    });
    const d = await detectPerformanceDrift({ restaurantId: smallId });
    assert.equal(d.verdict, 'insufficient_data',
      'با ۳ نتیجه نباید حکمِ رانش صادر شود، هرچقدر هم بد باشند');
    assert.equal(d.resolvedCount, 3);
  });

  test('مدلی که در تولید به‌شدت بدتر شده، drifted تشخیص داده می‌شود', async () => {
    // Brierِ هولدآوت ۰٫۱۰ بود. این‌جا خطایِ مربع = (۰٫۹−۰)² = ۰٫۸۱ →
    // بدترشدنِ نسبیِ ۷۱۰٪، خیلی بالاتر از آستانه‌ی ۲۵٪.
    await seedResolved({
      restaurantId: driftedId, runId: driftedRunId,
      count: MIN_RESOLVED_FOR_ACCURACY, predicted: 0.9, observed: 0,
    });
    const d = await detectPerformanceDrift({ restaurantId: driftedId });
    assert.equal(d.verdict, 'drifted');
    assert.equal(d.modelRunId, driftedRunId, 'باید به همان نسخه‌ی فعال نسبت داده شود');
    assert.equal(d.holdoutBrier, HOLDOUT_BRIER);
    assert.ok(d.productionBrier !== null && d.productionBrier > 0.8);
    assert.ok(d.relativeChange !== null && d.relativeChange > PERFORMANCE_DRIFT_THRESHOLD);
  });

  test('کنترلِ مثبت: مدلی که هم‌چنان خوب کار می‌کند stable می‌ماند', async () => {
    // بدونِ این، تستِ بالا با یک `return "drifted"`ِ همیشگی هم سبز می‌شد.
    // خطایِ مربع = (۰٫۳−۰)² = ۰٫۰۹ که کمی *بهتر* از هولدآوتِ ۰٫۱۰ است.
    await seedResolved({
      restaurantId: healthyId, runId: healthyRunId,
      count: MIN_RESOLVED_FOR_ACCURACY, predicted: 0.3, observed: 0,
    });
    const d = await detectPerformanceDrift({ restaurantId: healthyId });
    assert.equal(d.verdict, 'stable', `انتظارِ پایدار، ولی: ${d.reason}`);
    assert.ok(d.relativeChange !== null && d.relativeChange < PERFORMANCE_DRIFT_THRESHOLD / 2);
  });

  test('پیش‌بینی‌هایِ نسخه‌ی دیگر در این محاسبه شمرده نمی‌شوند', async () => {
    // یک نسخه‌ی *غیرفعالِ* دیگر با نتایجِ فاجعه‌بار. اگر فیلترِ model_run_id
    // کار نکند، رستورانِ سالم ناگهان drifted می‌شود.
    const otherRun = await db.modelTrainingRun.create({
      data: { restaurantId: healthyId, kind: 'no_show', sampleSize: 50,
              metrics: { learnedBrier: 0.5, staticBrier: 0.2 },
              isActive: false, reason: '[DEMO] نسخه‌ی ردشده' },
      select: { id: true },
    });
    await seedResolved({
      restaurantId: healthyId, runId: otherRun.id,
      count: MIN_RESOLVED_FOR_ACCURACY, predicted: 1, observed: 0,
    });
    const d = await detectPerformanceDrift({ restaurantId: healthyId });
    assert.equal(d.verdict, 'stable',
      'نتایجِ نسخه‌ی دیگر نباید به حسابِ نسخه‌ی فعال گذاشته شود');
  });
});

describe('رانشِ توزیعِ خروجی (PSI)', () => {
  test('با پیش‌بینیِ کم، حکم insufficient_data است', async () => {
    const d = await detectOutputDrift({ restaurantId: noModelId });
    assert.equal(d.verdict, 'insufficient_data');
    assert.equal(d.psi, null);
    assert.match(d.reason, new RegExp(String(MIN_SAMPLES_FOR_PSI)));
  });

  test('وقتی همه‌ی پیش‌بینی‌ها در پنجره‌ی اخیرند، پنجره‌ی پایه خالی است و حکم صادر نمی‌شود', async () => {
    // رستورانِ رانش‌کرده الان ۲۰ پیش‌بینی دارد، همه از همین دقیقه — یعنی
    // همه در پنجره‌ی «اخیر». مقایسه‌ی یک پنجره با هیچ، PSI ندارد؛ مهم است
    // که این حالت «پایدار» گزارش نشود.
    const d = await detectOutputDrift({ restaurantId: driftedId });
    assert.equal(d.verdict, 'insufficient_data');
    assert.equal(d.baselineCount, 0);
  });
});
