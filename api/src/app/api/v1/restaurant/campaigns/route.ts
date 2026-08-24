import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';

/** GET — تاریخچه‌ی کمپین‌های پیامکی ارسال‌شده */
export const GET = withRestaurantAuth({ permission: 'canManageCampaigns', rateLimit: 'search' }, async (_req, ctx) => {
  const logs = await db.campaignLog.findMany({
    where: { restaurantId: ctx.restaurant.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return NextResponse.json({
    items: logs.map(l => ({
      id: l.id, segment: l.segment, message: l.message,
      recipients_count: l.recipientsCount, created_at: l.createdAt,
    })),
  });
});
