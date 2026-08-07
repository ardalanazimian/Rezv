import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const {
  fitHoltWinters, forecastHoltWinters, seasonalNaiveForecast,
} = await import('../src/lib/demand-forecast.ts');
const { meanAbsoluteError } = await import('../src/lib/ml-core.ts');

// ═══════════════════════════════════════════════════════════════════════
//  پیش‌بینیِ تقاضا — این تست‌ها فقط ریاضیاتِ خالصِ Holt-Winters را می‌سنجند
//  (بدونِ DB). ادعای اصلی: مدل واقعاً الگوی فصلیِ هفتگی و روندِ صعودی/نزولی
//  را از دادهٔ مصنوعی یاد می‌گیرد و روی سری‌ای با روند، از baseline فصلیِ
//  ساده (کپیِ هفته‌ی قبل) بهتر عمل می‌کند.
// ═══════════════════════════════════════════════════════════════════════

describe('fitHoltWinters — اعتبارسنجیِ ورودی', () => {
  test('period کمتر از ۲ خطا می‌دهد', () => {
    assert.throws(() => fitHoltWinters([1, 2, 3, 4], 1));
  });
  test('کمتر از دو دوره‌ی کامل خطا می‌دهد', () => {
    assert.throws(() => fitHoltWinters([1, 2, 3, 4, 5, 6], 7)); // ۶ نقطه، period=۷ → کمتر از ۱۴ لازم
  });
  test('دقیقاً دو دوره کافی است (نباید کرش کند)', () => {
    const y = [1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7];
    assert.doesNotThrow(() => fitHoltWinters(y, 7));
  });
});

describe('fitHoltWinters — سریِ کاملاً فصلیِ بدونِ نویز و بدونِ روند (نقطه‌ی ثابت)', () => {
  // چون سری دقیقاً تکرارشونده است (بدونِ نویز/روند)، مقداردهیِ اولیه
  // (میانگینِ فصل برایِ level، انحراف از میانگین برایِ seasonal) از همان
  // ابتدا دقیقاً درست است و طبقِ استقراء در طولِ حلقه هم ثابت می‌ماند —
  // یعنی پیش‌بینی باید عیناً همان الگو را بازتولید کند، نه فقط «نزدیک».
  const pattern = [10, 10, 10, 10, 10, 30, 40];
  const numWeeks = 6;
  const series: number[] = [];
  for (let w = 0; w < numWeeks; w++) series.push(...pattern);

  test('level به میانگینِ دقیقِ الگو می‌رسد', () => {
    const model = fitHoltWinters(series, 7);
    const mean = pattern.reduce((a, b) => a + b, 0) / 7;
    assert.ok(Math.abs(model.level - mean) < 1e-6, `level=${model.level}, expected≈${mean}`);
  });

  test('trend صفر می‌ماند (سری بدونِ روند)', () => {
    const model = fitHoltWinters(series, 7);
    assert.ok(Math.abs(model.trend) < 1e-6, `trend=${model.trend}, expected≈0`);
  });

  test('پیش‌بینی عیناً همان الگوی هفتگی را بازتولید می‌کند', () => {
    const model = fitHoltWinters(series, 7);
    const forecast = forecastHoltWinters(model, 14); // دو هفته‌ی آینده
    for (let i = 0; i < 14; i++) {
      const expected = pattern[i % 7];
      assert.ok(
        Math.abs(forecast[i] - expected) < 1e-6,
        `روزِ ${i}: انتظار ${expected}، گرفتیم ${forecast[i]}`,
      );
    }
  });
});

describe('forecastHoltWinters — هیچ‌وقت پیش‌بینیِ منفی نمی‌دهد', () => {
  test('حتی وقتی level+seasonal ریاضی منفی می‌شود، خروجی صفر می‌شود', () => {
    const model = { level: 1, trend: 0, seasonal: [-100, 0, 0, 0, 0, 0, 0], period: 7, phaseOffset: 0 };
    const forecast = forecastHoltWinters(model, 1);
    assert.equal(forecast[0], 0);
  });
});

describe('seasonalNaiveForecast — تکرارِ چرخه‌ایِ آخرین دوره', () => {
  test('برایِ افق بزرگ‌تر از period، الگو را می‌چرخاند', () => {
    const f = seasonalNaiveForecast([1, 2, 3, 4, 5, 6, 7], 10);
    assert.deepEqual(f, [1, 2, 3, 4, 5, 6, 7, 1, 2, 3]);
  });
  test('خروجیِ منفی هم کلمپ می‌شود (دفاعی، حتی اگر عملاً رخ ندهد)', () => {
    const f = seasonalNaiveForecast([-5, 3], 2);
    assert.deepEqual(f, [0, 3]);
  });
});

describe('یکپارچگی: یادگیریِ واقعی روی سریِ دارایِ روند + فصلیِ هفتگی + نویز', () => {
  test('Holt-Winters باید از baselineِ فصلیِ ساده (کپیِ هفته‌ی قبل) روی سریِ دارایِ روند بهتر باشد', () => {
    // الگوی مصنوعیِ واقع‌گرا: تقاضایِ رستوران با اوجِ پنج‌شنبه/جمعه + روندِ
    // صعودیِ آرام (رستوران دارد محبوب‌تر می‌شود) + نویزِ تصادفی. baseline
    // فصلیِ ساده روندِ صعودی را نمی‌بیند (همیشه می‌گوید «مثلِ هفته‌ی قبل»)
    // پس باید سیستماتیک کمتر از واقعیت پیش‌بینی کند؛ Holt-Winters چون روند
    // را صریحاً مدل می‌کند نباید این تورشِ سیستماتیک را داشته باشد.
    const period = 7;
    const weeklyPattern = [20, 22, 18, 25, 30, 55, 60];
    const slope = 0.8;
    const noiseAmp = 3;
    const totalDays = 70; // ۱۰ هفته

    let seed = 11;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    const series: number[] = [];
    for (let t = 0; t < totalDays; t++) {
      const noise = (rand() - 0.5) * 2 * noiseAmp;
      series.push(Math.max(0, 40 + slope * t + weeklyPattern[t % period] + noise));
    }

    const splitAt = Math.floor(totalDays * 0.8);
    const trainSet = series.slice(0, splitAt);
    const holdout = series.slice(splitAt);

    const model = fitHoltWinters(trainSet, period);
    const learnedPreds = forecastHoltWinters(model, holdout.length);
    const learnedMae = meanAbsoluteError(learnedPreds, holdout);

    const baselinePreds = holdout.map((_, i) => series[splitAt + i - period]);
    const baselineMae = meanAbsoluteError(baselinePreds, holdout);

    assert.ok(
      learnedMae < baselineMae,
      `Holt-Winters (MAE=${learnedMae.toFixed(2)}) باید از baseline فصلیِ ساده (MAE=${baselineMae.toFixed(2)}) بهتر باشد`,
    );
  });
});
