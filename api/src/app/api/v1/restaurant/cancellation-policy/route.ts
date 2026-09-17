import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseBody, z } from '@/lib/schemas';
import { Err } from '@/lib/errors';
import { LATE_EXTENSION_MINUTES_MAX, LATE_GRACE_MINUTES_MAX, LATE_GRACE_MINUTES_MIN } from '@/lib/late-arrival';

// ═══════════════════════════════════════════════════════════
//  GET  /restaurant/cancellation-policy — خواندنِ سیاستِ کنسلیِ رستوران
//  PUT  /restaurant/cancellation-policy — تنظیمِ سیاست (لایه‌ی پایه‌یِ
//       resolvePolicy در lib/cancellation-policy.ts؛ رجوع کن به اونجا
//       برایِ لایه‌هایِ دینامیک/رویدادِ‌ویژه/tier/abuse که رویِ این پایه سوار می‌شن).
// ═══════════════════════════════════════════════════════════

const bodySchema = z.object({
  free_cancel_hours: z.number().int().min(0).max(720),
  partial_penalty_hours: z.number().int().min(0).max(720),
  partial_penalty_pct: z.number().int().min(0).max(100),
  deposit_required: z.boolean(),
  auto_confirm: z.boolean(),
  // F001 (STATE M-13، حکمِ CEO D-18): مهلتِ صبر برای مهمانِ دیرکرده و سقفِ «دیرتر می‌رسم». هر دو روی
  // `restaurants` می‌نشینند و CHECKِ مهاجرتِ ۰۹۲ همان بازه‌ها را در DB هم اجبار می‌کند. در PUT اختیاری‌اند تا
  // پنلی که هنوز آن‌ها را نمی‌فرستد نشکند؛ در پاسخ همیشه حاضرند.
  late_grace_minutes: z.number().int().min(LATE_GRACE_MINUTES_MIN).max(LATE_GRACE_MINUTES_MAX).optional(),
  max_late_extension_minutes: z.number().int().min(0).max(LATE_EXTENSION_MINUTES_MAX).optional(),
});

const LATE_SELECT = { lateGraceMinutes: true, maxLateExtensionMinutes: true } as const;

export const GET = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'search' }, async (_req, ctx) => {
  const [p, late] = await Promise.all([
    db.cancellationPolicy.findUnique({ where: { restaurantId: ctx.restaurant.id } }),
    db.restaurant.findUniqueOrThrow({ where: { id: ctx.restaurant.id }, select: LATE_SELECT }),
  ]);
  return NextResponse.json({
    free_cancel_hours: p?.freeCancelHours ?? 24,
    partial_penalty_hours: p?.partialPenaltyHours ?? 2,
    partial_penalty_pct: p?.partialPenaltyPct ?? 50,
    deposit_required: p?.depositRequired ?? false,
    auto_confirm: p?.autoConfirm ?? true,
    is_customized: !!p,
    late_grace_minutes: late.lateGraceMinutes,
    max_late_extension_minutes: late.maxLateExtensionMinutes,
  });
});

export const PUT = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'auth' }, async (req, ctx) => {
  const b = await parseBody(req, bodySchema);
  if (b.partial_penalty_hours > b.free_cancel_hours) {
    throw Err.validation('partial_penalty_hours نمی‌تواند از free_cancel_hours بزرگ‌تر باشد');
  }
  const [p, late] = await db.$transaction(async (tx) => {
    const late = (b.late_grace_minutes !== undefined || b.max_late_extension_minutes !== undefined)
      ? await tx.restaurant.update({
        where: { id: ctx.restaurant.id },
        data: {
          ...(b.late_grace_minutes !== undefined ? { lateGraceMinutes: b.late_grace_minutes } : {}),
          ...(b.max_late_extension_minutes !== undefined ? { maxLateExtensionMinutes: b.max_late_extension_minutes } : {}),
        },
        select: LATE_SELECT,
      })
      : await tx.restaurant.findUniqueOrThrow({ where: { id: ctx.restaurant.id }, select: LATE_SELECT });
    const p = await tx.cancellationPolicy.upsert({
      where: { restaurantId: ctx.restaurant.id },
      create: {
        restaurantId: ctx.restaurant.id,
        freeCancelHours: b.free_cancel_hours,
        partialPenaltyHours: b.partial_penalty_hours,
        partialPenaltyPct: b.partial_penalty_pct,
        depositRequired: b.deposit_required,
        autoConfirm: b.auto_confirm,
      },
      update: {
        freeCancelHours: b.free_cancel_hours,
        partialPenaltyHours: b.partial_penalty_hours,
        partialPenaltyPct: b.partial_penalty_pct,
        depositRequired: b.deposit_required,
        autoConfirm: b.auto_confirm,
      },
    });
    return [p, late] as const;
  });
  return NextResponse.json({
    free_cancel_hours: p.freeCancelHours, partial_penalty_hours: p.partialPenaltyHours,
    partial_penalty_pct: p.partialPenaltyPct, deposit_required: p.depositRequired,
    auto_confirm: p.autoConfirm, is_customized: true,
    late_grace_minutes: late.lateGraceMinutes, max_late_extension_minutes: late.maxLateExtensionMinutes,
  });
});
