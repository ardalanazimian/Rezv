import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, zUuid, z } from '@/lib/schemas';
import { invalidatePublicMenu } from '@/lib/menu-cache';

// ═══════════════════════════════════════════════════════════════════════
//  مرتب‌سازیِ دسته‌ایِ منو (SPEC-A فاز ۱)
//
//  یک درخواست، ترتیبِ نهایی: پنل بعد از جابه‌جایی (دکمه‌های بالا/پایین)
//  کلِ ترتیبِ تازه را می‌فرستد، نه per-item PATCH — هم یک تراکنش است
//  (ترتیبِ نیمه‌اعمال‌شده نداریم) هم یک invalidate.
//
//  مالکیت: **همه‌ی** idها قبل از هر نوشتنی چک می‌شوند؛ حتی یک idِ بیگانه
//  کلِ درخواست را ۴۰۴ می‌کند (همان پیامِ «یافت نشد»ِ ضدِ IDOR — لو نمی‌رود
//  که id وجود دارد ولی مالِ دیگری است).
// ═══════════════════════════════════════════════════════════════════════

const entry = z.object({
  id: zUuid,
  sort_order: z.number().int().min(0).max(100_000),
});
const bodySchema = z.object({
  categories: z.array(entry).max(200).optional(),
  items: z.array(entry).max(200).optional(),
});

export const PATCH = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx) => {
  const b = await parseBody(req, bodySchema);
  const cats = b.categories ?? [];
  const items = b.items ?? [];
  if (cats.length === 0 && items.length === 0) {
    throw Err.validation('چیزی برای مرتب‌سازی فرستاده نشده');
  }

  // چکِ مالکیت — شمارش روی idهای یکتا تا idِ تکراری، چکِ مالکیت را دور نزند.
  const catIds = [...new Set(cats.map(c => c.id))];
  const itemIds = [...new Set(items.map(i => i.id))];
  if (catIds.length) {
    const owned = await db.menuCategory.count({ where: { id: { in: catIds }, restaurantId: ctx.restaurant.id } });
    if (owned !== catIds.length) throw Err.notFound('دسته‌ی منو');
  }
  if (itemIds.length) {
    const owned = await db.menuItem.count({ where: { id: { in: itemIds }, restaurantId: ctx.restaurant.id } });
    if (owned !== itemIds.length) throw Err.notFound('آیتمِ منو');
  }

  await db.$transaction([
    ...cats.map(c => db.menuCategory.update({ where: { id: c.id }, data: { sortOrder: c.sort_order } })),
    ...items.map(i => db.menuItem.update({ where: { id: i.id }, data: { sortOrder: i.sort_order } })),
  ]);

  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({ reordered: { categories: cats.length, items: items.length } });
});
