import { db } from './db';
import { createLogger } from './logger';

const log = createLogger('platform-events');

// ═══════════════════════════════════════════════════════════════════════
//  Data Platform · فاز ۱ — درجِ رویدادِ رفتاری
//
//  توجه: این ماژول با lib/events.ts فرق دارد. events.ts «رویدادِ دامنه →
//  تحویلِ webhook» است؛ این‌جا «رویدادِ رفتاری → جدولِ کانونیِ platform_events»
//  برای تحلیل/هوش است. عمداً جدا نگه داشته شد تا دو مفهوم قاطی نشوند.
//
//  اصولِ کلیدی:
//   • append-only: فقط insert، هرگز update/delete.
//   • هرگز مسیرِ اصلی را نمی‌شکند: خطا فقط log می‌شود (رویداد از دست می‌رود،
//     نه اینکه رزرو/جست‌وجو fail شود).
//   • زمینه اختیاری است (رویدادِ ناشناس هم پذیرفته می‌شود).
//  معماری: docs/INTELLIGENCE-PLATFORM-ARCHITECTURE.md
// ═══════════════════════════════════════════════════════════════════════

/** منبعِ رویداد — از کدام سطحِ سیستم منتشر شد. */
export type EventSource = 'customer' | 'business' | 'company' | 'backend' | 'cron';

/**
 * سطحِ اعتمادِ منبعِ رویداد (پروتکل §۱۵).
 * **فقط سرور** این را تعیین می‌کند؛ کلاینت هرگز نمی‌تواند اعلامش کند.
 */
export type TrustLevel =
  | 'SERVER_VERIFIED'      // خودِ بک‌اند تولیدش کرده
  | 'AUTHENTICATED_CLIENT' // کلاینت با توکنِ معتبرِ مشتری
  | 'ANONYMOUS_CLIENT'     // کلاینت بدونِ هویت (فقط sessionId)
  | 'IMPORTED'             // واردشده از سیستمِ بیرونی
  | 'SYNTHETIC';           // ساخته‌شده برایِ تست/شبیه‌سازی

export interface PlatformEventInput {
  type: string;                              // نامِ نام‌فضادار: "search.performed"
  occurredAt?: Date | string;                // پیش‌فرض: اکنون
  source: EventSource;
  /** شناسه‌ی یکتا برایِ dedup — سرور namespace‌اش می‌کند (رجوع به route). */
  eventId?: string | null;
  /** پیش‌فرضِ عمدی: کم‌اعتمادترین سطح (fail-closed). */
  trustLevel?: TrustLevel;
  tenantId?: string | null;
  restaurantId?: string | null;
  userId?: string | null;
  staffId?: string | null;
  sessionId?: string | null;
  correlationId?: string | null;
  device?: Record<string, unknown> | null;
  geo?: Record<string, unknown> | null;
  payload?: Record<string, unknown>;
  schemaVersion?: number;
}

/**
 * پنجره‌ی مجازِ occurredAt نسبت به اکنون (پروتکل §۱۴ — timestamp validation).
 *
 * چرا لازم است: occurredAt از کلاینت می‌آید و پیش از این فقط NaN رد می‌شد —
 * یعنی یک کلاینت می‌توانست رویداد را به ۲۰۱۰ یا ۲۰۹۹ نسبت دهد و هر سریِ
 * زمانی‌ای که بعداً رویِ این جدول ساخته شود را مسموم کند.
 *
 * گذشته سخاوتمندانه است چون صفِ آفلاینِ کلاینت واقعاً می‌تواند روزها بماند
 * (analytics.js صف را در localStorage نگه می‌دارد). آینده تقریباً صفر است
 * چون هیچ دلیلِ مشروعی برایِ رویدادِ آینده وجود ندارد — فقط اختلافِ ساعتِ دستگاه.
 */
const MAX_PAST_MS = 30 * 24 * 3600_000;  // ۳۰ روز
const MAX_FUTURE_MS = 5 * 60_000;        // ۵ دقیقه (اختلافِ ساعت)

/** occurredAt را به پنجره‌ی معتبر می‌بَرد و می‌گوید آیا کلمپ شد. */
export function clampOccurredAt(raw: Date | string | undefined, now = new Date()): { value: Date; clamped: boolean } {
  if (!raw) return { value: now, clamped: false };
  const d = new Date(raw);
  if (isNaN(d.getTime())) return { value: now, clamped: true };
  if (+d > +now + MAX_FUTURE_MS) return { value: now, clamped: true };
  if (+d < +now - MAX_PAST_MS) return { value: new Date(+now - MAX_PAST_MS), clamped: true };
  return { value: d, clamped: false };
}

function toRow(e: PlatformEventInput) {
  return {
    type: e.type,
    // occurredAt به پنجره‌ی معتبر کلمپ می‌شود (نه فقط چکِ NaN).
    occurredAt: clampOccurredAt(e.occurredAt).value,
    eventId: e.eventId ?? null,
    trustLevel: e.trustLevel ?? 'ANONYMOUS_CLIENT',
    source: e.source,
    tenantId: e.tenantId ?? null,
    restaurantId: e.restaurantId ?? null,
    userId: e.userId ?? null,
    staffId: e.staffId ?? null,
    sessionId: e.sessionId ?? null,
    correlationId: e.correlationId ?? null,
    device: (e.device ?? undefined) as object | undefined,
    geo: (e.geo ?? undefined) as object | undefined,
    payload: (e.payload ?? {}) as object,
    schemaVersion: e.schemaVersion ?? 1,
  };
}

/**
 * درجِ یک رویدادِ رفتاری. غیرمسدودکننده از منظرِ درستیِ مسیرِ اصلی:
 * خطای درج فقط log می‌شود و پرتاب نمی‌شود.
 */
export async function recordEvent(e: PlatformEventInput): Promise<void> {
  try {
    await db.platformEvent.create({ data: toRow(e) });
  } catch (err) {
    log.warn('درجِ رویداد ناموفق', { type: e.type, error: (err as Error).message });
  }
}

/**
 * درجِ دسته‌ایِ رویدادها (برای ingestِ batch از کلاینت). تعدادِ پذیرفته‌شده
 * را برمی‌گرداند. مثلِ recordEvent، هرگز پرتاب نمی‌کند.
 */
export async function recordEvents(events: PlatformEventInput[]): Promise<number> {
  if (!events.length) return 0;
  try {
    // skipDuplicates → ON CONFLICT DO NOTHING، که ایندکسِ یکتایِ جزئیِ
    // event_id را رعایت می‌کند. `count` همچنان تعدادِ **واقعاً درج‌شده** است،
    // پس عددی که route به‌عنوانِ accepted برمی‌گرداند صادق می‌ماند.
    const res = await db.platformEvent.createMany({ data: events.map(toRow), skipDuplicates: true });
    return res.count;
  } catch (err) {
    log.warn('درجِ دسته‌ایِ رویداد ناموفق', { count: events.length, error: (err as Error).message });
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  هرسِ نگه‌داری (فازِ ۲، پروتکل §۱۴)
//
//  تا پیش از این، platform_events تنها جدولِ رشدِ بی‌مرزِ پروژه بود که هیچ
//  سیاستِ retention نداشت (jobs/idempotency/audit_logs همه داشتند). این‌جا
//  نیمه‌ی برنامه‌ایِ آن است؛ ایندکسِ پشتیبانش در migration 047.
//
//  سیاست بر اساسِ **سطحِ اعتماد** تفکیک می‌شود، نه یک عددِ واحد — چون دقیقاً
//  همان تفکیکی است که سیاستِ واجدِ شرایط‌بودنِ آموزش (§۱۵) رویش بنا شده:
//  رویدادی که هرگز واجدِ شرایطِ آموزش نیست، دلیلی ندارد یک سال بماند.
//
//  ⚠️ هرس روی `ingested_at` (حقیقتِ سروری) انجام می‌شود، نه `occurred_at`
//     (ورودیِ کلاینت). دلیلش در بالایِ migration 047 نوشته شده: با
//     occurred_at یک کلاینت می‌توانست با backdate کردن، حذفِ زودهنگامِ
//     رویدادِ خودش را تحریک کند.
// ═══════════════════════════════════════════════════════════════════════

/** روزهایِ نگه‌داری به‌ازایِ هر سطحِ اعتماد. با env قابلِ تنظیم است. */
function retentionDays(): Array<{ levels: TrustLevel[]; days: number }> {
  const n = (key: string, fallback: number) => {
    const v = Number(process.env[key]);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
  };
  return [
    // ناشناس/ساختگی: هرگز واجدِ شرایطِ آموزش نیستند (§۱۵) — فقط آمارِ تجمیعی.
    { levels: ['ANONYMOUS_CLIENT', 'SYNTHETIC'], days: n('TELEMETRY_RETENTION_ANON_DAYS', 90) },
    // کلاینتِ احرازشده: مشروط واجدِ شرایط، پس بیشتر می‌ماند.
    { levels: ['AUTHENTICATED_CLIENT'], days: n('TELEMETRY_RETENTION_AUTH_DAYS', 180) },
    // حقیقتِ سروری/واردشده: تنها موادِ خامِ کاملاً واجدِ شرایط.
    { levels: ['SERVER_VERIFIED', 'IMPORTED'], days: n('TELEMETRY_RETENTION_VERIFIED_DAYS', 400) },
  ];
}

const PRUNE_BATCH = 5_000;
const PRUNE_MAX_BATCHES = 200; // سقفِ ایمنی: حداکثر ۱ میلیون ردیف در هر اجرا

/**
 * حذفِ دسته‌ایِ رویدادهایِ منقضی. دسته‌ای است تا یک DELETEِ چندمیلیونی جدول را
 * برایِ مدتِ طولانی قفل نکند (همان ملاحظه‌ای که هر هرسِ تولیدی لازم دارد).
 * برمی‌گرداند: تعدادِ حذف‌شده به تفکیکِ سطل.
 */
export async function prunePlatformEvents(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const bucket of retentionDays()) {
    const key = bucket.levels.join('+');
    let total = 0;
    for (let i = 0; i < PRUNE_MAX_BATCHES; i++) {
      // ctid برایِ محدودکردنِ دسته: LIMIT مستقیم در DELETE در Postgres مجاز نیست.
      const deleted: number = await db.$executeRaw`
        DELETE FROM platform_events
        WHERE ctid IN (
          SELECT ctid FROM platform_events
          WHERE trust_level = ANY(${bucket.levels}::text[])
            AND ingested_at < now() - make_interval(days => ${bucket.days}::int)
          LIMIT ${PRUNE_BATCH}
        )
      `;
      total += deleted;
      if (deleted < PRUNE_BATCH) break;
    }
    out[key] = total;
  }
  return out;
}
