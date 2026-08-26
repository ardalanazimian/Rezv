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

/**
 * GET /api/v1/restaurant/branches — همه‌ی شعبه‌های این تنانت + شعبه‌ی فعلیِ این staff
 *
 * ═══ چرا این متد عمداً `permission:` ندارد (تصمیمِ ثبت‌شده، نه فراموشی) ═══
 *
 * در ممیزیِ RBAC علامت خورد چون `POST` همین فایل `canManageSettings` دارد و
 * `GET` ندارد. بررسی شد؛ برخلافِ خواهرهایش (photos/reviews/cashback/events که
 * همه بسته شدند) این یکی **باز می‌ماند**، به دلیلِ زیر:
 *
 *  • این یک endpointِ *context* است، نه داده‌ی کسب‌وکار: مصرف‌کننده‌اش
 *    `loadBranches()` در `apps/business/js/routing.js:57` است که در
 *    `staff-system.js` (خطوطِ ۵۰۱ و ۵۴۷) و `data.js:166` برایِ **هر** کاربرِ
 *    لاگین‌کرده و بدونِ هیچ چکِ مجوزی اجرا می‌شود — دقیقاً الگویِ heartbeat.
 *    اگر مجوز بگذاریم، سوییچرِ شعبه و مقداردهیِ اولیه‌ی
 *    `API.setActiveRestaurant(current_restaurant_id)` برایِ هر کارمندِ
 *    محدودشده ۴۰۳ می‌شود؛ یعنی بستنِ یک درِ کم‌ارزش به قیمتِ شکستنِ
 *    context در کلِ پنل.
 *
 *  • حساسیتِ خروجی پایین است: فقط `id/name/slug/is_open`ِ شعبه‌هایِ **تنانتِ
 *    خودِ همان کارمند** (`ctx.auth.tenantId`) — نه رزرو، نه مشتری، نه مالی، نه
 *    هیچ داده‌ی شخصی. مرزِ تنانت همچنان کاملاً اعمال می‌شود.
 *
 *  • عملیاتِ حساس (ساختِ شعبه) در `POST` است و آن `canManageSettings` دارد.
 *
 * ⚠️ این یک تصمیمِ محصولی است، نه یک واقعیتِ فنی — اگر مالکِ محصول بگوید
 *    کارمندِ محدود نباید فهرستِ شعبه‌ها را ببیند، رفعِ درست سمتِ پنل است
 *    (نخواندنِ این endpoint وقتی کاربر مجوز ندارد)، نه ۴۰۳ دادن به مسیری که
 *    پنل بی‌قید صدایش می‌زند.
 *    گاردِ خودکار: `tests/rbac-permission-coverage.test.mts` این فایل را در
 *    فهرستِ صریحِ استثناها دارد.
 */
export const GET = withRestaurantAuth(
  // بدونِ `permission:` — عمدی. دلیلِ کامل در بلوکِ بالا.
  { rateLimit: 'search' }, async (_req, ctx) => {
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
