import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseBody, z } from '@/lib/schemas';

const TRIGGERS = ['birthday', 'winback', 'post_visit', 'vip_milestone', 'no_show_followup'] as const;
const automationSchema = z.object({
  name: z.string().min(1).max(100),
  trigger: z.enum(TRIGGERS),
  trigger_config: z.record().optional(),
  message_template: z.string().min(1).max(1000),
  coupon_id: z.string().uuid().optional(),
});

export const GET = withRestaurantAuth({ permission: 'canManageCampaigns' }, async (_req, ctx) => {
  const items = await db.marketingAutomation.findMany({ where: { restaurantId: ctx.restaurant.id }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({
    items: items.map(a => ({
      id: a.id, name: a.name, trigger: a.trigger, trigger_config: a.triggerConfig,
      message_template: a.messageTemplate, coupon_id: a.couponId, is_active: a.isActive,
      last_run_at: a.lastRunAt, sent_count: a.sentCount, converted_count: a.convertedCount,
      conversion_rate_pct: a.sentCount ? Math.round((a.convertedCount / a.sentCount) * 100) : 0,
    })),
  });
});

// POST — ساخت قانون خودکار جدید · بدنه: { name, trigger, trigger_config?, message_template, coupon_id? }
export const POST = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageCampaigns' }, async (req, ctx) => {
  const b = await parseBody(req, automationSchema);

  const automation = await db.marketingAutomation.create({
    data: {
      restaurantId: ctx.restaurant.id, name: b.name, trigger: b.trigger,
      triggerConfig: (b.trigger_config || {}) as Prisma.InputJsonValue, messageTemplate: b.message_template,
      couponId: b.coupon_id || null,
    },
  });
  return NextResponse.json({ id: automation.id }, { status: 201 });
});
