import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const {
  sigmoid, trainLogisticRegression, predictProba, brierScore,
  decideActivation, buildFeatureVector, toMatrix, NO_SHOW_FEATURE_NAMES,
  checkChannelBias,
} = await import('../src/lib/no-show-model.ts');
const { computeStaticScoreFromFeatures, tierFromScore } = await import('../src/lib/customer-insights.ts');

// ═══════════════════════════════════════════════════════════════════════
//  یادگیریِ ریسکِ no-show — این تست‌ها فقط ریاضیاتِ خالص را می‌سنجند
//  (بدونِ DB). ادعای اصلی این است که سیستم واقعاً «یاد می‌گیرد» — یعنی
//  گرادیان‌دیسنت روی دادهٔ مصنوعی به وزن‌هایی می‌رسد که واقعاً از heuristic
//  دقیق‌تر پیش‌بینی می‌کنند. اگر این تست‌ها سبز نشوند، «self-learning» فقط
//  یک ادعا در کامنت است، نه رفتاری در کد.
// ═══════════════════════════════════════════════════════════════════════

describe('sigmoid', () => {
  test('در صفر دقیقاً نیم است', () => {
    assert.equal(sigmoid(0), 0.5);
  });
  test('برای z بزرگ به ۱ می‌رسد بدونِ overflow', () => {
    assert.equal(sigmoid(1000), 1);
    assert.ok(Number.isFinite(sigmoid(1000)));
  });
  test('برای z بسیار منفی به ۰ می‌رسد', () => {
    assert.equal(sigmoid(-1000), 0);
  });
  test('یکنواخت است (تابعِ صعودی)', () => {
    assert.ok(sigmoid(2) > sigmoid(1));
    assert.ok(sigmoid(-1) < sigmoid(0));
  });
});

describe('buildFeatureVector', () => {
  test('طولش با NO_SHOW_FEATURE_NAMES یکی است', () => {
    const v = buildFeatureVector({ hasUserId: true, priorTotal: 3, priorNoShowRate: 0.5, leadMinutes: 60, partySize: 2, source: 'app' });
    assert.equal(v.length, NO_SHOW_FEATURE_NAMES.length);
  });
  test('بایاس همیشه ۱ است', () => {
    const v = buildFeatureVector({ hasUserId: false, priorTotal: 0, priorNoShowRate: 0, leadMinutes: 60, partySize: 2, source: 'app' });
    assert.equal(v[0], 1);
  });
  test('بدونِ سابقه، نرخِ no-show در بردار صفر می‌شود حتی اگر عدد دیگری داده شود', () => {
    // priorTotal=0 یعنی «سابقه ندارد» — حتی اگر ورودی اشتباهاً rate بدهد، نباید استفاده شود.
    // (نامِ ویژگی در v3 به shrunkNoShowRate تغییر کرد؛ این قاعده همان است.)
    const v = buildFeatureVector({ hasUserId: true, priorTotal: 0, priorNoShowRate: 0.9, leadMinutes: 60, partySize: 2, source: 'app' });
    assert.equal(v[NO_SHOW_FEATURE_NAMES.indexOf('shrunkNoShowRate')], 0);
    assert.equal(v[NO_SHOW_FEATURE_NAMES.indexOf('priorEvidence')], 0, 'شواهد هم صفر است، نه یک عددِ ساختگی');
  });
});

describe('trainLogisticRegression — یادگیریِ واقعی از دادهٔ مصنوعی', () => {
  test('روی یک ویژگیِ کاملاً جداکننده، وزنِ همان ویژگی مثبت و بزرگ می‌شود', () => {
    // دادهٔ مصنوعی: last-minute تقریباً همیشه no-show است، بقیه تقریباً هیچ‌وقت
    // بردار از روی طولِ **واقعیِ** فهرستِ ویژگی‌ها ساخته می‌شود، نه با طولِ
    // هاردکد — نسخه‌ی قبلیِ این تست ۷ درایه‌ی ثابت داشت و با گسترشِ بردار
    // بی‌صدا به ایندکسِ اشتباه اشاره می‌کرد.
    const idx = NO_SHOW_FEATURE_NAMES.indexOf('lastMinute');
    const vec = (on: boolean) => {
      const v = new Array(NO_SHOW_FEATURE_NAMES.length).fill(0);
      v[0] = 1; v[idx] = on ? 1 : 0;
      return v;
    };
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 60; i++) {
      const lastMinute = i % 2 === 0;
      X.push(vec(lastMinute));
      y.push(lastMinute ? 1 : 0);
    }
    const w = trainLogisticRegression(X, y, { iterations: 1000, learningRate: 0.5, l2: 0.001 });
    assert.ok(w[idx] > 2, `انتظار وزنِ بزرگِ مثبت برای lastMinute داشتیم، گرفتیم ${w[idx]}`);

    // و باید واقعاً به‌درستی طبقه‌بندی کند
    const predLastMinute = predictProba(w, vec(true));
    const predNormal = predictProba(w, vec(false));
    assert.ok(predLastMinute > 0.8, `پیش‌بینیِ last-minute باید بالا باشد، شد ${predLastMinute}`);
    assert.ok(predNormal < 0.2, `پیش‌بینیِ حالتِ عادی باید پایین باشد، شد ${predNormal}`);
  });

  test('روی دادهٔ کاملاً بی‌ربط به هیچ ویژگی، وزن‌ها نزدیکِ صفر می‌مانند (regularization کار می‌کند)', () => {
    // برچسب کاملاً تصادفی و مستقل از ویژگی‌ها — مدل نباید به هیچ ویژگی وزنِ زیاد بدهد
    const X: number[][] = [];
    const y: number[] = [];
    let seed = 42;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 200; i++) {
      X.push([1, rand() > 0.5 ? 1 : 0, rand(), rand() > 0.5 ? 1 : 0, rand() > 0.5 ? 1 : 0, rand() > 0.5 ? 1 : 0, rand() > 0.5 ? 1 : 0]);
      y.push(rand() > 0.5 ? 1 : 0);
    }
    const w = trainLogisticRegression(X, y, { iterations: 500, l2: 0.05 });
    for (let j = 1; j < w.length; j++) {
      assert.ok(Math.abs(w[j]) < 1.5, `وزنِ بُعدِ ${NO_SHOW_FEATURE_NAMES[j]} خیلی بزرگ شد: ${w[j]} — روی نویز overfit کرده`);
    }
  });

  test('روی دیتاستِ خالی خطای صریح می‌دهد، نه NaN بی‌صدا', () => {
    assert.throws(() => trainLogisticRegression([], []));
  });
});

describe('brierScore', () => {
  test('پیش‌بینیِ کامل → صفر', () => {
    assert.equal(brierScore([1, 0, 1, 0], [1, 0, 1, 0]), 0);
  });
  test('پیش‌بینیِ کاملاً غلط → یک', () => {
    assert.equal(brierScore([0, 1], [1, 0]), 1);
  });
  test('پایین‌تر یعنی بهتر: پیش‌بینیِ نزدیک‌تر به برچسبِ واقعی امتیازِ کمتری می‌گیرد', () => {
    const good = brierScore([0.9, 0.1], [1, 0]);
    const bad = brierScore([0.5, 0.5], [1, 0]);
    assert.ok(good < bad);
  });
});

describe('decideActivation — قاعده‌ی ایمنی', () => {
  test('دادهٔ کم → غیرفعال، حتی اگر بهبود زیاد باشد', () => {
    const d = decideActivation({ sampleSize: 10, positiveCount: 5, learnedBrier: 0.05, staticBrier: 0.3 });
    assert.equal(d.isActive, false);
    assert.match(d.reason, /دادهٔ کافی نیست/);
  });
  test('تعدادِ no-show کم → غیرفعال، حتی با نمونه‌ی کلیِ زیاد', () => {
    const d = decideActivation({ sampleSize: 200, positiveCount: 2, learnedBrier: 0.05, staticBrier: 0.3 });
    assert.equal(d.isActive, false);
    assert.match(d.reason, /no-show برای یادگیری کم است/);
  });
  test('بهبودِ ناچیز → غیرفعال (نویزِ آماری هر شب heuristic را عوض نکند)', () => {
    const d = decideActivation({ sampleSize: 200, positiveCount: 30, learnedBrier: 0.199, staticBrier: 0.2 });
    assert.equal(d.isActive, false);
  });
  test('دادهٔ کافی + بهبودِ واقعی → فعال', () => {
    const d = decideActivation({ sampleSize: 200, positiveCount: 30, learnedBrier: 0.10, staticBrier: 0.20 });
    assert.equal(d.isActive, true);
    assert.match(d.reason, /دقیق‌تر از heuristic/);
  });
  test('مدلِ بدتر از heuristic هرگز فعال نمی‌شود', () => {
    const d = decideActivation({ sampleSize: 500, positiveCount: 100, learnedBrier: 0.25, staticBrier: 0.20 });
    assert.equal(d.isActive, false);
  });
});

describe('یکپارچگی با فرمولِ heuristic (computeStaticScoreFromFeatures)', () => {
  // این‌ها قفلِ رگرسیون‌اند: رفتارِ heuristicِ قبلی (پیش از افزودنِ یادگیری)
  // باید عیناً حفظ شده باشد، چون این تابع همچنان مسیرِ fallback است.
  // leadMinutes=1000 عمداً بینِ ۳۰ و ۱۰۰۸۰ (=۷×۲۴×۶۰) است — خنثی، هیچ‌کدام
  // از دو شاخه‌ی lead-time را فعال نمی‌کند، پس فقط سهمِ سابقه سنجیده می‌شود.
  const NEUTRAL_LEAD = 1000;
  test('مهمانِ ناشناس بدونِ سابقه → پایه‌ی ۱۵', () => {
    const s = computeStaticScoreFromFeatures({ hasUserId: false, priorTotal: 0, priorNoShowRate: 0, leadMinutes: NEUTRAL_LEAD, partySize: 2, source: 'app' });
    assert.equal(s, 15);
  });
  test('کاربرِ شناخته‌شده بدونِ سابقه‌ی حضور → پایه‌ی ۲۵', () => {
    const s = computeStaticScoreFromFeatures({ hasUserId: true, priorTotal: 0, priorNoShowRate: 0, leadMinutes: NEUTRAL_LEAD, partySize: 2, source: 'app' });
    assert.equal(s, 25);
  });
  test('مشتریِ وفادار (>=۵ سابقه، صفر no-show) → تخفیفِ اضافه به ۲', () => {
    const s = computeStaticScoreFromFeatures({ hasUserId: true, priorTotal: 5, priorNoShowRate: 0, leadMinutes: NEUTRAL_LEAD, partySize: 2, source: 'app' });
    assert.equal(s, 2);
  });
  test('last-minute (< ۳۰ دقیقه) به‌اندازه‌ی ۱۲ اضافه می‌کند', () => {
    const base = computeStaticScoreFromFeatures({ hasUserId: false, priorTotal: 0, priorNoShowRate: 0, leadMinutes: NEUTRAL_LEAD, partySize: 2, source: 'app' });
    const lastMinute = computeStaticScoreFromFeatures({ hasUserId: false, priorTotal: 0, priorNoShowRate: 0, leadMinutes: 10, partySize: 2, source: 'app' });
    assert.equal(lastMinute - base, 12);
  });
  test('رزروِ خیلی زودهنگام (> ۷ روز) به‌اندازه‌ی ۶ اضافه می‌کند', () => {
    const base = computeStaticScoreFromFeatures({ hasUserId: false, priorTotal: 0, priorNoShowRate: 0, leadMinutes: NEUTRAL_LEAD, partySize: 2, source: 'app' });
    const veryEarly = computeStaticScoreFromFeatures({ hasUserId: false, priorTotal: 0, priorNoShowRate: 0, leadMinutes: 999999, partySize: 2, source: 'app' });
    assert.equal(veryEarly - base, 6);
  });
  test('امتیاز هیچ‌وقت از ۱۰۰ بیشتر نمی‌شود', () => {
    const s = computeStaticScoreFromFeatures({ hasUserId: true, priorTotal: 10, priorNoShowRate: 1, leadMinutes: 5, partySize: 8, source: 'phone' });
    assert.ok(s <= 100);
  });
});

describe('tierFromScore', () => {
  test('مرزهای دقیقِ ۳۰ و ۶۰', () => {
    assert.equal(tierFromScore(29), 'low');
    assert.equal(tierFromScore(30), 'medium');
    assert.equal(tierFromScore(59), 'medium');
    assert.equal(tierFromScore(60), 'high');
  });
});

describe('toMatrix', () => {
  test('X و y هم‌طول‌اند و با ترتیبِ ورودی می‌خوانند', () => {
    const { X, y } = toMatrix([
      { features: { hasUserId: true, priorTotal: 2, priorNoShowRate: 1, leadMinutes: 10, partySize: 2, source: 'app' }, label: 1 },
      { features: { hasUserId: false, priorTotal: 0, priorNoShowRate: 0, leadMinutes: 500, partySize: 2, source: 'app' }, label: 0 },
    ]);
    assert.equal(X.length, 2);
    assert.equal(y.length, 2);
    assert.deepEqual(y, [1, 0]);
  });
});

describe('checkChannelBias — تستِ سادهِ بایاسِ کانالی (نقشه‌راهِ AI، فازِ ۱)', () => {
  test('وزن‌هایِ همه‌صفر → بدونِ بایاس', () => {
    const r = checkChannelBias([0, 0, 0, 0, 0, 0, 0]);
    assert.equal(r.biased, false);
    assert.equal(r.knownUserGap, 0);
    assert.equal(r.phoneSourceGap, 0);
  });

  test('وزنِ بزرگِ منفی روی knownUser (یعنی «مهمان = خیلی پرریسک») → بایاس شناسایی می‌شود', () => {
    // ترتیب: [bias, knownUser, priorNoShowRate, lastMinute, veryEarlyBooking, largeParty, phoneSource]
    // knownUser=-5 یعنی نبودِ حساب به‌تنهایی امتیازِ ریسک را خیلی بالا می‌برد —
    // این دقیقاً همان چیزی‌ست که نباید مجاز باشد: تبعیض بر اساسِ کانال، نه رفتار.
    const w = [0, -5, 0, 0, 0, 0, 0];
    const r = checkChannelBias(w);
    assert.equal(r.biased, true);
    assert.ok(Math.abs(r.knownUserGap) > 0.2, `انتظارِ گپِ بزرگ داشتیم، گرفتیم ${r.knownUserGap}`);
    assert.match(r.reason, /کانالِ رزرو/);
  });

  test('وزنِ بزرگ روی phoneSource (یعنی «رزروِ تلفنی = پرریسک») → بایاس شناسایی می‌شود', () => {
    const w = [0, 0, 0, 0, 0, 0, 4];
    const r = checkChannelBias(w);
    assert.equal(r.biased, true);
    assert.ok(Math.abs(r.phoneSourceGap) > 0.2);
  });

  test('وزنِ کوچکِ منطقی (تفاوتِ کم بینِ کانال‌ها) → بدونِ بایاس', () => {
    // یک وزنِ کوچک برای knownUser واقع‌گرایانه است (مثلاً کاربرانِ ثبت‌نامی
    // کمی قابل‌اعتمادترند) — تا وقتی گپ کوچک بماند، این تبعیضِ ناسالم نیست.
    const w = [0, -0.3, 0, 0, 0, 0, 0.2];
    const r = checkChannelBias(w);
    assert.equal(r.biased, false);
  });

  test('مدلی که فقط بر اساسِ رفتارِ واقعی (lastMinute) وزن دارد، نه هویت → بدونِ بایاس', () => {
    const w = [0, 0, 0, 3, 0, 0, 0];
    const r = checkChannelBias(w);
    assert.equal(r.biased, false);
  });
});

describe('سناریوی end-to-end با دادهٔ مصنوعیِ واقع‌گرا', () => {
  test('مدلِ یادگرفته باید از heuristic روی الگویی که heuristic نمی‌بیند بهتر عمل کند', () => {
    // الگوی مصنوعی: مشتری‌هایی که «آخرِ هفته» رزرو می‌کنند (اینجا با partySize=3
    // شبیه‌سازی شده به‌عنوانِ یک سیگنالِ که heuristic اصلاً استفاده‌اش نمی‌کند)
    // نرخِ no-showِ خیلی بالاتری دارند — چیزی که فرمولِ دستی نمی‌تواند ببیند
    // چون اصلاً چنین قاعده‌ای در heuristic نوشته نشده، ولی مدلِ یادگرفته باید
    // از طریقِ priorNoShowRate یا ترکیبِ ویژگی‌ها بتواند بخشی از این را بگیرد.
    const examples: { features: Parameters<typeof buildFeatureVector>[0]; label: 0 | 1 }[] = [];
    let seed = 7;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 300; i++) {
      const riskyUser = rand() < 0.3;
      const priorTotal = 3 + Math.floor(rand() * 10);
      const priorNoShowRate = riskyUser ? 0.6 + rand() * 0.3 : rand() * 0.1;
      const label: 0 | 1 = rand() < priorNoShowRate ? 1 : 0;
      examples.push({
        features: { hasUserId: true, priorTotal, priorNoShowRate, leadMinutes: 200 + rand() * 1000, partySize: 2, source: 'app' },
        label,
      });
    }
    const { X, y } = toMatrix(examples);
    const trainX = X.slice(0, 240), trainY = y.slice(0, 240);
    const testX = X.slice(240), testY = y.slice(240);

    const weights = trainLogisticRegression(trainX, trainY, { iterations: 1000 });
    const learnedPreds = testX.map((x) => predictProba(weights, x));
    const learnedBrier = brierScore(learnedPreds, testY);

    const staticPreds = examples.slice(240).map((e) => computeStaticScoreFromFeatures(e.features) / 100);
    const staticBrier = brierScore(staticPreds, testY);

    assert.ok(learnedBrier < staticBrier,
      `مدلِ یادگرفته (Brier=${learnedBrier.toFixed(4)}) باید از heuristic (Brier=${staticBrier.toFixed(4)}) بهتر باشد`);
  });
});
