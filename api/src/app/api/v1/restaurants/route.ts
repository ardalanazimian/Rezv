import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { cached, cacheKey } from '@/lib/cache';
import { errorResponse } from '@/lib/errors';
import { parseQuery, zUuid, z } from '@/lib/schemas';
import { visitedStatusList } from '@/lib/reservation-status';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════
//  GET /api/v1/restaurants — لیست رستوران‌ها
//  بهینه‌شده برای ۱۰۰هزار رستوران و ۵۰۰ req/s:
//   • Pagination با cursor (نه offset — در جدول بزرگ offset کند است)
//   • Cache با Redis (لیست رستوران‌ها کم تغییر می‌کند → TTL کوتاه)
//   • select محدود (فقط فیلدهای لازم برای کارت)
// ═══════════════════════════════════════════════════════════

const PAGE_SIZE = 24; // اندازه‌ی صفحه (مناسب grid موبایل)

const querySchema = z.object({
  vibe: z.string().min(1).max(50).optional(),
  city: z.string().min(1).max(100).optional(),      // فیلترِ شهر (صفحاتِ SEO /city/{c})
  cuisine: z.string().min(1).max(100).optional(),   // فیلترِ آشپزی (صفحاتِ SEO /cuisine/{c})
  cursor: zUuid.optional(),
});

async function GET_impl(req: Request) {
  try {
    const { vibe, city, cuisine, cursor } = parseQuery(req, querySchema);

    // کلید cache بر اساس فیلترها و صفحه
    const key = cacheKey('restaurants', vibe || 'all', city || 'all', cuisine || 'all', cursor || 'first');

    // cache 60 ثانیه — لیست رستوران‌ها لحظه‌ای تغییر نمی‌کند
    // (تغییر وضعیت آنلاین/آفلاین حداکثر ظرف ۶۰ ثانیه در اپ مشتری دیده می‌شود)
    const result = await cached(key, 60, async () => {
      // آستانه‌ی آنلاین‌بودن: heartbeat باید در ۹۰ ثانیه‌ی اخیر باشد.
      const onlineThreshold = new Date(Date.now() - 90_000);
      const items = await db.restaurant.findMany({
        where: {
          isOpen: true,
          ...(vibe ? { vibes: { has: vibe } } : {}),
          ...(city ? { city } : {}),
          ...(cuisine ? { cuisine } : {}),
          // اتصال: یا gating خاموش است، یا اخیراً heartbeat داشته (آنلاین است).
          // رستورانی که اینترنتش قطع شده از لیست مشتری پنهان می‌شود تا رزرو آنلاینِ
          // متضاد با ثبت حضوریِ آفلاین پیش نیاید.
          OR: [
            { onlineGating: false },
            { lastSeenAt: { gte: onlineThreshold } },
          ],
        },
        // latitude/longitude لازم‌اند تا اپ مشتری فاصله را واقعاً حساب کند؛
        // پیش از این عددِ «۰٫۷ کیلومتر» در فرانت ساخته می‌شد و هیچ ربطی به
        // موقعیتِ واقعی نداشت.
        // ⚠️ تکمیلِ P1-3: cancellationPolicy اینجا هم لازم است، نه فقط در
        // endpointِ جزئیات. علتش یک واقعیتِ سنجیده‌شده است: اپِ مشتری **هرگز**
        // `/restaurants/{slug}` را صدا نمی‌زند (grepِ کاملِ apps/customer: صفر)؛
        // کلِ آرایه‌ی R از همین لیست ساخته می‌شود. بدونِ این خط،
        // `depositRequired` همیشه null می‌ماند و depositLabel() برایِ هر
        // رستورانی سکوت می‌کند — یعنی دروغ برداشته می‌شد ولی حقیقت هم گفته نمی‌شد.
        select: {
          id: true, slug: true, name: true, cuisine: true, city: true, vibes: true,
          priceBand: true, cbBasePct: true, latitude: true, longitude: true,
          cancellationPolicy: { select: { depositRequired: true, freeCancelHours: true, autoConfirm: true } },
        },
        orderBy: { id: 'desc' },           // ترتیب پایدار برای cursor
        take: PAGE_SIZE + 1,                // یکی بیشتر بگیر تا بفهمی صفحه‌ی بعد هست
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > PAGE_SIZE;
      const page = hasMore ? items.slice(0, PAGE_SIZE) : items;
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      // ── سیگنال‌های اجتماعی، همه از دادهٔ واقعی ──
      // سه کوئریِ گروهیِ موازی، هر سه محدود به همین صفحه (scale-safe).
      // اپ مشتری پیش از این هر سه را در فرانت از روی امتیاز «تخمین» می‌زد؛
      // عددِ ساختگی روی صفحه‌ای که کارش جلبِ اعتماد است، خودش ضدِ هدف است.
      const ids = page.map(p => p.id);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);
      const [ratingRows, recommendRows, visitRows] = ids.length
        ? await Promise.all([
            db.review.groupBy({
              by: ['restaurantId'],
              where: { restaurantId: { in: ids }, isPublished: true },
              _avg: { rating: true }, _count: true,
            }),
            // «پیشنهاد می‌کنند» = سهمِ نظرهای ۴ و ۵ ستاره از کلِ نظرها
            db.review.groupBy({
              by: ['restaurantId'],
              where: { restaurantId: { in: ids }, isPublished: true, rating: { gte: 4 } },
              _count: true,
            }),
            // «این هفته» = رزروهایی که در ۷ روزِ گذشته به حضور رسیده‌اند
            db.reservation.groupBy({
              by: ['restaurantId'],
              where: {
                restaurantId: { in: ids },
                status: { in: visitedStatusList() as never[] },
                slotStart: { gte: weekAgo, lte: new Date() },
              },
              _count: true,
            }),
          ])
        : [[], [], []];

      const ratingMap = new Map(ratingRows.map(r => [r.restaurantId, { avg: r._avg.rating, count: r._count }]));
      const recommendMap = new Map(recommendRows.map(r => [r.restaurantId, Number(r._count)]));
      const visitMap = new Map(visitRows.map(r => [r.restaurantId, Number(r._count)]));

      const pageWithSignals = page.map(p => {
        const rt = ratingMap.get(p.id);
        const total = rt?.count ?? 0;
        const liked = recommendMap.get(p.id) ?? 0;
        // cancellationPolicy یک آبجکتِ رابطه‌ای است؛ به‌جایِ نشتِ شکلِ Prisma به
        // پاسخِ عمومی، همان قراردادِ booking_policy را می‌سازیم که endpointِ
        // جزئیات هم می‌دهد — یک شکل، دو مسیر (§۲۰ قراردادِ واحد).
        const { cancellationPolicy, ...rest } = p;
        return {
          ...rest,
          booking_policy: {
            deposit_required: cancellationPolicy?.depositRequired ?? false,
            free_cancel_hours: cancellationPolicy?.freeCancelHours ?? 24,
            auto_confirm: cancellationPolicy?.autoConfirm ?? true,
          },
          rating: rt?.avg ? Math.round(rt.avg * 10) / 10 : null,
          reviews_count: total,
          // null یعنی «هنوز نمی‌دانیم» — نه صفر و نه عددِ ساختگی. اپ مشتری در
          // این حالت اصلاً ادعایی نشان نمی‌دهد.
          recommend_pct: total >= 5 ? Math.round((liked / total) * 100) : null,
          visits_7d: visitMap.get(p.id) ?? 0,
        };
      });

      return { items: pageWithSignals, next_cursor: nextCursor, has_more: hasMore };
    });

    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/restaurants', GET_impl);
