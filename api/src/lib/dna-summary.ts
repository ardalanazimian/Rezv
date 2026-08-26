import { db } from './db';
import { INSIGHT_VISIT_STATUSES } from './customer-insights';
import { getVisitPercentile } from './guest-profile';

// ═══════════════════════════════════════════════════════════════════════
//  خلاصه‌ی ماهانه‌ی DNA غذایی — **درون‌اپ**، نه پیامک
//
//  ⚠️ شکافی که می‌بندد: دسته‌ی `dna` («خلاصه‌ی DNA غذایی») از روزِ اول در
//  تنظیماتِ اپِ مشتری به کاربر نشان داده می‌شد و کاربر می‌توانست خاموش/روشنش
//  کند — ولی **هیچ کدی در کلِ سیستم هرگز چیزی در این دسته صادر نمی‌کرد**
//  (grep: صفر نقطه‌ی صدور). یعنی یک وعده‌ی نمایش‌داده‌شده به کاربر که هیچ
//  پشتوانه‌ای نداشت؛ کلیدی که روشن و خاموشش هیچ فرقی نمی‌کرد.
//
//  چرا درون‌اپ و نه پیامک (تصمیمِ صریحِ مالکِ محصول): پنلِ کاوه‌نگار هنوز
//  گرفته نشده، و مهم‌تر اینکه این محتوا **تصویری** است — Wrapped با اسلاید و
//  انیمیشن. یک پیامکِ سه‌توکنی نمی‌تواند آن را برساند.
//
//  ── قاعده‌ی حاکم بر کلِ این فایل (docs/ML_CONTRACT.md) ──
//  نبودِ شواهد ⇒ `available:false` با دلیلِ صریح، یا `null`. **هرگز صفر.**
//  «۰ بازدیدِ این ماه» به‌عنوانِ یک «خلاصه‌ی جشن‌گونه» بدترین شکلِ دروغ است:
//  عددش درست است ولی پیامش («ماهِ خوبی داشتی!») نیست. کاربری که این ماه
//  بیرون نرفته اصلاً نباید خلاصه بگیرد.
// ═══════════════════════════════════════════════════════════════════════

const TZ = 'Asia/Tehran';

export const JALALI_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const;

// ── تقویمِ شمسی ────────────────────────────────────────────────────────
//
// ⚠️ چرا شمسی و نه میلادی: کاربرِ ایرانی «ماهِ گذشته» را مردادِ ۱۴۰۵
// می‌فهمد، نه August. مرزِ ماهِ میلادی وسطِ ماهِ شمسی می‌افتد و خلاصه‌ای
// می‌سازد که با هیچ‌چیزِ ذهنیِ کاربر جور نیست.
//
// بدونِ کتابخانه: `Intl` با تقویمِ `persian` این کار را می‌کند. از
// `en-US-u-ca-persian` استفاده می‌شود (نه `fa-IR`) تا ارقام لاتین برگردند
// و parse به تبدیلِ عدد نیاز نداشته باشد — همان الگویِ lib/loyalty.ts.

const jalaliFmt = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
});

const tehranFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

export interface JalaliParts { jy: number; jm: number; jd: number }

/** سال/ماه/روزِ شمسی به وقتِ تهران. */
export function jalaliPartsTehran(d: Date): JalaliParts {
  const p = jalaliFmt.formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { jy: get('year'), jm: get('month'), jd: get('day') };
}

/**
 * اختلافِ تهران با UTC در **همین لحظه**، بر حسبِ میلی‌ثانیه.
 *
 * ⚠️ چرا محاسبه می‌شود و +۳:۳۰ هاردکد نمی‌شود: ایران تا ۱۴۰۱ ساعتِ تابستانی
 * داشت (+۴:۳۰). رزروهای قدیمی‌تر در آن بازه‌اند و مرزِ ماهشان با آفستِ ثابت
 * یک ساعت جابه‌جا می‌شود — یعنی رزروهای نزدیکِ نیمه‌شبِ اول/آخرِ ماه در ماهِ
 * اشتباه شمرده می‌شوند. (تأییدشده: ۲۰۲۱-۰۹-۲۱ آفست ۴٫۵ برمی‌گرداند،
 * ۲۰۲۶-۰۸-۲۵ آفست ۳٫۵.)
 */
function tehranOffsetMs(d: Date): number {
  const p = tehranFmt.formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** نیمه‌شبِ تهرانِ همان روزی که این لحظه در آن است (به‌صورتِ لحظه‌ی UTC). */
export function tehranMidnight(d: Date): Date {
  const off = tehranOffsetMs(d);
  const local = new Date(d.getTime() + off);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - off);
}

/**
 * آغازِ ماهِ شمسیِ حاویِ این لحظه.
 *
 * روش عمداً حلقه‌ی روزبه‌روز است و نه حسابِ آفستی: طولِ ماهِ شمسی ثابت نیست
 * (۲۹/۳۰/۳۱) و اسفند در سالِ کبیسه فرق می‌کند. حلقه حداکثر ۳۱ گام دارد،
 * هیچ I/O ندارد، و از تعریفِ خودِ تقویم استفاده می‌کند نه از فرمولِ بازنویسی‌شده.
 * کمِ‌کردنِ ۲۴ ساعت از نیمه‌شبِ محلی حتی در روزِ ۲۳ یا ۲۵ ساعته هم داخلِ
 * روزِ قبل می‌افتد و snapِ دوباره درستش می‌کند.
 */
export function startOfJalaliMonth(d: Date): Date {
  let cur = tehranMidnight(d);
  for (let i = 0; i < 32 && jalaliPartsTehran(cur).jd > 1; i++) {
    cur = tehranMidnight(new Date(cur.getTime() - 86_400_000));
  }
  return cur;
}

export interface JalaliMonthRange {
  /** شاملِ این لحظه. */
  start: Date;
  /** **بدونِ** این لحظه (آغازِ ماهِ بعد). */
  end: Date;
  jy: number;
  jm: number;
  /** مثلاً `مرداد 1405`. ارقام عمداً لاتین‌اند: این مرزِ API است و
   *  تبدیل به ارقامِ فارسی کارِ کلاینت است (`faNum` در اپِ مشتری). */
  label: string;
  /** کلیدِ پایدار برای «این خلاصه را قبلاً دیده‌ام»: مثلاً `1405-05`. */
  key: string;
}

function rangeFrom(start: Date, end: Date): JalaliMonthRange {
  const { jy, jm } = jalaliPartsTehran(start);
  return {
    start, end, jy, jm,
    label: `${JALALI_MONTH_NAMES[jm - 1]} ${jy}`,
    key: `${jy}-${String(jm).padStart(2, '0')}`,
  };
}

/** آخرین ماهِ شمسیِ **کامل‌شده** (نه ماهِ جاری — ماهِ نیمه‌تمام خلاصه ندارد). */
export function lastCompletedJalaliMonth(now: Date): JalaliMonthRange {
  const thisStart = startOfJalaliMonth(now);
  const prevStart = startOfJalaliMonth(new Date(thisStart.getTime() - 86_400_000));
  return rangeFrom(prevStart, thisStart);
}

/** ماهِ پیش از یک بازه — برای مقایسه‌ی «نسبت به ماهِ قبل». */
export function previousMonthOf(range: JalaliMonthRange): JalaliMonthRange {
  const prevStart = startOfJalaliMonth(new Date(range.start.getTime() - 86_400_000));
  return rangeFrom(prevStart, range.start);
}

// ── خودِ خلاصه ─────────────────────────────────────────────────────────

export type DnaSummaryUnavailableReason = 'no_visits_this_month';

export interface DnaTopRestaurant {
  slug: string;
  name: string;
  cuisine: string | null;
  visits: number;
}

export interface DnaMonthlySummary {
  available: true;
  /** کلیدِ پایدارِ ماه — کلاینت با همین «خوانده‌شده» را علامت می‌زند. */
  periodKey: string;
  periodLabel: string;
  visits: number;
  /** بازدیدِ ماهِ قبل. `null` یعنی آن ماه هنوز داده‌ای در سیستم ندارد
   *  (کاربرِ تازه) — نه «صفر بازدید داشت». */
  previousVisits: number | null;
  restaurantsVisited: number;
  /** رستوران‌هایی که کاربر **هرگز** پیش از این ماه نرفته بود. */
  newRestaurants: number;
  /**
   * هزینه‌ی این ماه به تومان.
   * `null` = **اندازه‌گیری‌ناپذیر**، نه صفر. رزرونو مبلغِ فاکتور را نمی‌بیند؛
   * تنها منبع، پیش‌سفارش از منوست. اگر هیچ‌کدام از رستوران‌های این ماه منویِ
   * قیمت‌دار نداشته باشند، «۰ تومان» یک آرتیفکت است نه یک اندازه‌گیری —
   * همان قاعده‌ای که lib/customer-insights.ts هم رعایت می‌کند.
   */
  spendToman: number | null;
  /** امتیازِ وفاداریِ کسب‌شده در این ماه (فقط مثبت‌ها). */
  pointsEarned: number;
  topRestaurant: DnaTopRestaurant | null;
  /** پرتکرارترین نوعِ آشپزی این ماه. `null` اگر هیچ رستورانی cuisine نداشته باشد. */
  topCuisine: string | null;
  /**
   * درصدِ کاربرانی که بازدیدِ **کل**شان کمتر از این کاربر است.
   * `null` وقتی جمعیتِ مقایسه کوچک‌تر از حدِ معناداری است. عمداً «کل» است نه
   * ماهانه، و کلاینت هم همین را می‌نویسد — وگرنه عددِ ماهانه با برچسبِ کل
   * نمایش داده می‌شود.
   */
  lifetimeVisitPercentile: number | null;
}

export interface DnaMonthlyUnavailable {
  available: false;
  periodKey: string;
  periodLabel: string;
  reason: DnaSummaryUnavailableReason;
}

export type DnaMonthlyResult = DnaMonthlySummary | DnaMonthlyUnavailable;

/**
 * خلاصه‌ی ماهِ گذشته‌ی یک کاربر — فقط از دادهٔ واقعی.
 *
 * `now` تزریق‌پذیر است تا تست بتواند ماهِ مشخصی را بسنجد بدونِ دست‌کاریِ
 * ساعتِ سیستم.
 */
export async function buildDnaMonthlySummary(
  userId: string,
  now: Date = new Date(),
): Promise<DnaMonthlyResult> {
  const month = lastCompletedJalaliMonth(now);
  const prev = previousMonthOf(month);

  const visitStatuses = [...INSIGHT_VISIT_STATUSES];

  const monthVisits = await db.reservation.findMany({
    where: {
      userId,
      status: { in: visitStatuses },
      slotStart: { gte: month.start, lt: month.end },
    },
    select: {
      restaurantId: true,
      restaurant: { select: { slug: true, name: true, cuisine: true } },
      items: { select: { qty: true, menuItem: { select: { priceToman: true } } } },
    },
  });

  // ماهِ بدونِ بازدید خلاصه ندارد — رجوع کن به توضیحِ بالای فایل.
  if (monthVisits.length === 0) {
    return {
      available: false, periodKey: month.key, periodLabel: month.label,
      reason: 'no_visits_this_month',
    };
  }

  const monthRestaurantIds = [...new Set(monthVisits.map((r) => r.restaurantId))];

  // ── «تازه» یعنی پیش از **آغازِ این ماه** هرگز نرفته بود ────────────────
  // شرطِ `slotStart < month.start` حیاتی است: بدونش، هر رستورانی که همین
  // ماه دو بار رفته «قدیمی» شمرده می‌شد چون خودِ بازدیدهای همین ماه هم در
  // شمارش می‌آمدند — و «رستورانِ تازه» همیشه صفر می‌شد.
  const seenBefore = await db.reservation.findMany({
    where: {
      userId,
      status: { in: visitStatuses },
      slotStart: { lt: month.start },
      restaurantId: { in: monthRestaurantIds },
    },
    select: { restaurantId: true },
    distinct: ['restaurantId'],
  });
  const seenBeforeIds = new Set(seenBefore.map((r) => r.restaurantId));
  const newRestaurants = monthRestaurantIds.filter((id) => !seenBeforeIds.has(id)).length;

  // ── ماهِ قبل: تفکیکِ «صفر بازدید» از «اصلاً کاربر نبود» ────────────────
  // اگر کاربر پیش از ماهِ قبل هیچ ردی در سیستم ندارد، «۰ نسبت به ماهِ قبل»
  // یک مقایسه‌ی بی‌معناست، پس null می‌ماند و کلاینت مقایسه را نشان نمی‌دهد.
  const [previousCount, anyBefore] = await Promise.all([
    db.reservation.count({
      where: { userId, status: { in: visitStatuses }, slotStart: { gte: prev.start, lt: prev.end } },
    }),
    db.reservation.count({
      where: { userId, slotStart: { lt: prev.end } },
    }),
  ]);
  const previousVisits = anyBefore > 0 ? previousCount : null;

  // ── هزینه: اندازه‌گیری‌پذیر است یا اصلاً نه؟ ───────────────────────────
  const pricedMenuCount = await db.menuItem.count({
    where: { restaurantId: { in: monthRestaurantIds }, isActive: true, priceToman: { gt: 0 } },
  });
  const spendToman = pricedMenuCount > 0
    ? monthVisits.reduce(
        (sum, r) => sum + r.items.reduce((s, it) => s + it.qty * it.menuItem.priceToman, 0), 0)
    : null;

  // ── امتیازِ کسب‌شده در ماه (فقط مثبت — خرجِ امتیاز «کسب» نیست) ─────────
  const pointsAgg = await db.pointsLedger.aggregate({
    where: { userId, delta: { gt: 0 }, createdAt: { gte: month.start, lt: month.end } },
    _sum: { delta: true },
  });

  // ── پربازدیدترین رستوران و پرتکرارترین آشپزی ──────────────────────────
  const byRestaurant = new Map<string, { visits: number; slug: string; name: string; cuisine: string | null }>();
  const byCuisine = new Map<string, number>();
  for (const r of monthVisits) {
    const cur = byRestaurant.get(r.restaurantId);
    if (cur) cur.visits++;
    else byRestaurant.set(r.restaurantId, {
      visits: 1, slug: r.restaurant.slug, name: r.restaurant.name, cuisine: r.restaurant.cuisine,
    });
    if (r.restaurant.cuisine) byCuisine.set(r.restaurant.cuisine, (byCuisine.get(r.restaurant.cuisine) ?? 0) + 1);
  }
  const top = [...byRestaurant.values()].sort((a, b) => b.visits - a.visits)[0] ?? null;
  const topCuisine = [...byCuisine.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const lifetimeVisitPercentile = await getVisitPercentile(userId).catch(() => null);

  return {
    available: true,
    periodKey: month.key,
    periodLabel: month.label,
    visits: monthVisits.length,
    previousVisits,
    restaurantsVisited: monthRestaurantIds.length,
    newRestaurants,
    spendToman,
    pointsEarned: pointsAgg._sum.delta ?? 0,
    topRestaurant: top
      ? { slug: top.slug, name: top.name, cuisine: top.cuisine, visits: top.visits }
      : null,
    topCuisine,
    lifetimeVisitPercentile,
  };
}
