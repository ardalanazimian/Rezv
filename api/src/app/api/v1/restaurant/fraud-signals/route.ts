import { runFraudScan } from '@/lib/fraud';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { NextResponse } from 'next/server';

/**
 * GET /api/v1/restaurant/fraud-signals — سیگنال‌های تقلب/سوءاستفاده.
 * برای صاحب کسب‌وکار (نیاز به دسترسی مشاهده‌ی درآمد/آنالیتیکس).
 * تشخیص است نه مسدودسازی خودکار — صاحب تصمیم می‌گیرد.
 */
export const GET = withRestaurantAuth(
  { permission: 'canViewRevenue', rateLimit: 'search' },
  async (_req, ctx) => {
    const signals = await runFraudScan(ctx.restaurant.id);
    return NextResponse.json({
      count: signals.length,
      high: signals.filter((s) => s.severity === 'high').length,
      signals,
    });
  },
);
