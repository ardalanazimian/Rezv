import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { invalidatePublicMenu } from '@/lib/menu-cache';

const idParamSchema = z.object({ id: zUuid });

const patchSchema = z.object({
  name: z.string().min(1).max(60).trim().optional(),
  price_delta_toman: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100_000).optional(),
});

/** مالکیتِ سه-hop: گزینه → گروه → آیتم → رستورانِ توکن (ضدِ IDOR). */
async function findOwnedOption(id: string, restaurantId: string) {
  const o = await db.menuModifierOption.findUnique({
    where: { id },
    select: {
      id: true, name: true, priceDeltaToman: true,
      group: { select: { menuItem: { select: { restaurantId: true, priceToman: true } } } },
    },
  });
  if (!o || o.group.menuItem.restaurantId !== restaurantId) throw Err.notFound('گزینه‌ی افزودنی');
  return o;
}

/** PATCH — ویرایشِ گزینه (نام/دلتا/فعال/ترتیب) با گاردِ قیمتِ منفیِ نهایی. */
export const PATCH = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const o = await findOwnedOption(id, ctx.restaurant.id);

  const b = await parseBody(req, patchSchema);
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.price_delta_toman !== undefined) data.priceDeltaToman = b.price_delta_toman;
  if (b.is_active !== undefined) data.isActive = b.is_active;
  if (b.sort_order !== undefined) data.sortOrder = b.sort_order;
  if (Object.keys(data).length === 0) throw Err.validation('چیزی برای تغییر فرستاده نشده');

  const delta = b.price_delta_toman ?? o.priceDeltaToman;
  if (o.group.menuItem.priceToman + delta < 0) {
    throw Err.validation(`با این تخفیف، قیمتِ نهاییِ آیتم منفی می‌شود (قیمتِ فعلی: ${o.group.menuItem.priceToman} تومان)`);
  }

  const u = await db.menuModifierOption.update({
    where: { id }, data,
    select: { id: true, name: true, priceDeltaToman: true, isActive: true, sortOrder: true },
  });
  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({
    id: u.id, name: u.name, price_delta_toman: u.priceDeltaToman,
    is_active: u.isActive, sort_order: u.sortOrder,
  });
});

/** DELETE — حذفِ گزینه. */
export const DELETE = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (_req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const o = await findOwnedOption(id, ctx.restaurant.id);
  await db.menuModifierOption.delete({ where: { id } });
  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({ id, message: `گزینه‌ی «${o.name}» حذف شد.` });
});
