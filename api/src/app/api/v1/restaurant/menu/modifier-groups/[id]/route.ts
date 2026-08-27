import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { invalidatePublicMenu } from '@/lib/menu-cache';

const idParamSchema = z.object({ id: zUuid });

const patchSchema = z.object({
  name: z.string().min(1).max(60).trim().optional(),
  min_select: z.number().int().min(0).max(20).optional(),
  max_select: z.number().int().min(1).max(20).optional(),
  sort_order: z.number().int().min(0).max(100_000).optional(),
});

const optionSchema = z.object({
  name: z.string().min(1).max(60).trim(),
  price_delta_toman: z.number().int().min(-1_000_000_000).max(1_000_000_000).optional(),
  sort_order: z.number().int().min(0).max(100_000).optional(),
});

/**
 * گروه با چکِ مالکیتِ دو-hop (گروه → آیتم → رستورانِ توکن) — بدونِ این، با
 * حدسِ UUID می‌شد افزودنیِ منویِ رستورانِ دیگری را دید/برد (IDOR).
 * قیمتِ آیتم هم برمی‌گردد چون گاردِ «قیمتِ نهایی منفی نشود» لازمش دارد.
 */
async function findOwnedGroup(id: string, restaurantId: string) {
  const g = await db.menuModifierGroup.findUnique({
    where: { id },
    select: {
      id: true, name: true, minSelect: true, maxSelect: true,
      menuItem: { select: { id: true, restaurantId: true, priceToman: true } },
    },
  });
  if (!g || g.menuItem.restaurantId !== restaurantId) throw Err.notFound('گروهِ افزودنی');
  return g;
}

/** PATCH — ویرایشِ گروه (نام/کف/سقف/ترتیب). */
export const PATCH = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const g = await findOwnedGroup(id, ctx.restaurant.id);

  const b = await parseBody(req, patchSchema);
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) data.name = b.name;
  if (b.min_select !== undefined) data.minSelect = b.min_select;
  if (b.max_select !== undefined) data.maxSelect = b.max_select;
  if (b.sort_order !== undefined) data.sortOrder = b.sort_order;
  if (Object.keys(data).length === 0) throw Err.validation('چیزی برای تغییر فرستاده نشده');

  const min = b.min_select ?? g.minSelect;
  const max = b.max_select ?? g.maxSelect;
  if (max < min) throw Err.validation('سقفِ انتخاب نمی‌تواند از کفِ انتخاب کمتر باشد');

  const u = await db.menuModifierGroup.update({
    where: { id }, data,
    select: { id: true, name: true, minSelect: true, maxSelect: true, sortOrder: true },
  });
  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({
    id: u.id, name: u.name, min_select: u.minSelect, max_select: u.maxSelect, sort_order: u.sortOrder,
  });
});

/**
 * POST — افزودنِ گزینه به این گروه.
 * دلتای منفی مجاز است (تخفیف) ولی قیمتِ نهایی هرگز منفی نمی‌شود:
 * `item.priceToman + delta ≥ 0`. چکِ متقابلِ کاهشِ قیمتِ آیتم در menu/[id].
 */
export const POST = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const g = await findOwnedGroup(id, ctx.restaurant.id);

  const b = await parseBody(req, optionSchema);
  const delta = b.price_delta_toman ?? 0;
  if (g.menuItem.priceToman + delta < 0) {
    throw Err.validation(`با این تخفیف، قیمتِ نهاییِ آیتم منفی می‌شود (قیمتِ فعلی: ${g.menuItem.priceToman} تومان)`);
  }

  const o = await db.menuModifierOption.create({
    data: { groupId: id, name: b.name, priceDeltaToman: delta, sortOrder: b.sort_order ?? 0 },
    select: { id: true, name: true, priceDeltaToman: true, isActive: true, sortOrder: true },
  });
  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({
    id: o.id, name: o.name, price_delta_toman: o.priceDeltaToman,
    is_active: o.isActive, sort_order: o.sortOrder,
  }, { status: 201 });
});

/** DELETE — حذفِ سختِ گروه (+گزینه‌ها با Cascade). سفارشی به این‌ها وابسته نیست (B5). */
export const DELETE = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (_req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  const g = await findOwnedGroup(id, ctx.restaurant.id);
  await db.menuModifierGroup.delete({ where: { id } });
  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({ id, message: `گروهِ «${g.name}» و گزینه‌هایش حذف شد.` });
});
