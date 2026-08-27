import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { invalidatePublicMenu } from '@/lib/menu-cache';

// ═══════════════════════════════════════════════════════════════════════
//  افزودنی‌های یک آیتمِ منو (SPEC-A فاز ۲ / ۰۷۸) — فهرست و ساختِ گروه
//
//  «گروه» = یک پرسش از مهمان («سایز؟»، «افزودنی‌ها؟») با سقف/کفِ انتخاب؛
//  «گزینه» = پاسخ‌های ممکن با اختلافِ قیمت. در این فاز فقط ساختارِ منوست
//  (نمایش در صفحه‌ی عمومی/QR)؛ به سفارش وصل نیست (§۲-۴ spec).
// ═══════════════════════════════════════════════════════════════════════

const idParamSchema = z.object({ id: zUuid });

const createGroupSchema = z.object({
  name: z.string().min(1).max(60).trim(),
  min_select: z.number().int().min(0).max(20).optional(),
  max_select: z.number().int().min(1).max(20).optional(),
  sort_order: z.number().int().min(0).max(100_000).optional(),
});

/** آیتم با چکِ مالکیت — پیامِ «یافت نشد» عمداً وجودِ id را لو نمی‌دهد. */
async function findOwnedItem(id: string, restaurantId: string) {
  const item = await db.menuItem.findUnique({
    where: { id },
    select: { id: true, restaurantId: true },
  });
  if (!item || item.restaurantId !== restaurantId) throw Err.notFound('آیتمِ منو');
  return item;
}

/** GET — همه‌ی گروه‌ها + گزینه‌هایشان (برای فرمِ پنل؛ شاملِ گزینه‌های غیرفعال). */
export const GET = withRestaurantAuth({ permission: 'canManageSettings' }, async (_req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  await findOwnedItem(id, ctx.restaurant.id);

  const groups = await db.menuModifierGroup.findMany({
    where: { menuItemId: id },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, minSelect: true, maxSelect: true, sortOrder: true,
      options: {
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, priceDeltaToman: true, isActive: true, sortOrder: true },
      },
    },
  });
  return NextResponse.json({
    groups: groups.map(g => ({
      id: g.id, name: g.name, min_select: g.minSelect, max_select: g.maxSelect, sort_order: g.sortOrder,
      options: g.options.map(o => ({
        id: o.id, name: o.name, price_delta_toman: o.priceDeltaToman,
        is_active: o.isActive, sort_order: o.sortOrder,
      })),
    })),
  });
});

/** POST — ساختِ گروهِ تازه برای این آیتم. */
export const POST = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx, rawParams: { id: string }) => {
  const { id } = parseParams(rawParams, idParamSchema);
  await findOwnedItem(id, ctx.restaurant.id);

  const b = await parseBody(req, createGroupSchema);
  const min = b.min_select ?? 0;
  const max = b.max_select ?? 1;
  if (max < min) throw Err.validation('سقفِ انتخاب نمی‌تواند از کفِ انتخاب کمتر باشد');

  const g = await db.menuModifierGroup.create({
    data: { menuItemId: id, name: b.name, minSelect: min, maxSelect: max, sortOrder: b.sort_order ?? 0 },
    select: { id: true, name: true, minSelect: true, maxSelect: true, sortOrder: true },
  });

  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({
    id: g.id, name: g.name, min_select: g.minSelect, max_select: g.maxSelect, sort_order: g.sortOrder,
    options: [],
  }, { status: 201 });
});
