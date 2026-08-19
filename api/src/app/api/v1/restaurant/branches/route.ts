import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

// ⚠️ همگام‌سازی‌شده با DB زنده (migration 018_staff_branch_scoping).
// این روت قبلاً اصلاً وجود نداشت — چندشعبه‌ای روی DB ساخته شده بود ولی هیچ
// endpoint‌ای برای دیدن/مدیریتِ شعبه‌ها نبود (رجوع کنید به یادداشت‌های تحقیق).

const createBranchSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  slug: z.string().min(1).max(100).trim().regex(/^[a-z0-9-]+$/, 'اسلاگ فقط حروف کوچک/عدد/خط‌تیره').optional(),
  cuisine: z.string().max(50).optional(),
});

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'branch';
}

/** پیشوندِ کدِ باشگاه از حروفِ لاتینِ نام مشتق می‌شود (fallback به BR اگر چیزی نماند). */
function clubPrefixFrom(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return (letters.slice(0, 3) || 'BR').padEnd(2, 'X');
}

/** GET /api/v1/restaurant/branches — همه‌ی شعبه‌های این تنانت + شعبه‌ی فعلیِ این staff */
export const GET = withRestaurantAuth({ rateLimit: 'search' }, async (_req, ctx) => {
  // نکته: withRestaurantAuth پیش از رسیدن به اینجا resolveStaffRestaurant را صدا زده
  // که برای auth.kind !== 'staff' خودش Err.forbidden پرتاب می‌کند؛ پس ctx.auth همیشه staff است.
  if (ctx.auth.kind !== 'staff') throw Err.forbidden();
  const branches = await db.restaurant.findMany({
    where: { tenantId: ctx.auth.tenantId },
    select: { id: true, name: true, slug: true, isOpen: true },
    orderBy: { createdAt: 'asc' },
  });
  const staff = await db.staff.findUnique({ where: { id: ctx.auth.sub }, select: { restaurantId: true } });
  return NextResponse.json({
    branches: branches.map(b => ({ id: b.id, name: b.name, slug: b.slug, is_open: b.isOpen })),
    current_restaurant_id: ctx.restaurant.id,
    // اگر locked باشد یعنی این staff نمی‌تواند از پنل شعبه عوض کند (UI باید سوییچر را مخفی کند)
    locked_to_branch: !!staff?.restaurantId,
  });
});

/** POST /api/v1/restaurant/branches — ساخت شعبه‌ی جدید برای همین تنانت (فقط owner/manager) */
export const POST = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'auth' }, async (req, ctx) => {
  if (ctx.auth.kind !== 'staff') throw Err.forbidden();
  const b = await parseBody(req, createBranchSchema);
  const slug = b.slug || slugify(b.name);

  const existing = await db.restaurant.findUnique({ where: { slug }, select: { id: true } });
  if (existing) throw Err.validation('این اسلاگ قبلاً استفاده شده؛ اسلاگ دیگری انتخاب کنید');

  const restaurant = await db.restaurant.create({
    data: {
      tenantId: ctx.auth.tenantId,
      name: b.name,
      slug,
      cuisine: b.cuisine,
      clubPrefix: clubPrefixFrom(b.name),
      smsBalance: 50,
    },
    select: { id: true, name: true, slug: true },
  });
  return NextResponse.json({ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }, { status: 201 });
});
