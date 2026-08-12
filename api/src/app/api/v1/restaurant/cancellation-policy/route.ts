import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseBody, z } from '@/lib/schemas';
import { Err } from '@/lib/errors';

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
});

export const GET = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'search' }, async (_req, ctx) => {
  const p = await db.cancellationPolicy.findUnique({ where: { restaurantId: ctx.restaurant.id } });
  return NextResponse.json({
    free_cancel_hours: p?.freeCancelHours ?? 24,
    partial_penalty_hours: p?.partialPenaltyHours ?? 2,
    partial_penalty_pct: p?.partialPenaltyPct ?? 50,
    deposit_required: p?.depositRequired ?? false,
    auto_confirm: p?.autoConfirm ?? true,
    is_customized: !!p,
  });
});

export const PUT = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'auth' }, async (req, ctx) => {
  const b = await parseBody(req, bodySchema);
  if (b.partial_penalty_hours > b.free_cancel_hours) {
    throw Err.validation('partial_penalty_hours نمی‌تواند از free_cancel_hours بزرگ‌تر باشد');
  }
  const p = await db.cancellationPolicy.upsert({
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
  return NextResponse.json({
    free_cancel_hours: p.freeCancelHours, partial_penalty_hours: p.partialPenaltyHours,
    partial_penalty_pct: p.partialPenaltyPct, deposit_required: p.depositRequired,
    auto_confirm: p.autoConfirm, is_customized: true,
  });
});
