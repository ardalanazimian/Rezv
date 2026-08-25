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
} = await import('../src/lib/no-show-model');

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

async function setPlatformModel(weights: number[], isActive: boolean) {
  await db.platformNoShowModel.create({
    data: {
      weights, sampleSize: 500, positiveCount: 60, restaurantCount: 8,
      learnedBrier: 0.12, staticBrier: 0.20, learnedAuc: 0.72,
      isActive, activationReason: isActive ? 'تست' : 'غیرفعالِ تست',
    },
  });
  await invalidatePlatformNoShowModelCache();
}

async function setRestaurantModel(weights: number[], isActive: boolean) {
  await db.restaurantNoShowModel.upsert({
    where: { restaurantId },
    create: {
      restaurantId, weights, sampleSize: 100, positiveCount: 20,
      learnedBrier: 0.10, staticBrier: 0.20, isActive,
    },
    update: { weights, isActive },
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
