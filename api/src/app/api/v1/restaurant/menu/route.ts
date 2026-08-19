import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

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

const createSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  price_toman: z.number().int().min(0).max(1_000_000_000),
  emoji: z.string().max(16).optional(),
  category: z.string().max(60).trim().optional(),
  is_active: z.boolean().optional(),
});

/** GET — همه‌ی آیتم‌هایِ منویِ این رستوران (شاملِ غیرفعال‌ها، برایِ مدیریت در پنل) */
export const GET = withRestaurantAuth({ permission: 'canManageSettings' }, async (_req, ctx) => {
  const items = await db.menuItem.findMany({
    // فیلترِ restaurantId از ctx می‌آید (که withRestaurantAuth آن را از توکن/هدر
    // با چکِ مالکیتِ تنانت رزولو کرده) — هرگز از ورودیِ کلاینت.
    where: { restaurantId: ctx.restaurant.id },
    orderBy: [{ category: 'asc' }, { soldCount: 'desc' }, { name: 'asc' }],
    select: {
      id: true, name: true, emoji: true, priceToman: true,
      isActive: true, soldCount: true, category: true,
    },
  });
  return NextResponse.json({
    items: items.map(m => ({
      id: m.id, name: m.name, emoji: m.emoji, price_toman: m.priceToman,
      is_active: m.isActive, sold_count: m.soldCount, category: m.category,
    })),
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

  const item = await db.menuItem.create({
    data: {
      restaurantId: ctx.restaurant.id,
      name: b.name,
      priceToman: b.price_toman,
      emoji: b.emoji || null,
      category: b.category || null,
      isActive: b.is_active ?? true,
    },
    select: { id: true, name: true, priceToman: true, category: true, isActive: true },
  });

  return NextResponse.json({
    id: item.id, name: item.name, price_toman: item.priceToman,
    category: item.category, is_active: item.isActive,
  }, { status: 201 });
});
