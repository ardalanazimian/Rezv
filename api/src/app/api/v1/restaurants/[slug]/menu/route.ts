import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, z } from '@/lib/schemas';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { filterAvailableNow } from '@/lib/menu-availability';

import { withApiMetrics } from '@/lib/api-metrics';

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

async function GET_impl(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    const { slug } = parseParams(await params, paramsSchema);

    // TTL ۶۰→۳۰۰ (SPEC-A فاز ۲ — B1): حالا که هر mutation منو کش را فعالانه
    // باطل می‌کند (invalidatePublicMenu از ۰۷۷)، TTLِ بلندتر فقط بارِ DB را
    // کم می‌کند؛ تازگی از invalidation می‌آید، نه از انقضا.
    const data = await cached(cacheKey('restaurant-public-menu', slug), 300, async () => {
      const r = await db.restaurant.findUnique({
        where: { slug },
        select: {
          // فیلدهایِ عمومیِ لازم برایِ سرصفحه‌ی صفحه‌ی منو — نه بیشتر.
          // هیچ فیلدِ کارکنان/داخلی اینجا نمی‌آید.
          id: true, slug: true, name: true, cuisine: true, city: true,
          // ۰۷۸ — برای فیلترِ پنجره‌ی پس-از-کش لازم است (داخلِ payloadِ کش).
          timezone: true,
          // شخصی‌سازیِ صفحه‌ی منو (مهاجرتِ ۰۵۳). NULL = انتخاب‌نشده →
          // صفحه به پیش‌فرضِ پلتفرم برمی‌گردد.
          menuAccent: true, menuTheme: true, menuTagline: true, menuLayout: true,
          // ۰۷۷ — دسته‌های فعال برای سکشن‌بندیِ ساخت‌یافته. آیتمِ دسته‌ی
          // غیرفعال حذف نمی‌شود؛ فقط در نمایش «دسته‌نشده» می‌شود.
          menuCategories: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, sortOrder: true },
          },
          menuItems: {
            where: { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: {
              id: true, name: true, emoji: true, priceToman: true,
              category: true, categoryId: true, isOutOfStock: true,
              availability: true, tags: { select: { tag: true } },
              // ۰۷۸ — افزودنی‌ها فقط برای نمایش (صفحه‌ی QR)؛ گزینه‌های فعال.
              modifierGroups: {
                orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                select: {
                  id: true, name: true, minSelect: true, maxSelect: true,
                  options: {
                    where: { isActive: true },
                    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
                    select: { id: true, name: true, priceDeltaToman: true },
                  },
                },
              },
              description: true, imageUrl: true, sortOrder: true,
            },
          },
        },
      });
      if (!r) return null;

      return {
        restaurant: {
          id: r.id, slug: r.slug, name: r.name, cuisine: r.cuisine, city: r.city,
          timezone: r.timezone,
          menu_accent: r.menuAccent, menu_theme: r.menuTheme,
          menu_tagline: r.menuTagline, menu_layout: r.menuLayout,
        },
        // ۰۷۷ — سکشن‌بندیِ ساخت‌یافته (فقط افزودنی؛ فیلدهای قبلی دست‌نخورده
        // تا مصرف‌کننده‌ی متنیِ موجود — groupByCategoryِ SEO — نشکند).
        categories: r.menuCategories.map((c) => ({
          id: c.id, name: c.name, sort_order: c.sortOrder,
        })),
        // آرایه‌ی خالی یعنی «این رستوران هنوز منو ثبت نکرده» — یک حالتِ
        // کاملاً معتبر، نه خطا. کلاینت باید حالتِ خالیِ صادق نشان دهد، نه
        // منویِ نمونه (همان اشتباهی که در رویدادهای اپِ مشتری رخ داده بود).
        // «ناموجود» عمداً برمی‌گردد (با فلگ) — نمایش با برچسب، نه حذف.
        items: r.menuItems.map((m) => ({
          id: m.id, name: m.name, emoji: m.emoji, price_toman: m.priceToman,
          category: m.category, category_id: m.categoryId,
          is_out_of_stock: m.isOutOfStock,
          availability: m.availability, tags: m.tags.map(t => t.tag),
          modifiers: m.modifierGroups.map(g => ({
            id: g.id, name: g.name, min_select: g.minSelect, max_select: g.maxSelect,
            options: g.options.map(o => ({ id: o.id, name: o.name, price_delta_toman: o.priceDeltaToman })),
          })),
          description: m.description,
          image_url: m.imageUrl, sort_order: m.sortOrder,
        })),
      };
    });

    if (!data) throw Err.notFound('رستوران');
    // ۰۷۸ — فیلترِ پنجره‌ی دسترسی **پس از** خواندنِ کش (B6): کش کامل است،
    // سرو فیلترشده — وگرنه مرزِ پنجره تا سررسیدِ TTLِ ۳۰۰ ثانیه دروغ می‌گفت.
    if (Array.isArray(data.items) && data.items.length) {
      data.items = filterAvailableNow(data.items, data.restaurant?.timezone || 'Asia/Tehran');
    }
    return NextResponse.json(data);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/restaurants/[slug]/menu', GET_impl);
