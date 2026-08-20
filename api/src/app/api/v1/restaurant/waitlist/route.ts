import { NextResponse } from 'next/server';
import { getQueue, promoteNext } from '@/lib/waitlist';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';

/** GET /api/v1/restaurant/waitlist — صف لیست انتظار (داشبورد). مهاجرت‌شده: حالا rate-limit هم دارد. */
export const GET = withRestaurantAuth(
  { rateLimit: 'search' },
  async (_req, ctx) => {
    const queue = await getQueue(ctx.restaurant.id);
    return NextResponse.json({ queue, size: queue.filter(q => q.status === 'waiting').length });
  },
);

/** POST /api/v1/restaurant/waitlist — ارتقای دستی نفر بعدی. نیاز به مدیریت لیست انتظار. */
export const POST = withRestaurantAuth(
  { permission: 'canManageWaitlist', rateLimit: 'auth' },
  async (_req, ctx) => {
    const result = await promoteNext(ctx.restaurant.id);
    return NextResponse.json(result);
  },
);
