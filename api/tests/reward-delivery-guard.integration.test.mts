import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { RewardItemKind } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { listRewardItems, redeemRewardItem, isDeliverableKind, DELIVERABLE_KINDS } from '../src/lib/rewards.ts';
import { rankIncentives } from '../src/lib/incentive-engine.ts';
import { fixturePhone } from './_phone.helper.mts';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ تحویلِ جایزه — «سکه کسر شود و هیچ چیز تحویل نشود» باید
//  ساختاری ناممکن باشد، نه صرفاً از راهِ UI دست‌نیافتنی.
//
//  ⚠️ چرا این فایل نوشته شد: `rewards.ts:119` سه کیند را مستند می‌کرد که
//  «V1 فقط ردِ redemption رو ثبت می‌کنه» — یعنی `priority_boost`،
//  `free_item` و `event_access` سکه‌ی واقعیِ کاربر را کسر می‌کردند و
//  **هیچ چیزی تحویل نمی‌دادند**. تستِ قبلی (`rewards.integration:272`)
//  این را به‌عنوانِ رفتارِ عمدی *تبرک* می‌کرد.
//
//  همان کلاسِ نقصِ `coupon_grant`ِ بدونِ رستوران است که در ۲۰۲۶-۰۸-۲۰ رفع
//  شد (۵۰ سکه رفت، هیچ نیامد) — با این تفاوت که آن یکی داده‌ی خراب بود و
//  این یکی **طراحی** بود. کلاس یکی است: کیفِ پول قبل از تحویل کسر می‌شود.
//
//  قاعده‌ای که اینجا قفل می‌شود: یک کیند فقط وقتی فروختنی است که یک
//  «تحویل‌دهنده» داشته باشد. رجیستری تنها منبعِ حقیقت است — پس افزودنِ
//  کیندِ تازه بدونِ تحویل‌دهنده، به‌جای آنکه بی‌صدا پول بگیرد، این تست را
//  قرمز می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `rdg-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string;
const madeUsers: string[] = [];
const madeItems: string[] = [];

/** کیندهایی که در V1 هیچ تحویلی ندارند — و باید *پیش از* کسرِ سکه رد شوند. */
const UNDELIVERABLE = ['priority_boost', 'free_item', 'event_access'] as const;

async function mkUser(coins: number, tier = 'bronze'): Promise<string> {
  // ⚠️ پیشوندِ ۰۹۳۴ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
  const u = await db.user.create({
    data: { phone: fixturePhone('0934'), firstName: '[DEMO]', lastName: 'گاردِ تحویل' },
    select: { id: true },
  });
  await db.customerEconomyProfile.create({
    data: { userId: u.id, walletBalance: coins, reputationTier: tier },
  });
  madeUsers.push(u.id);
  return u.id;
}

async function mkItem(opts: {
  kind: RewardItemKind; costCoins: number; minTier?: string;
  stockRemaining?: number | null; restaurant?: 'this' | null;
}): Promise<string> {
  const it = await db.rewardMarketplaceItem.create({
    data: {
      title: `[DEMO] ${opts.kind}`, kind: opts.kind, costCoins: opts.costCoins,
      minTier: opts.minTier ?? 'bronze', isActive: true,
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
      tenantId, slug: TAG, name: '[DEMO] رستورانِ گاردِ تحویل', clubPrefix: 'RD',
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

describe('گاردِ تحویل — ردیم پیش از کسرِ سکه رد می‌شود', () => {
  for (const kind of UNDELIVERABLE) {
    test(`${kind}: سکه کسر نمی‌شود، موجودی کم نمی‌شود، ردِ redemption ساخته نمی‌شود`, async () => {
      const id = await mkItem({ kind, costCoins: 15, stockRemaining: 3 });
      const u = await mkUser(100);

      await assert.rejects(
        () => redeemRewardItem(u, id),
        // ⚠️ این assert عمداً **سخت‌گیر** است و اولین نسخه‌اش نبود. نسخه‌ی
        // اول فقط `e instanceof Error` را چک می‌کرد و **سبز شد پیش از آنکه
        // گارد نوشته شود** — چون `DELIVERERS[kind]` برایِ کیندِ بی‌تحویل
        // `undefined` است و `await undefined(...)` یک TypeError می‌دهد که
        // تراکنش را rollback می‌کند و کیفِ پول را دست‌نخورده برمی‌گرداند.
        // یعنی تست از مسیرِ **کرش** سبز بود، نه از مسیرِ ردِ عمدی — دقیقاً
        // همان کلاسِ «سبزِ از مسیرِ غلط» که در FIX-LANDING-SAFEMODE §۳ ثبت شد.
        // حالا فقط ردِ عمدیِ VALIDATION قبول است؛ TypeError تست را می‌اندازد.
        (e: any) => e?.code === 'VALIDATION' && e?.status === 422,
        'باید با ردِ عمدیِ VALIDATION رد شود — نه با کرش',
      );

      assert.equal(await walletOf(u), 100, 'کیفِ پول باید دست‌نخورده بماند');
      assert.equal(await stockOf(id), 3, 'موجودی نباید کم شود');
      assert.equal(
        await db.rewardRedemption.count({ where: { itemId: id, userId: u } }), 0,
        'ردِ redemption نباید ساخته شود',
      );
    });
  }

  test('کیندهایِ تحویل‌دار همچنان کار می‌کنند — گارد بیش از حد نمی‌بندد', async () => {
    const u = await mkUser(200);

    const couponItem = await mkItem({ kind: 'coupon_grant', costCoins: 50, restaurant: 'this' });
    const r1 = await redeemRewardItem(u, couponItem);
    assert.ok(r1.result_coupon_id, 'coupon_grant باید کوپن بسازد');
    assert.ok(r1.result_coupon_code, 'و کدِ قابلِ استفاده برگرداند');

    const gcItem = await mkItem({ kind: 'gift_card_credit', costCoins: 80, restaurant: 'this' });
    const r2 = await redeemRewardItem(u, gcItem);
    assert.ok(r2.result_gift_card_id, 'gift_card_credit باید گیفت‌کارت بسازد');

    assert.equal(await walletOf(u), 70, '۲۰۰ − ۵۰ − ۸۰ = ۷۰');
  });
});

describe('گاردِ تحویل — کلاس، نه نمونه', () => {
  test('هر کیندِ enum یا تحویل‌دهنده دارد یا صریح رد می‌شود — هیچ کیندی بی‌صدا فروختنی نیست', async () => {
    // منبع: خودِ نوعِ Postgres، نه یک لیستِ دستیِ موازی. اگر کسی کیندِ تازه‌ای
    // به schema اضافه کند و تحویل‌دهنده ننویسد، این تست قرمز می‌شود — که دقیقاً
    // همان لحظه‌ای است که تصمیم باید گرفته شود، نه بعد از اولین کسرِ سکه.
    const rows = await db.$queryRaw<{ label: string }[]>`
      SELECT e.enumlabel AS label
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'reward_item_kind'
      ORDER BY e.enumsortorder
    `;
    const allKinds = rows.map((r) => r.label);
    assert.ok(allKinds.length > 0, 'enumِ reward_item_kind باید در DB وجود داشته باشد');

    const undecided = allKinds.filter(
      (k) => !isDeliverableKind(k) && !UNDELIVERABLE.includes(k as typeof UNDELIVERABLE[number]),
    );
    assert.deepEqual(
      undecided, [],
      `کیندِ بدونِ تصمیم: ${undecided.join(', ')} — یا تحویل‌دهنده بنویس یا به UNDELIVERABLE اضافه کن`,
    );

    // و رجیستری واقعاً همان چیزی باشد که ادعا می‌کند.
    for (const k of DELIVERABLE_KINDS) {
      assert.ok(allKinds.includes(k), `رجیستری کیندِ ناموجود دارد: ${k}`);
    }
  });

  test('فهرست، آیتمِ بدونِ تحویل را حذف نمی‌کند ولی صادقانه علامت می‌زند', async () => {
    // حذف نمی‌کنیم (منشور: «هیچ فیچری حذف نمی‌شود») — ولی خریدنی هم نشانش
    // نمی‌دهیم. UI روی همین پرچم دکمه را غیرفعال می‌کند.
    const boost = await mkItem({ kind: 'priority_boost', costCoins: 15 });
    const coupon = await mkItem({ kind: 'coupon_grant', costCoins: 20, restaurant: 'this' });

    const items = await listRewardItems('platinum', restaurantId);
    const b = items.find((x) => x.id === boost);
    const c = items.find((x) => x.id === coupon);

    assert.ok(b, 'آیتمِ بدونِ تحویل باید همچنان در فهرست باشد');
    assert.equal(b!.deliverable, false, 'ولی deliverable=false');
    assert.ok(c, 'آیتمِ تحویل‌دار در فهرست است');
    assert.equal(c!.deliverable, true, 'و deliverable=true');
  });
});

describe('گاردِ تحویل — موتورِ پیشنهاد چیزی را که نمی‌شود خرید پیشنهاد نمی‌دهد', () => {
  const baseInput = {
    segment: 'loyal' as const,
    churnRiskScore: 0,
    reliabilityScore: 95,
    reputationTier: 'platinum' as const,
    hasActiveAbuseFlag: false,
    lowDemandDay: null,
    missions: [],
  };

  test('گران‌ترین آیتمِ بازشده اگر تحویل نداشته باشد پیشنهاد نمی‌شود', () => {
    // بدترین خواهرِ این باگ: موتور *فعالانه* گران‌ترین آیتمِ بازشده را به
    // کاربرِ معتبر پیشنهاد می‌کند. اگر آن آیتم تحویلی نداشته باشد، پلتفرم
    // کاربر را به خریدی هُل می‌دهد که رد خواهد شد.
    const out = rankIncentives({
      ...baseInput,
      rewardItems: [
        { id: 'boost', title: 'بوستِ اولویت', costCoins: 500, minTier: 'bronze', unlocked: true, inStock: true, deliverable: false },
        { id: 'cpn', title: 'کوپن', costCoins: 100, minTier: 'bronze', unlocked: true, inStock: true, deliverable: true },
      ],
    });
    const rec = out.find((s) => s.kind === 'reward');
    assert.ok(rec, 'باید یک پیشنهادِ جایزه بدهد');
    assert.equal(rec!.ref_id, 'cpn', 'باید کوپنِ ارزان‌ترِ تحویل‌دار را پیشنهاد دهد، نه بوستِ گران‌ترِ بی‌تحویل');
  });

  test('اگر هیچ آیتمِ تحویل‌داری نباشد، هیچ پیشنهادِ جایزه‌ای داده نمی‌شود', () => {
    const out = rankIncentives({
      ...baseInput,
      rewardItems: [
        { id: 'boost', title: 'بوستِ اولویت', costCoins: 500, minTier: 'bronze', unlocked: true, inStock: true, deliverable: false },
      ],
    });
    assert.equal(out.find((s) => s.kind === 'reward'), undefined, 'هیچ پیشنهادِ جایزه‌ای نباید باشد');
  });
});
