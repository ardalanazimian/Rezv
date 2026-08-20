import { Prisma } from '@prisma/client';
import { db } from './db';

// ═══════════════════════════════════════════════════════════════════════
//  فازِ ۴ — تعریفِ یکتایِ ویژگی («سابقه‌ی مشتری»)
//
//  ⚠️ باگی که این فایل از آن زاده شد (ممیزیِ ۲۰۲۶-۰۸-۲۰): همین یک ویژگی دو
//  پیاده‌سازیِ مستقل داشت و آن دو با هم فرق داشتند —
//
//    آموزش (SQL در no-show-model.ts):
//      • h.restaurant_id = r.restaurant_id      ← فقط همین رستوران
//      • completions: completed, arrived, seated, dining
//
//    سرو (computeNoShowRisk در customer-insights.ts):
//      • where: { userId }                       ← کلِ پلتفرم، بدونِ فیلترِ رستوران
//      • completions: completed, arrived, seated ← «dining» جا افتاده بود
//
//  یعنی مدل روی «سابقه در *این* رستوران» یاد می‌گرفت ولی در لحظه‌ی تصمیم
//  «سابقه در *همه‌ی* رستوران‌ها» به آن داده می‌شد. این کلاسیک‌ترین شکلِ
//  training/serving skew است: مدل ورودی‌ای می‌بیند که هرگز رویش آموزش ندیده،
//  و هرچه پلتفرم بزرگ‌تر شود این فاصله بیشتر می‌شود.
//
//  ⚠️ صداقت درباره‌ی بزرگیِ اثر: در دیتابیسِ فعلی صفر رزروِ حل‌شده وجود دارد،
//  پس *اندازه‌ی* انحراف قابلِ اندازه‌گیری نیست. این نقص از رویِ کد اثبات
//  می‌شود، نه از رویِ داده — یعنی نهفته است، نه غایب. دقیقاً همان وضعیتی که
//  نشتِ زمانی (مهاجرتِ P0 قبلی) داشت.
//
//  چرا سرو به آموزش هم‌تراز شد و نه برعکس: مدلِ فعال روی سابقه‌ی per-restaurant
//  آموزش دیده. تنها راهِ درستِ سروکردنش همان است. اگر روزی تصمیم گرفتیم
//  سابقه‌ی کلِ پلتفرم سیگنالِ بهتری است، باید *دوباره آموزش* داد و نسخه‌ی
//  ویژگی را بالا برد — نه اینکه بی‌سروصدا ورودیِ متفاوت به مدلِ قدیمی داد.
// ═══════════════════════════════════════════════════════════════════════

/**
 * وضعیت‌هایی که یعنی «مهمان واقعاً آمد».
 * ⚠️ `dining` عمداً هست — رزروی که در حالِ صرفِ غذاست قطعاً حضور داشته.
 * نبودنش در مسیرِ سرو یکی از دو نیمه‌ی همین باگ بود.
 */
export const PRIOR_COMPLETION_STATUSES = ['completed', 'arrived', 'seated', 'dining'] as const;

/** وضعیت‌هایی که «نتیجه‌ی قطعی» دارند (حضور یا عدمِ حضور). */
export const PRIOR_RESOLVED_STATUSES = [...PRIOR_COMPLETION_STATUSES, 'no_show'] as const;

export interface PriorHistory {
  priorNoShows: number;
  priorCompletions: number;
  /** جمعِ دو تا — همان priorTotal در RawFeatureInput. */
  priorTotal: number;
}

/**
 * سابقه‌ی حل‌شده‌ی یک مشتری در یک رستوران، تا لحظه‌ی `asOf`.
 *
 * این تابع تنها مسیرِ مجازِ محاسبه‌ی این ویژگی در زمانِ *سرو* است. معنایش
 * بند‌به‌بند با کوئریِ آموزش (fetchTrainingRows) یکی است و تستِ
 * tests/feature-parity.integration.test.mts این یکی‌بودن را قفل کرده.
 *
 * `asOf` عمداً پارامتر است و پیش‌فرضِ ضمنی ندارد: در سرو برابرِ «الان» است،
 * ولی صریح‌بودنش یعنی هر صداکننده‌ای مجبور است به لحظه‌ی تصمیم فکر کند —
 * همان چیزی که نبودش نشتِ زمانی را ساخته بود.
 *
 * مهمانِ بدونِ حساب (`userId === null`) سابقه ندارد: در آموزش هم گروه‌بندی با
 * `COALESCE(user_id, id)` انجام می‌شود، یعنی هر رزروِ مهمان فقط با خودش
 * هم‌گروه است و هیچ سابقه‌ای نمی‌گیرد. پس صفر برگرداندن اینجا معادلِ دقیقِ
 * همان رفتار است، نه یک ساده‌سازی.
 */
export async function loadPriorHistory(params: {
  restaurantId: string;
  userId: string | null;
  asOf: Date;
}): Promise<PriorHistory> {
  if (!params.userId) return { priorNoShows: 0, priorCompletions: 0, priorTotal: 0 };

  const rows = await db.$queryRaw<{ prior_no_shows: number; prior_completions: number }[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'no_show')::int AS prior_no_shows,
      COUNT(*) FILTER (WHERE status IN ('completed','arrived','seated','dining'))::int AS prior_completions
    FROM reservations
    WHERE restaurant_id = ${params.restaurantId}::uuid
      AND user_id = ${params.userId}::uuid
      AND status IN ('completed','no_show','arrived','seated','dining')
      -- همان شرطِ نقطه‌به‌زمانِ آموزش: فقط رزروهایی که تا این لحظه *رخ داده‌اند*.
      -- slot_start است و نه created_at — رجوع کن به رفعِ نشتِ زمانی.
      AND slot_start < ${params.asOf}
  `);

  // ⚠️ Number(...) لازم است حتی با ::int — جنریکِ $queryRaw فقط assertion است.
  const priorNoShows = Number(rows[0]?.prior_no_shows ?? 0);
  const priorCompletions = Number(rows[0]?.prior_completions ?? 0);
  return { priorNoShows, priorCompletions, priorTotal: priorNoShows + priorCompletions };
}
