import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkChannelBias, buildFeatureVector, NO_SHOW_FEATURE_NAMES,
} from '../src/lib/no-show-model.ts';
import { dot, predictProba, trainLogisticRegression } from '../src/lib/ml-core.ts';

// ═══════════════════════════════════════════════════════════════════════
//  گیت‌های ایمنیِ ML — سه P0 که ممیزیِ نهایی گرفت
//
//  ⚠️ هر سه در همان روزی ساخته شدند که بردارِ ویژگی از ۷ به ۱۲ رفت، و هر سه
//  از **همه‌ی** ۳۲ تستِ موجودِ no-show سبز رد شدند. علتِ مشترک: تست‌ها
//  وزنِ ۷ عنصریِ دستی می‌دادند، پس ناهم‌طولی هرگز رخ نمی‌داد.
//
//  درسِ روش: تستی که ورودی‌اش را با عددِ ثابت می‌سازد، فقط همان عدد را
//  می‌سنجد. این فایل همه‌ی طول‌ها را از `NO_SHOW_FEATURE_NAMES` می‌گیرد تا
//  با هر تغییرِ بعدیِ بردار خودبه‌خود همراه شود.
// ═══════════════════════════════════════════════════════════════════════

const DIM = NO_SHOW_FEATURE_NAMES.length;
const zeros = () => new Array(DIM).fill(0);

describe('گاردِ طولِ dot — ریشه‌ی هر سه باگ', () => {

  test('🔴 ناهم‌طولی خطا می‌دهد، نه NaNِ خاموش', async () => {
    // ⚠️ NaN در ریاضیاتِ شناور بی‌صدا منتشر می‌شود و **هر** مقایسه‌اش false
    // است. یعنی یک گیتِ ایمنی که با `Math.abs(x) > threshold` کار می‌کند،
    // با یک NaN نامرئی از کار می‌افتد — دقیقاً چیزی که رخ داد.
    assert.throws(() => dot([1, 2, 3], [1, 2]), /طولِ بردارها یکی نیست/);
    assert.throws(() => dot([1, 2], [1, 2, 3]), /طولِ بردارها یکی نیست/);
  });

  test('🔴 اثباتِ رفتارِ قدیمی: بدونِ گارد، نتیجه NaN می‌شد نه خطا', async () => {
    // کنترلِ مثبت برای تستِ بالا — نشان می‌دهد چرا سکوت خطرناک بود.
    const unguardedDot = (a: number[], b: number[]) => {
      let s = 0;
      for (let i = 0; i < a.length; i++) s += a[i] * b[i];
      return s;
    };
    const out = unguardedDot([0, 0, 0], [0, 0]);
    assert.ok(Number.isNaN(out), 'حتی با ضرایبِ صفر هم NaN می‌شد (۰ × undefined)');
    assert.equal(Math.abs(out) > 0.2, false, 'و هر مقایسه‌ای با NaN false است');
  });

  test('هم‌طول‌ها مثلِ قبل کار می‌کنند', async () => {
    assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
  });
});

describe('گیتِ بایاسِ کانالی — واقعاً می‌گزد', () => {

  test('🔴 وزنِ هم‌طول با بردارِ فعلی: گپ عددِ واقعی است، نه NaN', async () => {
    // ⚠️ باگِ اصلی: کاوش‌های ۷ عنصریِ هاردکد در برابرِ وزنِ ۱۲تایی ⇒
    // knownUserGap = NaN ⇒ biased همیشه false ⇒ گیت یک no-opِ دائمی.
    const r = checkChannelBias(zeros());
    assert.ok(Number.isFinite(r.knownUserGap), `knownUserGap باید عدد باشد، شد ${r.knownUserGap}`);
    assert.ok(Number.isFinite(r.staffEnteredGap), `staffEnteredGap باید عدد باشد، شد ${r.staffEnteredGap}`);
    assert.equal(r.knownUserGap, 0, 'مدلِ خنثی گپِ صفر دارد');
    assert.equal(r.biased, false);
  });

  test('🔴 مدلی که مهمان را صرفاً به‌خاطرِ مهمان‌بودن جریمه کند رد می‌شود', async () => {
    // این همان چیزی است که گیت برایش ساخته شد و دقیقاً همان که کار نمی‌کرد.
    const w = zeros();
    w[NO_SHOW_FEATURE_NAMES.indexOf('knownUser')] = -5;  // مهمان ⇒ ریسکِ خیلی بالاتر
    const r = checkChannelBias(w);
    assert.equal(r.biased, true, 'بایاسِ آشکارِ هویتی باید گرفته شود');
    assert.ok(Math.abs(r.knownUserGap) > 0.2);
  });

  test('🔴 بایاسِ کانالِ «ثبت توسطِ پرسنل» هم گرفته می‌شود', async () => {
    const w = zeros();
    w[NO_SHOW_FEATURE_NAMES.indexOf('staffEntered')] = 4;
    assert.equal(checkChannelBias(w).biased, true);
  });

  test('⚠️ رفتارِ ریسکیِ **واقعی** بایاس شمرده نمی‌شود (کنترلِ منفی)', async () => {
    // بدونِ این، «همیشه biased بده» هم سبز می‌شد و کلِ یادگیری می‌مرد.
    const w = zeros();
    w[NO_SHOW_FEATURE_NAMES.indexOf('shrunkNoShowRate')] = 6;  // سابقه‌ی بد = رفتار، نه هویت
    w[NO_SHOW_FEATURE_NAMES.indexOf('lastMinute')] = 3;
    assert.equal(checkChannelBias(w).biased, false, 'یادگیری از رفتار باید مجاز بماند');
  });

  test('🔴 کاوش‌ها از فهرستِ نام‌ها مشتق می‌شوند، پس با هر تغییرِ بردار همراه‌اند', async () => {
    // اگر کسی ویژگی اضافه کند و کاوش‌ها را دستی نگه دارد، `dot` حالا throw
    // می‌کند — این تست آن قرارداد را قفل می‌کند: هیچ استثنایی نباید بیفتد.
    assert.doesNotThrow(() => checkChannelBias(zeros()));
    assert.equal(buildFeatureVector({
      hasUserId: true, priorTotal: 2, priorNoShowRate: 0.5,
      leadMinutes: 90, partySize: 3, source: 'app', slotStart: new Date('2026-05-10T15:00:00Z'),
    }).length, DIM, 'بردارِ سرو و کاوش‌های گیت باید هم‌طول بمانند');
  });
});

describe('امتیازدهی با وزنِ نسخه‌ی قدیمی', () => {

  test('🔴 وزنِ ۷تاییِ قدیمی روی بردارِ ۱۲تایی دیگر بی‌صدا امتیاز نمی‌دهد', async () => {
    // پیش از این، `predictProba` عددی «قابلِ‌باور و غلط» برمی‌گرداند (وقتی
    // وزن کوتاه‌تر بود) یا NaN (وقتی بلندتر بود). حالا هر دو حالت خطاست و
    // گاردِ نسخه‌ی ذخیره‌شده جلوی رسیدنش به تولید را می‌گیرد.
    const oldWeights = new Array(7).fill(0.1);
    const currentVector = buildFeatureVector({
      hasUserId: true, priorTotal: 0, priorNoShowRate: 0,
      leadMinutes: 60, partySize: 2, source: 'app',
    });
    assert.throws(() => predictProba(oldWeights, currentVector), /طولِ بردارها یکی نیست/);
  });
});

describe('آموزش هنوز سالم است', () => {

  test('گاردِ تازه آموزشِ عادی را نمی‌شکند', async () => {
    // ⚠️ کنترلِ سلامتی: گاردِ طول نباید مسیرِ اصلی را بشکند. اگر بشکند،
    // «ایمنی» به قیمتِ نابودیِ خودِ یادگیری تمام شده است.
    const iLast = NO_SHOW_FEATURE_NAMES.indexOf('lastMinute');
    const X: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 60; i++) {
      const v = zeros(); v[0] = 1; v[iLast] = i % 2 === 0 ? 1 : 0;
      X.push(v); y.push(i % 2 === 0 ? 1 : 0);
    }
    const w = trainLogisticRegression(X, y);
    assert.equal(w.length, DIM);
    assert.ok(w.every((x) => Number.isFinite(x)), 'هیچ وزنی نباید NaN شود');
    assert.ok(w[iLast] > 2, `باید سیگنال را یاد بگیرد، وزن شد ${w[iLast]}`);
  });
});
