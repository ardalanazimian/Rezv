import { randomUUID } from 'crypto';
import { db } from './db';
import { Err } from './errors';

// ═══════════════════════════════════════════════════════════════════════
//  Reward Marketplace (migration 038)
// ═══════════════════════════════════════════════════════════════════════

const TIER_RANK: Record<string, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

/** لیستِ آیتم‌هایِ فروشگاه (سراسری + مالِ یه رستورانِ خاص اگه داده بشه)، با unlocked بر اساسِ tierِ کاربر. */
export async function listRewardItems(userReputationTier: string, restaurantId?: string) {
  const items = await db.rewardMarketplaceItem.findMany({
    where: {
      isActive: true,
      OR: restaurantId ? [{ restaurantId: null }, { restaurantId }] : [{ restaurantId: null }],
    },
    orderBy: { costCoins: 'asc' },
  });
  const userRank = TIER_RANK[userReputationTier] ?? 0;
  return items.map((it: any) => ({
    id: it.id, title: it.title, description: it.description, kind: it.kind,
    cost_coins: it.costCoins, min_tier: it.minTier,
    in_stock: it.stockRemaining === null || it.stockRemaining > 0,
    unlocked: (TIER_RANK[it.minTier] ?? 0) <= userRank,
  }));
}

/**
 * redeem — atomic، ضدِ race رویِ موجودیِ محدود و ضدِ خرجِ بیش‌ازموجودی.
 * زنده تست‌شده (رجوع کن به تاریخِ commit): دو UPDATEِ شرطی پشتِ‌سرِهم، هیچ‌کدوم
 * SELECT-then-check نیستن (TOCTOU-safe).
 */
export async function redeemRewardItem(userId: string, itemId: string) {
  return db.$transaction(async (tx) => {
    const item = await tx.rewardMarketplaceItem.findUnique({ where: { id: itemId } });
    if (!item || !item.isActive) throw Err.notFound('آیتمِ فروشگاه');

    const profile = await tx.customerEconomyProfile.findUnique({ where: { userId } });
    const userRank = TIER_RANK[profile?.reputationTier ?? 'bronze'] ?? 0;
    if ((TIER_RANK[item.minTier] ?? 0) > userRank) {
      throw Err.validation('این آیتم برایِ سطحِ اعتبارِ فعلیِ شما قفل است');
    }

    // ── کاهشِ موجودی: فقط اگه stockRemaining=null (نامحدود) یا >0 ──
    if (item.stockRemaining !== null) {
      const stockUpdate = await tx.$queryRaw<{ id: string }[]>`
        UPDATE reward_marketplace_items SET stock_remaining = stock_remaining - 1
        WHERE id = ${itemId}::uuid AND stock_remaining > 0
        RETURNING id
      `;
      if (stockUpdate.length === 0) throw Err.validation('موجودیِ این آیتم تمام شده است');
    }

    // ── کسرِ سکه: شرط >= مستقیم تویِ UPDATE (نه SELECT جدا) — TOCTOU-safe ──
    const walletUpdate = await tx.$queryRaw<{ user_id: string }[]>`
      UPDATE customer_economy_profiles SET wallet_balance = wallet_balance - ${item.costCoins}
      WHERE user_id = ${userId}::uuid AND wallet_balance >= ${item.costCoins}
      RETURNING user_id
    `;
    if (walletUpdate.length === 0) throw Err.validation('موجودیِ سکه‌یِ شما کافی نیست');

    let resultCouponId: string | null = null;
    let resultGiftCardId: string | null = null;
    // ⚠️ رفعِ ارزشِ گم‌شده (پروتکل §۱۰/§۱۶): قبلاً فقط **شناسه‌ی داخلی** برگردانده
    // می‌شد. هیچ endpointی کوپن/کارتِ هدیه را با id برنمی‌گرداند — کارتِ هدیه فقط
    // با `GET /gift-cards?code=…` و کوپن فقط با کد قابلِ استفاده است، و هیچ فهرستِ
    // «کارت‌های من» وجود ندارد. یعنی کاربر سکه‌ی واقعی خرج می‌کرد و دارایی‌ای
    // می‌گرفت که **کدش را هیچ‌جا نمی‌توانست ببیند**. کد افزوده شد (افزایشی، بدونِ
    // شکستنِ مصرف‌کننده‌ی فعلی).
    let resultCouponCode: string | null = null;
    let resultGiftCardCode: string | null = null;

    if (item.kind === 'coupon_grant') {
      // ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۰، با اجرای زنده اثبات شد): شرط قبلاً
      // `item.kind === 'coupon_grant' && item.restaurantId` بود — یعنی آیتمِ
      // coupon_grantِ بدونِ رستوران بی‌صدا از کنارِ ساختِ کوپن رد می‌شد، در
      // حالی که سکه‌ی کاربر **قبلاً کسر شده بود**. مشاهده‌ی واقعی: ۵۰ سکه کم
      // شد و `result_coupon_id` برابرِ null برگشت — کاربر پول داد و چیزی
      // نگرفت، بدونِ هیچ خطایی.
      //
      // برخلافِ priority_boost/free_item/event_access (که پایین‌تر عمداً فقط
      // ردِ redemption ثبت می‌کنند و این در V1 مستند است)، coupon_grant طبقِ
      // تعریفش باید کوپن بسازد. پس نبودِ رستوران یک دیتایِ خراب است، نه یک
      // حالتِ مجاز — و باید صریح رد شود تا تراکنش برگردد و سکه کسر نشود.
      if (!item.restaurantId) {
        throw Err.validation('این آیتمِ فروشگاه پیکربندیِ نادرست دارد (کوپن بدونِ رستوران)');
      }
      const coupon = await tx.coupon.create({
        data: {
          restaurantId: item.restaurantId,
          // ⚠️ باگِ رفع‌شده (همان‌جا): کد قبلاً `Date.now().toString(36)` بود.
          // دو ردیمِ همزمان در یک میلی‌ثانیه کدِ یکسان می‌ساختند و قیدِ
          // @@unique([restaurantId, code]) یکی را می‌شکست. اثباتِ زنده: از ۵
          // ردیمِ موازیِ یک آیتم، ۱ تا با خطای `tx.coupon.create()` افتاد.
          // کاربر پولش را از دست نمی‌داد (تراکنش برمی‌گشت) ولی به‌جای جایزه
          // یک خطای نامفهوم می‌گرفت. حالا آنتروپی از randomUUID می‌آید.
          code: `RWD-${itemId.slice(0, 8).toUpperCase()}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
          kind: 'fixed', value: item.costCoins, // ⚠️ ساده‌سازیِ V1: مقدارِ کوپن = costCoins (تومان)؛
          // مپینگِ دقیق‌ترِ coins↔toman فازِ بعدیه، خارج از دامنه‌یِ این commit.
          maxRedemptions: 1, perUserLimit: 1,
        },
      });
      resultCouponId = coupon.id;
      resultCouponCode = coupon.code;
    } else if (item.kind === 'gift_card_credit') {
      // همان دلیلِ بالا: `GiftCard.code` هم `@unique` است و ۴ کاراکترِ
      // تصادفیِ قبلی (≈۱٫۷ میلیون حالت) در مقیاس برخوردِ تولد می‌داد.
      const code = `RWDGC${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
      const gc = await tx.giftCard.create({
        data: {
          code, buyerId: userId, restaurantId: item.restaurantId,
          amountToman: item.costCoins, balanceToman: item.costCoins,
        },
      });
      resultGiftCardId = gc.id;
      resultGiftCardCode = gc.code;
    }
    // priority_boost / free_item / event_access: V1 فقط ردِ redemption رو ثبت می‌کنه
    // (اعمالِ واقعی‌شون — مثلاً boost موقتِ waitlist priority — فازِ بعدیه).

    const redemption = await tx.rewardRedemption.create({
      data: {
        itemId, userId, coinsSpent: item.costCoins,
        resultCouponId, resultGiftCardId,
      },
    });

    return {
      redemption_id: redemption.id, coins_spent: item.costCoins,
      kind: item.kind, title: item.title,
      result_coupon_id: resultCouponId, result_gift_card_id: resultGiftCardId,
      // کدهایِ قابلِ‌استفاده — تنها راهی که کاربر می‌تواند چیزی را که خریده خرج کند.
      result_coupon_code: resultCouponCode, result_gift_card_code: resultGiftCardCode,
    };
  });
}
