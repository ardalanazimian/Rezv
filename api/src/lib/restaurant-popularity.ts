import { db } from './db';
import { VISITED_RESERVATION_STATUSES } from './reservation-status';
import { Prisma } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════
//  بازمحاسبه‌ی `restaurants.visits_7d` — مبنایِ رتبه‌بندیِ فیدِ عمومی
//
//  ⚠️ چرا این ستون وجود دارد (مهاجرتِ ۰۷۳): فیدِ اپِ مشتری عنوانِ
//  «🔥 محبوب امشب» دارد ولی ترتیبش `orderBy: { id: 'desc' }` بود — و `id`
//  یک UUID است، یعنی عملاً تصادفی. سیگنالِ واقعی از قبل حساب می‌شد و روی
//  کارت‌ها هم نشان داده می‌شد، فقط **بعد از** صفحه‌بندی، پس نمی‌توانست
//  مبنایِ مرتب‌سازی باشد.
//
//  ⚠️ تعریفِ «محبوبیت» اینجا عمداً همان چیزی است که روی کارت نوشته می‌شود:
//  رزروهایی که در ۷ روزِ گذشته **واقعاً به حضور رسیده‌اند**
//  (`VISITED_RESERVATION_STATUSES`). نه رزروِ ثبت‌شده، نه بازدیدِ صفحه —
//  چون آن دو را می‌شود ارزان جعل کرد و این عدد مستقیماً روی چیزی اثر
//  می‌گذارد که مهمان می‌بیند. ثابت از `reservation-status.ts` می‌آید تا با
//  عددِ نمایش‌داده‌شده روی کارت واگرا نشود.
//
//  ⚠️ تازگی، صادقانه: از جابِ شبانه‌ی `customer-insights` (۰۳:۰۰) صدا زده
//  می‌شود، پس تا ۲۴ ساعت کهنه است. برای یک شمارشِ ۷ روزه‌ی غلتان بی‌اهمیت
//  است (عدد در طولِ یک روز جهش نمی‌کند)، ولی ادعای «همین لحظه» نیست.
//
//  یک `UPDATE` روی کلِ جدول است، نه حلقه‌ای per-restaurant: هم اتمیک‌تر و
//  هم برایِ چند هزار رستوران یک رفت‌وبرگشت.
// ═══════════════════════════════════════════════════════════════════════

/**
 * `visits_7d` هر رستوران را از رویِ رزروهای واقعی بازمحاسبه می‌کند.
 * @returns تعداد ردیف‌هایی که مقدارشان عوض شد.
 */
export async function recomputeRestaurantPopularity(): Promise<number> {
  const statuses = Prisma.join(
    VISITED_RESERVATION_STATUSES.map((s) => Prisma.sql`${s}::text`),
  );

  // ⚠️ `WHERE r.visits_7d IS DISTINCT FROM ...` عمدی است: فقط ردیف‌هایی که
  // واقعاً عوض شده‌اند نوشته می‌شوند. هم خروجیِ قابلِ‌گزارش می‌دهد و هم روی
  // جدولی که اکثرِ ردیف‌هایش ثابت‌اند، bloat و WALِ بی‌مورد نمی‌سازد.
  const rows = await db.$executeRaw`
    UPDATE restaurants r
       SET visits_7d = COALESCE(v.c, 0)
      FROM (
        SELECT id AS restaurant_id,
               (SELECT COUNT(*)::int
                  FROM reservations res
                 WHERE res.restaurant_id = restaurants.id
                   AND res.status::text IN (${statuses})
                   AND res.slot_start >= now() - interval '7 days'
                   AND res.slot_start <= now()) AS c
          FROM restaurants
      ) v
     WHERE v.restaurant_id = r.id
       AND r.visits_7d IS DISTINCT FROM COALESCE(v.c, 0)
  `;
  return rows;
}
