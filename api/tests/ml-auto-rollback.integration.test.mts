import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  پس‌گرفتنِ خودکارِ مدلِ خراب — بستنِ حلقه‌ی یادگیری
//
//  ⚠️ شکافی که این فایل می‌بندد: `detectPerformanceDrift` رانش را **تشخیص**
//  می‌داد و داشبورد نشانش می‌داد، ولی هیچ کدی هرگز مدلِ بدشده را غیرفعال
//  نمی‌کرد (grep: صفر مسیرِ `isActive: false` برای مدل). یعنی مدلی که در
//  تولید خراب شده بود همچنان به رستوران‌دار ریسکِ اشتباه می‌داد تا وقتی یک
//  انسان داشبورد را ببیند.
//
//  «قدرتِ یادگیری» فقط یادگرفتن نیست — پس‌گرفتنِ چیزی که بد از آب درآمد هم
//  هست. بدونِ آن، حلقه یک‌طرفه است.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { rollbackDriftedModel, PERFORMANCE_DRIFT_THRESHOLD } = await import('../src/lib/model-drift');
const { MIN_RESOLVED_FOR_ACCURACY } = await import('../src/lib/prediction-ledger');
const { getEffectiveNoShowModel, invalidateNoShowModelCache, NO_SHOW_FEATURE_VERSION, NO_SHOW_FEATURE_NAMES } =
  await import('../src/lib/no-show-model');

const TAG = `roll-${randomUUID().slice(0, 8)}`;
let tenantId: string;
let restaurantId: string;
let seq = 0;

/** مدلِ فعال با Brierِ هولدآوتِ مشخص. */
async function activeModel(holdoutBrier: number) {
  const run = await db.modelTrainingRun.create({
    data: {
      restaurantId, kind: 'no_show', sampleSize: 100, isActive: true,
      metrics: { learnedBrier: holdoutBrier, staticBrier: holdoutBrier * 1.5 } as never,
    },
    select: { id: true },
  });
  await db.restaurantNoShowModel.upsert({
    where: { restaurantId },
    create: {
      restaurantId, weights: new Array(NO_SHOW_FEATURE_NAMES.length).fill(0), sampleSize: 100, positiveCount: 20,
      learnedBrier: holdoutBrier, staticBrier: holdoutBrier * 1.5,
      isActive: true, activeRunId: run.id, featureVersion: NO_SHOW_FEATURE_VERSION,
    },
    update: { isActive: true, activeRunId: run.id, learnedBrier: holdoutBrier, activationReason: null },
  });
  return run.id;
}

/** n پیش‌بینیِ حل‌شده با خطای مربعیِ مشخص ⇒ Brierِ تولید = squaredError. */
async function resolvedPredictions(runId: string, n: number, squaredError: number) {
  for (let i = 0; i < n; i++) {
    const p = await db.modelPrediction.create({
      data: {
        restaurantId, modelRunId: runId, predictionType: 'no_show',
        entityType: 'reservation', entityId: `${TAG}-${++seq}`,
        modelSource: 'learned', featureVersion: 'test-v1',
        predictedValue: 0.5, confidence: 'high',
        generatedAt: new Date(Date.now() - 86_400_000),
      },
      select: { id: true },
    });
    await db.modelOutcome.create({
      data: {
        predictionId: p.id, observedValue: 0, squaredError,
        absoluteError: Math.sqrt(squaredError), source: 'test',
      },
    });
  }
}

const isActive = async () =>
  (await db.restaurantNoShowModel.findUnique({
    where: { restaurantId }, select: { isActive: true },
  }))?.isActive ?? false;

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] تنانتِ rollback ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: TAG, name: '[DEMO] رستورانِ تستِ rollback', clubPrefix: 'RB', timezone: 'Asia/Tehran' },
    select: { id: true },
  });
  restaurantId = r.id;
});

beforeEach(async () => {
  await db.modelOutcome.deleteMany({ where: { prediction: { restaurantId } } });
  await db.modelPrediction.deleteMany({ where: { restaurantId } });
  await db.restaurantNoShowModel.deleteMany({ where: { restaurantId } });
  await db.modelTrainingRun.deleteMany({ where: { restaurantId } });
  // ردیف‌ها مستقیم پاک می‌شوند، پس کشِ سرو هم باید پاک شود.
  await invalidateNoShowModelCache(restaurantId);
});

after(async () => {
  await db.modelOutcome.deleteMany({ where: { prediction: { restaurantId } } });
  await db.modelPrediction.deleteMany({ where: { restaurantId } });
  await db.restaurantNoShowModel.deleteMany({ where: { restaurantId } });
  await db.modelTrainingRun.deleteMany({ where: { restaurantId } });
  await db.restaurant.delete({ where: { id: restaurantId } });
  await db.tenant.delete({ where: { id: tenantId } });
});

describe('پس‌گرفتنِ خودکارِ مدلِ خراب', () => {

  test('⚠️ مدلی که در تولید بسیار بدتر شده، غیرفعال می‌شود', async () => {
    const runId = await activeModel(0.10);
    // Brierِ تولید ۰٫۳۰ در برابرِ هولدآوتِ ۰٫۱۰ ⇒ ۲۰۰٪ بدتر، خیلی بالاتر از آستانه
    await resolvedPredictions(runId, MIN_RESOLVED_FOR_ACCURACY + 5, 0.30);

    const out = await rollbackDriftedModel({ restaurantId });
    assert.equal(out.verdict, 'drifted', out.reason);
    assert.equal(out.rolledBack, true, 'باید پس گرفته شود');
    assert.equal(await isActive(), false, 'سیستم باید به heuristic برگردد');
  });

  test('علتِ غیرفعال‌شدن ثبت می‌شود، نه فقط is_active=false', async () => {
    // بدونِ متن، «هرگز فعال نشد» و «پس گرفته شد» از هم قابلِ تشخیص نیستند.
    const runId = await activeModel(0.10);
    await resolvedPredictions(runId, MIN_RESOLVED_FOR_ACCURACY + 5, 0.30);
    await rollbackDriftedModel({ restaurantId });
    const row = await db.restaurantNoShowModel.findUniqueOrThrow({
      where: { restaurantId }, select: { activationReason: true },
    });
    assert.match(row.activationReason ?? '', /غیرفعالِ خودکار/,
      'علت باید در ردیفِ مدل بماند تا داشبورد بتواند نشانش دهد');
  });

  test('🔴 کنترلِ منفی: مدلِ سالم دست نمی‌خورد', async () => {
    // بدونِ این، «همیشه غیرفعال کن» هم سبز می‌شد و کلِ ML می‌مرد.
    const runId = await activeModel(0.20);
    await resolvedPredictions(runId, MIN_RESOLVED_FOR_ACCURACY + 5, 0.20);   // بدونِ افت
    const out = await rollbackDriftedModel({ restaurantId });
    assert.equal(out.rolledBack, false, out.reason);
    assert.equal(await isActive(), true, 'مدلِ سالم باید فعال بماند');
  });

  test('🔴 با دادهٔ ناکافی هرگز اقدام نمی‌شود', async () => {
    // مهم‌ترین گاردِ ایمنی: غیرفعال‌کردنِ مدل بر پایه‌ی چند نمونه، خودش
    // همان «ادعای اندازه‌گیری‌نشده» است که ML_CONTRACT ممنوع کرده.
    const runId = await activeModel(0.10);
    await resolvedPredictions(runId, Math.max(1, MIN_RESOLVED_FOR_ACCURACY - 3), 0.90);  // فاجعه‌بار ولی کم
    const out = await rollbackDriftedModel({ restaurantId });
    assert.equal(out.verdict, 'insufficient_data', out.reason);
    assert.equal(out.rolledBack, false, 'با نمونه‌ی کم نباید اقدام شود');
    assert.equal(await isActive(), true);
  });

  test('افتِ زیرِ آستانه (watch) اقدام نمی‌شود', async () => {
    // آستانه‌ی نصف برای هشدار است نه اقدام؛ پس‌گرفتن روی نوسانِ معمولی
    // خودش بی‌ثباتی می‌سازد.
    const holdout = 0.20;
    const mild = holdout * (1 + PERFORMANCE_DRIFT_THRESHOLD * 0.6);   // بینِ نصف و آستانه
    const runId = await activeModel(holdout);
    await resolvedPredictions(runId, MIN_RESOLVED_FOR_ACCURACY + 5, mild);
    const out = await rollbackDriftedModel({ restaurantId });
    assert.equal(out.verdict, 'watch', out.reason);
    assert.equal(out.rolledBack, false);
    assert.equal(await isActive(), true);
  });

  test('اجرای دوم دوباره پس نمی‌گیرد', async () => {
    // ⚠️ صادقانه درباره‌ی چیزی که این تست **می‌سنجد** و چیزی که نمی‌سنجد:
    // این تستْ *کوتاه‌شدنِ مسیر* را قفل می‌کند — بعد از پس‌گرفتن، دیگر مدلِ
    // فعالی نیست پس `detectPerformanceDrift` حکمِ `insufficient_data` می‌دهد
    // و اصلاً به `updateMany` نمی‌رسد.
    //
    // شرطِ اتمیکِ `isActive: true` در خودِ `updateMany` را **نمی‌سنجد**: با
    // جهش‌آزمایی تأیید شد (برداشتنِ آن شرط ۰ تست را قرمز کرد). آن شرط
    // دفاعِ در عمق برای دو اجرای کاملاً هم‌زمان است، و چون این تابع در عمل
    // سریال اجرا می‌شود، مسیرش از این‌جا دست‌نیافتنی است.
    // ادعای «تستِ اتمیک بودن» می‌کردم، غلط بود.
    const runId = await activeModel(0.10);
    await resolvedPredictions(runId, MIN_RESOLVED_FOR_ACCURACY + 5, 0.30);
    const first = await rollbackDriftedModel({ restaurantId });
    const second = await rollbackDriftedModel({ restaurantId });
    assert.equal(first.rolledBack, true);
    assert.equal(second.rolledBack, false, 'مدلِ غیرفعال دوباره پس گرفته نمی‌شود');
  });

  test('بدونِ مدلِ فعال، اقدامی نیست', async () => {
    const out = await rollbackDriftedModel({ restaurantId });
    assert.equal(out.rolledBack, false);
    assert.equal(out.verdict, 'insufficient_data');
  });

  test('🔴 بعد از پس‌گرفتن، مسیرِ سرو هم دیگر مدل را نمی‌دهد (نه فقط ردیفِ DB)', async () => {
    // ⚠️ چرا این تست جدا از بقیه‌ی فایل لازم بود — یافته‌ی واقعیِ ۲۰۲۶-۰۸-۲۵:
    // همه‌ی تست‌های بالا `isActive()` را می‌خوانند، که مستقیم به **دیتابیس**
    // می‌زند. ولی مسیرِ سروِ واقعی (`getEffectiveNoShowModel`) از یک کشِ
    // یک‌ساعته می‌خواند. تا امروز `rollbackDriftedModel` کلیدِ **اشتباهی**
    // را invalidate می‌کرد، پس:
    //   ردیفِ DB → غیرفعال ✅ (همه‌ی تست‌ها سبز)
    //   مسیرِ سرو → همان مدلِ خرابِ پس‌گرفته‌شده، تا یک ساعت ❌
    // یعنی خودِ سازوکارِ پس‌گرفتن — که کلِ دلیلِ وجودِ این فایل است — بی‌اثر
    // بود و **هیچ تستی نمی‌گرفتش**، چون هیچ‌کدام از سمتِ سرو نگاه نمی‌کردند.
    const runId = await activeModel(0.10);
    await resolvedPredictions(runId, MIN_RESOLVED_FOR_ACCURACY + 5, 0.30);

    // کش را عمداً گرم کن — دقیقاً کاری که یک رزروِ واقعی پیش از رانش می‌کند.
    const before = await getEffectiveNoShowModel(restaurantId);
    assert.equal(before?.source, 'restaurant', 'پیش‌شرط: مدل باید سرو شود');

    assert.equal((await rollbackDriftedModel({ restaurantId })).rolledBack, true);

    const after = await getEffectiveNoShowModel(restaurantId);
    assert.notEqual(after?.source, 'restaurant',
      'مدلِ پس‌گرفته‌شده نباید از کش سرو شود — پس‌گرفتن باید فوری اثر کند');
  });
});
