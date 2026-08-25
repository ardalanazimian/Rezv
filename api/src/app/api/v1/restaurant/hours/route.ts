import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, zDateStr, z } from '@/lib/schemas';
import { audit } from '@/lib/audit';
import { clientIp } from '@/lib/ratelimit';
import { invalidateAllAvailability } from '@/lib/availability-cache';

// ═══════════════════════════════════════════════════════════
//  GET  /restaurant/hours — خواندن ساعتِ کاری + تعطیلاتِ خاص
//  PUT  /restaurant/hours — تنظیم ساعتِ کاری (و تعطیلات)
//  منطقِ اعتبارسنجی اینجاست؛ ساده و متمرکز.
// ═══════════════════════════════════════════════════════════

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ═══════════════════════════════════════════════════════════════════════
//  ⚠️ رفعِ یافته‌ی ۱۸ (فازِ ۲) — این PUT تنها مصرف‌کننده‌ی `safeJson` در کلِ
//  درختِ routeها بود که **`.parse()` نداشت**؛ یعنی بدنه‌اش هیچ شِیمایی
//  نداشت. سه پیامدِ تأییدشده با اجرای واقعی روی Postgres:
//
//   ۱. **DoSِ داخلی.** `closures` هیچ سقفِ طولی نداشت و مستقیم یک حلقه‌ی
//      **ترتیبیِ** `$executeRaw` را می‌راند (یک رفت‌وبرگشتِ DB به‌ازای هر
//      عضو). تنها مرز `MAX_BODY_BYTES` = ۱۰۰KB بود ⇒ با کوچک‌ترین عضوِ
//      ممکن (`{"date":"2026-01-01"},` = ۲۲ بایت) **۴۶۵۴** رفت‌وبرگشتِ
//      ترتیبی در یک درخواست (اندازه‌گیریِ واقعی، نه تخمین).
//
//   ۲. **۵۰۰ + از دست رفتنِ داده.** رجکسِ `^\d{4}-\d{2}-\d{2}$` تاریخِ
//      **تقویمیِ ناموجود** را می‌پذیرد. اجرای واقعی: `2026-02-30` و
//      `9999-99-99` هر دو از رجکس رد می‌شوند و بعد در `::date` با
//      `PrismaClientKnownRequestError P2010` می‌شکنند. آن خطا
//      `instanceof ApiError` نیست ⇒ `errorResponse` ۵۰۰ می‌دهد. بدتر:
//      `DELETE` قبلاً اجرا شده و هیچ transactionی دورِ حلقه نیست، پس
//      **همه‌ی تعطیلاتِ قبلی پاک می‌شوند و چیزی جایشان نمی‌نشیند** — از
//      دست رفتنِ داده با یک غلطِ تایپیِ ساده.
//
//   ۳. **دیتای بدنوعِ خاموش.** `reason` هیچ چکِ نوعی نداشت؛ اجرای واقعی
//      نشان داد Prisma بی‌صدا سریالایزش می‌کند: `{evil:true}` به
//      `{"evil": true}` و `['a','b']` به `{a,b}` (سینتکسِ آرایه‌ی Postgres)
//      تبدیل و در ستونِ `text`ِ بی‌سقف ذخیره می‌شد. (این SQL injection
//      **نبود** — تگ‌تمپلیت‌های Prisma پارامتری‌اند.)
//
//  رفع: شِیمای صریح + چکِ تقویمیِ واقعی. حالا هر بدنه‌ی نامعتبر **قبل از**
//  `DELETE` رد می‌شود، پس مسیرِ از دست رفتنِ داده هم بسته می‌شود.
// ═══════════════════════════════════════════════════════════════════════

/** سقفِ تعدادِ تعطیلات در یک درخواست — حلقه‌ی ترتیبیِ DB را کران‌دار می‌کند.
 *  ۳۶۶ = «بیشتر از یک سالِ کامل روزِ تعطیل» یعنی معناً غیرممکن، ولی به‌قدرِ
 *  کافی بالا که هیچ لیستِ دستیِ واقعی (پنل یکی‌یکی اضافه می‌کند) را نشکند. */
const MAX_CLOSURES = 366;
/** «دلیلِ تعطیلی» یک یادداشتِ کوتاه است؛ ستونِ DB نوعِ `text`ِ بی‌سقف است. */
const MAX_REASON_LEN = 200;

/** تاریخِ تقویمیِ واقعی — `zDateStr` فقط رجکسِ قالب است و `2026-02-30` را می‌پذیرد. */
function isRealDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const bodySchema = z.object({
  // ساختارِ داخلی را همچنان validateHours چک می‌کند (غنی‌تر از چیزی که شیم
  // می‌تواند بیان کند). این‌جا فقط «آبجکت یا null، و حتماً حاضر» — دقیقاً
  // همان قراردادِ قبلی: کلیدِ غایب قبلاً هم از validateHours رد می‌شد.
  opening_hours: z.record().nullable(),
  closures: z.array(z.object({
    date: zDateStr,
    reason: z.string().trim().max(MAX_REASON_LEN).nullable().optional(),
  })).max(MAX_CLOSURES).optional(),
});

/** اعتبارسنجی ساختار openingHours قبل از ذخیره. */
function validateHours(oh: unknown): boolean {
  if (oh === null) return true;
  if (typeof oh !== 'object' || Array.isArray(oh)) return false;
  for (const [k, shifts] of Object.entries(oh as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(k)) return false;                 // کلید فقط 0..6
    if (!Array.isArray(shifts)) return false;
    for (const s of shifts) {
      if (!Array.isArray(s) || s.length !== 2) return false;
      if (!HHMM.test(s[0]) || !HHMM.test(s[1])) return false;
    }
  }
  return true;
}

export const GET = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'search' }, async (_req, ctx) => {
  const r = await db.restaurant.findUnique({
    where: { id: ctx.restaurant.id },
    select: {
      openingHours: true, timezone: true,
      pendingOpeningHours: true, hoursChangeStatus: true, hoursChangeReason: true,
      hoursChangeRequestedAt: true, hoursChangeReviewedAt: true,
    },
  });
  const closures = await db.$queryRaw<Array<{ closure_date: Date; reason: string | null }>>`
    SELECT closure_date, reason FROM restaurant_closures
    WHERE restaurant_id = ${ctx.restaurant.id}::uuid AND closure_date >= CURRENT_DATE
    ORDER BY closure_date
  `.catch(() => []);
  return NextResponse.json({
    // زنده — همینی که مشتری می‌بیند و در محاسبه‌ی availability استفاده می‌شود.
    opening_hours: r?.openingHours ?? null,
    timezone: r?.timezone ?? 'Asia/Tehran',
    closures: closures.map(c => ({
      date: c.closure_date instanceof Date ? c.closure_date.toISOString().slice(0, 10) : String(c.closure_date).slice(0, 10),
      reason: c.reason,
    })),
    // ── Part 3: وضعیتِ پیشنهادِ در دستِ بررسی (اگر باشد) — پنلِ بیزنس این
    //    را برایِ نمایشِ «زنده در برابرِ در دستِ بررسی» استفاده می‌کند. ──
    pending_opening_hours: r?.pendingOpeningHours ?? null,
    hours_change_status: r?.hoursChangeStatus ?? null,
    hours_change_reason: r?.hoursChangeReason ?? null,
    hours_change_requested_at: r?.hoursChangeRequestedAt?.toISOString() ?? null,
    hours_change_reviewed_at: r?.hoursChangeReviewedAt?.toISOString() ?? null,
  });
});

// ⚠️ رفتارِ عوض‌شده (Part 3، تأییدِ ساعتِ کاری، ۲۰۲۶-۰۸-۱۴): قبلاً این
// PUT مستقیماً openingHoursِ زنده را می‌نوشت — یعنی یک اپراتور می‌توانست
// بی‌آنکه کسی ببیند، سانس‌هایی باز کند که ظرفیتِ واقعی را ندارد. حالا طبقِ
// مدلِ اقتدارِ پروژه (Company = مرجعِ تأیید، Restaurant = پیشنهاددهنده)،
// این مسیر فقط pending_opening_hours را می‌نویسد؛ openingHoursِ زنده تا
// تأییدِ صریحِ شرکت (POST/PATCH .../admin/hours-changes/[id]) دست‌نخورده
// می‌ماند. محدوده‌یِ عمدی: closures (تعطیلاتِ یک‌روزه) از این قاعده جدا
// مانده‌اند — یک استثنایِ یک‌روزه (مثلاً تعطیلیِ اضطراری) ریسکِ «باز کردنِ
// سانسِ جعلی» ندارد که تأییدِ Part 3 برایش طراحی شده، و لیستِ read-first/
// known-facts و اسکیمِ پیشنهادیِ ماموریت هم فقط opening_hours را هدف گرفته
// بودند — پس همچنان مستقیم می‌نویسند تا اسکوپ از ماموریت فراتر نرود.
export const PUT = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'auth' }, async (req, ctx) => {
  const b = await parseBody(req, bodySchema);
  if (!validateHours(b.opening_hours)) throw Err.validation('ساختار ساعتِ کاری نامعتبر است');
  // چکِ تقویمی جدا از شِیماست چون شیم `.refine()` ندارد — ولی حتماً **قبل از**
  // هر نوشتنی اجرا می‌شود تا DELETE با بدنه‌ی نامعتبر شلیک نشود.
  const badDate = b.closures?.find(c => !isRealDate(c.date));
  if (badDate) throw Err.validation(`تاریخِ تعطیلی معتبر نیست: ${badDate.date}`);

  await db.restaurant.update({
    where: { id: ctx.restaurant.id },
    data: {
      // ⚠️ `Prisma.JsonNull` و نه `null` خام: تا قبل از افزودنِ شِیما، `b`
      // نوعِ `any` داشت و `null` خام از تایپ‌چک رد می‌شد. رفتارِ زمانِ اجرا
      // عوض **نشده** — با اجرای واقعی سنجیده شد که `null` خام همان
      // `'null'::jsonb` می‌نویسد (نه SQL NULL)، یعنی دقیقاً کاری که
      // `Prisma.JsonNull` می‌کند. همان sentinelی که روتِ خواهر
      // (admin/hours-changes/[id]/route.ts:۶۶-۶۷) استفاده می‌کند.
      pendingOpeningHours: b.opening_hours ? (b.opening_hours as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      hoursChangeStatus: 'pending',
      hoursChangeReason: null,       // پیشنهادِ تازه = دلیلِ ردِ قبلی دیگر مصداق ندارد
      hoursChangeRequestedAt: new Date(),
      hoursChangeReviewedAt: null,
    },
  });

  await audit({
    action: 'hours.proposed',
    actorId: ctx.auth.sub,
    actorType: 'staff',
    targetId: ctx.restaurant.id,
    restaurantId: ctx.restaurant.id,
    ip: clientIp(req),
    detail: { opening_hours: b.opening_hours ?? null },
  });

  // به‌روزرسانیِ تعطیلاتِ خاص (اگر ارسال شده): جایگزینیِ کامل — زنده، بدونِ تأییدِ شرکت (رجوع به توضیحِ بالا)
  if (b.closures) {
    await db.$executeRaw`DELETE FROM restaurant_closures WHERE restaurant_id = ${ctx.restaurant.id}::uuid`;
    for (const c of b.closures) {
      await db.$executeRaw`
        INSERT INTO restaurant_closures (restaurant_id, closure_date, reason)
        VALUES (${ctx.restaurant.id}::uuid, ${c.date}::date, ${c.reason ?? null})
        ON CONFLICT (restaurant_id, closure_date) DO UPDATE SET reason = EXCLUDED.reason
      `;
    }
    // ⚠️ رفع‌شده (ممیزیِ ۲۰۲۶-۰۸-۲۴): closures زنده نوشته می‌شوند ولی کشِ
    // availability باطل نمی‌شد — یک تعطیلیِ اضطراریِ امروز تا ۳۰۰ ثانیه برای
    // مشتری سانسِ باز نشان می‌داد. تغییرِ closure روی همه‌ی تاریخ‌های حذف/
    // اضافه‌شده اثر دارد (جایگزینیِ کامل است)، پس کلِ کش پاک می‌شود.
    await invalidateAllAvailability(ctx.restaurant.id);
  }

  return NextResponse.json({ ok: true, hours_change_status: 'pending' });
});
