import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, z } from '@/lib/schemas';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/restaurants/{slug}/menu — منویِ عمومیِ یک رستوران
//
//  چرا جدا از `/restaurants/{slug}`: مصرف‌کننده‌ی اصلی‌اش صفحه‌ی منویِ QR است
//  که مهمان سرِ میز با دادهٔ موبایل باز می‌کند. پاسخِ کاملِ رستوران گالریِ
//  عکس، ساعتِ کاری، امتیاز و رستوران‌های مرتبط را هم دارد — چیزهایی که آن
//  صفحه اصلاً نشان نمی‌دهد. این نسخه فقط چیزی را می‌فرستد که رسم می‌شود.
//
//  هیچ منبعِ دادهٔ تازه‌ای نیست: همان MenuItem، همان فیلترِ isActive، همان
//  ترتیبِ sortOrder. یک منبعِ حقیقت، دو نمایِ متفاوت.
//
//  عمومی و بدونِ auth (مهمانِ سرِ میز حساب ندارد)، ولی rate-limit دارد چون
//  برخلافِ صفحه‌ی رستوران، آدرسش روی هر میز چاپ شده و قابلِ حدس‌زدن است.
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({ slug: z.string().min(1).max(150) });

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    const { slug } = parseParams(await params, paramsSchema);

    const data = await cached(cacheKey('restaurant-public-menu', slug), 60, async () => {
      const r = await db.restaurant.findUnique({
        where: { slug },
        select: {
          // فیلدهایِ عمومیِ لازم برایِ سرصفحه‌ی صفحه‌ی منو — نه بیشتر.
          // هیچ فیلدِ کارکنان/داخلی اینجا نمی‌آید.
          id: true, slug: true, name: true, cuisine: true, city: true,
          menuItems: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: {
              id: true, name: true, emoji: true, priceToman: true,
              category: true, description: true, imageUrl: true, sortOrder: true,
            },
          },
        },
      });
      if (!r) return null;

      return {
        restaurant: { id: r.id, slug: r.slug, name: r.name, cuisine: r.cuisine, city: r.city },
        // آرایه‌ی خالی یعنی «این رستوران هنوز منو ثبت نکرده» — یک حالتِ
        // کاملاً معتبر، نه خطا. کلاینت باید حالتِ خالیِ صادق نشان دهد، نه
        // منویِ نمونه (همان اشتباهی که در رویدادهای اپِ مشتری رخ داده بود).
        items: r.menuItems.map((m) => ({
          id: m.id, name: m.name, emoji: m.emoji, price_toman: m.priceToman,
          category: m.category, description: m.description,
          image_url: m.imageUrl, sort_order: m.sortOrder,
        })),
      };
    });

    if (!data) throw Err.notFound('رستوران');
    return NextResponse.json(data);
  } catch (e) { return errorResponse(e); }
}
