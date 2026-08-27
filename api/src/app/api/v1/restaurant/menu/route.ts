import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, zUuid, z } from '@/lib/schemas';
import { publicMenuUrl } from '@/lib/public-urls';
import { invalidatePublicMenu } from '@/lib/menu-cache';
import { resolveCategory } from '@/lib/menu-category';

// ═══════════════════════════════════════════════════════════════════════
//  مدیریتِ منو — پنلِ بیزنس
//
//  چرا این روت تازه ساخته شد (ممیزیِ ۲۰۲۶-۰۸-۱۹): مدلِ MenuItem از ابتدا
//  وجود داشت و در چند جا *خوانده* و *مصرف* می‌شد (صفحه‌ی عمومیِ رستوران،
//  پیش‌سفارشِ رزرو، گزارشِ پرفروش‌ها، محاسبه‌ی مبلغ در customer-insights)،
//  ولی هیچ‌جا ساخته نمی‌شد جز prisma/seed.ts. یعنی هر رستورانِ واقعی برایِ
//  همیشه منوی خالی داشت و چون تنها منبعِ مبلغ در رزرونو پیش‌سفارش از منوست،
//  زنجیره‌ی پیش‌سفارش→مبلغ→CLV هرگز داده‌ای نمی‌گرفت.
//
//  تفاوت با خواندنِ عمومی: `GET /v1/restaurants/[slug]` فقط آیتم‌هایِ
//  `isActive` را به مشتری می‌دهد. این روت متعلق به خودِ رستوران است و
//  آیتم‌هایِ غیرفعال را هم برمی‌گرداند تا در پنل قابلِ مدیریت باشند.
// ═══════════════════════════════════════════════════════════════════════

// ⚠️ `image_url` عمداً در این schema **نیست**.
//
// مهاجرتِ ۰۵۲ این فیلد را به‌صورتِ آدرسِ آزادِ کلاینت پذیرفت. مهاجرتِ ۰۵۳
// آن را به یک فیلدِ سرورنوشت تبدیل کرد: تنها راهِ عکس‌دار‌کردنِ آیتم
// `POST /restaurant/menu/{id}/photo` است که فایل را با تشخیصِ magic-byte،
// سقفِ حجم و ابعاد اعتبارسنجی می‌کند و روی ذخیره‌سازیِ خودمان می‌نشاند.
//
// چرا برگشت: آدرسِ آزاد یعنی (۱) هیچ تضمینی نیست محتوایش تصویر باشد،
// (۲) منویِ روی میز به میزبانِ بیرونی وابسته می‌شود که هر وقت پایین بیاید
// عکسِ شکسته نشان می‌دهد، (۳) هیچ نظارتی ممکن نیست.
const createSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  price_toman: z.number().int().min(0).max(1_000_000_000),
  emoji: z.string().max(16).optional(),
  category: z.string().max(60).trim().optional(),
  // ۰۷۷ — دسته‌ی رابطه‌ای؛ اگر بیاید بر رشته‌ی category برتری دارد.
  category_id: zUuid.nullable().optional(),
  is_out_of_stock: z.boolean().optional(),
  is_active: z.boolean().optional(),
  description: z.string().max(300).trim().optional(),
  sort_order: z.number().int().min(0).max(100_000).optional(),
});


/** GET — همه‌ی آیتم‌هایِ منویِ این رستوران (شاملِ غیرفعال‌ها، برایِ مدیریت در پنل) */
export const GET = withRestaurantAuth({ permission: 'canManageSettings' }, async (_req, ctx) => {
  // slug برایِ ساختنِ آدرسِ عمومی لازم است و در ctx نیست.
  const r = await db.restaurant.findUnique({
    where: { id: ctx.restaurant.id },
    select: { slug: true },
  });

  const items = await db.menuItem.findMany({
    // فیلترِ restaurantId از ctx می‌آید (که withRestaurantAuth آن را از توکن/هدر
    // با چکِ مالکیتِ تنانت رزولو کرده) — هرگز از ورودیِ کلاینت.
    where: { restaurantId: ctx.restaurant.id },
    // همان ترتیبی که مشتری در منویِ عمومی می‌بیند (sortOrder، سپس نام)، تا
    // رستوران‌دار در پنل دقیقاً چیدمانِ واقعی را ببیند نه ترتیبِ فروش.
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true, name: true, emoji: true, priceToman: true,
      isActive: true, soldCount: true, category: true,
      categoryId: true, isOutOfStock: true,
      availability: true, tags: { select: { tag: true } },
      description: true, imageUrl: true, sortOrder: true,
    },
  });
  // ۰۷۷ — دسته‌ها (همه، حتی غیرفعال‌ها: پنل باید بتواند برشان گرداند)
  const cats = await db.menuCategory.findMany({
    where: { restaurantId: ctx.restaurant.id },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, sortOrder: true, isActive: true },
  });
  return NextResponse.json({
    items: items.map(m => ({
      id: m.id, name: m.name, emoji: m.emoji, price_toman: m.priceToman,
      is_active: m.isActive, sold_count: m.soldCount, category: m.category,
      category_id: m.categoryId, is_out_of_stock: m.isOutOfStock,
      availability: m.availability, tags: m.tags.map(t => t.tag),
      description: m.description, image_url: m.imageUrl, sort_order: m.sortOrder,
    })),
    categories: cats.map(c => ({
      id: c.id, name: c.name, sort_order: c.sortOrder, is_active: c.isActive,
    })),
    // آدرسِ عمومی از سرور می‌آید، نه ساختِ رشته در پنل — همان آدرسی که
    // داخلِ QR هم می‌رود، پس «لینکی که کپی می‌کنی» و «QRی که چاپ می‌کنی»
    // نمی‌توانند از هم بیفتند.
    public_menu_url: r?.slug ? publicMenuUrl(r.slug) : null,
  });
});

/** POST — افزودنِ آیتمِ تازه به منو */
export const POST = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageSettings' }, async (req, ctx) => {
  const b = await parseBody(req, createSchema);

  // نامِ تکراری در همان رستوران جلوگیری می‌شود: دو آیتمِ هم‌نام در منو یعنی
  // رستوران‌دار نمی‌فهمد کدام را ویرایش می‌کند و گزارشِ پرفروش‌ها هم دوپاره می‌شود.
  const dup = await db.menuItem.findFirst({
    where: { restaurantId: ctx.restaurant.id, name: b.name },
    select: { id: true },
  });
  if (dup) throw Err.validation('آیتمی با همین نام در منو هست');

  const cat = await resolveCategory(ctx.restaurant.id, b);

  const item = await db.menuItem.create({
    data: {
      restaurantId: ctx.restaurant.id,
      name: b.name,
      priceToman: b.price_toman,
      emoji: b.emoji || null,
      category: cat.category,
      categoryId: cat.categoryId,
      isOutOfStock: b.is_out_of_stock ?? false,
      isActive: b.is_active ?? true,
      description: b.description || null,
      // imageUrl عمداً اینجا ست نمی‌شود — فقط روتِ آپلودِ عکس آن را می‌نویسد.
      sortOrder: b.sort_order ?? 0,
    },
    select: {
      id: true, name: true, priceToman: true, category: true, categoryId: true,
      isOutOfStock: true, isActive: true,
      description: true, imageUrl: true, sortOrder: true,
    },
  });

  await invalidatePublicMenu(ctx.restaurant.id);
  return NextResponse.json({
    id: item.id, name: item.name, price_toman: item.priceToman,
    category: item.category, category_id: item.categoryId,
    is_out_of_stock: item.isOutOfStock, is_active: item.isActive,
    description: item.description, image_url: item.imageUrl, sort_order: item.sortOrder,
  }, { status: 201 });
});
