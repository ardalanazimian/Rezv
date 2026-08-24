import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { listRewardItems, redeemRewardItem } from '../src/lib/rewards.ts';
import { fixturePhone } from './_phone.helper.mts';

// ═══════════════════════════════════════════════════════════════════════
//  فروشگاهِ جایزه — تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ چرا این فایل نوشته شد: `lib/rewards.ts` هیچ تستی نداشت، در حالی که
//  سرآیندِ `redeemRewardItem` — دقیقاً مثلِ coupons.ts و sms-balance.ts —
//  ادعا می‌کند «زنده تست‌شده … TOCTOU-safe». باز هم ادعای عملکردی بدونِ قفل.
//  و این یک مسیرِ پولِ واقعی است: سکه‌ی کاربر خرج می‌شود و کوپن/گیفت‌کارتِ
//  قابلِ‌خرج تولید می‌شود.
//
//  ⚠️ دو باگی که همین‌جا پیدا و رفع شد (۲۰۲۶-۰۸-۲۰، هر دو با اجرای زنده):
//   ۱) آیتمِ `coupon_grant` بدونِ رستوران: سکه کسر می‌شد ولی کوپن ساخته
//      نمی‌شد و `result_coupon_id` برابرِ null برمی‌گشت — بدونِ هیچ خطایی.
//      مشاهده‌ی واقعی: ۵۰ سکه رفت، هیچ چیزی نیامد.
//   ۲) کدِ کوپن از `Date.now().toString(36)` ساخته می‌شد. از ۵ ردیمِ موازیِ
//      یک آیتم، ۱ تا با نقضِ `@@unique([restaurantId, code])` می‌افتاد.
//      (پول برنمی‌گشت چون تراکنش rollback می‌شد، ولی مشتری به‌جای جایزه یک
//      خطای نامفهوم می‌گرفت.) حالا آنتروپی از randomUUID می‌آید.
//  شرحِ کامل در KNOWN_LIMITATIONS §2m.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `rw-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string;
const madeUsers: string[] = [];
const madeItems: string[] = [];

async function mkUser(coins: number, tier = 'bronze'): Promise<string> {
  // ⚠️ پیشوندِ ۰۹۳۲ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
  const u = await db.user.create({
    data: { phone: fixturePhone('0932'), firstName: '[DEMO]', lastName: 'جایزه' },
    select: { id: true },
  });
  await db.customerEconomyProfile.create({
    data: { userId: u.id, walletBalance: coins, reputationTier: tier },
  });
  madeUsers.push(u.id);
  return u.id;
}

async function mkItem(opts: {
  kind: string; costCoins: number; minTier?: string;
  stockRemaining?: number | null; restaurant?: 'this' | null; isActive?: boolean;
}): Promise<string> {
  const it = await db.rewardMarketplaceItem.create({
    data: {
      title: `[DEMO] ${opts.kind}`, kind: opts.kind, costCoins: opts.costCoins,
      minTier: opts.minTier ?? 'bronze', isActive: opts.isActive ?? true,
      stockRemaining: opts.stockRemaining ?? null,
      restaurantId: opts.restaurant === 'this' ? restaurantId : null,
    },
    select: { id: true },
  });
  madeItems.push(it.id);
  return it.id;
}

const walletOf = async (userId: string) =>
  (await db.customerEconomyProfile.findUniqueOrThrow({
    where: { userId }, select: { walletBalance: true },
  })).walletBalance;

const stockOf = async (itemId: string) =>
  (await db.rewardMarketplaceItem.findUniqueOrThrow({
    where: { id: itemId }, select: { stockRemaining: true },
  })).stockRemaining;

async function cleanupMade() {
  if (madeItems.length) {
    await db.rewardRedemption.deleteMany({ where: { itemId: { in: madeItems } } }).catch(() => {});
  }
  await db.coupon.deleteMany({ where: { restaurantId } }).catch(() => {});
  if (madeUsers.length) {
    await db.giftCard.deleteMany({ where: { buyerId: { in: madeUsers } } }).catch(() => {});
    await db.customerEconomyProfile.deleteMany({ where: { userId: { in: madeUsers } } }).catch(() => {});
  }
  if (madeItems.length) {
    await db.rewardMarketplaceItem.deleteMany({ where: { id: { in: madeItems } } }).catch(() => {});
  }
  if (madeUsers.length) await db.user.deleteMany({ where: { id: { in: madeUsers } } }).catch(() => {});
  madeItems.length = 0;
  madeUsers.length = 0;
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: TAG, name: '[DEMO] رستورانِ جایزه', clubPrefix: 'RW',
      timezone: 'Asia/Tehran', isOpen: true,
    },
    select: { id: true },
  });
  restaurantId = r.id;
});

beforeEach(cleanupMade);

after(async () => {
  await cleanupMade();
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('فروشگاهِ جایزه — فهرست و قفلِ سطح', () => {
  test('آیتمِ سطحِ بالاتر در فهرست هست ولی قفل است', async () => {
    await mkItem({ kind: 'free_item', costCoins: 10, minTier: 'gold' });
    const asBronze = await listRewardItems('bronze');
    const it = asBronze.find(x => x.min_tier === 'gold');
    assert.ok(it, 'آیتم باید دیده شود (تا کاربر بداند چه چیزی در انتظارش است)');
    assert.equal(it.unlocked, false);
    assert.equal((await listRewardItems('gold')).find(x => x.min_tier === 'gold')!.unlocked, true);
  });

  test('آیتمِ غیرفعال اصلاً نمایش داده نمی‌شود', async () => {
    const id = await mkItem({ kind: 'free_item', costCoins: 10, isActive: false });
    assert.equal((await listRewardItems('bronze')).some(x => x.id === id), false);
  });

  test('آیتمِ رستورانِ دیگر بدونِ restaurantId دیده نمی‌شود', async () => {
    const scoped = await mkItem({ kind: 'free_item', costCoins: 10, restaurant: 'this' });
    assert.equal((await listRewardItems('bronze')).some(x => x.id === scoped), false,
      'بدونِ تعیینِ رستوران فقط آیتم‌های سراسری');
    assert.equal((await listRewardItems('bronze', restaurantId)).some(x => x.id === scoped), true);
  });

  test('in_stock موجودیِ صفر را درست گزارش می‌کند', async () => {
    const empty = await mkItem({ kind: 'free_item', costCoins: 10, stockRemaining: 0 });
    const unlimited = await mkItem({ kind: 'free_item', costCoins: 10, stockRemaining: null });
    const list = await listRewardItems('bronze');
    assert.equal(list.find(x => x.id === empty)!.in_stock, false);
    assert.equal(list.find(x => x.id === unlimited)!.in_stock, true, 'null یعنی نامحدود، نه ناموجود');
  });
});

describe('فروشگاهِ جایزه — کسرِ سکه و گاردها', () => {
  test('ردیمِ موفق سکه را کم و ردِ redemption را ثبت می‌کند', async () => {
    const id = await mkItem({ kind: 'free_item', costCoins: 30 });
    const u = await mkUser(100);

    const res = await redeemRewardItem(u, id);
    assert.equal(res.coins_spent, 30);
    assert.equal(await walletOf(u), 70);
    assert.equal(await db.rewardRedemption.count({ where: { itemId: id, userId: u } }), 1);
  });

  test('سکه‌ی ناکافی رد می‌شود و هیچ‌چیز را تغییر نمی‌دهد', async () => {
    const id = await mkItem({ kind: 'free_item', costCoins: 500, stockRemaining: 3 });
    const u = await mkUser(100);

    await assert.rejects(() => redeemRewardItem(u, id));
    assert.equal(await walletOf(u), 100, 'موجودی نباید دست بخورد');
    assert.equal(await stockOf(id), 3, '⚠️ موجودیِ آیتم هم نباید کم شود — کسرِ انبار قبل از چکِ سکه است');
    assert.equal(await db.rewardRedemption.count({ where: { itemId: id } }), 0);
  });

  test('سطحِ اعتبارِ ناکافی رد می‌شود', async () => {
    const id = await mkItem({ kind: 'free_item', costCoins: 10, minTier: 'platinum' });
    const u = await mkUser(1000, 'silver');
    await assert.rejects(() => redeemRewardItem(u, id));
    assert.equal(await walletOf(u), 1000);
  });

  test('کاربرِ بدونِ پروفایلِ اقتصادی نمی‌تواند خرج کند', async () => {
    const id = await mkItem({ kind: 'free_item', costCoins: 10 });
    const u = await db.user.create({
      data: { phone: fixturePhone('0932'), firstName: '[DEMO]', lastName: 'جایزه' }, select: { id: true },
    });
    madeUsers.push(u.id);
    await assert.rejects(() => redeemRewardItem(u.id, id), 'بدونِ پروفایل موجودی‌ای وجود ندارد');
  });

  test('آیتمِ غیرفعال قابلِ ردیم نیست', async () => {
    const id = await mkItem({ kind: 'free_item', costCoins: 10, isActive: false });
    const u = await mkUser(100);
    await assert.rejects(() => redeemRewardItem(u, id));
    assert.equal(await walletOf(u), 100);
  });
});

describe('فروشگاهِ جایزه — همزمانی (قفلِ ادعایِ TOCTOU-safe)', () => {
  test('موجودیِ محدود زیرِ ردیمِ موازی هرگز منفی نمی‌شود', async () => {
    const STOCK = 3, PARALLEL = 12;
    const id = await mkItem({ kind: 'free_item', costCoins: 10, stockRemaining: STOCK });
    const users = await Promise.all(Array.from({ length: PARALLEL }, () => mkUser(100)));

    const out = await Promise.allSettled(users.map(u => redeemRewardItem(u, id)));
    const ok = out.filter(o => o.status === 'fulfilled').length;

    assert.equal(ok, STOCK, `دقیقاً ${STOCK} ردیم باید موفق شود، نه ${ok}`);
    assert.equal(await stockOf(id), 0, 'موجودی هرگز نباید منفی شود');
    assert.equal(await db.rewardRedemption.count({ where: { itemId: id } }), STOCK);
  });

  test('یک کاربر با ردیمِ موازی بیش از موجودیِ سکه‌اش خرج نمی‌کند', async () => {
    // ⚠️ همان کلاسِ باگی که در sms-balance و coupons دنبالش بودیم: چکِ موجودی
    // باید داخلِ خودِ UPDATE باشد، نه SELECT-then-check.
    const id = await mkItem({ kind: 'free_item', costCoins: 40 });
    const u = await mkUser(100);           // فقط ۲ تا از ۵ تلاش باید جا شود

    const out = await Promise.allSettled(Array.from({ length: 5 }, () => redeemRewardItem(u, id)));
    const ok = out.filter(o => o.status === 'fulfilled').length;

    assert.equal(ok, 2, `فقط ۲ ردیم باید جا شود، نه ${ok}`);
    assert.equal(await walletOf(u), 20, 'موجودی هرگز نباید منفی شود');
  });

  test('⚠️ ردیمِ موازیِ یک آیتمِ کوپن‌دار، کدِ تکراری نمی‌سازد', async () => {
    // ⚠️ قفلِ باگِ رفع‌شده: کدِ کوپن از Date.now().toString(36) ساخته می‌شد،
    // پس دو ردیم در یک میلی‌ثانیه کدِ یکسان می‌ساختند و
    // @@unique([restaurantId, code]) یکی را می‌شکست. اثباتِ زنده پیش از رفع:
    // از ۵ ردیمِ موازی، ۱ تا با خطای tx.coupon.create() افتاد.
    const id = await mkItem({ kind: 'coupon_grant', costCoins: 10, restaurant: 'this' });
    const users = await Promise.all(Array.from({ length: 6 }, () => mkUser(100)));

    const out = await Promise.allSettled(users.map(u => redeemRewardItem(u, id)));
    const failed = out.filter(o => o.status === 'rejected');
    assert.equal(failed.length, 0,
      `هیچ ردیمی نباید به‌خاطرِ برخوردِ کد بیفتد؛ ${failed.length} افتاد`);

    const codes = (await db.coupon.findMany({ where: { restaurantId }, select: { code: true } }))
      .map(c => c.code);
    assert.equal(codes.length, 6);
    assert.equal(new Set(codes).size, 6, 'همه‌ی کدها باید یکتا باشند');
  });
});

describe('فروشگاهِ جایزه — تولیدِ جایزه', () => {
  test('coupon_grant کوپنِ واقعیِ همان رستوران می‌سازد', async () => {
    const id = await mkItem({ kind: 'coupon_grant', costCoins: 25, restaurant: 'this' });
    const u = await mkUser(100);

    const res = await redeemRewardItem(u, id);
    assert.ok(res.result_coupon_id, 'شناسه‌ی کوپن باید برگردد');
    const c = await db.coupon.findUniqueOrThrow({ where: { id: res.result_coupon_id! } });
    assert.equal(c.restaurantId, restaurantId);
    assert.equal(c.maxRedemptions, 1, 'کوپنِ جایزه یک‌بارمصرف است');
    assert.equal(c.perUserLimit, 1);
  });

  test('⚠️ coupon_grant بدونِ رستوران رد می‌شود، نه اینکه بی‌صدا پول بگیرد', async () => {
    // ⚠️ قفلِ باگِ رفع‌شده. پیش از رفع، شرط `kind === 'coupon_grant' &&
    // item.restaurantId` بود: نبودِ رستوران یعنی از کنارِ ساختِ کوپن رد شو —
    // در حالی که سکه *قبلاً* کسر شده بود. مشاهده‌ی زنده: ۵۰ سکه رفت،
    // result_coupon_id برابرِ null، بدونِ هیچ خطایی.
    const id = await mkItem({ kind: 'coupon_grant', costCoins: 50, restaurant: null });
    const u = await mkUser(500);

    await assert.rejects(() => redeemRewardItem(u, id), 'باید صریح رد شود');
    assert.equal(await walletOf(u), 500, 'تراکنش باید برگردد و سکه دست‌نخورده بماند');
    assert.equal(await db.rewardRedemption.count({ where: { itemId: id } }), 0);
  });

  test('gift_card_credit گیفت‌کارتِ با موجودی می‌سازد', async () => {
    const id = await mkItem({ kind: 'gift_card_credit', costCoins: 80, restaurant: 'this' });
    const u = await mkUser(200);

    const res = await redeemRewardItem(u, id);
    assert.ok(res.result_gift_card_id);
    const gc = await db.giftCard.findUniqueOrThrow({ where: { id: res.result_gift_card_id! } });
    assert.equal(gc.buyerId, u);
    assert.equal(gc.amountToman, 80);
    assert.equal(gc.balanceToman, 80, 'موجودیِ اولیه باید کاملِ مبلغ باشد');
  });

  test('کیندهایِ V1ِ بدونِ اثر فقط ردِ redemption ثبت می‌کنند', async () => {
    // ⚠️ این رفتار عمدی و در خودِ کد مستند است (priority_boost/free_item/
    // event_access هنوز اثرِ واقعی ندارند). تست آن را *ثبت* می‌کند تا اگر
    // روزی عوض شد عمدی باشد — و تا کسی آن را با باگِ coupon_grant اشتباه نگیرد.
    const id = await mkItem({ kind: 'priority_boost', costCoins: 15 });
    const u = await mkUser(100);

    const res = await redeemRewardItem(u, id);
    assert.equal(res.result_coupon_id, null);
    assert.equal(res.result_gift_card_id, null);
    assert.equal(await walletOf(u), 85, 'سکه خرج می‌شود — این بخشِ عمدیِ طراحی است');
    assert.equal(await db.rewardRedemption.count({ where: { itemId: id, userId: u } }), 1);
  });
});
