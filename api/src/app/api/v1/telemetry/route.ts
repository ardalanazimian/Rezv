import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { createHash } from 'crypto';
import { recordEventsDetailed, type PlatformEventInput, type TrustLevel } from '@/lib/platform-events';
import { metrics, capTelemetryTypeLabel } from '@/lib/metrics';
import { createLogger } from '@/lib/logger';

import { withApiMetrics } from '@/lib/api-metrics';

const log = createLogger('telemetry-ingest');

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/v1/telemetry — درگاهِ ingestِ رویدادِ رفتاری (Data Platform · فاز ۱)
//
//  توجهِ نام: مسیرِ /v1/events از قبل با GETِ «رویدادهای ویژه‌ی رستوران» گرفته
//  شده؛ برای پرهیز از تصادمِ معنایی، ingestِ رفتاری روی /v1/telemetry نشست.
//
//  کلاینت‌ها (اپ کاستومر/بیزنس/کامپانی) رویدادها را دسته‌ای می‌فرستند. auth
//  اختیاری است: اگر توکنِ مشتری بود userId ضمیمه می‌شود، وگرنه رویدادِ ناشناس
//  (بر پایه‌ی sessionId) پذیرفته می‌شود. سرور روی فیلدهای حساس authoritative است:
//   • userId فقط از توکن (کلاینت نمی‌تواند جعل کند)
//   • source فقط سه مقدارِ کلاینتی (backend/cron از کلاینت پذیرفته نمی‌شود)
//   • device از هدرِ UA (نه از بدنه)
//  پاسخِ 202 فوری. **به‌روزرسانیِ ۲۰۲۶-۰۸-۲۶:** «۲۰۲ در هر حالت» دیگر درست
//  نیست — دو حالت از هم تفکیک شدند:
//   • ردِ **دائمی** (نامِ خارج از allowlist) → همچنان 202، ولی بدنه شمارشِ
//     `rejected`/`rejected_types` را می‌دهد و متریک+لاگ می‌خورد. تلاشِ دوباره
//     بی‌فایده است، پس کلاینت باید صف را خالی کند.
//   • شکستِ **گذرا** (درج در DB throw کرد) → 503، تا کلاینت صف را نگه دارد.
//     پیش از این هر دو «۲۰۲ با accepted:0» بودند و از هم قابلِ تشخیص نبودند.
//  معماری: docs/INTELLIGENCE-PLATFORM-ARCHITECTURE.md
// ═══════════════════════════════════════════════════════════════════════

const MAX_BATCH = 50;

// ═══════════════════════════════════════════════════════════════════════
//  محدودیت‌هایِ payload (پروتکل §۱۴ — payload/nesting/string limits)
//
//  پیش از این `payload: z.record()` هر شکلی را می‌پذیرفت و تنها مرزِ عملی
//  سقفِ کلیِ بدنه بود. یعنی یک کلاینت می‌توانست jsonbهایِ عظیم و عمیقاً
//  تودرتو درج کند که نه قابلِ ایندکس‌اند و نه قابلِ هرس.
// ═══════════════════════════════════════════════════════════════════════
const MAX_PAYLOAD_KEYS = 40;
const MAX_PAYLOAD_DEPTH = 4;
const MAX_STRING_LEN = 500;
const MAX_PAYLOAD_BYTES = 8_000;

/**
 * حذفِ بایتِ NUL از هر رشته‌ی ارسالیِ کلاینت.
 *
 * ⚠️ چرا لازم است (تأییدشده با اجرای واقعی روی Postgres، نه فرض): `\u0000`
 * یک رشته‌ی کاملاً معتبرِ JSON است ولی Postgres آن را در هیچ ستونِ text/jsonb
 * نمی‌پذیرد و کلِ `createMany` را با
 * `22021 invalid byte sequence for encoding "UTF8": 0x00` می‌شکند.
 *
 * تا وقتی درجِ ناموفق «۲۰۲ با accepted:0» می‌داد این فقط یک از‌دست‌رفتنِ بی‌صدا
 * بود. حالا که شکستِ درج صادقانه ۵۰۳ می‌دهد (پایینِ همین فایل)، همان یک بایت
 * تبدیل می‌شد به یک **قرصِ سمی**: دسته‌ی آلوده هرگز درج نمی‌شود، پاسخ هرگز
 * `ok` نمی‌شود، و صفِ localStorageِ کلاینت تا ابد همان دسته را دوباره
 * می‌فرستد. پس این هرس بخشی از خودِ همان رفع است، نه یک بهبودِ جانبی.
 */
function stripNul(s: string): string {
  return s.includes('\u0000') ? s.replace(/\u0000/g, '') : s;
}

/**
 * payload را به شکلِ امن می‌بَرد: عمق، تعدادِ کلید و طولِ رشته را محدود می‌کند.
 * به‌جایِ رد کردنِ کلِ رویداد، **هرس** می‌کند — چون تله‌متری نباید مسیرِ اصلی
 * را بشکند، ولی حق ندارد داده‌ی بی‌مرز هم بپذیرد.
 */
function sanitizePayload(v: unknown, depth = 0): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return stripNul(v.length > MAX_STRING_LEN ? v.slice(0, MAX_STRING_LEN) : v);
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (depth >= MAX_PAYLOAD_DEPTH) return null;      // عمیق‌تر از حد → قطع
  if (Array.isArray(v)) return v.slice(0, MAX_PAYLOAD_KEYS).map((x) => sanitizePayload(x, depth + 1));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (n >= MAX_PAYLOAD_KEYS) break;
      // کلید هم ورودیِ کلاینت است و همان محدودیتِ NUL را دارد.
      out[stripNul(k.slice(0, 80))] = sanitizePayload(val, depth + 1);
      n++;
    }
    return out;
  }
  return null;                                       // function/symbol/… → دور ریخته می‌شود
}

/**
 * سقفِ نهاییِ حجم: حتی بعد از هرسِ عمق/کلید/رشته، یک payload می‌تواند از
 * انباشتِ کلیدهایِ کوچک بزرگ شود. اگر از سقف رد شد، به‌جایِ درجِ یک jsonbِ
 * غول‌پیکر، یک نشانگرِ صریح ذخیره می‌شود تا در تحلیل بشود شمردش.
 */
function capPayloadSize(p: unknown): Record<string, unknown> {
  try {
    const json = JSON.stringify(p ?? {});
    if (json.length <= MAX_PAYLOAD_BYTES) return (p ?? {}) as Record<string, unknown>;
    return { _truncated: true, _originalBytes: json.length };
  } catch {
    return { _unserializable: true };
  }
}

/**
 * نامِ رویداد باید نام‌فضادار و در فهرستِ مجاز باشد (پروتکل §۱۴ — allowed event types).
 *
 * پیش از این هر رشته‌ی ۱۲۰ کاراکتری پذیرفته می‌شد، یعنی کاردینالیتیِ بی‌مرز روی
 * ایندکسِ (type, occurred_at). به‌جایِ فهرستِ کاملِ نام‌ها (که با هر فیچرِ جدید
 * کهنه می‌شود و تیم را وسوسه می‌کند دورش بزند)، **پیشوندِ دامنه** allowlist
 * می‌شود: شکل تضمین می‌شود بدونِ اینکه افزودنِ رویدادِ تازه نیازِ تغییرِ بک‌اند باشد.
 */
const ALLOWED_TYPE_PREFIXES = [
  'search.', 'discover.', 'restaurant.', 'reservation.', 'waitlist.',
  'auth.', 'profile.', 'loyalty.', 'reward.', 'chat.', 'nav.', 'ui.', 'panel.',
  // ── دو پیشوندِ زیر در ۲۰۲۶-۰۸-۲۶ اضافه شدند و **هر دو فرستنده‌ی واقعی
  //    دارند** (شرطِ افزودن به این فهرست: نامِ بی‌فرستنده اضافه نمی‌شود).
  //
  //    یافته: تا پیش از این، فهرستِ بالا **هیچ‌کدام** از نام‌هایی که کلاینت‌ها
  //    واقعاً می‌فرستند را پوشش نمی‌داد. کلِ نام‌های ارسالی دقیقاً دو تاست
  //    (grep روی apps/ + shared/، هر پنج نقطه رشته‌ی ثابت‌اند، صفر نامِ پویا):
  //
  //      app.opened  → apps/customer/js/analytics.js:88
  //                    apps/business/js/analytics.js:82
  //                    apps/company/js/analytics.js:82
  //                    shared/js/analytics.panel.js:82   (منبعِ دو موردِ بالا)
  //      page.viewed → apps/customer/js/data/discover.js:16
  //                    apps/business/js/routing.js:64     (window.rzTrack)
  //                    apps/company/js/data.js:31         (window.rzTrack)
  //
  //    یعنی ۱۰۰٪ تله‌متریِ کلاینت رد می‌شد. تأییدِ اجراییِ پیش از رفع: همان
  //    بدنه‌ی واقعی روی روتِ واقعی + DBِ واقعی → `202 {"accepted":0}` و صفر
  //    ردیف در `platform_events`.
  'app.', 'page.',
];
const TYPE_SHAPE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/** چرا رد شد — همان مقداری که برچسبِ `reason`ِ متریک می‌شود. */
type TypeVerdict = 'ok' | 'shape' | 'prefix';

function classifyType(t: string): TypeVerdict {
  if (!TYPE_SHAPE.test(t)) return 'shape';
  return ALLOWED_TYPE_PREFIXES.some((p) => t.startsWith(p)) ? 'ok' : 'prefix';
}

const eventSchema = z.object({
  type: z.string().min(1).max(120),
  occurredAt: z.string().max(40).optional(),        // ISO؛ خارج از پنجره → کلمپ می‌شود
  source: z.enum(['customer', 'business', 'company']),
  restaurantId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  sessionId: z.string().max(200).optional(),
  correlationId: z.string().max(200).optional(),
  payload: z.record().optional(),
  schemaVersion: z.number().int().min(1).max(1000).optional(),
  // شناسه‌ی ارسالیِ کلاینت برایِ dedup. **خامش ذخیره نمی‌شود** — پایین namespace می‌شود.
  eventId: z.string().min(8).max(64).optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(MAX_BATCH),
});

async function POST_impl(req: Request) {
  try {
    // rate-limit بر پایه‌ی IP (ضدِ سیلِ رویداد). سطلِ اختصاصیِ ingest.
    await enforceRateLimit(clientIp(req), { prefix: 'events', max: 120, windowMs: 60_000 });

    // auth اختیاری: مشتریِ شناخته‌شده → userId؛ در غیر این صورت ناشناس.
    let userId: string | null = null;
    try {
      const auth = authFromRequest(req);
      if (auth.kind === 'customer') userId = auth.sub;
    } catch { /* ناشناس — مجاز است */ }

    const body = await parseBody(req, bodySchema);

    // device فقط از هدرِ UA (بدونِ PII؛ کلاینت نمی‌تواند آن را در بدنه جعل کند).
    const ua = req.headers.get('user-agent')?.slice(0, 400) || undefined;
    const device = ua ? { ua } : undefined;

    const restaurantIds = [...new Set(body.events.map((e) => e.restaurantId).filter((id): id is string => Boolean(id)))];
    const restaurants = restaurantIds.length
      ? await db.restaurant.findMany({ where: { id: { in: restaurantIds } }, select: { id: true, tenantId: true } })
      : [];
    const restaurantMap = new Map(restaurants.map((r) => [r.id, r]));

    // ── سطحِ اعتماد: **سروری**، هرگز از بدنه (پروتکل §۱۵) ──
    // کلاینتِ دارایِ توکنِ معتبرِ مشتری از کلاینتِ ناشناس تفکیک می‌شود. هیچ
    // مسیرِ کلاینتی نمی‌تواند SERVER_VERIFIED بگیرد — آن فقط برایِ رویدادهایی
    // است که خودِ بک‌اند تولید می‌کند.
    const trustLevel: TrustLevel = userId ? 'AUTHENTICATED_CLIENT' : 'ANONYMOUS_CLIENT';

    // ── namespaceِ شناسه‌ی dedup ──
    // شناسه‌ی خامِ کلاینت مستقیم ذخیره **نمی‌شود**: وگرنه یک مهاجم می‌توانست
    // idهایی را از پیش «تصاحب» کند و با ایندکسِ یکتا، رویدادِ واقعیِ کاربرِ
    // دیگری را بی‌صدا خفه کند. با چسباندنِ دامنه‌ی فراخوان (کاربر، یا نشست،
    // یا IP) هر کلاینت فقط می‌تواند رویدادهایِ **خودش** را دیدوپلیکیت کند.
    const dedupScope = userId ?? `s:${clientIp(req)}`;
    const nsEventId = (raw: string | undefined, sessionId: string | null): string | null => {
      if (!raw) return null;
      const scope = userId ?? (sessionId ? `sess:${sessionId}` : dedupScope);
      return createHash('sha256').update(`${scope}:${raw}`).digest('hex').slice(0, 40);
    };

    // ── ردشدنِ رویداد دیگر بی‌صدا نیست (بخشِ ۹ CLAUDE.md) ──
    // کنارگذاشتن همچنان **مسیرِ کاربر را نمی‌شکند** (کد وضعیت عوض نمی‌شود)،
    // ولی حالا سه ردِ قابلِ‌پیگیری می‌گذارد: متریکِ قابلِ‌آلارم، یک لاگِ
    // ساختاریافته در هر درخواست، و اعدادِ صریح در بدنه‌ی پاسخ.
    //
    // چرا لاگ **در هر درخواست** و نه در هر رویداد: یک دسته تا ۵۰ رویداد و
    // سطلِ ریت‌لیمیت ۱۲۰ درخواست در دقیقه دارد؛ لاگِ per-event می‌توانست
    // دقیقه‌ای ۶۰۰۰ خط بسازد و همان سیگنالی را که می‌خواهیم دفن کند.
    const rejected: string[] = [];
    const allowed = body.events.filter((e) => {
      const verdict = classifyType(e.type);
      if (verdict === 'ok') return true;
      const label = capTelemetryTypeLabel(e.type);
      metrics.telemetryEventRejected.inc({ reason: verdict, type: label });
      rejected.push(label);
      return false;
    });
    if (rejected.length) {
      log.warn('رویدادِ تله‌متری درج نشد — نامِ خارج از allowlist', {
        rejected: rejected.length,
        received: body.events.length,
        // فهرستِ **مهارشده** (به capTelemetryTypeLabel رجوع کن) و سقف‌دار، تا
        // لاگ خودش به مسیرِ تزریق/سیل تبدیل نشود.
        types: [...new Set(rejected)].slice(0, 10),
        source: body.events[0]?.source ?? null,
      });
    }

    const events: PlatformEventInput[] = allowed
      .map((e) => ({
        type: e.type,
        occurredAt: e.occurredAt,
        source: e.source,
        // userId سروری‌ست؛ مقدارِ بدنه (اگر بود) نادیده گرفته می‌شود.
        userId,
        trustLevel,
        eventId: nsEventId(e.eventId, e.sessionId ?? null),
        // زمینهٔ tenant فقط از رکورد معتبر رستوران می‌آید؛ client نمی‌تواند
        // event را به tenant دلخواه نسبت دهد یا tenantId مستقل جعل کند.
        restaurantId: e.restaurantId && restaurantMap.has(e.restaurantId) ? e.restaurantId : null,
        tenantId: e.restaurantId ? restaurantMap.get(e.restaurantId)?.tenantId ?? null : null,
        // stripNul: این دو مستقیم در ستونِ `text` می‌نشینند و همان محدودیتِ
        // NULِ Postgres را دارند (بالا، `stripNul`).
        sessionId: e.sessionId ? stripNul(e.sessionId) : null,
        correlationId: e.correlationId ? stripNul(e.correlationId) : null,
        device,
        payload: capPayloadSize(sanitizePayload(e.payload ?? {})),
        schemaVersion: e.schemaVersion ?? 1,
      }));

    // ── چرا کدِ وضعیت **همچنان ۲۰۲** است، حتی وقتی همه‌چیز رد شد ──
    // ردشدن بابتِ allowlist یک شکستِ **دائمی** است: همان بدنه هر بار دوباره
    // رد می‌شود. کلاینت (`analytics.js:52`) صف را فقط داخلِ `if (r.ok)` هرس
    // می‌کند، پس یک کدِ ۴xx باعث می‌شد صفِ localStorage تا سقفِ ۲۰۰ رویداد پر
    // بماند و هر بارگذاری همان دسته‌ی محکوم‌به‌رد را دوباره بفرستد — یعنی
    // یک حلقه‌ی بی‌پایانِ تلاش. صداقت اینجا در **بدنه** خریداری می‌شود، نه در
    // کدِ وضعیت: فرستنده حالا می‌تواند `rejected`/`rejected_types` را ببیند.
    if (!events.length) {
      return NextResponse.json(
        { ok: true, received: body.events.length, accepted: 0, duplicates: 0, rejected: rejected.length, rejected_types: [...new Set(rejected)].slice(0, 10) },
        { status: 202 },
      );
    }

    const res = await recordEventsDetailed(events);

    // ── شکستِ درج ≠ موفقیت (§۳) ──
    // این حالت با «همه تکراری بودند» یکی نیست: رویدادها **گم شده‌اند**. با
    // پاسخِ ۲۰۲ کلاینت صف را هرس می‌کرد و داده برای همیشه می‌رفت. ۵۰۳ یعنی
    // صف دست‌نخورده می‌ماند و دفعه‌ی بعد دوباره تلاش می‌شود (صف خودش سقفِ
    // ۲۰۰ ردیفی دارد، پس رشدِ بی‌مرز هم ندارد). `withApiMetrics` این را در
    // `rezervno_http_errors_total` می‌شمارد ⇒ قابلِ آلارم.
    if (res.failed) throw Err.serviceUnavailable('ثبتِ رویدادِ تله‌متری موقتاً ممکن نیست؛ دوباره تلاش کنید');

    return NextResponse.json(
      {
        ok: true,
        received: body.events.length,
        accepted: res.inserted,
        // تفاضلِ صریح، نه استنتاجِ خواننده: رویدادی که شکل و نامش درست بود ولی
        // `event_id`ش قبلاً درج شده. (dedupِ عمدی — به migration 059b رجوع کن.)
        duplicates: events.length - res.inserted,
        rejected: rejected.length,
        rejected_types: [...new Set(rejected)].slice(0, 10),
      },
      { status: 202 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/telemetry', POST_impl);
