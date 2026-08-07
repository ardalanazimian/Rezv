import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// import پویا عمداً — همان دلیلِ محیطیِ ذکرشده در tests/validate.test.mts.
const {
  tierFromPoints, tierProgress, computeBadges, countNightOwlVisits, longestWeekStreak, LOYALTY_TIERS,
} = await import('../src/lib/loyalty-status.ts');

// ═══════════════════════════════════════════════════════════════════════
//  loyalty.js قبلاً «سطحِ طلایی»، «۱۶۰ امتیاز تا پلاتینیوم»، نوارِ ۶۸٪، و
//  نشان‌های earned/locked را همیشه ثابت نشان می‌داد — مستقل از امتیازِ
//  واقعیِ کاربر. این تست‌ها ثابت می‌کنند این اعداد حالا واقعاً از رویِ
//  ورودی محاسبه می‌شوند، نه یک رشته‌ی هاردکد.
// ═══════════════════════════════════════════════════════════════════════

describe('tierFromPoints — مرزهای سطح', () => {
  test('۰ تا ۲۹۹ → برنزی', () => {
    assert.equal(tierFromPoints(0).key, 'bronze');
    assert.equal(tierFromPoints(299).key, 'bronze');
  });
  test('۳۰۰ تا ۷۹۹ → نقره‌ای', () => {
    assert.equal(tierFromPoints(300).key, 'silver');
    assert.equal(tierFromPoints(799).key, 'silver');
  });
  test('۸۰۰ تا ۱۹۹۹ → طلایی', () => {
    assert.equal(tierFromPoints(800).key, 'gold');
    assert.equal(tierFromPoints(1999).key, 'gold');
  });
  test('۲۰۰۰+ → پلاتینیوم', () => {
    assert.equal(tierFromPoints(2000).key, 'platinum');
    assert.equal(tierFromPoints(999999).key, 'platinum');
  });
  test('امتیازِ منفی هم بی‌خطا برنزی می‌ماند', () => {
    assert.equal(tierFromPoints(-50).key, 'bronze');
  });
});

describe('tierProgress — پیشرفتِ واقعی، نه یک عددِ ثابت', () => {
  test('در ابتدایِ باند → صفر درصد', () => {
    const p = tierProgress(0);
    assert.equal(p.tier.key, 'bronze');
    assert.equal(p.nextTier?.key, 'silver');
    assert.equal(p.pointsToNext, 300);
    assert.equal(p.progressPct, 0);
  });
  test('وسطِ باند → پنجاه درصد', () => {
    const p = tierProgress(150); // بین ۰ و ۳۰۰
    assert.equal(p.progressPct, 50);
    assert.equal(p.pointsToNext, 150);
  });
  test('نزدیکِ سطحِ بعدی → درصدِ بالا', () => {
    const p = tierProgress(750); // بین ۳۰۰(نقره‌ای) و ۸۰۰(طلایی)
    assert.ok(p.progressPct > 85, `انتظارِ درصدِ بالا داشتیم، شد ${p.progressPct}`);
  });
  test('بالاترین سطح → nextTier=null و صد درصد', () => {
    const p = tierProgress(5000);
    assert.equal(p.tier.key, 'platinum');
    assert.equal(p.nextTier, null);
    assert.equal(p.pointsToNext, null);
    assert.equal(p.progressPct, 100);
  });
  test('همه‌ی سطح‌ها به‌جز آخری nextTier دارند', () => {
    for (const t of LOYALTY_TIERS.slice(0, -1)) {
      assert.ok(tierProgress(t.min).nextTier, `سطحِ ${t.key} باید nextTier داشته باشد`);
    }
  });
});

describe('computeBadges — نشان‌ها از رویِ دادهٔ واقعی، نه یک آرایه‌ی ثابت', () => {
  const none = { globalVisits: 0, restaurantsVisited: 0, isVipAnywhere: false, streakWeeks: 0, nightOwlVisits: 0 };

  test('کاربرِ بدونِ هیچ فعالیتی → هیچ نشانی کسب نشده', () => {
    const badges = computeBadges(none);
    assert.equal(badges.length, 6);
    assert.ok(badges.every((b) => b.earned === false));
  });

  test('اولین بازدید → فقط نشانِ first_visit', () => {
    const badges = computeBadges({ ...none, globalVisits: 1 });
    const byKey = Object.fromEntries(badges.map((b) => [b.key, b.earned]));
    assert.equal(byKey.first_visit, true);
    assert.equal(byKey.gourmet, false);
  });

  test('گورمه در ۳ رستوران، کاشف هنوز نه', () => {
    const badges = computeBadges({ ...none, restaurantsVisited: 3 });
    const byKey = Object.fromEntries(badges.map((b) => [b.key, b.earned]));
    assert.equal(byKey.gourmet, true);
    assert.equal(byKey.explorer, false);
  });

  test('کاشف در ۷ رستوران', () => {
    const badges = computeBadges({ ...none, restaurantsVisited: 7 });
    const byKey = Object.fromEntries(badges.map((b) => [b.key, b.earned]));
    assert.equal(byKey.explorer, true);
  });

  test('VIP مستقیماً از isVipAnywhere', () => {
    const badges = computeBadges({ ...none, isVipAnywhere: true });
    assert.equal(badges.find((b) => b.key === 'vip')?.earned, true);
  });

  test('شب‌نشین با ۳ بازدیدِ دیرهنگام', () => {
    const badges = computeBadges({ ...none, nightOwlVisits: 3 });
    assert.equal(badges.find((b) => b.key === 'night_owl')?.earned, true);
    const under = computeBadges({ ...none, nightOwlVisits: 2 });
    assert.equal(under.find((b) => b.key === 'night_owl')?.earned, false);
  });

  test('۵ هفته پیاپی', () => {
    const badges = computeBadges({ ...none, streakWeeks: 5 });
    assert.equal(badges.find((b) => b.key === 'streak5')?.earned, true);
    const under = computeBadges({ ...none, streakWeeks: 4 });
    assert.equal(under.find((b) => b.key === 'streak5')?.earned, false);
  });
});

describe('countNightOwlVisits — به‌وقتِ تهران، نه سرور', () => {
  test('بازدیدهایِ بینِ ۲۲:۰۰ و ۰۴:۰۰ تهران شمرده می‌شوند', () => {
    const dates = [
      new Date('2026-01-01T19:00:00Z'), // تهران ۲۲:۳۰ — شب‌نشین
      new Date('2026-01-01T00:00:00Z'), // تهران ۰۳:۳۰ — شب‌نشین
      new Date('2026-01-01T12:00:00Z'), // تهران ۱۵:۳۰ — نه
    ];
    assert.equal(countNightOwlVisits(dates), 2);
  });
  test('آرایه‌ی خالی → صفر', () => {
    assert.equal(countNightOwlVisits([]), 0);
  });
});

describe('longestWeekStreak — توالیِ واقعیِ هفته‌ها', () => {
  const day = 86_400_000;
  const base = new Date('2026-01-05T12:00:00Z').getTime(); // دوشنبه، ظهرِ UTC (دور از مرزِ نیمه‌شب)

  test('بدونِ بازدید → صفر', () => {
    assert.equal(longestWeekStreak([]), 0);
  });
  test('یک بازدید → یک هفته', () => {
    assert.equal(longestWeekStreak([new Date(base)]), 1);
  });
  test('سه هفته‌ی پیاپی → طول ۳', () => {
    const dates = [0, 7, 14].map((daysOffset) => new Date(base + daysOffset * day));
    assert.equal(longestWeekStreak(dates), 3);
  });
  test('چند بازدید در یک هفته فقط یک‌بار شمرده می‌شود', () => {
    const sameWeek = [new Date(base), new Date(base + 1 * day), new Date(base + 2 * day)];
    assert.equal(longestWeekStreak(sameWeek), 1);
  });
  test('شکاف در توالی → طولانی‌ترین زیررشته برمی‌گردد، نه کلِ تعداد', () => {
    // هفته‌ی ۰، ۱ (پیاپی) سپس شکاف، بعد هفته‌ی ۴ (تنها)
    const dates = [0, 7, 28].map((daysOffset) => new Date(base + daysOffset * day));
    assert.equal(longestWeekStreak(dates), 2);
  });
});
