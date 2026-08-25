import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeatureVector, NO_SHOW_FEATURE_NAMES, NO_SHOW_FEATURE_VERSION, tehranHourWeekday,
} from '../src/lib/no-show-model.ts';
import { trainLogisticRegression, predictProba, rocAuc } from '../src/lib/ml-core.ts';
import type { RawFeatureInput } from '../src/lib/ml-core.ts';

// ═══════════════════════════════════════════════════════════════════════
//  بردارِ ویژگیِ v2 — آیا واقعاً چیزی یاد می‌گیرد که v1 نمی‌توانست؟
//
//  ⚠️ چرا این فایل لازم بود: «ویژگی اضافه کردم» به‌خودیِ‌خود یک ادعای
//  بی‌پشتوانه است. اضافه‌کردنِ ویژگی می‌تواند مدل را **بدتر** کند (واریانسِ
//  بیشتر روی نمونه‌ی کم). پس اینجا با یک فرایندِ تولیدِ دادهٔ **معلوم**
//  اندازه‌گیری می‌شود، نه ادعا.
//
//  ── مرزِ صداقتِ این فایل ──
//  این یک آزمایشِ کنترل‌شده است، نه سنجشِ تولید. چیزی که ثابت می‌کند:
//  «وقتی سیگنالِ زمانی/پیوسته در داده هست، v2 می‌تواند بگیردش و v1
//  **ساختاراً** نمی‌تواند.» چیزی که ثابت **نمی‌کند**: اینکه دادهٔ واقعیِ
//  رزرونو چنین سیگنالی دارد. آن فقط با دفترِ پیش‌بینیِ تولید معلوم می‌شود
//  (lib/prediction-ledger.ts) و تا آن موقع ادعایی درباره‌اش نمی‌کنیم.
// ═══════════════════════════════════════════════════════════════════════

/**
 * بردارِ v1 — **کپیِ منجمدِ تاریخی**، عمداً اینجا و نه import.
 * هدفِ این فایل مقایسه با گذشته است؛ اگر از کدِ زنده import می‌شد، مقایسه
 * با هر تغییرِ بعدی بی‌معنا می‌شد.
 */
function buildFeatureVectorV1(f: RawFeatureInput): number[] {
  const hasHistory = f.hasUserId && f.priorTotal > 0;
  return [
    1,
    f.hasUserId ? 1 : 0,
    hasHistory ? f.priorNoShowRate : 0,
    f.leadMinutes < 30 ? 1 : 0,
    f.leadMinutes > 7 * 24 * 60 ? 1 : 0,
    f.partySize >= 6 ? 1 : 0,
    f.source === 'phone' ? 1 : 0,
  ];
}

/** مولدِ شبه‌تصادفیِ **قطعی** — تستِ آماری نباید flake بدهد. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * دادهٔ مصنوعی با فرایندِ تولیدِ **معلوم**:
 *  • ریسک با نزدیک‌شدنِ زمانِ ثبت به اسلات بالا می‌رود — **پیوسته**، نه پله‌ای
 *  • رزروِ نیمه‌شب ریسکی‌تر از رزروِ ناهار است — یک اثرِ **دایره‌ای** روی ساعت
 *  • سابقه‌ی بد ریسک را بالا می‌برد
 * هیچ‌کدام از این سه در v1 قابلِ بیان نیستند مگر به‌شکلِ بسیار خام.
 */
function makeDataset(n: number, seed: number) {
  const rnd = mulberry32(seed);
  const rows: { f: RawFeatureInput; y: 0 | 1 }[] = [];
  const base = new Date('2026-05-10T00:00:00Z').getTime();
  for (let i = 0; i < n; i++) {
    // ساعتِ اسلات ۰..۲۳ به وقتِ تهران
    const hour = Math.floor(rnd() * 24);
    // نیمه‌شبِ تهران = ۲۰:۳۰ UTCِ روزِ قبل ⇒ برای رسیدن به ساعتِ تهرانِ h،
    // از نیمه‌شبِ تهران h ساعت جلو می‌رویم.
    const tehranMidnightUtc = base - 3.5 * 3600_000;
    const slotStart = new Date(tehranMidnightUtc + i * 86_400_000 + hour * 3600_000);
    const leadMinutes = Math.round(5 + rnd() * 10 * 24 * 60);  // ۵ دقیقه تا ۱۰ روز
    const partySize = 1 + Math.floor(rnd() * 8);
    const priorTotal = Math.floor(rnd() * 12);
    const priorNoShows = priorTotal ? Math.floor(rnd() * (priorTotal + 1)) : 0;

    // ── فرایندِ حقیقت ──
    const leadEffect = 1.6 * (1 - Math.log1p(leadMinutes) / Math.log1p(10 * 24 * 60));
    const { hour: tehranHour } = tehranHourWeekday(slotStart);
    const nightEffect = 1.1 * Math.cos((2 * Math.PI * (tehranHour - 1)) / 24);
    const histEffect = priorTotal > 0 ? 1.4 * (priorNoShows / priorTotal) : 0;
    const logit = -2.2 + leadEffect + nightEffect + histEffect;
    const p = 1 / (1 + Math.exp(-logit));

    rows.push({
      f: {
        hasUserId: true, priorTotal,
        priorNoShowRate: priorTotal > 0 ? priorNoShows / priorTotal : 0,
        leadMinutes, partySize, source: 'app', slotStart,
      },
      y: rnd() < p ? 1 : 0,
    });
  }
  return rows;
}

function aucFor(
  build: (f: RawFeatureInput) => number[],
  train: ReturnType<typeof makeDataset>,
  holdout: ReturnType<typeof makeDataset>,
): number | null {
  const w = trainLogisticRegression(train.map((r) => build(r.f)), train.map((r) => r.y));
  return rocAuc(holdout.map((r) => predictProba(w, build(r.f))), holdout.map((r) => r.y));
}

describe('بردارِ ویژگیِ v2', () => {

  test('نسخه و طولِ بردار با فهرستِ نام‌ها هم‌تراز است', async () => {
    // اگر یکی از این سه از هم جدا بیفتد، همه‌چیز بی‌صدا خراب می‌شود:
    // نامِ اشتباه روی وزنِ اشتباه در داشبورد، یا وزنِ ذخیره‌شده با طولِ غلط.
    // v3 و نه v2: دفترِ پیش‌بینی از قبل برچسبِ no_show/v2 را برای معنیِ
    // دیگری مصرف کرده بود (فازِ ۴)، و حالا هر دو از همین یک ثابت مشتق
    // می‌شوند — پس شماره‌ی بعدیِ صادقانه v3 است، نه v2ی دوم.
    assert.equal(NO_SHOW_FEATURE_VERSION, 'v3');
    const v = buildFeatureVector({
      hasUserId: true, priorTotal: 3, priorNoShowRate: 0.33,
      leadMinutes: 120, partySize: 4, source: 'app', slotStart: new Date('2026-05-10T18:00:00Z'),
    });
    assert.equal(v.length, NO_SHOW_FEATURE_NAMES.length,
      'طولِ بردار و فهرستِ نام‌ها باید همیشه یکی باشند');
    assert.equal(v.length, 12);
    assert.ok(v.every((x) => Number.isFinite(x)), 'هیچ درایه‌ای نباید NaN/Infinity باشد');
  });

  test('🔴 بدونِ slotStart هم NaN تولید نمی‌کند (سه درایه‌ی زمانی صفر می‌شوند)', async () => {
    // ⚠️ اگر این نشکند-به-صفر نبود، هر مسیری که slotStart ندهد یک NaN تا
    // خودِ UI می‌فرستاد — دقیقاً همان شکستِ خاموشی که گاردِ نسخه برای آن ساخته شد.
    const v = buildFeatureVector({
      hasUserId: false, priorTotal: 0, priorNoShowRate: 0,
      leadMinutes: 60, partySize: 2, source: 'app',
    });
    assert.ok(v.every((x) => Number.isFinite(x)));
    assert.deepEqual(v.slice(-3), [0, 0, 0], 'hourSin/hourCos/isWeekend بدونِ داده صفرند');
  });

  test('🔴 جمع‌شدگیِ نرخِ سابقه: یک no-show از یک رزرو ≠ ۵۰ از ۵۰', async () => {
    // نقصِ اصلیِ v1: هر دو نرخِ خامِ ۱٫۰ می‌گرفتند و مدل یکسان می‌دیدشان.
    const idx = NO_SHOW_FEATURE_NAMES.indexOf('shrunkNoShowRate');
    const thin = buildFeatureVector({
      hasUserId: true, priorTotal: 1, priorNoShowRate: 1,
      leadMinutes: 60, partySize: 2, source: 'app',
    })[idx];
    const thick = buildFeatureVector({
      hasUserId: true, priorTotal: 50, priorNoShowRate: 1,
      leadMinutes: 60, partySize: 2, source: 'app',
    })[idx];
    assert.ok(thin < thick - 0.4, `کم‌شواهد باید خیلی پایین‌تر باشد (${thin} در برابرِ ${thick})`);
    assert.ok(thin < 0.4, `یک no-show از یک رزرو نباید نزدیکِ قطعیت باشد: ${thin}`);
    assert.ok(thick > 0.85, `۵۰ از ۵۰ باید نزدیکِ قطعیت بماند: ${thick}`);
  });

  test('🔴 فاصله‌ی زمانی پیوسته است — v1 این دو را یکسان می‌دید', async () => {
    // ۳۵ دقیقه و ۶ روز هر دو در v1 بردارِ [۰,۰] می‌گرفتند.
    const at = (leadMinutes: number) => buildFeatureVector({
      hasUserId: true, priorTotal: 0, priorNoShowRate: 0,
      leadMinutes, partySize: 2, source: 'app',
    });
    const a = at(35), b = at(6 * 24 * 60);
    assert.deepEqual(buildFeatureVectorV1({
      hasUserId: true, priorTotal: 0, priorNoShowRate: 0, leadMinutes: 35, partySize: 2, source: 'app',
    }), buildFeatureVectorV1({
      hasUserId: true, priorTotal: 0, priorNoShowRate: 0, leadMinutes: 6 * 24 * 60, partySize: 2, source: 'app',
    }), 'پیش‌شرط: v1 واقعاً این دو را یکسان می‌دید');
    assert.notDeepEqual(a, b, 'v2 باید تفکیکشان کند');
    const i = NO_SHOW_FEATURE_NAMES.indexOf('leadLog');
    assert.ok(a[i] < b[i], 'رزروِ نزدیک‌تر باید leadLog کمتری داشته باشد');
  });

  test('ساعتِ تهران محاسبه می‌شود، نه UTC', async () => {
    // ⚠️ ۲۱:۳۰ UTC = ۰۱:۰۰ بامدادِ **روزِ بعد** به وقتِ تهران. با UTC هم
    // ساعت غلط می‌شد هم روزِ هفته، و مدل الگویی شیفت‌خورده یاد می‌گرفت.
    const d = new Date('2026-05-13T21:30:00Z'); // چهارشنبه شب UTC
    const { hour, weekday } = tehranHourWeekday(d);
    assert.equal(hour, 1, 'یک بامداد به وقتِ تهران');
    assert.equal(weekday, 4, 'پنجشنبه — روز عوض شده است');
  });

  test('🔴 آخرِ هفته پنجشنبه/جمعه است، نه شنبه/یکشنبه', async () => {
    const i = NO_SHOW_FEATURE_NAMES.indexOf('isWeekend');
    const flag = (iso: string) => buildFeatureVector({
      hasUserId: true, priorTotal: 0, priorNoShowRate: 0,
      leadMinutes: 60, partySize: 2, source: 'app', slotStart: new Date(iso),
    })[i];
    // همگی ساعتِ ۱۵:۰۰ به وقتِ تهران (۱۱:۳۰ UTC) تا مرزِ روز جابه‌جا نشود
    assert.equal(flag('2026-05-14T11:30:00Z'), 1, 'پنجشنبه');
    assert.equal(flag('2026-05-15T11:30:00Z'), 1, 'جمعه');
    assert.equal(flag('2026-05-16T11:30:00Z'), 0, 'شنبه — روزِ کاری در ایران');
    assert.equal(flag('2026-05-17T11:30:00Z'), 0, 'یکشنبه — روزِ کاری در ایران');
  });

  test('⚠️ اندازه‌گیری: v2 روی سیگنالِ زمانی/پیوسته از v1 بهتر تفکیک می‌کند', async () => {
    // آزمایشِ کنترل‌شده — رجوع کن به «مرزِ صداقت» در بالای فایل.
    //
    // ── اعدادِ واقعیِ اندازه‌گیری‌شده (بذرِ ثابت، پس تکرارپذیر) ──
    //   سقفِ نظریِ این فرایند (AUCِ اوراکل)  ۰٫۷۸۱۷
    //   v1                                     ۰٫۶۶۶۱  ⇒ ۵۹٫۰٪ از سیگنالِ دست‌یافتنی
    //   v2                                     ۰٫۶۷۶۹  ⇒ ۶۲٫۸٪
    // یعنی +۰٫۰۱۱ AUC و بستنِ حدودِ ۹٪ از شکافِ باقی‌مانده تا سقف.
    //
    // ⚠️ عمداً «۰٫۰۳ بهتر» ادعا نمی‌شود: آستانه‌ی اولِ این تست ۰٫۰۳ بود و آن
    // یک حدس بود نه اندازه‌گیری — و همان حدس باعث شد اولین اجرا قرمز شود و
    // یک باگِ واقعی لو برود (پایین). آستانه حالا زیرِ عددِ **اندازه‌گیری‌شده**
    // است، نه بالای یک آرزو.
    //
    // ⚠️ و چرا v2 به سقف نمی‌رسد، صادقانه: بخشی از فرایندِ حقیقت نرخِ **خامِ**
    // سابقه است، ولی v2 عمداً نرخِ **جمع‌شده** را می‌دهد. اینجا کمی هزینه
    // می‌دهد؛ روی دادهٔ واقعی که اکثرِ کاربران ۱ تا ۳ رزروِ قبلی دارند، همان
    // جمع‌شدگی سودِ اصلی را می‌دهد. این یک مبادله است، نه نقص.
    const train = makeDataset(1200, 12345);
    const holdout = makeDataset(600, 999);
    const aucV1 = aucFor(buildFeatureVectorV1, train, holdout);
    const aucV2 = aucFor(buildFeatureVector, train, holdout);
    assert.ok(aucV1 !== null && aucV2 !== null, 'هولدآوت باید هر دو کلاس را داشته باشد');
    assert.ok(aucV2! > aucV1! + 0.005,
      `v2 باید بهتر باشد — v1=${aucV1!.toFixed(4)} v2=${aucV2!.toFixed(4)}`);
  });

  test('🔴 بدونِ همگرایی، بردارِ غنی‌تر **بدتر** می‌شود — تله‌ی واقعی', async () => {
    // ⚠️ این تست یک باگِ واقعی را قفل می‌کند، نه یک فرضیه.
    // سقفِ قبلیِ آموزش ۸۰۰ تکرارِ ثابت بود؛ برای بردارِ ۷تاییِ تقریباً دودویی
    // کافی بود، ولی بردارِ ۱۲تاییِ پیوسته را **زیرآموزش** می‌داد. نتیجه:
    // v2 روی هولدآوت از v1 بدتر می‌شد (۰٫۶۶۴۲ در برابرِ ۰٫۶۶۶۱) — یعنی
    // «ویژگی‌های جدید کمکی نکردند»، نتیجه‌ای کاملاً غلط و کاملاً قابلِ‌باور.
    // (اولین اجرای تستِ بالا دقیقاً همین را نشان داد.)
    //
    // حالا `trainLogisticRegression` همگرایی را تشخیص می‌دهد. این تست همان
    // شرایطِ قدیمی را بازسازی می‌کند تا اگر کسی توقفِ همگرایی را بردارد،
    // بلافاصله معلوم شود چرا نباید.
    const train = makeDataset(1200, 12345);
    const holdout = makeDataset(600, 999);
    const capped = (b: (f: RawFeatureInput) => number[]) => {
      const w = trainLogisticRegression(
        train.map((r) => b(r.f)), train.map((r) => r.y), { iterations: 800, tolerance: 0 });
      return rocAuc(holdout.map((r) => predictProba(w, b(r.f))), holdout.map((r) => r.y))!;
    };
    const under = capped(buildFeatureVector);
    const converged = aucFor(buildFeatureVector, train, holdout)!;
    assert.ok(converged > under + 0.005,
      `همگرایی باید واقعاً کمک کند — ۸۰۰تکرار=${under.toFixed(4)} همگرا=${converged.toFixed(4)}`);
    assert.ok(under < capped(buildFeatureVectorV1),
      'و بدونِ همگرایی، v2 واقعاً از v1 بدتر می‌شد — همان نتیجه‌ی گمراه‌کننده');
  });

  test('🔴 کنترلِ منفی: روی دادهٔ بدونِ سیگنال، v2 برتریِ ساختگی نمی‌سازد', async () => {
    // بدونِ این، تستِ بالا می‌توانست صرفاً «بردارِ بزرگ‌تر = AUC بیشتر» را
    // نشان دهد (بیش‌برازش روی هولدآوت هم گاهی تصادفاً بهتر می‌شود).
    // اینجا برچسب کاملاً تصادفی است ⇒ هیچ مدلی نباید واقعاً تفکیک کند.
    const rnd = mulberry32(7);
    const noise = (n: number) => Array.from({ length: n }, () => ({
      f: {
        hasUserId: true, priorTotal: Math.floor(rnd() * 10), priorNoShowRate: rnd(),
        leadMinutes: Math.round(rnd() * 10000), partySize: 1 + Math.floor(rnd() * 8),
        source: 'app', slotStart: new Date(Date.UTC(2026, 4, 1 + Math.floor(rnd() * 27), Math.floor(rnd() * 24))),
      } as RawFeatureInput,
      y: (rnd() < 0.3 ? 1 : 0) as 0 | 1,
    }));
    const aucV2 = aucFor(buildFeatureVector, noise(1200), noise(600));
    assert.ok(aucV2 !== null);
    assert.ok(Math.abs(aucV2! - 0.5) < 0.08,
      `روی نویزِ خالص AUC باید نزدیکِ ۰٫۵ بماند، شد ${aucV2!.toFixed(4)}`);
  });
});
