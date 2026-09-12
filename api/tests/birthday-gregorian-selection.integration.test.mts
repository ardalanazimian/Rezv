import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  انتخابِ متولدینِ امروز — با دیتابیسِ واقعی
//
//  چرا این فایل لازم است در حالی که `birthday-calendar.test.mts` هم هست:
//  آن فایل قرارداد و شکلِ کد را می‌سنجد، ولی چیزی که واقعاً هدیه را شلیک
//  می‌کند یک `$queryRaw` با `EXTRACT(MONTH/DAY FROM birth_date)` است. §۴c:
//  گاردی که سوژه‌اش را از مرجعِ دیگری می‌شمارد، سبزیِ ساختاری دارد. پس اینجا
//  خودِ کوئری با دو کاربرِ واقعی اجرا می‌شود.
//
//  باگی که قفل می‌شود: cron ماه/روزِ **شمسیِ** امروز را با ستونِ **میلادیِ**
//  birth_date مقایسه می‌کرد. با آن منطق، کاربرِ الف (تولدش دقیقاً امروز)
//  انتخاب **نمی‌شد** — هدیه‌ی ۱۰۰۰ امتیازی برای تقریباً همه در روزِ غلط
//  می‌رفت، و چون هدیه واقعاً ارسال می‌شد کسی متوجه نمی‌شد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { grantBirthdayRewards } = await import('../src/lib/loyalty.ts');
const { dateInTz } = await import('../src/lib/hours.ts');

const SFX = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let todayUserId = '';
let otherUserId = '';

/** ماه/روزِ میلادیِ تهران — همان چیزی که cron می‌خواند. */
const { m: TODAY_M, day: TODAY_D } = dateInTz(new Date(), 'Asia/Tehran');

before(async () => {
  // ⚠️ `loyalty: false` عمداً: انصراف فقط جلویِ **پیامک** را می‌گیرد، نه خودِ
  // امتیاز را (قاعده‌ی مستندشده در grantBirthdayRewards). پس ادعای این تست
  // دست‌نخورده می‌ماند و سوئیت به صفِ پیامک/Redis گره نمی‌خورد.
  const prefs = { loyalty: false };

  const a = await db.user.create({
    data: {
      phone: `+98912${SFX.slice(-7).padStart(7, '0')}`,
      firstName: '[DEMO]', lastName: 'متولدِ امروز',
      birthDate: new Date(Date.UTC(1990, TODAY_M - 1, TODAY_D)),
      notificationPrefs: prefs,
    },
  });
  todayUserId = a.id;

  // ماهِ متفاوت (و روزِ ۱۵ که در هر ماهی معتبر است) → قطعاً امروز نیست.
  const otherMonth = TODAY_M === 12 ? 1 : TODAY_M + 1;
  const b = await db.user.create({
    data: {
      phone: `+98913${SFX.slice(-7).padStart(7, '0')}`,
      firstName: '[DEMO]', lastName: 'متولدِ ماهِ دیگر',
      birthDate: new Date(Date.UTC(1990, otherMonth - 1, 15)),
      notificationPrefs: prefs,
    },
  });
  otherUserId = b.id;
});

after(async () => {
  const ids = [todayUserId, otherUserId].filter(Boolean);
  await db.pointsLedger.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
});

describe('grantBirthdayRewards — انتخاب بر مبنایِ ماه/روزِ میلادی', () => {
  test('🔴 کاربری که تولدِ میلادی‌اش امروز است انتخاب می‌شود، و آنکه نیست نمی‌شود', async () => {
    // نبودِ موضوع = خطا (قاعده‌ی ۵): اگر ساخت کاربرها نگرفته، تست باید بشکند.
    assert.ok(todayUserId && otherUserId, 'کاربرهای تست ساخته نشدند');

    await grantBirthdayRewards();

    const hit = await db.pointsLedger.count({
      where: { userId: todayUserId, reason: 'birthday' },
    });
    assert.equal(hit, 1,
      'کاربرِ متولدِ امروز باید هدیه بگیرد — با منطقِ شمسیِ قبلی این صفر می‌شد');

    const miss = await db.pointsLedger.count({
      where: { userId: otherUserId, reason: 'birthday' },
    });
    assert.equal(miss, 0, 'کاربری که تولدش امروز نیست نباید هدیه بگیرد');
  });

  test('اجرای دوباره‌ی همان روز، هدیه‌ی دوم نمی‌دهد (idempotency)', async () => {
    // cron روزانه است ولی retry/اجرای دستی رخ می‌دهد؛ کلیدِ سالانه باید بگیرد.
    await grantBirthdayRewards();
    const n = await db.pointsLedger.count({
      where: { userId: todayUserId, reason: 'birthday' },
    });
    assert.equal(n, 1, 'هدیه‌ی تولد باید سالی یک‌بار بماند');
  });
});
