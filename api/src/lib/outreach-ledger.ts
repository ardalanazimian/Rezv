import { Prisma } from '@prisma/client';
import { db } from './db';
import { createLogger } from './logger';

const log = createLogger('outreach');

// ═══════════════════════════════════════════════════════════════════════
//  دفترِ ارتباط‌گیری — «به کی پیام/تماس رفت و بعدش چه شد؟»
//
//  ⚠️ باگی که این ماژول از آن زاده شد (ممیزیِ ۲۰۲۶-۰۸-۲۰):
//  marketing_automations.converted_count در کلِ ریپو هیچ‌جا افزایش نمی‌یافت،
//  ولی پنلِ بیزنس نرخِ تبدیل را از رویش نشان می‌داد. یعنی رستوران‌دار همیشه
//  «۱۲۰ ارسال · ۰٪ تبدیل» می‌دید و نتیجه می‌گرفت کمپین‌هایش بی‌اثرند —
//  در حالی که عدد اصلاً اندازه‌گیری نشده بود. شرحِ کامل در
//  prisma/sql/057-outreach-ledger.sql.
//
//  ⚠️ قاعده‌ی حاکم بر این فایل (همان بندِ ۴۶ که بر دفترِ پیش‌بینی حاکم است):
//  ثبتِ دفتر هرگز نباید ارسالِ واقعی را بشکند. توابعِ نوشتن fail-open‌اند —
//  خطا لاگ می‌شود و اجرا ادامه پیدا می‌کند. از دست‌رفتنِ یک ردیفِ آمار
//  بی‌اهمیت است؛ نرسیدنِ پیامک به مشتری نیست.
// ═══════════════════════════════════════════════════════════════════════

/**
 * پنجره‌ی انتساب: رزروی که تا این تعداد روز پس از تماس ساخته شود، به آن
 * تماس نسبت داده می‌شود.
 *
 * ⚠️ این عدد یک *انتخاب* است، نه یک کشف. هیچ داده‌ای نداریم که بگوید اثرِ
 * واقعیِ یک پیامک چند روز طول می‌کشد — چون تا امروز اصلاً اندازه‌گیری
 * نمی‌شد. ۱۴ روز محافظه‌کارانه انتخاب شد (کوتاه‌تر از چرخه‌ی معمولِ
 * بازگشتِ مشتریِ رستوران) تا نرخ را باد نکند. وقتی چند ماه دادهٔ واقعی جمع
 * شد، باید از روی توزیعِ فاصله‌ی «تماس تا رزرو» بازتنظیم شود — و آن‌وقت
 * دیگر انتخاب نیست، اندازه‌گیری است.
 */
export const ATTRIBUTION_WINDOW_DAYS = 14;

/**
 * کفِ نمونه برای گزارشِ نرخ. زیرِ این تعداد ردیفِ *حل‌شده*، نرخ گزارش
 * نمی‌شود و به‌جایش insufficient_data برمی‌گردد (بندِ ۲۰).
 *
 * چرا لازم است: با ۳ ارسال و ۱ تبدیل، «۳۳٪ نرخِ تبدیل» عددی است که هیچ
 * معنایی ندارد ولی کاملاً قطعی به‌نظر می‌رسد — دقیقاً همان جعلِ قطعیتی که
 * این کل ماژول برای رفعش نوشته شد.
 */
export const MIN_RESOLVED_FOR_RATE = 20;

export type OutreachChannel = 'sms' | 'call';
export type OutreachSource = 'automation' | 'campaign' | 'crm_recommendation';

export interface OutreachRow {
  restaurantId: string;
  /** NULL برای شماره‌ی خامِ بدونِ حسابِ کاربری — قابلِ انتساب نیست. */
  userId: string | null;
  channel: OutreachChannel;
  source: OutreachSource;
  sourceId?: string | null;
  reason?: string | null;
}

/**
 * ثبتِ گروهیِ گیرنده‌ها. fail-open: خطا لاگ می‌شود و تعدادِ ۰ برمی‌گردد،
 * هرگز throw نمی‌کند.
 *
 * چرا createMany و نه حلقه‌ی create: یک automation می‌تواند صدها گیرنده
 * داشته باشد و حلقه یعنی صدها رفت‌وبرگشت به DB داخلِ همان cronی که از قبل
 * سنگین است.
 */
export async function recordOutreach(rows: OutreachRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  try {
    const result = await db.outreachLog.createMany({
      data: rows.map((r) => ({
        restaurantId: r.restaurantId,
        userId: r.userId,
        channel: r.channel,
        source: r.source,
        sourceId: r.sourceId ?? null,
        reason: r.reason ? r.reason.slice(0, 300) : null,
      })),
    });
    return result.count;
  } catch (err) {
    log.error('ثبتِ دفترِ ارتباط‌گیری شکست خورد', {
      error: err instanceof Error ? err.message : String(err),
      rows: rows.length,
    });
    return 0;
  }
}

export interface ResolveResult {
  /** چند ردیف تبدیل خورد. */
  converted: number;
  /** چند ردیف بدونِ تبدیل منقضی شد (پنجره بسته شد). */
  expired: number;
}

/**
 * حلقه‌ی بازخورد را می‌بندد: رزروهای پس از هر تماس را پیدا و نسبت می‌دهد،
 * بعد ردیف‌هایی را که پنجره‌شان تمام شده «حل‌شده‌ی بدونِ تبدیل» علامت می‌زند.
 *
 * ⚠️ ترتیبِ دو دستور اجباری است: اول انتساب، بعد انقضا. برعکسش یعنی ردیفی
 * که همین حالا واجدِ تبدیل شده، قبل از دیده‌شدن منقضی می‌شود.
 *
 * انتسابِ «آخرین تماس» (last-touch) با دو لایه DISTINCT ON:
 *   ۱) برای هر رزرو، آخرین تماسِ پیش از آن  → یک رزرو دو تماس را تبدیل نمی‌کند
 *   ۲) برای هر تماس، زودترین رزروِ باقی‌مانده → یک تماس دو رزرو را ادعا نمی‌کند
 * بدونِ لایه‌ی دوم، `UPDATE ... FROM` با دو ردیفِ منطبق یکی را به‌دلخواه
 * انتخاب می‌کند و نتیجه غیرقطعی می‌شود. tie-break با id تا اجرا تکرارپذیر بماند.
 */
export async function resolveOutreachConversions(
  windowDays: number = ATTRIBUTION_WINDOW_DAYS,
): Promise<ResolveResult> {
  const interval = Prisma.sql`(${windowDays}::text || ' days')::interval`;

  const converted = await db.$executeRaw(Prisma.sql`
    WITH pairs AS (
      SELECT r.id AS rid, r.created_at AS rat, o.id AS oid, o.sent_at
      FROM outreach_log o
      JOIN reservations r
        ON r.restaurant_id = o.restaurant_id
       AND r.user_id       = o.user_id
       -- نقطه‌به‌زمان: فقط رزروی که *پس از* تماس ساخته شده. رزروی که از قبل
       -- وجود داشت را نمی‌شود به تماس نسبت داد.
       AND r.created_at    > o.sent_at
       AND r.created_at   <= o.sent_at + ${interval}
      WHERE o.user_id IS NOT NULL
        AND o.converted_reservation_id IS NULL
        AND o.resolved_at IS NULL
        -- رزروی که قبلاً به تماسِ دیگری نسبت داده شده دوباره شمرده نمی‌شود
        AND NOT EXISTS (
          SELECT 1 FROM outreach_log o2 WHERE o2.converted_reservation_id = r.id
        )
    ),
    best_per_reservation AS (
      SELECT DISTINCT ON (rid) rid, rat, oid
      FROM pairs ORDER BY rid, sent_at DESC, oid
    ),
    best_per_outreach AS (
      SELECT DISTINCT ON (oid) oid, rid, rat
      FROM best_per_reservation ORDER BY oid, rat ASC, rid
    )
    UPDATE outreach_log o
       SET converted_reservation_id = b.rid,
           converted_at             = b.rat,
           resolved_at              = now()
      FROM best_per_outreach b
     WHERE o.id = b.oid
  `);

  const expired = await db.$executeRaw(Prisma.sql`
    UPDATE outreach_log
       SET resolved_at = now()
     WHERE resolved_at IS NULL
       AND sent_at + ${interval} < now()
  `);

  return { converted, expired };
}

/** آمارِ تبدیلِ یک منبع. `ratePct` عمداً می‌تواند null باشد. */
export interface OutreachStats {
  sourceId: string | null;
  /** کلِ ردیف‌های ثبت‌شده (شاملِ قابلِ‌انتساب‌نبودن‌ها). */
  sentCount: number;
  /** ردیف‌هایی که userId ندارند — نه تبدیل‌شده، نه تبدیل‌نشده. */
  unattributableCount: number;
  /** ردیف‌های قابلِ‌انتسابی که نتیجه‌شان قطعی شده. مخرجِ نرخ. */
  resolvedCount: number;
  /** ردیف‌های حل‌شده‌ای که به رزرو رسیدند. صورتِ کسر. */
  convertedCount: number;
  /**
   * نرخِ تبدیل به درصد، یا null اگر شواهد کافی نیست.
   * ⚠️ null یعنی «نمی‌دانیم»، نه «صفر». مصرف‌کننده حق ندارد آن را ۰ نشان دهد.
   */
  ratePct: number | null;
  /** چرا ratePct صفر یا null است — برای نمایشِ صادقانه در UI. */
  status: 'measured' | 'insufficient_data';
}

/**
 * آمارِ تبدیل به تفکیکِ منبع، برای یک رستوران.
 *
 * ⚠️ ایزولاسیونِ تنانت: فیلترِ restaurant_id اجباری و غیرقابل‌حذف است —
 * این تابع هرگز بدونِ آن صدا زده نمی‌شود.
 */
export async function getOutreachStatsBySource(params: {
  restaurantId: string;
  source: OutreachSource;
  sourceIds?: string[];
}): Promise<Map<string | null, OutreachStats>> {
  const { restaurantId, source, sourceIds } = params;
  if (sourceIds && sourceIds.length === 0) return new Map();

  const sourceFilter = sourceIds
    ? Prisma.sql`AND source_id = ANY(${sourceIds}::uuid[])`
    : Prisma.empty;

  const rows = await db.$queryRaw<{
    source_id: string | null;
    sent_count: number;
    unattributable_count: number;
    resolved_count: number;
    converted_count: number;
  }[]>(Prisma.sql`
    SELECT
      source_id,
      COUNT(*)::int                                              AS sent_count,
      COUNT(*) FILTER (WHERE user_id IS NULL)::int               AS unattributable_count,
      COUNT(*) FILTER (
        WHERE user_id IS NOT NULL AND resolved_at IS NOT NULL
      )::int                                                     AS resolved_count,
      COUNT(*) FILTER (
        WHERE converted_reservation_id IS NOT NULL
      )::int                                                     AS converted_count
    FROM outreach_log
    WHERE restaurant_id = ${restaurantId}::uuid
      AND source = ${source}
      ${sourceFilter}
    GROUP BY source_id
  `);

  const out = new Map<string | null, OutreachStats>();
  for (const r of rows) {
    // ⚠️ Number(...) لازم است حتی با ::int — جنریکِ $queryRaw فقط assertion است.
    const resolvedCount = Number(r.resolved_count);
    const convertedCount = Number(r.converted_count);
    const enough = resolvedCount >= MIN_RESOLVED_FOR_RATE;
    out.set(r.source_id, {
      sourceId: r.source_id,
      sentCount: Number(r.sent_count),
      unattributableCount: Number(r.unattributable_count),
      resolvedCount,
      convertedCount,
      ratePct: enough ? Math.round((convertedCount / resolvedCount) * 100) : null,
      status: enough ? 'measured' : 'insufficient_data',
    });
  }
  return out;
}
