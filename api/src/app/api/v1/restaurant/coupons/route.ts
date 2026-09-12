import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { genCouponCode } from '@/lib/coupons';
import { Err } from '@/lib/errors';
import { parseBody, zUuid, z } from '@/lib/schemas';
import { toAsciiDigits } from '@/lib/validate';
import { zonedTimeToUtc } from '@/lib/hours';

/**
 * پایانِ اعتبارِ کوپن.
 *
 * ⚠️ رفعِ P2 (ممیزیِ قراردادِ فرانت↔بک، ۲۰۲۶-۰۹-۱۳): پنل (marketing.js:97)
 * مقدارِ `<input type=date>` یعنی `YYYY-MM-DD` را می‌فرستد و این‌جا
 * `new Date('2026-09-20')` ذخیره می‌شد = نیمه‌شبِ **UTC**ِ آغازِ همان روز.
 * `validateCoupon` با `validUntil < now` رد می‌کند ⇒ کوپن از ۰۳:۳۰ِ صبحِ
 * تهران در همان روزی که مالک «آخرین روزِ اعتبار» انتخاب کرده بود، منقضی می‌شد.
 * حالا تاریخِ خالی = پایانِ همان روز به وقتِ رستوران. مقدارِ بدشکل پیش‌تر
 * `Invalid Date` به Prisma می‌داد (۵۰۰)؛ حالا ۴۲۲.
 */
function couponValidUntil(raw: string | undefined, timezone: string): Date | null {
  if (!raw) return null;
  const v = toAsciiDigits(raw.trim());
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const next = new Date(Date.parse(`${v}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const end = zonedTimeToUtc(next, '00:00', timezone).getTime() - 1;
    if (Number.isFinite(end)) return new Date(end);
  } else {
    const d = new Date(v);
    if (Number.isFinite(d.getTime())) return d;
  }
  throw Err.validation('valid_until: تاریخ نامعتبر است');
}

const SEGMENTS = ['new_customer', 'active', 'at_risk', 'churned', 'vip'] as const;

const createSchema = z.object({
  kind: z.enum(['percent', 'fixed', 'free_item'] as const),
  value: z.number().int().min(0).optional(),
  code: z.string().min(1).max(30).optional(),
  free_menu_item_id: zUuid.optional(),
  min_party_size: z.number().int().min(1).max(30).optional(),
  max_redemptions: z.number().int().min(1).optional(),
  per_user_limit: z.number().int().min(1).max(1000).optional(),
  target_segment: z.enum(SEGMENTS).optional(),
  valid_until: z.string().max(40).optional(),
});

export const GET = withRestaurantAuth({ permission: 'canManageCoupons' }, async (_req, ctx) => {
  const coupons = await db.coupon.findMany({
    where: { restaurantId: ctx.restaurant.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } } },
  });
  return NextResponse.json({
    items: coupons.map(c => ({
      id: c.id, code: c.code, kind: c.kind, value: c.value,
      max_redemptions: c.maxRedemptions, redemption_count: c.redemptionCount,
      per_user_limit: c.perUserLimit, target_segment: c.targetSegment,
      valid_from: c.validFrom, valid_until: c.validUntil, is_active: c.isActive,
    })),
  });
});

// POST — ساخت کوپن جدید · بدنه: { kind, value, code?, min_party_size?, max_redemptions?, per_user_limit?, target_segment?, valid_until? }
export const POST = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageCoupons' }, async (req, ctx) => {
  const b = await parseBody(req, createSchema);
  if (b.kind !== 'free_item' && (!b.value || b.value <= 0)) throw Err.validation('مقدار تخفیف نامعتبر است');
  if (b.kind === 'percent' && b.value! > 100) throw Err.validation('درصد تخفیف نمی‌تواند بیش از ۱۰۰ باشد');

  const validUntil = couponValidUntil(b.valid_until, ctx.restaurant.timezone || 'Asia/Tehran');
  const code = (b.code || genCouponCode(ctx.restaurant.name.slice(0, 4))).toUpperCase().slice(0, 30);
  const coupon = await db.coupon.create({
    data: {
      restaurantId: ctx.restaurant.id, code, kind: b.kind, value: b.value || 0,
      freeMenuItemId: b.free_menu_item_id || null,
      minPartySize: b.min_party_size || null,
      maxRedemptions: b.max_redemptions ?? null,
      perUserLimit: b.per_user_limit ?? 1,
      targetSegment: b.target_segment || null,
      validUntil,
    },
  });
  return NextResponse.json({ id: coupon.id, code: coupon.code }, { status: 201 });
});
