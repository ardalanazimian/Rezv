import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
// ⚠️ importِ پویا عمدی است، نه سلیقه: با `--experimental-test-coverage` زیرِ
// tsx، ماژولی که فقط با importِ *ایستا* کشیده شود اصلاً در گزارشِ پوشش ظاهر
// نمی‌شود (اندازه‌گیریِ A/B، ۲۰۲۶-۰۸-۲۵ — شرح در KNOWN_LIMITATIONS §۷).
// یعنی همان الگویی که بیشترِ فایل‌های این پوشه از قبل دارند.
const {
  FEATURE_FLAG_KEYS, featureFlagLabel, isFeatureEnabled, getAllFeatureFlags, setFeatureFlag,
} = await import('../src/lib/feature-flags.ts');
const { getPlatformSetting, setPlatformSetting } = await import('../src/lib/platform-settings.ts');

// ═══════════════════════════════════════════════════════════════════════
//  سوییچ‌هایِ قابلیت (kill-switch) — تستِ روی Postgres + Redisِ واقعی
//
//  ⚠️ چرا این فایل نوشته شد: `lib/feature-flags.ts` و `lib/platform-settings.ts`
//  هر دو **صفر درصد** پوشش داشتند، در حالی که پنج مسیرِ زنده رویشان قفل
//  می‌شوند (reservations، waitlist، فروشگاهِ جایزه، دریافتِ جایزه‌ی ماموریت،
//  پیشنهادهای هوشمند). یک kill-switch که تست ندارد، دقیقاً همان چیزی است که
//  در روزِ حادثه باید به آن تکیه کرد — و آن روز جای کشفِ خرابی نیست.
//
//  دو خاصیتِ ظریف که فقط تستِ زنده می‌تواند تأییدشان کند و هیچ تایپ‌چکی
//  نمی‌گیردشان:
//
//   ۱) **fail-open بودنِ پیش‌فرض**: کلیدی که در DB نیست یعنی «فعال». اگر
//      روزی کسی این را به fail-closed برگرداند، نصبِ تازه/به‌روزرسانی
//      بی‌صدا کلِ رزروگیری را می‌بندد.
//
//   ۲) **باطل‌شدنِ فوریِ کش**: getPlatformSetting کشِ ۳۰ ثانیه‌ای دارد.
//      اگر setPlatformSetting کش را باطل نکند، خاموش‌کردنِ یک قابلیت در
//      لحظه‌ی حادثه تا ۳۰ ثانیه بی‌اثر می‌ماند. این تست عمداً *اول* مقدار
//      را می‌خواند (تا کش گرم شود) و بعد عوضش می‌کند — بدونِ آن خواندنِ
//      اول، تست حتی اگر باطل‌سازی حذف شود سبز می‌ماند.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `ff-${randomUUID().slice(0, 8)}`;
/** ادمینِ ساختگی برایِ ستونِ updated_by / audit — فقط یک UUID معتبر. */
const ADMIN_ID = randomUUID();
/** کلیدهایی که این فایل در platform_settings می‌سازد و باید پاک شوند. */
const touchedKeys = new Set<string>();

async function clearFlags() {
  const keys = [...FEATURE_FLAG_KEYS.map(k => `feature_flag:${k}`), ...touchedKeys];
  await db.platformSettings.deleteMany({ where: { key: { in: keys } } });
  // کش را هم پاک کن، وگرنه مقدارِ حذف‌شده تا ۳۰ ثانیه زنده می‌ماند و
  // تستِ بعدی رویِ حالتِ کهنه قضاوت می‌کند.
  const { invalidatePattern } = await import('../src/lib/cache.ts');
  for (const k of keys) await invalidatePattern(`platform-settings:${k}`);
}

before(clearFlags);
beforeEach(clearFlags);

after(async () => {
  await clearFlags();
  await db.auditLog.deleteMany({ where: { actorId: ADMIN_ID } });
});

describe('feature-flags · پیش‌فرضِ fail-open', () => {
  test('کلیدی که در DB نیست یعنی «فعال»', async () => {
    for (const key of FEATURE_FLAG_KEYS) {
      assert.equal(await isFeatureEnabled(key), true,
        `${key} بدونِ ردیف در DB باید فعال باشد — fail-closed یعنی نصبِ تازه بی‌صدا بسته است`);
    }
  });

  test('getAllFeatureFlags همه‌ی کلیدهای شناخته‌شده را برمی‌گرداند', async () => {
    const flags = await getAllFeatureFlags();
    assert.deepEqual(Object.keys(flags).sort(), [...FEATURE_FLAG_KEYS].sort(),
      'پنلِ شرکت روی همین فهرست سوییچ می‌سازد — کلیدِ جاافتاده یعنی سوییچِ نامرئی');
    assert.ok(Object.values(flags).every(v => v === true), 'همه باید پیش‌فرض فعال باشند');
  });

  test('هر کلید برچسبِ فارسیِ غیرخالی دارد', async () => {
    // برچسب مستقیماً در پیامِ خطایِ کاربر می‌نشیند (Err.featureDisabled).
    // کلیدِ بی‌برچسب یعنی پیامی مثل «undefined غیرفعال است» به مشتری.
    for (const key of FEATURE_FLAG_KEYS) {
      const label = featureFlagLabel(key);
      assert.equal(typeof label, 'string');
      assert.ok(label.trim().length > 0, `${key} برچسب ندارد`);
    }
  });
});

describe('feature-flags · خاموش/روشن‌کردن', () => {
  test('خاموش‌کردن بلافاصله اثر می‌کند (کش نباید تأخیر بیندازد)', async () => {
    const key = 'reservations_enabled' as const;
    // ⚠️ خواندنِ اول عمدی است: کش را گرم می‌کند. بدونِ آن، این تست حتی با
    // حذفِ invalidatePattern از setPlatformSetting هم سبز می‌ماند.
    assert.equal(await isFeatureEnabled(key), true, 'پیش‌شرط: باید فعال شروع شود');

    await setFeatureFlag(key, false, ADMIN_ID);

    assert.equal(await isFeatureEnabled(key), false,
      'kill-switch باید در همان لحظه اثر کند — تأخیرِ ۳۰ ثانیه‌ای در حادثه یعنی بی‌اثر');
  });

  test('روشن‌کردنِ دوباره هم بلافاصله اثر می‌کند', async () => {
    const key = 'waitlist_enabled' as const;
    await setFeatureFlag(key, false, ADMIN_ID);
    assert.equal(await isFeatureEnabled(key), false, 'پیش‌شرط: باید خاموش شده باشد');

    await setFeatureFlag(key, true, ADMIN_ID);

    assert.equal(await isFeatureEnabled(key), true, 'برگرداندنِ سوییچ نباید منتظرِ انقضایِ کش بماند');
  });

  test('خاموش‌کردنِ یک قابلیت به بقیه سرایت نمی‌کند', async () => {
    await setFeatureFlag('reward_marketplace_enabled', false, ADMIN_ID);

    const flags = await getAllFeatureFlags();
    assert.equal(flags.reward_marketplace_enabled, false);
    assert.equal(flags.reservations_enabled, true, 'رزروگیری نباید با خاموشیِ فروشگاهِ جایزه بسته شود');
    assert.equal(flags.waitlist_enabled, true);
    assert.equal(flags.missions_claim_enabled, true);
    assert.equal(flags.ai_recommendations_enabled, true);
  });

  test('تغییرِ سوییچ در audit ثبت می‌شود', async () => {
    // چه کسی رزروگیریِ کلِ پلتفرم را بست، کِی؟ بدونِ این ردیف، پاسخی نیست.
    await setFeatureFlag('missions_claim_enabled', false, ADMIN_ID);

    const rows = await db.auditLog.findMany({
      where: { action: 'feature_flag.update', actorId: ADMIN_ID },
      orderBy: { createdAt: 'desc' }, take: 1,
    });
    assert.equal(rows.length, 1, 'تغییرِ kill-switch باید ردِ انسانی داشته باشد');
    assert.deepEqual(rows[0].detail, { key: 'missions_claim_enabled', enabled: false });
  });

  test('فقط مقدارِ دقیقِ «false» خاموش است — مقدارِ ناشناخته امن (فعال) می‌ماند', async () => {
    // یک مقدارِ دست‌کاری‌شده/خراب در DB نباید بی‌صدا قابلیت را ببندد.
    const key = 'ai_recommendations_enabled' as const;
    const settingKey = `feature_flag:${key}`;
    touchedKeys.add(settingKey);
    await setPlatformSetting(settingKey, 'maybe', ADMIN_ID);

    assert.equal(await isFeatureEnabled(key), true,
      'مقدارِ ناشناخته باید fail-open بماند، نه اینکه قابلیت را ببندد');

    // کنترلِ مثبت: همین مسیر با مقدارِ دقیقِ 'false' واقعاً می‌بندد.
    await setPlatformSetting(settingKey, 'false', ADMIN_ID);
    assert.equal(await isFeatureEnabled(key), false, 'کنترلِ مثبت: مسیرِ خاموشی سالم است');
  });
});

describe('platform-settings · کلید/مقدارِ پایه', () => {
  test('کلیدِ نبود → undefined؛ با fallbackِ env → همان مقدارِ env', async () => {
    const key = `${TAG}-absent`;
    touchedKeys.add(key);
    assert.equal(await getPlatformSetting(key), undefined, 'کلیدِ نبود نباید رشته‌ی خالی برگرداند');
    assert.equal(await getPlatformSetting(key, 'از-env'), 'از-env',
      'fallbackِ env مسیرِ تنظیماتی است که هنوز به DB منتقل نشده‌اند');
  });

  test('مقدارِ DB بر fallbackِ env اولویت دارد', async () => {
    const key = `${TAG}-override`;
    touchedKeys.add(key);
    await setPlatformSetting(key, 'از-دیتابیس', ADMIN_ID);

    assert.equal(await getPlatformSetting(key, 'از-env'), 'از-دیتابیس',
      'کلِ هدفِ این جدول، ویرایش از پنل بدونِ ری‌دیپلوی است — env نباید رویش را بگیرد');
  });

  test('نوشتنِ دوباره مقدار را به‌روز می‌کند (upsert، نه ردیفِ دوم)', async () => {
    const key = `${TAG}-upsert`;
    touchedKeys.add(key);
    await setPlatformSetting(key, 'اول', ADMIN_ID);
    await setPlatformSetting(key, 'دوم', ADMIN_ID);

    assert.equal(await getPlatformSetting(key), 'دوم');
    const rows = await db.platformSettings.findMany({ where: { key } });
    assert.equal(rows.length, 1, 'کلید PK است — نباید ردیفِ تکراری بسازد');
    assert.equal(rows[0].updatedBy, ADMIN_ID, 'باید معلوم باشد چه کسی آخرین‌بار عوضش کرده');
  });
});
