import { NextResponse } from 'next/server';
import { getWaitlistAnalytics } from '@/lib/waitlist';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseQuery, z } from '@/lib/schemas';

const querySchema = z.object({ days: z.number().int().min(1).max(365).default(30) });

/** GET /api/v1/restaurant/waitlist/analytics — آمار لیست انتظار */
export const GET = withRestaurantAuth(
  { permission: 'canViewAnalytics', rateLimit: 'search' },
  async (req, ctx) => {
    const { days } = parseQuery(req, querySchema);
    const analytics = await getWaitlistAnalytics(ctx.restaurant.id, days);
    return NextResponse.json(analytics);
  },
);
