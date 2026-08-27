import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { invalidatePublicMenu } from '@/lib/menu-cache';

// ═══════════════════════════════════════════════════════════════════════
//  دسته‌های منو — لیست و ساخت (SPEC-A فاز ۱، مهاجرتِ ۰۷۷)
//
//  تا ۰۷۷، «دسته» فقط یک رشته‌ی آزاد روی آیتم بود (datalistِ پیشنهادی در
//  پنل). این route دسته را موجودیتِ واقعی می‌کند: نامِ یکتا در رستوران،
//  ترتیبِ مستقل، و حذفِ نرم — تا منویِ عمومی/QR سکشن‌بندیِ قابلِ‌اتکا بگیرد.
//
//  ستونِ متنیِ MenuItem.category به‌عنوانِ میرورِ سازگاری می‌ماند و در
//  mutationهای آیتم/دسته سینک می‌شود (مصرف‌کننده‌های قدیمی نمی‌شکنند).
// ═══════════════════════════════════════════════════════════════════════

const createSchema = z.object({
  name: z.string().min(1).max(60).trim(),
  sort_order: z.number().int().min(0).max(100_000).optional(),
});

/** GET — همه‌ی دسته‌های این رستوران (شاملِ غیرفعال‌ها، برای مدیریت در پنل). */
export const GET = withRestaurantAuth({ permission: 'canManageSettings' }, async (_req, ctx) => {
  const cats = await db.menuCategory.findMany({
    where: { restaurantId: ctx.restaurant.id },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, sortOrder: true, isActive: true },
  });
  return NextResponse.json({
    categories: cats.map(c => ({
      id: c.id, name: c.name, sort_order: c.sortOrder, is_active: c.isActive,
    })),
  });
});

/** POST — ساختِ دسته‌ی تازه. */
export const POST = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx) => {
  const b = await parseBody(req, createSchema);

  // unique([restaurantId, name]) در DB هم هست؛ چکِ پیشاپیش برای پیامِ فارسیِ
  // مفهوم به‌جای خطای خامِ constraint.
  const dup = await db.menuCategory.findFirst({
    where: { restaurantId: ctx.restaurant.id, name: b.name },
    select: { id: true },
  });
  if (dup) throw Err.validation('دسته‌ای با همین نام از قبل هست');

  const cat = await db.menuCategory.create({
    data: {
      restaurantId: ctx.restaurant.id,
      name: b.name,
      sortOrder: b.sort_order ?? 0,
    },
    select: { id: true, name: true, sortOrder: true, isActive: true },
  });

  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({
    id: cat.id, name: cat.name, sort_order: cat.sortOrder, is_active: cat.isActive,
  }, { status: 201 });
});
