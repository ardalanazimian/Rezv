import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { createHash } from 'crypto';
import { recordEvents, type PlatformEventInput, type TrustLevel } from '@/lib/platform-events';

import { withApiMetrics } from '@/lib/api-metrics';

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
//  پاسخِ 202 فوری؛ درج غیرمسدودکننده است (خطا → رویداد از دست می‌رود، مسیر نمی‌شکند).
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
 * payload را به شکلِ امن می‌بَرد: عمق، تعدادِ کلید و طولِ رشته را محدود می‌کند.
 * به‌جایِ رد کردنِ کلِ رویداد، **هرس** می‌کند — چون تله‌متری نباید مسیرِ اصلی
 * را بشکند، ولی حق ندارد داده‌ی بی‌مرز هم بپذیرد.
 */
function sanitizePayload(v: unknown, depth = 0): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.length > MAX_STRING_LEN ? v.slice(0, MAX_STRING_LEN) : v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  if (depth >= MAX_PAYLOAD_DEPTH) return null;      // عمیق‌تر از حد → قطع
  if (Array.isArray(v)) return v.slice(0, MAX_PAYLOAD_KEYS).map((x) => sanitizePayload(x, depth + 1));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (n >= MAX_PAYLOAD_KEYS) break;
      out[k.slice(0, 80)] = sanitizePayload(val, depth + 1);
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
];
const TYPE_SHAPE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

function isAllowedType(t: string): boolean {
  return TYPE_SHAPE.test(t) && ALLOWED_TYPE_PREFIXES.some((p) => t.startsWith(p));
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

    const events: PlatformEventInput[] = body.events
      // typeهایِ خارج از allowlist بی‌صدا کنار گذاشته می‌شوند (نه ۴۰۰): تله‌متری
      // هرگز نباید مسیرِ کاربر را بشکند، ولی داده‌ی بی‌شکل هم نباید بپذیرد.
      // عددِ `accepted` در پاسخ همچنان صادق است چون از تعدادِ درجِ واقعی می‌آید.
      .filter((e) => isAllowedType(e.type))
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
        sessionId: e.sessionId ?? null,
        correlationId: e.correlationId ?? null,
        device,
        payload: capPayloadSize(sanitizePayload(e.payload ?? {})),
        schemaVersion: e.schemaVersion ?? 1,
      }));

    if (!events.length) return NextResponse.json({ ok: true, accepted: 0 }, { status: 202 });

    const accepted = await recordEvents(events);
    return NextResponse.json({ ok: true, accepted }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/telemetry', POST_impl);
