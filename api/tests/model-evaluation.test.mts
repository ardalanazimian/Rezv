import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const {
  calibrationBuckets, expectedCalibrationError, classifyModelHealth,
  baseRateBrier, evaluatePairs, MIN_EVAL_SAMPLE,
} = await import('../src/lib/model-evaluation.ts');
const { noShowOutcomeLabel } = await import('../src/lib/prediction-ledger.ts');

// ═══════════════════════════════════════════════════════════════════════
//  سنجشِ تولیدیِ مدل (lib/model-evaluation.ts)
//
//  تمرکزِ این تست‌ها روی «صداقتِ عدد» است، نه صرفاً درستیِ حساب: مهم‌ترین
//  رفتاری که باید قفل بماند این است که وقتی دادهٔ کافی نیست، سیستم عددِ
//  خوش‌ظاهر نسازد — این دقیقاً همان جایی‌ست که داشبوردهای «هوش مصنوعی»
//  معمولاً دروغ می‌گویند.
// ═══════════════════════════════════════════════════════════════════════

/** سازنده‌ی جفت‌های آزمایشی. */
function pairs(n: number, probability: number, label: number) {
  return Array.from({ length: n }, () => ({ probability, label }));
}

describe('calibrationBuckets', () => {
  test('هر پیش‌بینی در سطلِ درستِ خودش می‌افتد', () => {
    const b = calibrationBuckets([
      { probability: 0.05, label: 0 },
      { probability: 0.15, label: 1 },
    ], 10);
    assert.equal(b.length, 2);
    assert.equal(b[0].lowerBound, 0);
    assert.equal(b[0].count, 1);
    assert.equal(b[1].lowerBound, 0.1);
  });

  test('احتمالِ دقیقاً ۱ در آخرین سطل می‌افتد، نه در سطلِ خیالیِ بعدی', () => {
    const b = calibrationBuckets([{ probability: 1, label: 1 }], 10);
    assert.equal(b.length, 1);
    assert.equal(b[0].upperBound, 1);
    assert.equal(b[0].count, 1);
  });

  test('سطلِ خالی برگردانده نمی‌شود (count صفر معنایِ آماری ندارد)', () => {
    const b = calibrationBuckets([{ probability: 0.55, label: 1 }], 10);
    assert.equal(b.length, 1);
    assert.ok(b.every((x) => x.count > 0));
  });

  test('نرخِ واقعی و میانگینِ پیش‌بینی را درست حساب می‌کند', () => {
    // چهار پیش‌بینیِ ۰٫۵ که دوتاشان رخ داده → نرخِ واقعی ۰٫۵ (کاملاً کالیبره)
    const b = calibrationBuckets([
      { probability: 0.5, label: 1 }, { probability: 0.5, label: 1 },
      { probability: 0.5, label: 0 }, { probability: 0.5, label: 0 },
    ], 10);
    assert.equal(b.length, 1);
    assert.equal(b[0].meanPredicted, 0.5);
    assert.equal(b[0].observedRate, 0.5);
  });

  test('احتمالِ نامعتبر (NaN/خارج از بازه) شمرده نمی‌شود', () => {
    const b = calibrationBuckets([
      { probability: NaN, label: 1 },
      { probability: 1.5, label: 1 },
      { probability: -0.2, label: 0 },
      { probability: 0.5, label: 1 },
    ], 10);
    assert.equal(b.reduce((s, x) => s + x.count, 0), 1);
  });
});

describe('expectedCalibrationError', () => {
  test('مدلِ کاملاً کالیبره خطای صفر می‌گیرد', () => {
    const b = calibrationBuckets([
      { probability: 0.5, label: 1 }, { probability: 0.5, label: 0 },
    ], 10);
    assert.equal(expectedCalibrationError(b), 0);
  });

  test('مدلی که همیشه ۹۰٪ می‌گوید ولی هیچ‌وقت رخ نمی‌دهد، خطای نزدیکِ ۰٫۹ می‌گیرد', () => {
    const b = calibrationBuckets(pairs(10, 0.9, 0), 10);
    assert.ok(Math.abs(expectedCalibrationError(b) - 0.9) < 1e-9);
  });

  test('روی ورودیِ خالی صفر برمی‌گرداند، نه NaN', () => {
    assert.equal(expectedCalibrationError([]), 0);
  });
});

describe('baseRateBrier', () => {
  test('نرخِ پایه را به‌عنوانِ پیش‌بینیِ ثابت به‌کار می‌برد', () => {
    // ۲ از ۴ رخ داده → نرخِ پایه ۰٫۵ → Brier = میانگینِ (۰٫۵−y)² = ۰٫۲۵
    const v = baseRateBrier([
      { probability: 0.1, label: 1 }, { probability: 0.9, label: 1 },
      { probability: 0.2, label: 0 }, { probability: 0.8, label: 0 },
    ]);
    assert.equal(v, 0.25);
  });

  test('روی ورودیِ خالی صفر برمی‌گرداند', () => {
    assert.equal(baseRateBrier([]), 0);
  });
});

describe('classifyModelHealth', () => {
  test('زیرِ حداقلِ نمونه → insufficient_data و هیچ عددی گزارش نمی‌شود', () => {
    const r = classifyModelHealth({ sampleSize: 5, productionBrier: 0.1, baselineBrier: 0.25 });
    assert.equal(r.status, 'insufficient_data');
    assert.equal(r.relativeImprovement, null);
  });

  test('baselineِ صفر (تنوعِ نتیجه صفر) → insufficient_data، نه بهبودِ بی‌نهایت', () => {
    // اگر هیچ no-showی رخ نداده باشد نرخِ پایه ۰ است و Brierش هم ۰ —
    // تقسیم بر آن یک «بهبودِ بی‌نهایت»ِ ساختگی می‌ساخت.
    const r = classifyModelHealth({ sampleSize: 100, productionBrier: 0.02, baselineBrier: 0 });
    assert.equal(r.status, 'insufficient_data');
    assert.equal(r.relativeImprovement, null);
  });

  test('بهبودِ ≥۵٪ → normal', () => {
    const r = classifyModelHealth({ sampleSize: 100, productionBrier: 0.20, baselineBrier: 0.25 });
    assert.equal(r.status, 'normal');
  });

  test('بهبودِ مثبت ولی نازک → warning', () => {
    const r = classifyModelHealth({ sampleSize: 100, productionBrier: 0.245, baselineBrier: 0.25 });
    assert.equal(r.status, 'warning');
  });

  test('بدتر از baseline ولی کمتر از ۱۰٪ → degraded', () => {
    const r = classifyModelHealth({ sampleSize: 100, productionBrier: 0.26, baselineBrier: 0.25 });
    assert.equal(r.status, 'degraded');
    assert.ok(r.relativeImprovement! < 0);
  });

  test('بیش از ۱۰٪ بدتر از baseline → critical', () => {
    const r = classifyModelHealth({ sampleSize: 100, productionBrier: 0.30, baselineBrier: 0.25 });
    assert.equal(r.status, 'critical');
  });
});

describe('evaluatePairs — صداقتِ گزارش', () => {
  test('دادهٔ کم → همه‌ی معیارها null، نه صفر', () => {
    const r = evaluatePairs(pairs(MIN_EVAL_SAMPLE - 1, 0.3, 0));
    assert.equal(r.status, 'insufficient_data');
    // ⚠️ حیاتی: صفر نباشد. یک UI که «۰» ببیند آن را «خطای صفر = عالی»
    // تفسیر می‌کند؛ null یعنی «نمی‌دانیم» و قابلِ‌اشتباه‌گرفتن نیست.
    assert.equal(r.productionBrier, null);
    assert.equal(r.baselineBrier, null);
    assert.equal(r.calibrationError, null);
    assert.equal(r.observedRate, null);
    assert.deepEqual(r.calibration, []);
  });

  test('جفتِ نامعتبر از نمونه حذف می‌شود (نه اینکه آمار را مسموم کند)', () => {
    const good = pairs(MIN_EVAL_SAMPLE, 0.5, 1);
    const bad = [{ probability: NaN, label: 1 }, { probability: 0.5, label: 7 }];
    const r = evaluatePairs([...good, ...bad]);
    assert.equal(r.sampleSize, MIN_EVAL_SAMPLE);
  });

  test('مدلِ کامل روی دادهٔ کافی → Brierِ صفر و وضعیتِ normal', () => {
    const half = MIN_EVAL_SAMPLE;
    const r = evaluatePairs([...pairs(half, 1, 1), ...pairs(half, 0, 0)]);
    assert.equal(r.sampleSize, half * 2);
    assert.equal(r.productionBrier, 0);
    assert.equal(r.status, 'normal');
    assert.equal(r.observedRate, 0.5);
  });

  test('مدلی که همیشه برعکس می‌گوید → critical', () => {
    const half = MIN_EVAL_SAMPLE;
    const r = evaluatePairs([...pairs(half, 0, 1), ...pairs(half, 1, 0)]);
    assert.equal(r.status, 'critical');
    assert.ok(r.productionBrier! > r.baselineBrier!);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  دامنه‌ی برچسبِ نتیجه — قفلِ رگرسیون در برابرِ ناهم‌ترازیِ آموزش/تولید
// ═══════════════════════════════════════════════════════════════════════
describe('noShowOutcomeLabel', () => {
  test('no_show برچسبِ ۱ می‌گیرد', () => {
    assert.equal(noShowOutcomeLabel('no_show'), 1);
  });

  test('همه‌ی وضعیت‌هایِ «مهمان آمد» برچسبِ ۰ می‌گیرند', () => {
    for (const s of ['completed', 'arrived', 'seated', 'dining']) {
      assert.equal(noShowOutcomeLabel(s), 0, `وضعیتِ ${s} باید ۰ باشد`);
    }
  });

  test('لغو/انقضا/رد اصلاً برچسب نمی‌گیرند (null)', () => {
    // ⚠️ اگر اینها روزی ۰ بشوند، دقتِ تولیدی به‌طورِ ساختگی بالا می‌رود:
    // لغوها زیادند و مدل هیچ ادعایی درباره‌شان نکرده بود.
    for (const s of ['cancelled', 'cancelled_by_user', 'cancelled_by_restaurant',
                     'auto_cancelled', 'expired', 'rejected', 'pending', 'confirmed']) {
      assert.equal(noShowOutcomeLabel(s), null, `وضعیتِ ${s} نباید برچسب بگیرد`);
    }
  });

  test('دامنه‌ی برچسب دقیقاً با دامنه‌ی دادهٔ آموزش یکی است', () => {
    // fetchTrainingRows در lib/no-show-model.ts فقط این پنج وضعیت را
    // به‌عنوانِ دادهٔ آموزش می‌خواند. اگر این دو دامنه از هم جدا بیفتند،
    // Brierِ تولیدی و Brierِ هولدآوت دو چیزِ متفاوت را می‌سنجند و
    // مقایسه‌شان (که کلِ داشبوردِ سلامتِ مدل رویش بنا شده) بی‌معنا می‌شود.
    const trainingDomain = ['completed', 'no_show', 'arrived', 'seated', 'dining'];
    for (const s of trainingDomain) {
      assert.notEqual(noShowOutcomeLabel(s), null, `${s} در آموزش هست پس باید برچسب بگیرد`);
    }
  });
});
