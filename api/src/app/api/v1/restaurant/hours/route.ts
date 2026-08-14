import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { safeJson } from '@/lib/schemas';
import { audit } from '@/lib/audit';
import { clientIp } from '@/lib/ratelimit';

// ═══════════════════════════════════════════════════════════
//  GET  /restaurant/hours — خواندن ساعتِ کاری + تعطیلاتِ خاص
//  PUT  /restaurant/hours — تنظیم ساعتِ کاری (و تعطیلات)
//  منطقِ اعتبارسنجی اینجاست؛ ساده و متمرکز.
// ═══════════════════════════════════════════════════════════

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  const b = await safeJson(req);
  if (!validateHours(b.opening_hours)) throw Err.validation('ساختار ساعتِ کاری نامعتبر است');

  await db.restaurant.update({
    where: { id: ctx.restaurant.id },
    data: {
      pendingOpeningHours: b.opening_hours ?? null,
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
  if (Array.isArray(b.closures)) {
    await db.$executeRaw`DELETE FROM restaurant_closures WHERE restaurant_id = ${ctx.restaurant.id}::uuid`;
    for (const c of b.closures) {
      if (typeof c?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.date)) continue;
      await db.$executeRaw`
        INSERT INTO restaurant_closures (restaurant_id, closure_date, reason)
        VALUES (${ctx.restaurant.id}::uuid, ${c.date}::date, ${c.reason ?? null})
        ON CONFLICT (restaurant_id, closure_date) DO UPDATE SET reason = EXCLUDED.reason
      `;
    }
  }

  return NextResponse.json({ ok: true, hours_change_status: 'pending' });
});
