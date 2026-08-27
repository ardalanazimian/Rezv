import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { invalidatePublicMenu } from '@/lib/menu-cache';

const idParamSchema = z.object({ id: zUuid });

const patchSchema = z.object({
  name: z.string().min(1).max(60).trim().optional(),
  sort_order: z.number().int().min(0).max(100_000).optional(),
  is_active: z.boolean().optional(),
});

/**
 * دسته را با چکِ مالکیت پیدا می‌کند (همان الگوی ضدِ IDORِ menu/[id]):
 * پیامِ خطا عمداً «یافت نشد» است تا وجود/عدمِ وجودِ id لو نرود.
 */
async function findOwnedCategory(id: string, restaurantId: string) {
  const cat = await db.menuCategory.findUnique({
    where: { id },
    select: { id: true, restaurantId: true, name: true, isActive: true },
  });
  if (!cat || cat.restaurantId !== restaurantId) throw Err.notFound('دسته‌ی منو');
  return cat;
}

/** PATCH — تغییرِ نام / ترتیب / فعال‌بودنِ دسته. */
export const PATCH = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const cat = await findOwnedCategory(id, ctx.restaurant.id);

  const b = await parseBody(req, patchSchema);
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.sort_order !== undefined) data.sortOrder = b.sort_order;
  if (b.is_active !== undefined) data.isActive = b.is_active;
  if (Object.keys(data).length === 0) throw Err.validation('چیزی برای تغییر فرستاده نشده');

  if (b.name !== undefined && b.name !== cat.name) {
    const dup = await db.menuCategory.findFirst({
      where: { restaurantId: ctx.restaurant.id, name: b.name, id: { not: id } },
      select: { id: true },
    });
    if (dup) throw Err.validation('دسته‌ی دیگری با همین نام هست');
  }

  // rename → میرورِ متنیِ آیتم‌های همین دسته هم در **همان تراکنش** عوض
  // می‌شود؛ وگرنه مصرف‌کننده‌های قدیمی (SEO/مشتری) نامِ کهنه را گروه می‌کردند.
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.menuCategory.update({
      where: { id },
      data,
      select: { id: true, name: true, sortOrder: true, isActive: true },
    });
    if (b.name !== undefined && b.name !== cat.name) {
      await tx.menuItem.updateMany({
        where: { restaurantId: ctx.restaurant.id, categoryId: id },
        data: { category: b.name },
      });
    }
    return u;
  });

  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({
    id: updated.id, name: updated.name, sort_order: updated.sortOrder, is_active: updated.isActive,
  });
});

/**
 * DELETE — حذفِ نرم (is_active=false).
 *
 * چرا نرم و نه حذفِ سخت: آیتم‌های دسته باید بمانند (فقط در نمایشِ عمومی
 * «دسته‌نشده» می‌شوند) و برگرداندنِ دسته با یک PATCH ممکن باشد. میرورِ
 * متنیِ آیتم‌ها عمداً دست نمی‌خورد — نامِ تاریخی برای مصرف‌کننده‌های قدیمی
 * معنادار می‌ماند و منبعِ حقیقتِ سکشن‌بندیِ جدید آرایه‌ی categories است.
 */
export const DELETE = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (_req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const cat = await findOwnedCategory(id, ctx.restaurant.id);

  if (!cat.isActive) {
    // دوباره‌حذف خطا نیست، ولی «موفقیتِ بی‌صدا» هم نباید باشد.
    return NextResponse.json({ id, archived: true, message: 'این دسته از قبل غیرفعال بود.' });
  }

  await db.menuCategory.update({ where: { id }, data: { isActive: false } });
  const itemCount = await db.menuItem.count({ where: { restaurantId: ctx.restaurant.id, categoryId: id } });

  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({
    id, archived: true, item_count: itemCount,
    message: itemCount > 0
      ? `دسته‌ی «${cat.name}» غیرفعال شد؛ ${itemCount} آیتمش در منو ماند (به‌صورتِ دسته‌نشده نمایش داده می‌شوند).`
      : `دسته‌ی «${cat.name}» غیرفعال شد.`,
  });
});
