import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { recordEvents, type PlatformEventInput } from '@/lib/platform-events';

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

const eventSchema = z.object({
  type: z.string().min(1).max(120),
  occurredAt: z.string().max(40).optional(),        // ISO؛ نامعتبر → سرور «اکنون» می‌گذارد
  source: z.enum(['customer', 'business', 'company']),
  restaurantId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  sessionId: z.string().max(200).optional(),
  correlationId: z.string().max(200).optional(),
  payload: z.record().optional(),
  schemaVersion: z.number().int().min(1).max(1000).optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(MAX_BATCH),
});

export async function POST(req: Request) {
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

    const events: PlatformEventInput[] = body.events.map((e) => ({
      type: e.type,
      occurredAt: e.occurredAt,
      source: e.source,
      // userId سروری‌ست؛ مقدارِ بدنه (اگر بود) نادیده گرفته می‌شود.
      userId,
      // زمینهٔ tenant فقط از رکورد معتبر رستوران می‌آید؛ client نمی‌تواند
      // event را به tenant دلخواه نسبت دهد یا tenantId مستقل جعل کند.
      restaurantId: e.restaurantId && restaurantMap.has(e.restaurantId) ? e.restaurantId : null,
      tenantId: e.restaurantId ? restaurantMap.get(e.restaurantId)?.tenantId ?? null : null,
      sessionId: e.sessionId ?? null,
      correlationId: e.correlationId ?? null,
      device,
      payload: e.payload ?? {},
      schemaVersion: e.schemaVersion ?? 1,
    }));

    const accepted = await recordEvents(events);
    return NextResponse.json({ ok: true, accepted }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
