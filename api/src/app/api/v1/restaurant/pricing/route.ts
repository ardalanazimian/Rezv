import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { suggestPricing, type HeatCell } from '@/lib/pricing';
import { parseBody, zTimeStr, z } from '@/lib/schemas';

const rulesSchema = z.array(z.object({
  dows: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  from: zTimeStr,
  to: zTimeStr,
  min_toman: z.number().int().min(0),
})).max(50).optional();
const pricingSchema = z.object({
  rules: rulesSchema,
  base_min_spend_toman: z.number().int().min(0).default(0),
});

export const GET = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'search' }, async (_req, ctx) => {
  const r = await db.restaurant.findUnique({
    where: { id: ctx.restaurant.id },
    select: { pricingRules: true, baseMinSpendToman: true },
  });

  // داده‌ی شلوغیِ ۹۰ روز اخیر برای تولیدِ پیشنهاد
  const heat = await db.$queryRaw<HeatCell[]>`
    SELECT EXTRACT(DOW FROM slot_start)::int AS dow,
           EXTRACT(HOUR FROM slot_start)::int AS hour,
           COUNT(*)::int AS count
    FROM reservations
    WHERE restaurant_id = ${ctx.restaurant.id}::uuid
      AND slot_start >= now() - interval '90 days'
      AND status IN ('confirmed','arrived','seated','completed')
    GROUP BY dow, hour
  `.catch(() => [] as HeatCell[]);

  const suggestions = suggestPricing(heat, r?.baseMinSpendToman ?? 0);

  return NextResponse.json({
    current_rules: r?.pricingRules ?? [],
    base_min_spend_toman: r?.baseMinSpendToman ?? 0,
    suggestions,
    has_data: heat.length > 0,
  });
});

export const PUT = withRestaurantAuth({ permission: 'canManageSettings', rateLimit: 'auth' }, async (req, ctx) => {
  const b = await parseBody(req, pricingSchema);

  await db.restaurant.update({
    where: { id: ctx.restaurant.id },
    data: {
      pricingRules: b.rules ? (b.rules as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      baseMinSpendToman: b.base_min_spend_toman,
    },
  });

  return NextResponse.json({ ok: true });
});
