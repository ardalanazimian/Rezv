import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { Prisma } from '@prisma/client';
import { validateCoupon, calcDiscount, redeemCouponAtomicTx } from '../src/lib/coupons.ts';

// ═══════════════════════════════════════════════════════════════════════
//  موتورِ کوپن — تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ چرا این فایل نوشته شد: `lib/coupons.ts` هیچ تستی نداشت، در حالی که
//  سرآیندِ خودش ادعا می‌کند ضدِ TOCTOU بودنش «تأییدشده روی PostgreSQL واقعی»
//  است. یعنی یک ادعای عملکردی بدونِ هیچ قفلی — دقیقاً همان الگویی که این
//  ممیزی مدام پیدا می‌کند، فقط این‌بار درباره‌ی *همزمانی* به‌جای *اندازه‌گیری*.
//  اگر کسی فردا `redeemCouponAtomicTx` را «ساده» کند، هیچ‌چیز نمی‌فهمید.
//
//  ⚠️ فقط `redeemCouponAtomicTx` مسیرِ زنده است (از داخلِ تراکنشِ رزرو در
//  reservations.ts:513). دو تابعِ دیگر (`redeemCoupon` و `redeemCouponAtomic`)
//  صفر صداکننده دارند — رجوع کن به توضیحِ حذفشان در همین PR.
//
//  تست‌های همزمانی عمداً از تراکنش‌های *واقعیِ موازی* استفاده می‌کنند، نه
//  شبیه‌سازی — چون خودِ ادعا درباره‌ی رفتارِ Postgres زیرِ فشار است.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `cp-${randomUUID().slice(0, 8)}`;
let tenantId: string;
let restaurantId: string;
const createdUserIds: string[] = [];
let userSeq = 0;
const PHONE_PREFIX = String(Math.floor(Math.random() * 9000) + 1000);

async function makeUser(): Promise<string> {
  // شماره‌ی ساختگی (پیش‌شماره‌ی ۰۹۰۰ تخصیص داده نشده) — هیچ شماره‌ی واقعی‌ای نیست.
  const u = await db.user.create({
    data: { phone: `09${PHONE_PREFIX}${String(++userSeq).padStart(5, '0')}`, firstName: '[DEMO] مهمان' },
    select: { id: true },
  });
  createdUserIds.push(u.id);
  return u.id;
}

async function makeCoupon(opts: {
  code: string; kind?: string; value?: number;
  maxRedemptions?: number | null; perUserLimit?: number;
  isActive?: boolean; validFrom?: Date; validUntil?: Date | null;
  targetSegment?: string | null;
}): Promise<string> {
  const c = await db.coupon.create({
    data: {
      restaurantId, code: opts.code.toUpperCase(),
      kind: (opts.kind ?? 'percent') as never, value: opts.value ?? 20,
      maxRedemptions: opts.maxRedemptions === undefined ? null : opts.maxRedemptions,
      perUserLimit: opts.perUserLimit ?? 1,
      isActive: opts.isActive ?? true,
      ...(opts.validFrom ? { validFrom: opts.validFrom } : {}),
      ...(opts.validUntil !== undefined ? { validUntil: opts.validUntil } : {}),
      ...(opts.targetSegment !== undefined ? { targetSegment: opts.targetSegment } : {}),
    },
    select: { id: true },
  });
  return c.id;
}

/**
 * یک تلاشِ redemption در تراکنشِ مستقلِ خودش.
 *
 * ⚠️ سطحِ ایزولاسیون پارامتر است و پیش‌فرضش **Serializable** — چون مسیرِ زنده
 * (reservations.ts:336) دقیقاً همین است. اولین نسخه‌ی این هلپر ایزولاسیونِ
 * پیش‌فرضِ Prisma (ReadCommitted) را می‌گرفت و «باگ» گزارش کرد؛ باگ در کد
 * نبود، در خودِ هارنس بود. درسش در تستِ «پیش‌شرطِ ایزولاسیون» پایین قفل شد.
 */
function attempt(
  couponId: string, userId: string | null,
  isolationLevel: Prisma.TransactionIsolationLevel = Prisma.TransactionIsolationLevel.Serializable,
): Promise<boolean | 'serialization_error'> {
  return db.$transaction(
    tx => redeemCouponAtomicTx(tx, couponId, userId, `${TAG}-${randomUUID().slice(0, 6)}`, 1000, null),
    { isolationLevel, timeout: 10_000 },
  ).catch(() => 'serialization_error' as const);
}

const countRedemptions = (couponId: string) => db.couponRedemption.count({ where: { couponId } });
const couponCounter = async (couponId: string) =>
  (await db.coupon.findUniqueOrThrow({ where: { id: couponId }, select: { redemptionCount: true } })).redemptionCount;

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] تنانتِ کوپن ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-rest`, name: '[DEMO] رستورانِ تستِ کوپن',
      clubPrefix: 'CP', timezone: 'Asia/Tehran',
    },
    select: { id: true },
  });
  restaurantId = r.id;
});

after(async () => {
  const cs = await db.coupon.findMany({ where: { restaurantId }, select: { id: true } });
  await db.couponRedemption.deleteMany({ where: { couponId: { in: cs.map(c => c.id) } } });
  await db.coupon.deleteMany({ where: { restaurantId } });
  await db.customerInsight.deleteMany({ where: { restaurantId } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  if (createdUserIds.length) await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('کوپن — همزمانیِ واقعی (قفلِ ادعایِ ضدِ TOCTOU)', () => {
  test('سقفِ کل زیرِ ۲۰ تلاشِ موازی هرگز رد نمی‌شود', async () => {
    // ⚠️ همان ادعایی که سرآیندِ coupons.ts می‌کرد ولی هیچ‌جا قفل نشده بود.
    // بدونِ `UPDATE ... WHERE redemption_count < max_redemptions` اتمیک، الگویِ
    // «اول بخوان بعد بنویس» اجازه می‌داد چند درخواستِ همزمان همگی ظرفیت را
    // آزاد ببینند و سقف رد شود.
    const MAX = 3, PARALLEL = 20;
    const couponId = await makeCoupon({ code: `${TAG}-CAP`, maxRedemptions: MAX, perUserLimit: 99 });
    // کاربرانِ متفاوت تا سقفِ per-user دخالت نکند — این تست فقط سقفِ کل است.
    const users = await Promise.all(Array.from({ length: PARALLEL }, () => makeUser()));

    // ⚠️ عمداً ReadCommitted (ضعیف‌ترین حالت): سقفِ کل باید **خودش** محافظت
    // کند، نه با تکیه به ایزولاسیونِ صداکننده — چون `UPDATE ... WHERE
    // redemption_count < max_redemptions` اتمیک است.
    const results = await Promise.all(users.map(u =>
      attempt(couponId, u, Prisma.TransactionIsolationLevel.ReadCommitted)));
    const ok = results.filter(r => r === true).length;

    assert.equal(ok, MAX, `دقیقاً ${MAX} تلاش باید موفق شود، نه ${ok}`);
    assert.equal(await countRedemptions(couponId), MAX, 'تعدادِ رکوردهای ثبت‌شده باید با سقف یکی باشد');
    assert.equal(await couponCounter(couponId), MAX, 'شمارنده‌ی کوپن نباید از سقف رد شود');
  });

  test('سقفِ per-user زیرِ تلاشِ موازیِ یک کاربر رد نمی‌شود — با ایزولاسیونِ تولید', async () => {
    // ⚠️ باگِ H1 که توضیحِ داخلِ coupons.ts می‌گوید رفع شده: نسخه‌ی tx-aware
    // قبلاً فقط سقفِ کل را چک می‌کرد، پس *یک* کاربر با چند درخواستِ هم‌زمان
    // می‌توانست کوپنِ «یک‌بار به‌ازای هر نفر» را چند بار مصرف کند.
    //
    // اینجا Serializable است چون مسیرِ زنده همان است (reservations.ts:336).
    const couponId = await makeCoupon({ code: `${TAG}-USER`, maxRedemptions: null, perUserLimit: 1 });
    const userId = await makeUser();

    const results = await Promise.all(Array.from({ length: 10 }, () => attempt(couponId, userId)));
    const ok = results.filter(r => r === true).length;

    assert.equal(ok, 1, `یک کاربر با perUserLimit=1 فقط یک‌بار — نه ${ok} بار`);
    assert.equal(await countRedemptions(couponId), 1,
      'دیتابیس باید دقیقاً یک رکورد داشته باشد');

    // کنترلِ مثبت: کاربرِ دیگر همچنان می‌تواند استفاده کند (سقفِ کل نامحدود است).
    assert.equal(await attempt(couponId, await makeUser()), true,
      'سقفِ شخصی نباید کوپن را برای بقیه ببندد');
  });

  test('⚠️ پیش‌شرطِ ایزولاسیون: سقفِ per-user بدونِ Serializable نگه داشته نمی‌شود', async () => {
    // ⚠️ **این تست یک ضعفِ واقعیِ طراحی را اجرایی می‌کند، نه یک باگ.**
    //
    // برخلافِ سقفِ کل (که با UPDATE شرطیِ اتمیک خودش را محافظت می‌کند)، گاردِ
    // per-user یک «اول بشمار بعد بنویس» ساده است. امنیتش از خودِ تابع نمی‌آید —
    // از تراکنشِ Serializableِ *صداکننده* می‌آید. کامنتِ داخلِ coupons.ts هم
    // دقیقاً همین را می‌گوید و درست است.
    //
    // ولی تا امروز فقط یک «کامنت» بود. اگر روزی کسی redeemCouponAtomicTx را از
    // یک تراکنشِ ReadCommitted صدا بزند، سقفِ per-user بی‌سروصدا از کار می‌افتد
    // و هیچ تستی نمی‌فهمد.
    //
    // ⚠️ چرا این تست *ترتیب‌دهیِ صریح* دارد و نه «۱۰ تلاشِ موازی»: نسخه‌ی اولش
    // ۱۰ تراکنشِ همزمان می‌ساخت و `ok > 1` را ادعا می‌کرد — یعنی به **بردن در
    // یک ریس** تکیه داشت. اگر روزی استخرِ اتصالِ CI کوچک شود یا ماشین کند باشد،
    // آن ۱۰ تا سریالایز می‌شدند و تست بی‌دلیل قرمز می‌شد: یک flake. اینجا
    // به‌جایش خودِ *مکانیزم* قطعی نشان داده می‌شود.
    const couponId = await makeCoupon({ code: `${TAG}-ISO`, maxRedemptions: null, perUserLimit: 1 });
    const userId = await makeUser();

    let openGate!: () => void;
    const gate = new Promise<void>(res => { openGate = res; });

    // تراکنشِ A: کارش را می‌کند ولی commit نمی‌کند (پشتِ gate منتظر می‌ماند).
    const a = db.$transaction(async tx => {
      const r = await redeemCouponAtomicTx(tx, couponId, userId, `${TAG}-A`, 1000, null);
      await gate;   // تراکنش باز می‌ماند
      return r;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 });

    // به A فرصت بده خواندن/نوشتنش را انجام دهد (هنوز commit نکرده).
    await new Promise(res => setTimeout(res, 300));

    // تراکنشِ B: شمارشِ per-user را انجام می‌دهد و ردیفِ **commit‌نشده‌ی** A را
    // نمی‌بیند (ReadCommitted) → از گارد رد می‌شود. بعد روی UPDATEِ کوپن پشتِ
    // قفلِ ردیفِ A بلاک می‌شود تا A تمام شود.
    const b = db.$transaction(
      tx => redeemCouponAtomicTx(tx, couponId, userId, `${TAG}-B`, 1000, null),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 20_000 },
    );

    await new Promise(res => setTimeout(res, 300));
    openGate();
    const [okA, okB] = await Promise.all([a, b]);

    assert.equal(okA, true, 'تراکنشِ اول باید موفق شود');
    assert.equal(okB, true,
      'تراکنشِ دوم هم موفق می‌شود چون شمارشِ per-userش ردیفِ commit‌نشده‌ی اولی را ندید');
    assert.equal(await countRedemptions(couponId), 2,
      `زیرِ ReadCommitted گارد نگه داشته نمی‌شود: دو رکورد برای کاربری با perUserLimit=1. ` +
      `این وضعیتِ *فعلی* است، نه مطلوب — اگر روزی گارد self-protecting شود این تست ` +
      `قرمز می‌شود و باید با خبرِ خوب به‌روزش کرد.`);
  });

  test('کوپنِ بدونِ سقفِ کل برای همه‌ی کاربران کار می‌کند', async () => {
    // کنترلِ مثبت برایِ تستِ اول: بدونِ این، «دقیقاً MAX موفقیت» می‌توانست
    // به‌دلیلِ خرابیِ کلیِ redemption هم درست از آب دربیاید.
    const couponId = await makeCoupon({ code: `${TAG}-FREE`, maxRedemptions: null, perUserLimit: 1 });
    const users = await Promise.all(Array.from({ length: 8 }, () => makeUser()));
    const results = await Promise.all(users.map(u => attempt(couponId, u)));
    assert.equal(results.filter(Boolean).length, 8, 'کوپنِ نامحدود نباید کسی را رد کند');
  });

  test('تلاشِ ناموفق شمارنده را بالا نمی‌برد — و همین تست گاردِ per-user را قفل می‌کند', async () => {
    // ⚠️ یافته‌ی جهش‌آزمایی (۲۰۲۶-۰۸-۲۰): با حذفِ **کاملِ** بلوکِ per-user از
    // redeemCouponAtomicTx، تستِ «۱۰ تلاشِ همزمان زیرِ Serializable» همچنان سبز
    // می‌ماند — چون آنجا `UPDATE` رویِ همان ردیفِ کوپن خودش نقطه‌ی سریالایز است
    // و بقیه abort می‌شوند. یعنی آن تست رفتارِ *سیستم* را می‌سنجد، نه سهمِ گارد را.
    //
    // این تستِ **ترتیبی** است که واقعاً گارد را قفل می‌کند، و هر دو جهشِ حذفِ
    // گارد را همین گرفت. نقشِ واقعیِ گاردِ per-user هم همین است: کاربری که
    // فردا دوباره برمی‌گردد — حالتی که هیچ مکانیزمِ دیتابیسی نمی‌گیردش.
    // اگر شمارنده در مسیرِ شکست برنگردد، کوپن به‌مرور «ظرفیتش پر» می‌شود
    // بدونِ اینکه واقعاً کسی استفاده کرده باشد — نشتِ خاموشِ ظرفیت.
    const couponId = await makeCoupon({ code: `${TAG}-LEAK`, maxRedemptions: 5, perUserLimit: 1 });
    const userId = await makeUser();

    assert.equal(await attempt(couponId, userId), true, 'اولی موفق');
    assert.equal(await attempt(couponId, userId), false, 'دومی باید به سقفِ شخصی بخورد');
    assert.equal(await attempt(couponId, userId), false, 'سومی هم');

    assert.equal(await couponCounter(couponId), 1,
      'دو تلاشِ ناموفق نباید ظرفیتِ کوپن را مصرف کرده باشند');
    assert.equal(await countRedemptions(couponId), 1);
  });
});

describe('کوپن — اعتبارسنجی', () => {
  test('کوپنِ غیرفعال / منقضی / هنوز-فعال‌نشده رد می‌شود', async () => {
    const day = 86_400_000;
    await makeCoupon({ code: `${TAG}-OFF`, isActive: false });
    await makeCoupon({ code: `${TAG}-EXP`, validUntil: new Date(Date.now() - day) });
    await makeCoupon({ code: `${TAG}-SOON`, validFrom: new Date(Date.now() + day) });

    for (const code of [`${TAG}-OFF`, `${TAG}-EXP`, `${TAG}-SOON`, `${TAG}-NOPE`]) {
      await assert.rejects(() => validateCoupon(restaurantId, code, null), `${code} باید رد شود`);
    }

    // کنترلِ مثبت: کوپنِ سالم باید بپذیرد.
    await makeCoupon({ code: `${TAG}-GOOD` });
    const c = await validateCoupon(restaurantId, `${TAG}-GOOD`, null);
    assert.ok(c.id, 'کوپنِ معتبر باید برگردد');
  });

  test('کدِ کوچک‌حرف هم پذیرفته می‌شود (نرمال‌سازی)', async () => {
    await makeCoupon({ code: `${TAG}-CASE` });
    const c = await validateCoupon(restaurantId, `${TAG}-case`.toLowerCase(), null);
    assert.ok(c.id, 'کد باید بدونِ حساسیت به بزرگی/کوچکیِ حروف پیدا شود');
  });

  test('کوپنِ رستورانِ دیگر پیدا نمی‌شود', async () => {
    // ایزولاسیونِ تنانت: کدِ یکسان در دو رستوران دو کوپنِ متفاوت است.
    const other = await db.restaurant.create({
      data: { tenantId, slug: `${TAG}-other`, name: '[DEMO] رستورانِ دوم', clubPrefix: 'CP2' },
      select: { id: true },
    });
    await makeCoupon({ code: `${TAG}-MINE` });
    await assert.rejects(() => validateCoupon(other.id, `${TAG}-MINE`, null),
      'کوپنِ رستورانِ A نباید از رستورانِ B قابلِ استفاده باشد');
  });

  test('کوپنِ سگمنت‌دار فقط برای همان سگمنت', async () => {
    await makeCoupon({ code: `${TAG}-VIP`, targetSegment: 'vip' });
    const wrong = await makeUser();
    await db.customerInsight.create({
      data: { restaurantId, userId: wrong, segment: 'active', totalVisits: 3 },
    });
    await assert.rejects(() => validateCoupon(restaurantId, `${TAG}-VIP`, wrong),
      'مشتریِ active نباید کوپنِ vip را بگیرد');

    const right = await makeUser();
    await db.customerInsight.create({
      data: { restaurantId, userId: right, segment: 'vip', totalVisits: 30 },
    });
    const c = await validateCoupon(restaurantId, `${TAG}-VIP`, right);
    assert.ok(c.id, 'کنترلِ مثبت: مشتریِ vip باید بگیرد');
  });
});

describe('کوپن — محاسبه‌ی تخفیف', () => {
  test('تخفیف هرگز از مبلغِ سفارش بیشتر نمی‌شود', () => {
    // اگر سقف نخورَد، مبلغِ نهایی منفی می‌شود — یعنی رستوران به مشتری پول بدهد.
    assert.equal(calcDiscount({ kind: 'percent', value: 20 }, 100_000), 20_000);
    assert.equal(calcDiscount({ kind: 'percent', value: 150 }, 100_000), 100_000,
      'درصدِ بالای ۱۰۰ باید به کلِ مبلغ محدود شود');
    assert.equal(calcDiscount({ kind: 'fixed', value: 500_000 }, 100_000), 100_000,
      'مبلغِ ثابتِ بزرگ‌تر از سفارش باید به کلِ مبلغ محدود شود');
    assert.equal(calcDiscount({ kind: 'fixed', value: 30_000 }, 100_000), 30_000);
    assert.equal(calcDiscount({ kind: 'free_item', value: 0 }, 100_000), 0,
      'free_item در سطحِ آیتم اعمال می‌شود، نه اینجا');
  });
});
