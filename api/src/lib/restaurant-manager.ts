import { Prisma } from '@prisma/client';
import { db } from './db';
import { cached, cacheKey } from './cache';
import { DEMAND_STATUSES_SQL } from './reservation-status';

// ⚠️ status IN (${DEMAND_STATUSES_SQL}) در کوئری‌های زیر عمداً با
// Prisma.raw() نوشته شده، نه interpolation معمولیِ ${...}: تگ‌تمپلیتِ
// $queryRaw هر ${...} را به‌صورتِ پیش‌فرض به یک پارامترِ bound‌شده تبدیل
// می‌کند (یعنی «'a','b','c'» به‌عنوانِ یک رشته‌ی واحد پاس داده می‌شد، نه
// چند مقدار در IN) — Prisma.raw می‌گوید این متن، SQLِ خام است. امن است
// چون DEMAND_STATUSES_SQL یک ثابتِ کاملاً کدی‌ست، نه ورودیِ کاربر.
const DEMAND_STATUSES_RAW = Prisma.raw(DEMAND_STATUSES_SQL);

// ═══════════════════════════════════════════════════════════════════════
//  «روز» یعنی روزِ **تهران** — تنها تعریفِ مجاز در گزارش‌های رستوران
//
//  ⚠️ باگی که این بلوک از آن زاده شد (۲۰۲۶-۰۸-۲۵، تأییدشده با کوئریِ واقعی
//  روی Postgres): `reservations.slot_start` از نوعِ
//  `timestamp WITHOUT time zone` است و سرورِ Postgres روی UTC اجرا می‌شود
//  (`SHOW TimeZone` → `Etc/UTC`). پس `slot_start::date`،
//  `EXTRACT(DOW FROM slot_start)` و `EXTRACT(HOUR FROM slot_start)` همگی
//  **روز/روزِ‌هفته/ساعتِ UTC** می‌دهند، نه تهران.
//
//  تهران UTC+3:30 است، پس هر اسلاتِ ۰۰:۰۰ تا ۰۳:۲۹ به وقتِ تهران در UTC
//  هنوز روزِ *قبل* است. اندازه‌گیریِ واقعی:
//    2026-03-10 20:45 UTC  →  روزِ UTC = 03-10، روزِ تهران = 03-11
//                             DOW: ۲ در برابرِ ۳، ساعت: ۲۰ در برابرِ ۰۰
//  یعنی شامِ دیرِ سه‌شنبه‌شب در آمار به چهارشنبه منتقل می‌شد (و برعکس)،
//  و «ساعتِ اوج» ۳:۳۰ جابه‌جا گزارش می‌شد.
//
//  چرا مهم است و نه یک جزئیاتِ زیبایی‌شناختی: مدلِ پیش‌بینیِ تقاضا
//  (lib/demand-forecast.ts) فصلیِ **هفتگی** یاد می‌گیرد. اگر بخشی از هر
//  شب به روزِ قبل بیفتد، سیگنالِ فصلی با نویزِ سیستماتیک آلوده می‌شود.
//  `buildFeatureVector` در lib/no-show-model.ts از همان اول این را با
//  `tehranHourWeekday()` درست انجام می‌داد — یعنی دو تعریفِ متناقض از «روز»
//  در یک کدبیس زنده بود.
//
//  ⚠️ اینها عمداً `Prisma.raw` هستند و از یک ثابتِ کاملاً کدی ساخته می‌شوند
//  (نه ورودیِ کاربر) — همان الگو و همان دلیلِ DEMAND_STATUSES_RAW بالا.
//  ⚠️ و عمداً اینجا یک‌جا تعریف شده‌اند، نه پنج کپی در پنج فایل: پنج کپی
//  دقیقاً همان چیزی است که اجازه داد این تعریف از `no-show-model.ts` واگرا شود.
// ═══════════════════════════════════════════════════════════════════════

/** منطقه‌ی زمانیِ کسب‌وکار. هم‌ارزِ SQLیِ `tehranHourWeekday()` در `no-show-model.ts`. */
export const BUSINESS_TZ = 'Asia/Tehran';

/** روزِ تقویمیِ تهرانِ یک اسلات. */
export const TEHRAN_SLOT_DAY = Prisma.raw(`(slot_start AT TIME ZONE 'UTC' AT TIME ZONE '${BUSINESS_TZ}')::date`);
/** روزِ هفته به وقتِ تهران (۰=یکشنبه، هم‌قرارداد با DAY_NAMES_FA). */
export const TEHRAN_SLOT_DOW = Prisma.raw(`EXTRACT(DOW FROM (slot_start AT TIME ZONE 'UTC' AT TIME ZONE '${BUSINESS_TZ}'))::int`);
/** ساعتِ روز (۰..۲۳) به وقتِ تهران. */
export const TEHRAN_SLOT_HOUR = Prisma.raw(`EXTRACT(HOUR FROM (slot_start AT TIME ZONE 'UTC' AT TIME ZONE '${BUSINESS_TZ}'))::int`);
/** «امروز» به وقتِ تهران — جایگزینِ `CURRENT_DATE` که روزِ UTC می‌دهد. */
export const TEHRAN_TODAY = Prisma.raw(`(now() AT TIME ZONE '${BUSINESS_TZ}')::date`);

/**
 * لحظه‌ی شروعِ یک روزِ تقویمیِ تهران، به‌صورتِ `timestamp`ِ UTC — یعنی چیزی
 * که مستقیماً با `slot_start` قابلِ مقایسه است و ایندکس را هم می‌سوزاند.
 * `daysAgo` از «امروزِ تهران» شمرده می‌شود.
 *
 * چرا لازم است: `slot_start >= CURRENT_DATE - 60` مرزِ پنجره را روی نیمه‌شبِ
 * **UTC** می‌گذارد، یعنی ۳ ساعت‌ونیم از نیمه‌شبِ تهران جلوتر — و در بازه‌ی
 * ۲۰:۳۰ تا ۲۴:۰۰ UTC حتی یک روزِ کامل جابه‌جا می‌شود.
 */
export function tehranDayStart(daysAgo: number): Prisma.Sql {
  // daysAgo از کد می‌آید (نه کاربر)، ولی برای اطمینان به عددِ صحیح مهار می‌شود.
  const d = Math.max(0, Math.trunc(daysAgo));
  return Prisma.raw(
    `((((now() AT TIME ZONE '${BUSINESS_TZ}')::date - ${d})::timestamp AT TIME ZONE '${BUSINESS_TZ}') AT TIME ZONE 'UTC')`,
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  AI Restaurant Manager — پاسخ‌هایِ ساختارمند و مستند به سؤالاتِ مدیریتیِ
//  رایج، نه یک چت‌بات با NLU. دقیقاً همون فلسفه‌ی restaurant/ai/route.ts:
//  «موتورِ قانون‌محورِ شفاف، نه black-box» — هر پاسخ عددِ پشتِ خودش را نشان
//  می‌دهد و هیچ‌وقت آماره‌ی نامعلوم را حدس نمی‌زند (اگر داده کم باشد، آن
//  پاسخ اصلاً برنمی‌گردد، نه یک عددِ نویزی).
//
//  ساختارِ هر پاسخ (طبقِ درخواست): Finding / Evidence / Confidence /
//  Recommended action — بدونِ «Impact» به‌عنوانِ فیلدِ جدا، چون در همین
//  پروژه «severity» (ai/route.ts) همان نقش را بازی می‌کند؛ دوباره‌کاری
//  نشد، فقط همان قرارداد اینجا هم اعمال شده.
// ═══════════════════════════════════════════════════════════════════════

export interface ManagerAnswer {
  id: string;
  question: string;
  finding: string;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  recommended_action: string | null;
}

// ── ریاضیاتِ خالص — بدونِ DB، مستقیماً تست‌پذیر ──

export interface ComparisonResult {
  diff_pct: number;               // مثبت = بیشتر از معمول، منفی = کمتر
  direction: 'lower' | 'higher' | 'normal';
}

/** نوسانِ کمتر از این درصد «معمولی» حساب می‌شود، نه سیگنالِ قابلِ‌گزارش —
 *  وگرنه هر روز یک ادعای «کمتر/بیشتر از حدِ انتظار» ساخته می‌شد. */
const NORMAL_BAND_PCT = 15;

export function compareToTypical(actual: number, typical: number): ComparisonResult {
  if (typical <= 0) return { diff_pct: 0, direction: 'normal' };
  const diffPct = Math.round(((actual - typical) / typical) * 1000) / 10;
  const direction: ComparisonResult['direction'] =
    Math.abs(diffPct) < NORMAL_BAND_PCT ? 'normal' : diffPct < 0 ? 'lower' : 'higher';
  return { diff_pct: diffPct, direction };
}

export interface TableActivity { number: number; name: string | null; bookings_count: number }
export interface TableUtilization extends TableActivity { relative_to_avg_pct: number; underutilized: boolean }

/** کمتر از این درصدِ میانگینِ خودِ همان رستوران = «کم‌استفاده» — نسبی، نه
 *  مطلق (نیاز به ساعتِ کاریِ دقیق برای درصدِ مطلق ندارد). */
const UNDERUTILIZED_RELATIVE_PCT = 50;
/** با کمتر از این تعداد میز، مقایسه‌ی نسبی معنا ندارد (مثلاً رستورانِ ۲میزه). */
const MIN_TABLES_FOR_COMPARISON = 4;

/** رتبه‌بندیِ میزها بر اساسِ استفاده نسبت به میانگینِ خودِ رستوران — منطقِ
 *  خالص، بدونِ DB. */
export function rankUtilization(tables: readonly TableActivity[]): TableUtilization[] {
  if (tables.length < MIN_TABLES_FOR_COMPARISON) return [];
  const avg = tables.reduce((s, t) => s + t.bookings_count, 0) / tables.length;
  if (avg <= 0) return [];
  return tables
    .map((t) => {
      const relativeToAvgPct = Math.round((t.bookings_count / avg) * 1000) / 10;
      return { ...t, relative_to_avg_pct: relativeToAvgPct, underutilized: relativeToAvgPct < UNDERUTILIZED_RELATIVE_PCT };
    })
    .sort((a, b) => a.relative_to_avg_pct - b.relative_to_avg_pct);
}

/** ۰=یکشنبه، هم‌قرارداد با `EXTRACT(DOW ...)` در Postgres و با TEHRAN_SLOT_DOW. */
export const DAY_NAMES_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

// ── از اینجا به بعد: DB واقعی. در تستِ واحد صدا زده نمی‌شود. ──

/**
 * سؤالِ ۱: «چرا دیروز رزروها کمتر/بیشتر از حدِ معمول بود؟»
 * «معمول» = میانگینِ همین‌روزِ هفته در ۴ هفته‌ی قبل (زوجِ هم‌روز، نه میانگینِ
 * کلِ هفته — چهارشنبه را باید با چهارشنبه‌های قبل مقایسه کرد، نه با جمعه).
 * روزهایِ بدونِ‌رزرو هم صفر شمرده می‌شوند (نه از میانگین حذف)، وگرنه
 * میانگین کاذب بالا می‌رفت.
 */
async function buildYesterdayAnswer(restaurantId: string): Promise<ManagerAnswer | null> {
  const rows = await db.$queryRaw<{ day: Date; cnt: bigint }[]>`
    WITH same_weekday AS (
      SELECT generate_series(${TEHRAN_TODAY} - 28, ${TEHRAN_TODAY} - 1, interval '1 day')::date AS day
    )
    SELECT sw.day,
      (SELECT COUNT(*) FROM reservations
        WHERE restaurant_id = ${restaurantId}::uuid
          AND status IN (${DEMAND_STATUSES_RAW})
          AND ${TEHRAN_SLOT_DAY} = sw.day
      )::bigint AS cnt
    FROM same_weekday sw
    WHERE EXTRACT(DOW FROM sw.day) = EXTRACT(DOW FROM ${TEHRAN_TODAY} - 1)
    ORDER BY sw.day ASC
  `;
  if (rows.length < 3) return null; // کمتر از ۳ نمونه‌ی مقایسه‌ای → سیگنالِ قابلِ‌اتکا نیست
  const yesterday = rows[rows.length - 1];
  const priorSameWeekdays = rows.slice(0, -1);
  const typical = priorSameWeekdays.reduce((s, r) => s + Number(r.cnt), 0) / priorSameWeekdays.length;
  const cmp = compareToTypical(Number(yesterday.cnt), typical);
  if (cmp.direction === 'normal') return null; // چیزِ گزارش‌کردنی نیست

  const dayName = DAY_NAMES_FA[new Date(yesterday.day).getUTCDay()];
  const lower = cmp.direction === 'lower';
  return {
    id: 'yesterday_vs_typical',
    question: 'چرا رزروهای دیروز نسبت به حدِ معمول تغییر کرد؟',
    finding: `دیروز (${dayName}) ${fmtInt(Number(yesterday.cnt))} رزرو داشتید — ${lower ? 'کمتر' : 'بیشتر'} از حدِ معمول.`,
    evidence: `میانگینِ ${dayName}‌های ${priorSameWeekdays.length} هفته‌ی قبل: ${fmtInt(Math.round(typical))} رزرو (${Math.abs(cmp.diff_pct)}٪ ${lower ? 'کمتر' : 'بیشتر'}).`,
    confidence: priorSameWeekdays.length >= 4 ? 'medium' : 'low',
    recommended_action: lower
      ? 'اگر این روند تکرار شد، یک کوپنِ کوتاه‌مدت یا یادآوریِ کمپین برای همین‌روزِ هفته امتحان کنید.'
      : null,
  };
}

export interface DowRankingRow { dow: number; count: number }

/**
 * رتبه‌بندیِ کاملِ ۷ روزِ هفته بر اساسِ تعدادِ رزروِ ۶۰ روزِ اخیر — نزولی
 * (پرترددترین اول). خالص از نظرِ فرمت‌بندی (فقط query+map)، تا هم
 * buildDowRankingAnswer هم دستیارِ هوشمند (lib/assistant-answers.ts) از
 * همین یک کوئری استفاده کنند، نه دو کپیِ جدا از همان SQL.
 * null یعنی داده‌ی خیلی کم برایِ رتبه‌بندیِ معنادار.
 */
export async function getWeekdayRanking(restaurantId: string): Promise<DowRankingRow[] | null> {
  const rows = await db.$queryRaw<{ dow: number; cnt: bigint }[]>`
    SELECT ${TEHRAN_SLOT_DOW} AS dow, COUNT(*)::bigint AS cnt
    FROM reservations
    WHERE restaurant_id = ${restaurantId}::uuid
      AND status IN (${DEMAND_STATUSES_RAW})
      AND slot_start >= ${tehranDayStart(60)}
    GROUP BY dow
  `;
  const totalDays = rows.reduce((s, r) => s + Number(r.cnt), 0);
  if (rows.length < 5 || totalDays < 30) return null; // داده‌ی خیلی کم برایِ رتبه‌بندیِ معنادار
  return rows
    .map((r) => ({ dow: r.dow, count: Number(r.cnt) }))
    .sort((a, b) => b.count - a.count);
}

/** سؤالِ ۲: «کدام روزهای هفته قوی‌ترند؟» — رتبه‌بندیِ کاملِ ۷ روز (نه فقط ضعیف‌ترین). */
async function buildDowRankingAnswer(restaurantId: string): Promise<ManagerAnswer | null> {
  const sorted = await getWeekdayRanking(restaurantId);
  if (!sorted) return null;
  const totalDays = sorted.reduce((s, r) => s + r.count, 0);
  const strongest = sorted.slice(0, 2).map((r) => DAY_NAMES_FA[r.dow]);
  const weakest = sorted[sorted.length - 1];
  const weakestName = DAY_NAMES_FA[weakest.dow];

  return {
    id: 'strongest_weekdays',
    question: 'کدام روزهای هفته قوی‌ترند؟',
    finding: `${strongest.join(' و ')} پرتقاضاترین روزهای شما هستند (۶۰ روزِ اخیر).`,
    evidence: `${sorted.map((r) => `${DAY_NAMES_FA[r.dow]}: ${fmtInt(r.count)}`).join('، ')}.`,
    confidence: totalDays >= 100 ? 'high' : 'medium',
    recommended_action: `${weakestName} کم‌تقاضاترین روز است — کوپنِ اختصاصی یا تبلیغِ همان روز می‌تواند ترافیک را جابه‌جا کند.`,
  };
}

/** سؤالِ ۳: «کدام مشتری‌ها دارند غیرفعال می‌شوند؟» — از همان سگمنتِ at_risk
 *  که customer-insights.ts هرشب محاسبه می‌کند (بدونِ دوباره‌کاریِ منطق). */
async function buildAtRiskAnswer(restaurantId: string): Promise<ManagerAnswer | null> {
  const [atRisk, total] = await Promise.all([
    db.customerInsight.count({ where: { restaurantId, segment: 'at_risk' } }),
    db.customerInsight.count({ where: { restaurantId } }),
  ]);
  if (total < 10 || atRisk === 0) return null; // مشتریِ کافی برایِ سگمنت‌بندیِ معنادار نیست، یا کسی در ریسک نیست
  const pct = Math.round((atRisk / total) * 100);
  return {
    id: 'at_risk_customers',
    question: 'کدام مشتری‌ها دارند غیرفعال می‌شوند؟',
    finding: `${fmtInt(atRisk)} مشتری (${pct}٪ از کوهورتِ فعال) بیش از حدِ معمول غیبت کرده‌اند.`,
    evidence: `از رویِ RFM: کسانی که فاصله‌ی بازدیدشان از الگویِ عادیِ خودشان بیشتر شده (محاسبه‌ی شبانه).`,
    confidence: total >= 30 ? 'high' : 'medium',
    recommended_action: 'یک کمپینِ Win-back با کدِ تخفیف برایِ همین سگمنت بسازید (کارتِ «ریسکِ ریزش» در پیشنهادهای AI).',
  };
}

/** سؤالِ ۴: «کدام میزها کم‌استفاده‌اند؟» — نسبت به میانگینِ خودِ همین رستوران. */
async function buildTableUtilizationAnswer(restaurantId: string): Promise<ManagerAnswer | null> {
  const rows = await db.$queryRaw<{ number: number; name: string | null; cnt: bigint }[]>`
    SELECT t.number, t.name, COUNT(r.id)::bigint AS cnt
    FROM tables t
    LEFT JOIN reservations r ON r.table_id = t.id
      AND r.status IN (${DEMAND_STATUSES_RAW})
      AND r.slot_start >= ${tehranDayStart(30)}
    WHERE t.restaurant_id = ${restaurantId}::uuid AND t.is_active = true
    GROUP BY t.number, t.name
  `;
  const ranked = rankUtilization(rows.map((r) => ({ number: r.number, name: r.name, bookings_count: Number(r.cnt) })));
  const underused = ranked.filter((t) => t.underutilized);
  if (underused.length === 0) return null;

  const label = (t: TableUtilization) => t.name || `میزِ ${fmtInt(t.number)}`;
  return {
    id: 'underutilized_tables',
    question: 'کدام میزها کم‌استفاده‌اند؟',
    finding: `${underused.length} میز به‌وضوح کمتر از میانگینِ بقیه‌ی میزهای شما رزرو می‌شوند: ${underused.slice(0, 3).map(label).join('، ')}.`,
    evidence: `در ۳۰ روزِ اخیر، این میزها کمتر از ${UNDERUTILIZED_RELATIVE_PCT}٪ میانگینِ رزروِ سایرِ میزهای فعال داشته‌اند.`,
    confidence: 'medium',
    recommended_action: 'بررسی کنید آیا موقعیتِ فیزیکی/ظرفیتِ این میزها مشکل دارد، یا در تخصیصِ خودکار اولویتِ کمتری گرفته‌اند.',
  };
}

function fmtInt(n: number): string {
  return n.toLocaleString('fa-IR');
}

/** همه‌ی پاسخ‌های آماده — فقط آن‌هایی که واقعاً چیزی برایِ گفتن دارند
 *  (null یعنی داده کم بود یا سیگنالِ قابلِ‌گزارشی نبود، نه خطا). کش‌شده. */
export async function getManagerInsights(restaurantId: string): Promise<ManagerAnswer[]> {
  return cached(cacheKey('manager-insights', restaurantId), 900, async () => {
    const results = await Promise.all([
      buildYesterdayAnswer(restaurantId),
      buildDowRankingAnswer(restaurantId),
      buildAtRiskAnswer(restaurantId),
      buildTableUtilizationAnswer(restaurantId),
    ]);
    return results.filter((a): a is ManagerAnswer => a !== null);
  });
}
