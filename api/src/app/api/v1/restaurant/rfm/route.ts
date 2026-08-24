import { getRfmDistribution } from '@/lib/rfm';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { NextResponse } from 'next/server';

/**
 * GET /api/v1/restaurant/rfm — توزیع سگمنت‌های RFM مشتریان.
 * برای داشبورد CRM صاحب کسب‌وکار (نیاز به دسترسی مشاهده‌ی مشتریان).
 */
export const GET = withRestaurantAuth(
  { permission: 'canViewAnalytics', rateLimit: 'search' },
  async (_req, ctx) => {
    const distribution = await getRfmDistribution(ctx.restaurant.id);
    const total = distribution.reduce((s, d) => s + d.count, 0);
    return NextResponse.json({ total, segments: distribution });
  },
);
