import { NextResponse } from 'next/server';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { getRecentActivity } from '@/lib/notifications';

// GET /api/v1/restaurant/notifications — فعالیتِ اخیرِ واقعیِ رستوران
// (رزروِ جدید، نظرِ جدید، هشدارِ ریزش) برایِ زنگوله‌یِ اعلانِ پنل.
export const GET = withRestaurantAuth({ rateLimit: 'search' }, async (_req, ctx) => {
  const items = await getRecentActivity(ctx.restaurant.id);
  return NextResponse.json({ items });
});
