import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseBody, z } from '@/lib/schemas';
import {
  getOutreachStatsBySource,
  ATTRIBUTION_WINDOW_DAYS,
  MIN_RESOLVED_FOR_RATE,
} from '@/lib/outreach-ledger';

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

  // ⚠️ نرخِ تبدیل دیگر از marketing_automations.converted_count نمی‌آید.
  // آن ستون در کلِ ریپو هیچ‌جا افزایش نمی‌یافت، پس عبارتِ قبلی
  // (converted_count / sent_count) *ساختاراً* همیشه صفر برمی‌گرداند و پنل
  // «۰٪ تبدیل» نشان می‌داد — یک معیارِ عملکرد که هیچ کدی نمی‌توانست پرش کند.
  // حالا از دفترِ ارتباط‌گیری (migration 057) محاسبه می‌شود، و اگر شواهد کافی
  // نباشد null برمی‌گردد نه صفر (بندِ ۲۰: هرگز قطعیتِ نداشته نساز).
  const stats = await getOutreachStatsBySource({
    restaurantId: ctx.restaurant.id,
    source: 'automation',
    sourceIds: items.map(a => a.id),
  });

  return NextResponse.json({
    // فراداده‌ی اندازه‌گیری تا کلاینت بتواند «هنوز کافی نیست» را درست بگوید
    attribution: {
      window_days: ATTRIBUTION_WINDOW_DAYS,
      min_resolved: MIN_RESOLVED_FOR_RATE,
    },
    items: items.map(a => {
      const s = stats.get(a.id);
      return {
        id: a.id, name: a.name, trigger: a.trigger, trigger_config: a.triggerConfig,
        message_template: a.messageTemplate, coupon_id: a.couponId, is_active: a.isActive,
        last_run_at: a.lastRunAt, sent_count: a.sentCount,
        // ردیف‌هایی که نتیجه‌شان قطعی شده — مخرجِ واقعیِ نرخ. ارسال‌های
        // دیروز هنوز در پنجره‌اند و اینجا شمرده نمی‌شوند.
        resolved_count: s?.resolvedCount ?? 0,
        converted_count: s?.convertedCount ?? 0,
        // ⚠️ null = «هنوز نمی‌دانیم»، نه «صفر». کلاینت حق ندارد ۰٪ نشانش دهد.
        conversion_rate_pct: s?.ratePct ?? null,
        conversion_status: s?.status ?? 'insufficient_data',
      };
    }),
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
