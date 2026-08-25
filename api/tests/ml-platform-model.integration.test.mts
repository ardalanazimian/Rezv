import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  مدلِ سراسریِ پلتفرم — رفعِ سرمای شروع
//
//  ⚠️ مسئله‌ای که حل می‌کند و چرا بزرگ‌ترین مانعِ عملیِ ML بود:
//  گیتِ فعال‌سازی به‌ازای **هر رستوران** ۴۰ نمونه و ۵ no-show می‌خواهد. برای
//  پلتفرمی که تازه لانچ می‌کند یعنی تقریباً هیچ رستورانی هرگز مدل نمی‌گیرد و
//  همه تا ماه‌ها روی heuristicِ ثابت می‌مانند — **هرچقدر هم که کلِ پلتفرم
//  داده جمع کند**. یعنی «یادگیری» برای رستورانِ تازه عملاً اتفاق نمی‌افتاد.
//
//  خطرِ اصلیِ این قابلیت این است که مدلِ سراسری، مدلِ **اختصاصیِ** یک
//  رستوران را کنار بزند. برای همین تستِ تقدم اینجا مرکزی است.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const {
  getEffectiveNoShowModel, getPlatformNoShowModel, trainAndCalibratePlatformNoShowModel,
  invalidateNoShowModelCache, invalidatePlatformNoShowModelCache,
  NO_SHOW_FEATURE_VERSION, fetchPlatformTrainingRows, fetchTrainingRows,
} = await import('../src/lib/no-show-model');
const { detectPlatformPerformanceDrift, rollbackDriftedPlatformModel } =
  await import('../src/lib/model-drift');
const { MIN_RESOLVED_FOR_ACCURACY } = await import('../src/lib/prediction-ledger');

// ⚠️ کشِ مدل را عمداً با همان توابعِ خودِ کد پاک می‌کنیم، نه با ساختنِ دستیِ
// کلید. نسخه‌ی اولِ همین فایل کلید را دستی می‌ساخت و چون نامِ کلید در کد
// عوض شده بود (`noshow-model` → `-v2`)، تستِ تقدم قرمز شد — و همان قرمزی
// یک باگِ **واقعیِ تولید** را لو داد: هر دو نویسنده هم کلیدِ اشتباه را پاک
// می‌کردند. اگر تست کلید را خودش بسازد، دقیقاً همان اشتباه را تکرار
// می‌کند و دیگر هرگز آن باگ را نمی‌گیرد.

const TAG = `plat-${randomUUID().slice(0, 8)}`;
let tenantId: string;
let restaurantId: string;
const W = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];

async function setPlatformModel(weights: number[], isActive: boolean, featureVersion = NO_SHOW_FEATURE_VERSION) {
  await db.platformNoShowModel.create({
    data: {
      weights, sampleSize: 500, positiveCount: 60, restaurantCount: 8,
      learnedBrier: 0.12, staticBrier: 0.20, learnedAuc: 0.72,
      isActive, activationReason: isActive ? 'تست' : 'غیرفعالِ تست', featureVersion,
    },
  });
  await invalidatePlatformNoShowModelCache();
}

async function setRestaurantModel(weights: number[], isActive: boolean, featureVersion = NO_SHOW_FEATURE_VERSION) {
  await db.restaurantNoShowModel.upsert({
    where: { restaurantId },
    create: {
      restaurantId, weights, sampleSize: 100, positiveCount: 20,
      learnedBrier: 0.10, staticBrier: 0.20, isActive, featureVersion,
    },
    update: { weights, isActive, featureVersion },
  });
  await invalidateNoShowModelCache(restaurantId);
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] تنانتِ سراسری ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: TAG, name: '[DEMO] رستورانِ تستِ سراسری', clubPrefix: 'PL', timezone: 'Asia/Tehran' },
    select: { id: true },
  });
  restaurantId = r.id;
});

beforeEach(async () => {
  await db.platformNoShowModel.deleteMany({});
  await db.restaurantNoShowModel.deleteMany({ where: { restaurantId } });
  await invalidatePlatformNoShowModelCache();
  await invalidateNoShowModelCache(restaurantId);
});

after(async () => {
  await db.platformNoShowModel.deleteMany({});
  await db.restaurantNoShowModel.deleteMany({ where: { restaurantId } });
  await db.restaurant.delete({ where: { id: restaurantId } });
  await db.tenant.delete({ where: { id: tenantId } });
});

describe('انتخابِ مدلِ مؤثر', () => {

  test('⚠️ رستورانِ بدونِ مدلِ خودش، مدلِ سراسری می‌گیرد (رفعِ سرمای شروع)', async () => {
    // این دقیقاً همان چیزی است که پیش از این ممکن نبود: رستورانِ تازه
    // مستقیم به heuristic می‌افتاد.
    await setPlatformModel(W, true);
    const eff = await getEffectiveNoShowModel(restaurantId);
    assert.ok(eff, 'باید مدل بگیرد، نه null');
    assert.equal(eff!.source, 'platform');
    assert.deepEqual(eff!.weights, W);
  });

  test('🔴 مدلِ اختصاصیِ رستوران همیشه بر سراسری مقدم است', async () => {
    // مهم‌ترین تستِ فایل: وقتی رستورانی دادهٔ کافیِ خودش را دارد، الگوی
    // خودش دقیق‌تر از میانگینِ پلتفرم است. سراسری فقط شکاف را پر می‌کند،
    // نه اینکه جایگزینِ یادگیریِ محلی شود.
    const own = [9, 9, 9, 9, 9, 9, 9];
    await setPlatformModel(W, true);
    await setRestaurantModel(own, true);
    const eff = await getEffectiveNoShowModel(restaurantId);
    assert.equal(eff!.source, 'restaurant', 'مدلِ سراسری نباید مدلِ اختصاصی را کنار بزند');
    assert.deepEqual(eff!.weights, own);
  });

  test('مدلِ اختصاصیِ **غیرفعال** کنار می‌رود و سراسری جایش را می‌گیرد', async () => {
    // رستورانی که مدلش به‌خاطرِ افتِ کارایی پس گرفته شده، نباید به
    // heuristic بیفتد اگر مدلِ سراسریِ سالمی هست.
    await setPlatformModel(W, true);
    await setRestaurantModel([9, 9, 9, 9, 9, 9, 9], false);
    const eff = await getEffectiveNoShowModel(restaurantId);
    assert.equal(eff!.source, 'platform');
  });

  test('🔴 بدونِ هیچ مدلی ⇒ null (یعنی heuristic)، نه یک مدلِ ساختگی', async () => {
    // بدونِ این، «همیشه یک مدل برگردان» هم سبز می‌شد و heuristic هرگز
    // استفاده نمی‌شد — حتی وقتی هیچ مدلِ سنجیده‌ای وجود ندارد.
    const eff = await getEffectiveNoShowModel(restaurantId);
    assert.equal(eff, null);
  });

  test('مدلِ سراسریِ غیرفعال استفاده نمی‌شود', async () => {
    await setPlatformModel(W, false);
    assert.equal(await getPlatformNoShowModel(), null);
    assert.equal(await getEffectiveNoShowModel(restaurantId), null);
  });

  test('از چند مدلِ سراسری، آخرینِ فعال خوانده می‌شود', async () => {
    await setPlatformModel([1, 1, 1, 1, 1, 1, 1], false);
    await new Promise((r) => setTimeout(r, 5));
    await setPlatformModel(W, true);
    assert.deepEqual(await getPlatformNoShowModel(), W);
  });
});

describe('آموزشِ مدلِ سراسری — گیتِ تنوعِ رستوران', () => {

  test('🔴 با تنوعِ ناکافیِ رستوران، «سراسری» ادعا نمی‌شود', async () => {
    // ۴۰۰ رزرو که همه از یک رستوران باشند، مدلِ «سراسری» نیست — مدلِ همان
    // رستوران است با برچسبِ غلط، و روی بقیه بدتر از heuristic عمل می‌کند.
    // این گیت جلوی آن ادعا را می‌گیرد.
    const out = await trainAndCalibratePlatformNoShowModel();
    if (!out.trained && /تنوعِ رستوران/.test(out.reason ?? '')) {
      assert.ok(out.restaurantCount < 3, 'دلیل باید با عددِ واقعی بخواند');
      return;
    }
    // اگر DBِ تست رستورانِ کافی داشت، دستِ‌کم باید صادقانه گزارش کند.
    assert.ok(out.restaurantCount >= 3, 'یا گیت باید فعال شود یا تنوع واقعاً کافی باشد');
  });

  test('نتیجه همیشه دلیلِ صریح دارد، نه سکوت', async () => {
    const out = await trainAndCalibratePlatformNoShowModel();
    assert.ok(typeof out.reason === 'string' && out.reason.length > 0,
      'چه آموزش ببیند چه نه، باید بگوید چرا');
    assert.equal(typeof out.restaurantCount, 'number');
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('گاردِ نسخه‌ی بردارِ ویژگی', () => {

  test('🔴 مدلِ رستوران با نسخه‌ی ناسازگار سرو نمی‌شود', async () => {
    // ⚠️ چرا این گارد و نه اعتماد به «یادمان می‌ماند بازآموزی کنیم»:
    // `dot()` روی طولِ weights حلقه می‌زند، پس وزنِ نسخه‌ی قدیمی روی بردارِ
    // جدید **هیچ خطایی نمی‌دهد** — فقط ویژگی‌های اضافه را نادیده می‌گیرد و
    // یک امتیازِ قابلِ‌باور و غلط می‌سازد که تا UI می‌رود.
    await setRestaurantModel([9, 9, 9, 9, 9, 9, 9], true, 'v-قدیمی');
    assert.equal(await getEffectiveNoShowModel(restaurantId), null,
      'مدلِ ناسازگار باید کنار برود، نه اینکه امتیازِ غلط بدهد');
  });

  test('🔴 و در آن حالت به مدلِ سراسریِ سازگار عقب می‌نشیند، نه به هیچ', async () => {
    // صادقانه‌ترین رفتار: یک پله عقب، نه سقوطِ کامل.
    await setPlatformModel(W, true);
    await setRestaurantModel([9, 9, 9, 9, 9, 9, 9], true, 'v-قدیمی');
    const eff = await getEffectiveNoShowModel(restaurantId);
    assert.equal(eff?.source, 'platform');
    assert.deepEqual(eff?.weights, W);
  });

  test('🔴 مدلِ سراسری با نسخه‌ی ناسازگار هم سرو نمی‌شود', async () => {
    await setPlatformModel(W, true, 'v-قدیمی');
    assert.equal(await getPlatformNoShowModel(), null);
  });

  test('⚠️ مدلِ ناسازگارِ **تازه‌تر** جلوی مدلِ سازگارِ قدیمی‌تر را نمی‌گیرد', async () => {
    // باگِ ظریفی که اگر فیلترِ نسخه *بعد* از انتخابِ «آخرین فعال» اعمال شود
    // رخ می‌دهد: مدلِ سازگار وجود دارد ولی نتیجه null می‌شود و کلِ پلتفرم
    // بی‌دلیل به heuristic می‌افتد.
    const good = [2, 2, 2, 2, 2, 2, 2];
    await setPlatformModel(good, true);                 // سازگار، قدیمی‌تر
    await new Promise((r) => setTimeout(r, 5));
    await setPlatformModel([7, 7, 7, 7, 7, 7, 7], true, 'v-آینده');  // ناسازگار، تازه‌تر
    assert.deepEqual(await getPlatformNoShowModel(), good,
      'باید آخرین مدلِ فعالِ **سازگار** را بدهد');
  });

  test('🔴 کنترلِ مثبت: نسخه‌ی درست همچنان سرو می‌شود', async () => {
    // بدونِ این، «همیشه null بده» هم همه‌ی تست‌های بالا را سبز می‌کرد.
    await setRestaurantModel([3, 3, 3, 3, 3, 3, 3], true);
    const eff = await getEffectiveNoShowModel(restaurantId);
    assert.equal(eff?.source, 'restaurant');
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('ترتیبِ زمانیِ دادهٔ آموزش — پیش‌شرطِ هولدآوتِ درست', () => {

  let codeN = 0;
  /** رزروِ حل‌شده با created_at و slot_start مشخص. */
  async function resolved(daysAgo: number, status = 'completed') {
    const slot = new Date(Date.now() - daysAgo * 86_400_000);
    await db.$executeRaw`
      INSERT INTO reservations
        (id, code, restaurant_id, party_size, slot_start, slot_end, status, source, created_at)
      VALUES (gen_random_uuid(), ${`${TAG}-O${++codeN}`}, ${restaurantId}::uuid, 2,
              ${slot}, ${new Date(slot.getTime() + 5_400_000)},
              CAST(${status}::text AS "public"."reservation_status"), 'app',
              ${new Date(slot.getTime() - 3_600_000)})`;
  }

  test('🔴 ردیف‌های آموزش صعودی برمی‌گردند — وگرنه هولدآوت وارونه می‌شود', async () => {
    // ⚠️ این تست یک P0ِ واقعی را قفل می‌کند (ممیزیِ نهاییِ ۲۰۲۶-۰۸-۲۵).
    // `trainAndCalibrate*` با `slice(0, ۸۰٪)` آموزش و `slice(۸۰٪)` هولدآوت
    // می‌سازد. اگر آرایه **نزولی** باشد، این یعنی آموزش روی تازه‌ترین ۸۰٪ و
    // سنجش روی قدیمی‌ترین ۲۰٪ — مدل روی آینده آموزش می‌بیند و روی گذشته
    // سنجیده می‌شود. بدتر از split تصادفی، و عددِ Brier/AUCی که گیتِ
    // فعال‌سازی رویش تصمیم می‌گیرد هیچ تخمینی از کاراییِ آینده نیست.
    //
    // مسیرِ سراسری دقیقاً همین اشکال را داشت (ORDER BY ... DESC بدونِ
    // برعکس‌کردن) در حالی که مسیرِ per-restaurant سالم بود — و هیچ تستی
    // ترتیب را نمی‌سنجید.
    for (const d of [30, 20, 10, 5, 1]) await resolved(d);

    // ⚠️ روی **کلیدِ واقعیِ مرتب‌سازی** بسنج، نه روی یک ستونِ همبسته.
    // نسخه‌ی اولِ این تست `slot_start` را می‌سنجید و برای فیکسچرهای خودم
    // درست بود (چون created_at را دقیقاً یک ساعت قبلش می‌گذارم)، ولی کوئریِ
    // سراسری **همه‌ی** رستوران‌ها را می‌خواند و در رانرِ کامل، ردیف‌های
    // فایل‌های دیگر created_at و slot_startِ نامرتبط دارند ⇒ تست در اجرای
    // تکی سبز و در سوئیتِ کامل قرمز می‌شد. `created_at` از
    // `slot_start - lead_minutes` بازسازی می‌شود (همان تعریفِ خودِ کوئری).
    const createdAt = (r: { slot_start: Date; lead_minutes: number }) =>
      +new Date(r.slot_start) - Number(r.lead_minutes) * 60_000;
    const asc = (rows: { slot_start: Date; lead_minutes: number }[]) =>
      rows.every((r, i) => i === 0 || createdAt(rows[i - 1]) <= createdAt(r) + 1);

    const platform = await fetchPlatformTrainingRows();
    assert.ok(platform.length >= 5, `پیش‌شرط: باید ردیف داشته باشیم، شد ${platform.length}`);
    assert.ok(asc(platform), 'ردیف‌های مدلِ سراسری باید صعودی باشند');

    const own = await fetchTrainingRows(restaurantId);
    assert.ok(own.length >= 5);
    assert.ok(asc(own), 'ردیف‌های مدلِ اختصاصی هم باید صعودی باشند');

    // و صریحاً: تازه‌ترین ردیف آخر است، نه اول.
    assert.ok(createdAt(platform[platform.length - 1]) > createdAt(platform[0]),
      'آخرین عنصر باید تازه‌ترین باشد (بر مبنای created_at، کلیدِ واقعیِ مرتب‌سازی)');

    await db.reservation.deleteMany({ where: { restaurantId } });
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('سنجش و بازگردانیِ مدلِ سراسری در تولید', () => {
  let seq = 0;
  /** n پیش‌بینیِ حل‌شده‌ی **سراسری** با خطای مربعیِ مشخص. */
  async function platformPredictions(n: number, squaredError: number) {
    for (let i = 0; i < n; i++) {
      const p = await db.modelPrediction.create({
        data: {
          restaurantId, predictionType: 'no_show', entityType: 'reservation',
          entityId: `${TAG}-P${++seq}`,
          modelSource: 'learned', modelScope: 'platform', featureVersion: NO_SHOW_FEATURE_VERSION,
          predictedValue: 0.5, confidence: 'medium',
          generatedAt: new Date(Date.now() - 3_600_000),
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

  async function activePlatform(learnedBrier: number) {
    await db.platformNoShowModel.create({
      data: {
        weights: W, sampleSize: 500, positiveCount: 60, restaurantCount: 8,
        learnedBrier, staticBrier: learnedBrier * 1.5, learnedAuc: 0.72,
        isActive: true, activationReason: 'تست', featureVersion: NO_SHOW_FEATURE_VERSION,
        // زمانِ آموزش عمداً در گذشته تا پیش‌بینی‌های تست بعد از آن بیفتند.
        trainedAt: new Date(Date.now() - 7 * 86_400_000),
      },
    });
    await invalidatePlatformNoShowModelCache();
  }

  async function cleanup() {
    await db.modelOutcome.deleteMany({ where: { prediction: { restaurantId } } });
    await db.modelPrediction.deleteMany({ where: { restaurantId } });
    await db.platformNoShowModel.deleteMany({});
    await invalidatePlatformNoShowModelCache();
  }

  test('🔴 مدلِ سراسریِ رانش‌کرده پس گرفته می‌شود — تا امروز هیچ مسیری نداشت', async () => {
    // ⚠️ این مرکزی‌ترین تستِ این بلاک است. مدلِ سراسری به **هر** رستورانِ
    // بدونِ مدلِ اختصاصی سرو می‌شود، و تا مهاجرتِ ۰۷۱ نه قابلِ سنجش بود
    // (پیش‌بینی‌هایش از heuristic تفکیک‌ناپذیر بودند) نه قابلِ بازگردانی
    // (`rollbackDriftedModel` فقط جدولِ per-restaurant را می‌نوشت).
    await cleanup();
    await activePlatform(0.10);
    await platformPredictions(MIN_RESOLVED_FOR_ACCURACY + 5, 0.30);  // ۲۰۰٪ بدتر

    const drift = await detectPlatformPerformanceDrift({});
    assert.equal(drift.verdict, 'drifted', drift.reason);

    const out = await rollbackDriftedPlatformModel({});
    assert.equal(out.rolledBack, true, out.reason);
    assert.equal(await getPlatformNoShowModel(), null, 'باید فوراً از مسیرِ سرو خارج شود');
    await cleanup();
  });

  test('🔴 کنترلِ منفی: مدلِ سراسریِ سالم دست نمی‌خورد', async () => {
    // بدونِ این، «همیشه غیرفعال کن» هم سبز می‌شد و رفعِ سرمای شروع می‌مرد.
    await cleanup();
    await activePlatform(0.20);
    await platformPredictions(MIN_RESOLVED_FOR_ACCURACY + 5, 0.20);  // بدونِ افت

    const out = await rollbackDriftedPlatformModel({});
    assert.equal(out.rolledBack, false, out.reason);
    assert.deepEqual(await getPlatformNoShowModel(), W, 'مدلِ سالم باید سرو بماند');
    await cleanup();
  });

  test('🔴 با دادهٔ ناکافی هرگز اقدام نمی‌شود', async () => {
    // غیرفعال‌کردن بر پایه‌ی چند نمونه، خودش همان «ادعای اندازه‌گیری‌نشده»
    // است که ML_CONTRACT ممنوع کرده.
    await cleanup();
    await activePlatform(0.10);
    await platformPredictions(Math.max(1, MIN_RESOLVED_FOR_ACCURACY - 3), 0.90);  // فاجعه‌بار ولی کم

    const out = await rollbackDriftedPlatformModel({});
    assert.equal(out.verdict, 'insufficient_data', out.reason);
    assert.equal(out.rolledBack, false);
    await cleanup();
  });

  test('⚠️ پیش‌بینیِ نسخه‌ی **قبلیِ** سراسری شمرده نمی‌شود', async () => {
    // ⚠️ مدلِ سراسری شناسه‌ی اجرا ندارد، پس تنها کلیدِ تفکیک `scope` است.
    // بدونِ کفِ زمانیِ `trainedAt`، پیش‌بینی‌های نسخه‌های قبلی هم شمرده
    // می‌شدند و «بدترشدن» می‌توانست صرفاً اثرِ عوض‌شدنِ مدل باشد، نه رانشِ
    // دنیا — همان اشتباهی که مسیرِ per-restaurant با model_run_id از آن
    // پرهیز می‌کند.
    await cleanup();
    // ⚠️ ۵ روز قبل، نه ۳۰ روز: باید **داخلِ** پنجره‌ی ۳۰ روزه بیفتند تا این
    // تست واقعاً کفِ `trainedAt` را بسنجد و نه پنجره‌ی زمانی را. نسخه‌ی اولِ
    // همین تست آن‌ها را ۳۰ روز عقب می‌برد و در نتیجه خودِ پنجره حذفشان
    // می‌کرد — پس برداشتنِ کفِ trainedAt هیچ تستی را قرمز نمی‌کرد
    // (جهش‌آزمایی ثابتش کرد: ۰ قرمز).
    await platformPredictions(MIN_RESOLVED_FOR_ACCURACY + 5, 0.90);
    await db.modelPrediction.updateMany({
      where: { restaurantId },
      data: { generatedAt: new Date(Date.now() - 5 * 86_400_000) },
    });
    // نسخه‌ی تازه، آموزش‌دیده بعد از آن‌ها
    await db.platformNoShowModel.create({
      data: {
        weights: W, sampleSize: 500, positiveCount: 60, restaurantCount: 8,
        learnedBrier: 0.10, staticBrier: 0.20, learnedAuc: 0.72,
        isActive: true, activationReason: 'تست', featureVersion: NO_SHOW_FEATURE_VERSION,
        // آموزش‌دیده **بعد از** آن پیش‌بینی‌ها، ولی هر دو داخلِ پنجره‌ی ۳۰ روزه.
        trainedAt: new Date(Date.now() - 86_400_000),
      },
    });
    await invalidatePlatformNoShowModelCache();

    const drift = await detectPlatformPerformanceDrift({});
    assert.equal(drift.resolvedCount, 0,
      'هیچ نتیجه‌ای از زمانِ آموزشِ این نسخه نیست — قدیمی‌ها نباید شمرده شوند');
    assert.equal(drift.verdict, 'insufficient_data',
      'خطای نسخه‌ی قبلی نباید به نسخه‌ی تازه نسبت داده شود');
    await cleanup();
  });

  test('🔴 پیش‌بینیِ رستورانی (scope دیگر) در سنجشِ سراسری نمی‌آید', async () => {
    // بدونِ فیلترِ scope، دقتِ دو دامنه‌ی کاملاً متفاوت با هم قاطی می‌شد.
    await cleanup();
    await activePlatform(0.10);
    await platformPredictions(MIN_RESOLVED_FOR_ACCURACY + 5, 0.30);
    await db.modelPrediction.updateMany({ where: { restaurantId }, data: { modelScope: 'restaurant' } });

    const drift = await detectPlatformPerformanceDrift({});
    assert.equal(drift.verdict, 'insufficient_data',
      'ردیف‌های scope=restaurant نباید در سنجشِ سراسری شمرده شوند');
    await cleanup();
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('نسب‌نامه‌ی دامنه در دفترِ پیش‌بینی', () => {

  test('🔴 پیش‌بینیِ ساخته‌شده با مدلِ سراسری با scope=platform ثبت می‌شود', async () => {
    // ⚠️ این تست حلقه‌ی **نوشتن** را می‌بندد، و بدونش کلِ زنجیره بی‌اثر بود:
    // اگر `modelScope` به دفتر نرسد، `detectPlatformPerformanceDrift` هرگز
    // ردیفی پیدا نمی‌کند و بازگردانیِ سراسری — با همه‌ی تست‌های سبزش — یک
    // مکانیزمِ مرده است.
    // جهش‌آزمایی این را ثابت کرد: برداشتنِ `modelScope` از نقطه‌ی ثبت
    // **صفر** تست را قرمز می‌کرد.
    const { recordPrediction } = await import('../src/lib/prediction-ledger');

    await db.modelOutcome.deleteMany({ where: { prediction: { restaurantId } } });
    await db.modelPrediction.deleteMany({ where: { restaurantId } });

    const id = await recordPrediction({
      restaurantId, predictionType: 'no_show', entityType: 'reservation',
      entityId: `${TAG}-scope-1`,
      modelSource: 'learned',
      modelRunId: null,           // مدلِ سراسری اجرایِ per-restaurant ندارد
      modelScope: 'platform',
      featureVersion: NO_SHOW_FEATURE_VERSION,
      predictedValue: 0.4, confidence: 'medium',
    });
    assert.ok(id, 'ثبت باید موفق باشد');

    const row = await db.modelPrediction.findUniqueOrThrow({
      where: { id: id! }, select: { modelScope: true, modelRunId: true },
    });
    assert.equal(row.modelScope, 'platform',
      'بدونِ این ستون، پیش‌بینیِ سراسری از heuristic و از مدل‌های بی‌نسب تفکیک‌ناپذیر است');
    assert.equal(row.modelRunId, null, 'و صادقانه نسب‌نامه‌ی جعلی نمی‌گیرد');

    await db.modelPrediction.deleteMany({ where: { restaurantId } });
  });

  test('⚠️ نبودِ دامنه NULL می‌ماند، نه یک مقدارِ حدسی', async () => {
    // ردیف‌های پیش از مهاجرتِ ۰۷۱ واقعاً نامعلوم‌اند. جعلِ 'restaurant'
    // برایشان همان «صفر به‌جای نامعلوم» است که ML_CONTRACT ممنوع کرده.
    const { recordPrediction } = await import('../src/lib/prediction-ledger');
    const id = await recordPrediction({
      restaurantId, predictionType: 'no_show', entityType: 'reservation',
      entityId: `${TAG}-scope-2`,
      modelSource: 'heuristic', featureVersion: NO_SHOW_FEATURE_VERSION,
      predictedValue: 0.2, confidence: 'low',
    });
    const row = await db.modelPrediction.findUniqueOrThrow({
      where: { id: id! }, select: { modelScope: true },
    });
    assert.equal(row.modelScope, null);
    await db.modelPrediction.deleteMany({ where: { restaurantId } });
  });
});
