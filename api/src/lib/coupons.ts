import { randomBytes } from 'crypto';
import { db } from './db';
import { Err } from './errors';

// ═══════════════════════════════════════════════════════════
//  موتور کوپن — مستقل از کش‌بک درصدی دائمی فعلی.
//  کوپن برای کمپین‌های هدفمند و موقت است (winback، تولد، VIP).
// ═══════════════════════════════════════════════════════════

export async function validateCoupon(restaurantId: string, code: string, userId: string | null) {
  const coupon = await db.coupon.findUnique({ where: { restaurantId_code: { restaurantId, code: code.toUpperCase() } } });
  if (!coupon || !coupon.isActive) throw Err.validation('کد تخفیف نامعتبر است');
  const now = new Date();
  if (coupon.validFrom > now) throw Err.validation('این کد هنوز فعال نشده است');
  if (coupon.validUntil && coupon.validUntil < now) throw Err.validation('این کد منقضی شده است');
  if (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions) throw Err.validation('ظرفیت استفاده از این کد تمام شده است');

  if (userId) {
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id, userId } });
    if (used >= coupon.perUserLimit) throw Err.validation('شما قبلاً از این کد استفاده کرده‌اید');
    if (coupon.targetSegment) {
      const insight = await db.customerInsight.findUnique({ where: { restaurantId_userId: { restaurantId, userId } } });
      if (!insight || insight.segment !== coupon.targetSegment) throw Err.validation('این کد برای حساب شما فعال نیست');
    }
  }
  return coupon;
}

/** تخفیف را روی مبلغ سفارش اعمال می‌کند. */
export function calcDiscount(coupon: { kind: string; value: number }, subtotalToman: number): number {
  // درصدی: سقف = مبلغ کل (NEW-C2: جلوگیری از قیمت منفی اگر value اشتباهاً >۱۰۰ باشد)
  if (coupon.kind === 'percent') return Math.min(Math.round((subtotalToman * coupon.value) / 100), subtotalToman);
  if (coupon.kind === 'fixed') return Math.min(coupon.value, subtotalToman);
  return 0; // free_item جداگانه در سطح آیتم اعمال می‌شود
}

/**
 * redemption اتمیک کوپن — ضد TOCTOU (NEW-H1).
 * به‌جای چک جدا + increment جدا، در یک UPDATE شرطی: فقط اگر هنوز ظرفیت هست
 * increment می‌کند. اگر صفر ردیف برگشت = سقف پر شده (دو درخواست همزمان امن).
 * تأییدشده روی PostgreSQL واقعی.
 * خروجی: true اگر redemption موفق بود، false اگر سقف پر بود.
 */
export async function redeemCouponAtomic(
  couponId: string, userId: string | null, reservationCode: string | null,
  discountToman: number, perUserLimit: number,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    // ۱) افزایش شمارنده فقط اگر ظرفیت کل هست (اتمیک)
    const claimed = await tx.$queryRaw<{ id: string }[]>`
      UPDATE coupons SET redemption_count = redemption_count + 1
      WHERE id = ${couponId}::uuid
        AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
      RETURNING id
    `;
    if (claimed.length === 0) return false; // سقف کل پر است

    // ۲) چک سقف per-user داخل همان تراکنش (با شمارش فعلی)
    if (userId) {
      const used = await tx.couponRedemption.count({ where: { couponId, userId } });
      if (used >= perUserLimit) {
        throw Object.assign(new Error('سقف استفاده‌ی شخصی پر است'), { rollback: true });
      }
    }

    // ۳) ثبت رکورد
    await tx.couponRedemption.create({ data: { couponId, userId, reservationCode, discountToman } });
    return true;
  }).catch((e) => {
    // اگر per-user limit خورد، تراکنش rollback شده (شمارنده هم برگشته) → false
    if ((e as any)?.rollback) return false;
    throw e;
  });
}

/** نسخه‌ی tx-aware (برای فراخوانی داخل تراکنش رزرو، بدون تراکنش تودرتو).
 *
 *  ⚠️ باگ H1: قبلاً این نسخه (که مسیر واقعی checkout از آن استفاده می‌کند) فقط
 *  سقف کل را چک می‌کرد و perUserLimit را نادیده می‌گرفت؛ پس یک کاربر با چند
 *  درخواست هم‌زمان می‌توانست کوپن «یک‌بار به‌ازای هر نفر» را چند بار مصرف کند.
 *  حالا در همان تراکنش، تعداد مصرف این کاربر شمرده و در برابر perUserLimit چک
 *  می‌شود. چون این چک داخل تراکنش رزرو اجرا می‌شود و کل مسیر با قفل اسلات +
 *  تراکنش serializable محافظت شده، دو درخواست هم‌زمان همان کاربر سریالایز می‌شوند
 *  و دومی سقف را پر می‌بیند. (ایندکس یکتای ثابت سطح دیتابیس اینجا مناسب نیست چون
 *  perUserLimit per-coupon متغیر است و می‌تواند >۱ باشد؛ ایندکس یکتای بی‌قید،
 *  کوپن‌های چندبارمصرف مجاز را هم اشتباهاً بلاک می‌کرد.)
 *
 *  ⚠️ باگ M1: ip اکنون ذخیره می‌شود تا داشبورد تشخیص سوءاستفاده‌ی چندحسابی کار کند.
 */
export async function redeemCouponAtomicTx(
  tx: any, couponId: string, userId: string | null, reservationCode: string | null,
  discountToman: number, ip?: string | null,
): Promise<boolean> {
  // ── گارد per-user (فقط وقتی کاربر شناخته‌شده است) ──
  if (userId) {
    const coupon = await tx.coupon.findUnique({ where: { id: couponId }, select: { perUserLimit: true } });
    const perUserLimit = coupon?.perUserLimit ?? 1;
    if (perUserLimit > 0) {
      const used = await tx.couponRedemption.count({ where: { couponId, userId } });
      if (used >= perUserLimit) return false; // این کاربر به سقف شخصی رسیده
    }
  }
  // ── گارد سقف کل (اتمیک: افزایش شمارنده فقط اگر ظرفیت هست) ──
  const claimed = await tx.$queryRaw<{ id: string }[]>`
    UPDATE coupons SET redemption_count = redemption_count + 1
    WHERE id = ${couponId}::uuid
      AND (max_redemptions IS NULL OR redemption_count < max_redemptions)
    RETURNING id
  `;
  if (claimed.length === 0) return false;
  await tx.couponRedemption.create({ data: { couponId, userId, reservationCode, discountToman, ip: ip ?? null } });
  return true;
}

/** نسخه‌ی قدیمی (بدون گارد) — منسوخ. از redeemCouponAtomic استفاده کن. */
export async function redeemCoupon(couponId: string, userId: string | null, reservationCode: string | null, discountToman: number) {
  await db.$transaction(async tx => {
    await tx.coupon.update({ where: { id: couponId }, data: { redemptionCount: { increment: 1 } } });
    await tx.couponRedemption.create({ data: { couponId, userId, reservationCode, discountToman } });
  });
}

/** کد یکتای خوانا برای کمپین خودکار می‌سازد (مثلاً WELCOME-7K2N).
 *  L1: از crypto امن استفاده می‌کند نه Math.random (کد قابل‌حدس‌زدن نباشد). */
export function genCouponCode(prefix: string): string {
  // Base32 بدون کاراکترهای مبهم (0/O/1/I) برای خوانایی
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(4);
  let rand = '';
  for (let i = 0; i < 4; i++) rand += alphabet[bytes[i] % alphabet.length];
  return `${prefix.toUpperCase()}-${rand}`;
}
