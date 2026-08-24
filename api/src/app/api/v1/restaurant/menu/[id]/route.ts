import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

const idParamSchema = z.object({ id: zUuid });

const patchSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  price_toman: z.number().int().min(0).max(1_000_000_000).optional(),
  emoji: z.string().max(16).nullable().optional(),
  category: z.string().max(60).trim().nullable().optional(),
  is_active: z.boolean().optional(),
  // فیلدهایِ منویِ عمومی/QR (مهاجرتِ ۰۵۲). nullable چون «پاک‌کردنِ توضیح/عکس»
  // باید ممکن باشد — با فرستادنِ null، نه با رشته‌ی خالی.
  description: z.string().max(300).trim().nullable().optional(),
  // image_url اینجا نیست — عکس فقط از راهِ POST/DELETE روی `{id}/photo`
  // عوض می‌شود (اعتبارسنجیِ واقعیِ فایل). رجوع به مهاجرتِ ۰۵۳.
  sort_order: z.number().int().min(0).max(100_000).optional(),
});

/**
 * آیتم را با چکِ مالکیت پیدا می‌کند.
 * چرا جدا: هر دو متدِ این فایل باید *قبل از هر کاری* ثابت کنند این آیتم
 * واقعاً مالِ همان رستورانی است که توکن به آن دسترسی دارد — وگرنه با حدسِ
 * یک UUID می‌شد منویِ رستورانِ دیگری را ویرایش/حذف کرد (IDOR).
 * پیامِ خطا عمداً همان «یافت نشد» است تا وجود/عدمِ وجودِ id لو نرود.
 */
async function findOwnedItem(id: string, restaurantId: string) {
  const item = await db.menuItem.findUnique({
    where: { id },
    select: { id: true, restaurantId: true, name: true },
  });
  if (!item || item.restaurantId !== restaurantId) throw Err.notFound('آیتمِ منو');
  return item;
}

/** PATCH — ویرایشِ آیتمِ منو (نام، قیمت، ایموجی، دسته، فعال/غیرفعال) */
export const PATCH = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  await findOwnedItem(id, ctx.restaurant.id);

  const b = await parseBody(req, patchSchema);
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.price_toman !== undefined) data.priceToman = b.price_toman;
  if (b.emoji !== undefined) data.emoji = b.emoji;
  if (b.category !== undefined) data.category = b.category;
  if (b.is_active !== undefined) data.isActive = b.is_active;
  if (b.description !== undefined) data.description = b.description;
  if (b.sort_order !== undefined) data.sortOrder = b.sort_order;
  if (Object.keys(data).length === 0) throw Err.validation('چیزی برای تغییر فرستاده نشده');

  if (b.name !== undefined) {
    const dup = await db.menuItem.findFirst({
      where: { restaurantId: ctx.restaurant.id, name: b.name, id: { not: id } },
      select: { id: true },
    });
    if (dup) throw Err.validation('آیتمِ دیگری با همین نام در منو هست');
  }

  const updated = await db.menuItem.update({
    where: { id },
    data,
    select: {
      id: true, name: true, priceToman: true, emoji: true, category: true, isActive: true,
      description: true, imageUrl: true, sortOrder: true,
    },
  });

  return NextResponse.json({
    id: updated.id, name: updated.name, price_toman: updated.priceToman,
    emoji: updated.emoji, category: updated.category, is_active: updated.isActive,
    description: updated.description, image_url: updated.imageUrl, sort_order: updated.sortOrder,
  });
});

/**
 * DELETE — حذفِ آیتمِ منو.
 *
 * ⚠️ نکته‌ی دامنه‌ای: رابطه‌ی ReservationItem→MenuItem با `onDelete: Restrict`
 * تعریف شده، با این توضیحِ صریح در schema: «آیتمِ منویی که در سابقه‌ی سفارش
 * هست نباید حذف شود (یکپارچگیِ تاریخچه)». اگر آیتمی قبلاً پیش‌سفارش شده،
 * حذفِ سختش یعنی نابودیِ سابقه‌ی مبلغِ رزروهایِ گذشته — همان داده‌ای که
 * customer-insights برایِ محاسبه‌ی خرج و CLV به آن تکیه می‌کند.
 *
 * پس به‌جایِ شکستِ خام با خطایِ FK، وضعیت را *پیش از* حذف تشخیص می‌دهیم و:
 *   • بدونِ سابقه → حذفِ واقعی
 *   • با سابقه   → غیرفعال‌سازی (بایگانی) + پاسخِ صریح که چه شد و چرا
 * هیچ‌کدام بی‌صدا نیست؛ کلاینت با فیلدِ `archived` می‌فهمد کدام اتفاق افتاده.
 */
export const DELETE = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (_req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const item = await findOwnedItem(id, ctx.restaurant.id);

  const usedInOrders = await db.reservationItem.count({ where: { menuItemId: id } });

  if (usedInOrders > 0) {
    await db.menuItem.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({
      id, archived: true, used_in_orders: usedInOrders,
      message: `«${item.name}» در ${usedInOrders} پیش‌سفارشِ ثبت‌شده به‌کار رفته، پس برایِ حفظِ سابقه حذف نشد و فقط از منو برداشته شد (غیرفعال).`,
    });
  }

  await db.menuItem.delete({ where: { id } });
  return NextResponse.json({ id, archived: false, message: 'آیتم از منو حذف شد.' });
});
