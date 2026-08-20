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

// ⚠️ حذف‌شده (۲۰۲۶-۰۸-۲۰): `redeemCouponAtomic` (نسخه‌ی standalone با تراکنشِ
// خودش) و `redeemCoupon` (نسخه‌ی «منسوخ» و **بدونِ هیچ گاردی**) هر دو حذف شدند
// چون **صفر صداکننده** داشتند — تأییدشده با grep روی کلِ src/ و tests/.
//
// چرا حذف و نه نگه‌داشتن: `redeemCoupon` شمارنده را بی‌قیدوشرط بالا می‌برد و نه
// سقفِ کل را می‌دید نه سقفِ per-user را. یک تفنگِ پُر بود — هر توسعه‌دهنده‌ای که
// از رویِ اسم برش می‌داشت، هر دو سقف را دور می‌زد بدونِ اینکه بفهمد.
//
// تنها مسیرِ مجاز `redeemCouponAtomicTx` است (پایین).

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
 *
 *  ═══ پیش‌شرطِ اجباری (سنجیده‌شده، ۲۰۲۶-۰۸-۲۰) ═══
 *  دو گاردِ این تابع **قدرتِ یکسانی ندارند**:
 *
 *    • سقفِ کل      → self-protecting در هر سطحِ ایزولاسیون، چون
 *                     `UPDATE … WHERE redemption_count < max_redemptions` اتمیک است.
 *    • سقفِ per-user → **self-protecting نیست.** یک «اول بشمار بعد بنویس» ساده
 *                     است و امنیتش تماماً از تراکنشِ **Serializable**ِ صداکننده
 *                     می‌آید (SSI تضادِ read/write را می‌گیرد و یکی را abort می‌کند).
 *
 *  اندازه‌گیریِ واقعی روی Postgres — ۱۰ تلاشِ موازیِ یک کاربر با perUserLimit=1:
 *    Serializable  → ۱ موفق، ۶ خطای serialization، **۱ رکورد در DB**  ✅
 *    ReadCommitted → ۱۰ موفق، **۱۰ رکورد در DB**                      ❌
 *
 *  ⚠️ پس این تابع را **فقط** از تراکنشِ Serializable صدا بزن. تنها صداکننده‌ی
 *  فعلی (createReservation با isolationLevel: Serializable) رعایتش می‌کند. هر
 *  صداکننده‌ی جدیدی که رعایت نکند، سقفِ per-user را بی‌سروصدا از کار
 *  می‌اندازد. هر دو حالت در tests/coupons.integration.test.mts قفل شده‌اند.
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
