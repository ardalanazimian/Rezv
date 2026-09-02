import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const { meanAbsoluteError, decideModelActivation, calibrationCurve, expectedCalibrationError } =
  await import('../src/lib/ml-core.ts');

// ═══════════════════════════════════════════════════════════════════════
//  این تست‌ها فقط بخش‌هایی از ml-core.ts را می‌سنجند که از طریقِ
//  no-show-model.test.mts پوشش داده نشده‌اند (sigmoid/trainLogisticRegression/
//  predictProba/brierScore/decideActivation از همان‌جا به‌طورِ کامل تست
//  می‌شوند چون no-show-model.ts آن‌ها را re-export می‌کند). اینجا فقط روی
//  meanAbsoluteError (مخصوصِ رگرسیون، هنوز جایی استفاده نشده تا no-show)
//  و رفتارِ عمومیِ decideModelActivation (فراتر از wrapperِ no-show‌محور) تمرکز است.
// ═══════════════════════════════════════════════════════════════════════

describe('meanAbsoluteError', () => {
  test('پیش‌بینیِ کامل → صفر', () => {
    assert.equal(meanAbsoluteError([1, 2, 3], [1, 2, 3]), 0);
  });
  test('میانگینِ قدرمطلقِ خطا را درست حساب می‌کند', () => {
    assert.equal(meanAbsoluteError([10, 20], [12, 16]), (2 + 4) / 2);
  });
  test('برخلافِ خطای مربعی، به outlier کمتر حساس است (مقایسه‌ی نسبی)', () => {
    const withOutlier = meanAbsoluteError([10, 10, 10, 100], [10, 10, 10, 10]);
    // MAE برای یک outlier با فاصله‌ی ۹۰، خودِ ۹۰/۴=22.5 می‌شود، نه (۹۰)²/۴
    assert.equal(withOutlier, 90 / 4);
  });
  test('روی آرایه‌ی خالی بدترینِ ممکن (Infinity) را برمی‌گرداند، نه NaN بی‌صدا', () => {
    assert.equal(meanAbsoluteError([], []), Infinity);
  });
});

describe('decideModelActivation — قاعده‌ی ایمنیِ عمومی (فراتر از دامنه‌ی no-show)', () => {
  test('دادهٔ کم → غیرفعال، مستقل از دامنه', () => {
    const d = decideModelActivation({ sampleSize: 5, minSampleSize: 42, learnedError: 0.1, baselineError: 0.5 });
    assert.equal(d.isActive, false);
    assert.match(d.reason, /دادهٔ کافی نیست \(5 < 42\)/);
  });

  test('بدونِ extraGate، فقط sampleSize و بهبودِ نسبی سنجیده می‌شوند', () => {
    const d = decideModelActivation({ sampleSize: 100, minSampleSize: 42, learnedError: 5, baselineError: 10 });
    assert.equal(d.isActive, true); // بهبودِ ۵۰٪ >> ۵٪ پیش‌فرض
  });

  test('extraGate رد می‌کند حتی وقتی sampleSize و بهبود هردو کافی‌اند', () => {
    const d = decideModelActivation({
      sampleSize: 100, minSampleSize: 42, learnedError: 5, baselineError: 10,
      extraGate: { ok: false, reason: 'دلیلِ اختصاصیِ دامنه' },
    });
    assert.equal(d.isActive, false);
    assert.equal(d.reason, 'دلیلِ اختصاصیِ دامنه');
  });

  test('extraGate با ok:true مانعِ ادامه‌ی سنجش نمی‌شود', () => {
    const d = decideModelActivation({
      sampleSize: 100, minSampleSize: 42, learnedError: 5, baselineError: 10,
      extraGate: { ok: true, reason: '' },
    });
    assert.equal(d.isActive, true);
  });

  test('baseline نامعتبر (صفر یا منفی) → همیشه غیرفعال', () => {
    const d = decideModelActivation({ sampleSize: 100, minSampleSize: 42, learnedError: 0, baselineError: 0 });
    assert.equal(d.isActive, false);
    assert.match(d.reason, /baseline نامعتبر/);
  });

  test('minRelativeImprovement قابلِ‌تنظیم است (پیش‌فرض ۵٪ نیست همیشه)', () => {
    // بهبودِ ۱۰٪ — با آستانه‌ی پیش‌فرض (۵٪) فعال می‌شود، با آستانه‌ی سخت‌گیرانه‌ی ۲۰٪ نه
    const lenient = decideModelActivation({ sampleSize: 100, minSampleSize: 42, learnedError: 9, baselineError: 10 });
    const strict = decideModelActivation({
      sampleSize: 100, minSampleSize: 42, learnedError: 9, baselineError: 10, minRelativeImprovement: 0.2,
    });
    assert.equal(lenient.isActive, true);
    assert.equal(strict.isActive, false);
  });

  test('baselineLabel در متنِ دلیلِ موفقیت ظاهر می‌شود (شفافیتِ دامنه‌مستقل)', () => {
    const d = decideModelActivation({
      sampleSize: 100, minSampleSize: 42, learnedError: 5, baselineError: 10,
      baselineLabel: 'پیش‌بینیِ فصلیِ ساده',
    });
    assert.match(d.reason, /پیش‌بینیِ فصلیِ ساده/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  expectedCalibrationError — تنها چیزِ جدیدِ ریاضیِ این تغییر.
//  calibrationCurve از قبل در ml-discrimination.test.mts تست شده؛ اینجا
//  فقط تابعِ خلاصه‌سازِ رویِ آن سنجیده می‌شود.
// ═══════════════════════════════════════════════════════════════════════
describe('expectedCalibrationError', () => {
  test('مدلِ کاملاً کالیبره → صفر', () => {
    // چهار پیش‌بینیِ ۰٫۵ که دقیقاً نیمی رخ داده‌اند: predicted=observed=۰٫۵
    const curve = calibrationCurve([0.5, 0.5, 0.5, 0.5], [1, 1, 0, 0], 10);
    assert.equal(expectedCalibrationError(curve), 0);
  });

  test('مدلی که همیشه ۹۰٪ می‌گوید ولی هیچ‌وقت رخ نمی‌دهد → نزدیکِ ۰٫۹', () => {
    const preds = Array(20).fill(0.9);
    const labels = Array(20).fill(0);
    const curve = calibrationCurve(preds, labels, 10);
    const ece = expectedCalibrationError(curve);
    assert.ok(Math.abs(ece - 0.9) < 1e-9, `انتظار ≈۰٫۹، شد ${ece}`);
  });

  test('وزن‌دهی با تعدادِ نمونه — سطلِ پرجمعیت بیشتر از سطلِ کم‌جمعیت اثر می‌گذارد', () => {
    // ۹۰ نمونه در سطلِ کاملاً غلط (خطایِ ۰٫۹) + ۱۰ نمونه در سطلِ کاملاً درست
    // (خطایِ ۰) → میانگینِ وزنی باید نزدیکِ ۰٫۸۱ باشد، نه میانگینِ ساده‌ی ۰٫۴۵.
    const preds = [...Array(90).fill(0.9), ...Array(10).fill(0.05)];
    const labels = [...Array(90).fill(0), ...Array(10).fill(0)];
    const curve = calibrationCurve(preds, labels, 20);
    const ece = expectedCalibrationError(curve);
    assert.ok(ece > 0.7, `وزنِ سطلِ بزرگ باید غالب باشد، شد ${ece}`);
  });

  test('ورودیِ خالی → صفر، نه NaN', () => {
    assert.equal(expectedCalibrationError([]), 0);
  });

  test('همیشه نامنفی است، حتی با مدلی که به‌طورِ سیستماتیک دست‌کم‌گویی می‌کند', () => {
    const curve = calibrationCurve(Array(20).fill(0.1), Array(20).fill(1), 10);
    assert.ok(expectedCalibrationError(curve) > 0);
  });
});
