import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import {
  detectHighNoShow, detectRedemptionVelocity, runFraudScan,
  applyAbuseFlags, clearAbuseFlag, setAbuseFlagManually, listFlaggedAbuseUsers,
} from '../src/lib/fraud.ts';
import { applyStrikeDecay } from '../src/lib/economy.ts';
import { fixturePhone } from './_phone.helper.mts';

// ═══════════════════════════════════════════════════════════════════════
//  تشخیصِ سوءاستفاده — تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ چرا این فایل نوشته شد: `lib/fraud.ts` هیچ تستی نداشت، در حالی که
//  سرآیندش ادعا می‌کند «همه‌ی کوئری‌ها روی PostgreSQL واقعی تست شده‌اند».
//  و پیامدش مستقیم رویِ مشتریِ واقعی است: خطای مثبت یعنی سخت‌ترشدنِ قوانینِ
//  کنسلیِ یک مشتریِ بی‌گناه در **کلِ پلتفرم** (پروفایلِ اقتصادی per-User است،
//  نه per-restaurant).
//
//  ⚠️ باگی که همین‌جا پیدا و رفع شد (۲۰۲۶-۰۸-۲۰، با اجرای زنده):
//  `flagUserForAbuse` فیلدِ `lastViolationAt` را هم به «الان» می‌برد — ولی آن
//  فیلد مالِ این ماژول نیست: `economy.ts` با آن decayِ strike را حساب می‌کند،
//  با معنایِ مستندِ «هر ۹۰ روزِ *بدونِ نقضِ جدید*، یک strike کم می‌شود».
//  این اسکن نقضِ جدیدی نمی‌بیند — همان رزروهای قدیمی را دوباره می‌بیند
//  (پنجره‌ی high_no_show ۹۰ روزه است). پس هر اجرای cron ساعتِ ریکاوری را
//  ریست می‌کرد و دوره‌ی بهبود تا دو برابر کش می‌آمد.
//  شرحِ کامل در KNOWN_LIMITATIONS §2o.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `fr-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string;
const madeUsers: string[] = [];
let codeSeq = 0;

async function mkUser(): Promise<string> {
  // ⚠️ پیشوندِ ۰۹۳۷ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
  const u = await db.user.create({
    data: { phone: fixturePhone('0937'), firstName: '[DEMO]', lastName: 'تقلب' },
    select: { id: true },
  });
  madeUsers.push(u.id);
  return u.id;
}

/** n رزرو با وضعیتِ دلخواه در ۹۰ روزِ اخیر. */
async function mkReservations(userId: string, status: string, n: number, daysAgoBase = 20) {
  for (let i = 0; i < n; i++) {
    const slot = new Date(Date.now() - (daysAgoBase + i) * 86_400_000);
    const code = `FR${String(++codeSeq).padStart(4, '0')}${randomUUID().slice(0, 2).toUpperCase()}`;
    await db.$executeRaw`
      INSERT INTO reservations (id, code, restaurant_id, user_id, party_size, slot_start, slot_end,
        duration_minutes, block_buffer_minutes, status, source, created_at)
      VALUES (${randomUUID()}::uuid, ${code}, ${restaurantId}::uuid, ${userId}::uuid, 2,
        ${slot}, ${new Date(+slot + 5_400_000)}, 90, 15,
        CAST(${status}::text AS "public"."reservation_status"), 'app', ${slot})`;
  }
}

const profileOf = (userId: string) =>
  db.customerEconomyProfile.findUnique({
    where: { userId },
    select: { hasActiveAbuseFlag: true, lastViolationAt: true, strikeCount: true },
  });

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: TAG, name: '[DEMO] رستورانِ تقلب', clubPrefix: 'FR',
      timezone: 'Asia/Tehran', isOpen: true,
    },
    select: { id: true },
  });
  restaurantId = r.id;
});

beforeEach(async () => {
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ${restaurantId}::uuid`;
  if (madeUsers.length) {
    await db.customerEconomyProfile.deleteMany({ where: { userId: { in: madeUsers } } }).catch(() => {});
  }
  await db.$executeRaw`DELETE FROM coupon_redemptions WHERE coupon_id IN (SELECT id FROM coupons WHERE restaurant_id = ${restaurantId}::uuid)`;
  await db.coupon.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.auditLog.deleteMany({ where: { restaurantId } }).catch(() => {});
});

after(async () => {
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ${restaurantId}::uuid`.catch(() => 0);
  await db.auditLog.deleteMany({ where: { restaurantId } }).catch(() => {});
  if (madeUsers.length) {
    await db.customerEconomyProfile.deleteMany({ where: { userId: { in: madeUsers } } }).catch(() => {});
    await db.user.deleteMany({ where: { id: { in: madeUsers } } }).catch(() => {});
  }
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('تشخیصِ سوءاستفاده — آستانه‌ها و خطای مثبت', () => {
  test('نرخِ no-showِ بالا با نمونه‌ی کافی تشخیص داده می‌شود', async () => {
    const u = await mkUser();
    await mkReservations(u, 'no_show', 4);

    const sigs = await detectHighNoShow(restaurantId);
    const mine = sigs.find(s => s.subject === u);
    assert.ok(mine, 'باید تشخیص داده شود');
    assert.equal(mine.severity, 'high', '۱۰۰٪ no-show باید high باشد');
    assert.equal(mine.metrics.pct, 100);
  });

  test('⚠️ زیرِ حدِ نصابِ نمونه اصلاً تشخیص داده نمی‌شود', async () => {
    // ⚠️ مهم‌ترین گاردِ ضدِ خطای مثبت: ۳ رزرو (زیرِ minReservations=4) حتی با
    // ۱۰۰٪ no-show نباید کسی را متهم کند. این همان انضباطِ «شواهدِ ناکافی =
    // ادعا نکن» است که در ML_CONTRACT هم آمده.
    const u = await mkUser();
    await mkReservations(u, 'no_show', 3);

    const sigs = await detectHighNoShow(restaurantId);
    assert.equal(sigs.some(s => s.subject === u), false,
      'با ۳ رزرو نباید هیچ ادعایی بشود');
  });

  test('مشتریِ خوش‌حساب هرگز سیگنال نمی‌سازد (کنترلِ منفی)', async () => {
    const u = await mkUser();
    await mkReservations(u, 'completed', 10);
    assert.equal((await detectHighNoShow(restaurantId)).some(s => s.subject === u), false);
  });

  test('نرخِ زیرِ آستانه تشخیص داده نمی‌شود', async () => {
    // ۲ از ۶ = ۳۳٪ — زیرِ threshold=0.6
    const u = await mkUser();
    await mkReservations(u, 'no_show', 2, 20);
    await mkReservations(u, 'completed', 4, 30);
    assert.equal((await detectHighNoShow(restaurantId)).some(s => s.subject === u), false);
  });

  test('نرخِ متوسط medium می‌شود نه high', async () => {
    // ۴ از ۶ ≈ ۶۷٪ — بالایِ آستانه ولی زیرِ ۸۰٪
    const u = await mkUser();
    await mkReservations(u, 'no_show', 4, 20);
    await mkReservations(u, 'completed', 2, 40);
    const mine = (await detectHighNoShow(restaurantId)).find(s => s.subject === u);
    assert.ok(mine);
    assert.equal(mine.severity, 'medium', 'زیرِ ۸۰٪ نباید high باشد — فلگِ خودکار نمی‌خورد');
  });

  test('رزروِ مهمانِ بدونِ حساب وارد محاسبه نمی‌شود', async () => {
    // user_id IS NULL در کوئری فیلتر شده — چون سیگنال باید به یک کاربر
    // نسبت داده شود، نه به هیچ‌کس.
    const code = `FR${String(++codeSeq).padStart(4, '0')}GX`;
    const slot = new Date(Date.now() - 10 * 86_400_000);
    await db.$executeRaw`
      INSERT INTO reservations (id, code, restaurant_id, user_id, party_size, slot_start, slot_end,
        duration_minutes, block_buffer_minutes, status, source, created_at)
      VALUES (${randomUUID()}::uuid, ${code}, ${restaurantId}::uuid, NULL, 2,
        ${slot}, ${new Date(+slot + 5_400_000)}, 90, 15,
        CAST('no_show'::text AS "public"."reservation_status"), 'manual', ${slot})`;
    const sigs = await detectHighNoShow(restaurantId, 1, 0.1);
    assert.equal(sigs.length, 0, 'مهمانِ بی‌حساب نباید سیگنال بسازد');
  });

  test('تشخیص به همان رستوران مقید است (بدونِ نشتِ تنانت)', async () => {
    const other = await db.restaurant.create({
      data: {
        tenantId, slug: `${TAG}-o`, name: '[DEMO] شعبه‌ی دیگر',
        clubPrefix: 'FR', timezone: 'Asia/Tehran',
      },
      select: { id: true },
    });
    try {
      const u = await mkUser();
      await mkReservations(u, 'no_show', 4);
      assert.equal((await detectHighNoShow(other.id)).length, 0,
        'رستورانِ دیگر نباید سیگنالِ این یکی را ببیند');
    } finally {
      await db.restaurant.delete({ where: { id: other.id } }).catch(() => {});
    }
  });

  test('اسکنِ کامل روی رستورانِ بی‌داده چیزی ادعا نمی‌کند', async () => {
    assert.deepEqual(await runFraudScan(restaurantId), []);
    assert.deepEqual(await detectRedemptionVelocity(restaurantId), []);
  });
});

/** ردیمِ کوپن برایِ سنجشِ سرعتِ استفاده. */
async function mkRedemptions(userId: string, n: number) {
  const c = await db.coupon.create({
    data: {
      restaurantId, code: `FRC${randomUUID().slice(0, 8).toUpperCase()}`,
      kind: 'fixed', value: 1000, maxRedemptions: 1000, perUserLimit: 1000,
    },
    select: { id: true },
  });
  for (let i = 0; i < n; i++) {
    await db.$executeRaw`
      INSERT INTO coupon_redemptions (id, coupon_id, user_id, discount_toman, redeemed_at)
      VALUES (${randomUUID()}::uuid, ${c.id}::uuid, ${userId}::uuid, 1000,
              now() - (${i} * interval '1 minute'))`;
  }
  return c.id;
}

describe('تشخیصِ سوءاستفاده — سرعتِ ردیم (قاعده‌ی هم‌راستاشده)', () => {
  test('زیرِ آستانه اصلاً سیگنال نمی‌سازد', async () => {
    const u = await mkUser();
    await mkRedemptions(u, 5);          // آستانه «بیش از ۵» است
    assert.equal((await detectRedemptionVelocity(restaurantId)).length, 0);
  });

  test('بالایِ آستانه ولی زیرِ دو برابر → medium (فلگِ خودکار نمی‌خورد)', async () => {
    const u = await mkUser();
    await mkRedemptions(u, 7);
    const sig = (await detectRedemptionVelocity(restaurantId)).find(s => s.subject === u);
    assert.ok(sig, 'باید تشخیص داده شود');
    assert.equal(sig.severity, 'medium');
  });

  test('⚠️ دو برابرِ آستانه یا بیشتر → high (شاخه‌ای که قبلاً مرده بود)', async () => {
    // ⚠️ باگِ رفع‌شده: این تنها detectorی بود که severity را هاردکد روی
    // 'medium' می‌گذاشت. چون applyAbuseFlags فقط 'high' را فلگ می‌کند، حضورِ
    // redemption_velocity در USER_SCOPED_KINDS یک شاخه‌ی مرده بود.
    //
    // تصمیمِ طراحی نبود، ناسازگاری بود: چهار detectorِ دیگرِ همین فایل قاعده‌ی
    // «دو برابرِ آستانه = high» را دارند. همان قاعده اینجا هم اعمال شد.
    const u = await mkUser();
    await mkRedemptions(u, 10);         // ۲ × ۵
    const sig = (await detectRedemptionVelocity(restaurantId)).find(s => s.subject === u);
    assert.ok(sig);
    assert.equal(sig.severity, 'high');
    assert.equal(sig.metrics.redemptions, 10);
  });

  test('سیگنالِ highِ سرعتِ ردیم واقعاً فلگ می‌زند', async () => {
    // کنترلِ end-to-end: اگر فقط severity عوض شده بود ولی مسیرِ فلگ وصل نبود،
    // این تست می‌افتاد.
    const u = await mkUser();
    await mkRedemptions(u, 12);
    const res = await applyAbuseFlags(restaurantId);
    assert.ok(res.flaggedUserIds.includes(u), 'کاربر باید فلگ بخورد');
    assert.equal((await profileOf(u))!.hasActiveAbuseFlag, true);
  });
});

describe('تشخیصِ سوءاستفاده — اِعمالِ فلگ', () => {
  test('سیگنالِ high فلگ می‌زند و ردِ audit ثبت می‌کند', async () => {
    const u = await mkUser();
    await mkReservations(u, 'no_show', 4);

    const res = await applyAbuseFlags(restaurantId);
    assert.ok(res.flaggedUserIds.includes(u));
    assert.equal((await profileOf(u))!.hasActiveAbuseFlag, true);
    assert.ok(
      await db.auditLog.count({ where: { restaurantId, action: 'security.abuse_flag', targetId: u } }) > 0,
      'هر فلگ باید ردِ حسابرسی داشته باشد',
    );
  });

  test('سیگنالِ medium فلگِ خودکار نمی‌زند', async () => {
    const u = await mkUser();
    await mkReservations(u, 'no_show', 4, 20);
    await mkReservations(u, 'completed', 2, 40);   // ≈۶۷٪ → medium

    const res = await applyAbuseFlags(restaurantId);
    assert.equal(res.flaggedUserIds.includes(u), false, 'فقط high فلگ می‌زند');
    assert.equal(await profileOf(u), null, 'نباید حتی پروفایل ساخته شود');
  });

  test('⚠️ اسکنِ دوباره ساعتِ ریکاوریِ strike را ریست نمی‌کند', async () => {
    // ⚠️ قفلِ باگِ رفع‌شده. `lastViolationAt` مالِ سیستمِ strike در economy.ts
    // است، نه این ماژول. اسکن نقضِ *جدیدی* نمی‌بیند — همان رزروهای قدیمی را
    // دوباره می‌بیند — پس نباید مهرِ زمانی را جلو ببرد.
    //
    // اثباتِ زنده پیش از رفع: کاربری با ۲ strike و آخرین نقضِ ۱۰۰ روز پیش
    // (که decay باید به ۱ برساند) پس از یک اسکن مهرش به «امروز» رفت و strike
    // دوباره ۲ شد. چون رزروها تا ۹۰ روز در پنجره می‌مانند، دوره‌ی ریکاوری
    // عملاً تا دو برابر کش می‌آمد.
    const u = await mkUser();
    const oldViolation = new Date(Date.now() - 100 * 86_400_000);
    await db.customerEconomyProfile.create({
      data: { userId: u, strikeCount: 2, lastViolationAt: oldViolation, reliabilityScore: 40 },
    });
    await mkReservations(u, 'no_show', 4);

    assert.equal(applyStrikeDecay(2, oldViolation), 1, 'پیش‌شرط: باید یک strike decay شده باشد');

    await applyAbuseFlags(restaurantId);

    const p = (await profileOf(u))!;
    assert.equal(p.hasActiveAbuseFlag, true, 'فلگ باید خورده باشد');
    assert.equal(+p.lastViolationAt!, +oldViolation,
      'مهرِ نقض نباید جلو برود — اسکن نقضِ جدیدی ندیده');
    assert.equal(applyStrikeDecay(p.strikeCount, p.lastViolationAt), 1,
      'decay باید همان‌طور که بود بماند');
  });

  test('فلگ‌زدنِ دوباره پروفایل را خراب نمی‌کند (idempotent)', async () => {
    const u = await mkUser();
    await mkReservations(u, 'no_show', 4);

    await applyAbuseFlags(restaurantId);
    const first = await profileOf(u);
    await applyAbuseFlags(restaurantId);
    const second = await profileOf(u);

    assert.equal(second!.hasActiveAbuseFlag, true);
    assert.equal(second!.strikeCount, first!.strikeCount, 'strike نباید با اسکن زیاد شود');
  });
});

describe('تشخیصِ سوءاستفاده — مسیرِ دستی و appeal', () => {
  test('فلگِ دستی ثبت می‌شود و در فهرست می‌آید', async () => {
    const u = await mkUser();
    const admin = randomUUID();
    await setAbuseFlagManually(u, admin, '[DEMO] بررسیِ دستی');

    assert.equal((await profileOf(u))!.hasActiveAbuseFlag, true);
    assert.ok((await listFlaggedAbuseUsers()).some((x: any) => x.userId === u || x.user_id === u),
      'کاربرِ فلگ‌خورده باید در فهرستِ بازبینی دیده شود');
  });

  test('⚠️ فلگِ دستی هم ساعتِ ریکاوریِ strike را ریست نمی‌کند', async () => {
    // ⚠️ باگی که ممیزیِ تاریخچه‌ی PRها پیدا کرد: PR #55 این را برای مسیرِ
    // *خودکار* رفع کرد ولی `setAbuseFlagManually` (مسیرِ دستیِ ادمین) از قلم
    // افتاده بود — و آن‌جا بدتر بود چون **نامتقارن** است: فلگ‌زدن مهر
    // می‌زد، ولی `clearAbuseFlag` (مسیرِ اعتراض) مهر را برنمی‌گرداند.
    //
    // یعنی یک فلگِ اشتباهیِ ادمین، حتی پس از پس‌گرفتن، تا ۹۰ روزِ اضافه
    // جلوی decayِ strikeِ مشتری را می‌گرفت — بی‌صدا و بدونِ هیچ ردی.
    const u = await mkUser();
    const oldViolation = new Date(Date.now() - 100 * 86_400_000);
    await db.customerEconomyProfile.create({
      data: { userId: u, strikeCount: 2, lastViolationAt: oldViolation, reliabilityScore: 40 },
    });
    assert.equal(applyStrikeDecay(2, oldViolation), 1, 'پیش‌شرط: یک strike باید decay شده باشد');

    await setAbuseFlagManually(u, randomUUID(), '[DEMO] بررسیِ دستی');

    const p = (await profileOf(u))!;
    assert.equal(p.hasActiveAbuseFlag, true, 'فلگ باید خورده باشد');
    assert.equal(+p.lastViolationAt!, +oldViolation,
      'مهرِ نقض نباید جلو برود — فلگِ ادمین نقضِ جدیدِ رزرو نیست');
    assert.equal(applyStrikeDecay(p.strikeCount, p.lastViolationAt), 1);
  });

  test('⚠️ پاک‌کردنِ فلگ ساعتِ ریکاوری را دست‌نخورده می‌گذارد (تقارن)', async () => {
    // نیمه‌ی دومِ همان نامتقارنی: حالا که فلگ‌زدن مهر نمی‌زند، پاک‌کردن هم
    // چیزی برای برگرداندن ندارد — و نباید مهرِ *واقعیِ* رزروها را پاک کند.
    const u = await mkUser();
    const realViolation = new Date(Date.now() - 10 * 86_400_000);
    await db.customerEconomyProfile.create({
      data: { userId: u, strikeCount: 1, lastViolationAt: realViolation, hasActiveAbuseFlag: true },
    });

    await clearAbuseFlag(u, randomUUID(), restaurantId, 'staff');

    const p = (await profileOf(u))!;
    assert.equal(p.hasActiveAbuseFlag, false);
    assert.equal(+p.lastViolationAt!, +realViolation,
      'نقضِ واقعیِ رزرو نباید با پاک‌کردنِ فلگِ سوءاستفاده پاک شود');
  });

  test('⚠️ پاک‌کردنِ فلگ فقط با اقدامِ صریح انجام می‌شود و رد می‌گذارد', async () => {
    // ⚠️ ادعای صریحِ کامنتِ کد: «هرگز خودکار پاک نمی‌شود … تا false-positive
    // با یک چرخه‌ی cron دیگر خودبه‌خود ناپدید نشود و کسی متوجهِ آن نشود».
    const u = await mkUser();
    await mkReservations(u, 'no_show', 4);
    await applyAbuseFlags(restaurantId);
    assert.equal((await profileOf(u))!.hasActiveAbuseFlag, true);

    // اجرای دوباره‌ی اسکن نباید فلگ را پاک کند
    await applyAbuseFlags(restaurantId);
    assert.equal((await profileOf(u))!.hasActiveAbuseFlag, true, 'اسکن هرگز پاک‌کننده نیست');

    const staffId = randomUUID();
    await clearAbuseFlag(u, staffId, restaurantId, 'staff');
    assert.equal((await profileOf(u))!.hasActiveAbuseFlag, false, 'اقدامِ صریح باید پاک کند');
    assert.ok(
      await db.auditLog.count({ where: { restaurantId, targetId: u, action: { contains: 'abuse' } } }) >= 2,
      'هم فلگ‌زدن هم پاک‌کردن باید در audit باشند',
    );
  });
});
