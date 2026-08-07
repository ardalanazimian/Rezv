import { NextResponse } from 'next/server';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { getManagerInsights } from '@/lib/restaurant-manager';

/**
 * GET /api/v1/restaurant/manager-insights — «AI Restaurant Manager».
 * پاسخِ ساختارمند و مستند به سؤالاتِ مدیریتیِ رایج (چرا دیروز رزرو کمتر
 * بود، کدام روزها قوی‌ترند، کدام مشتری‌ها در حالِ ریزش‌اند، کدام میزها
 * کم‌استفاده‌اند) — نه یک چت با NLU، هر پاسخ عددِ پشتِ خودش را نشان می‌دهد
 * (lib/restaurant-manager.ts). اگر داده کم باشد، آن سؤال اصلاً در پاسخ نیست.
 */
export const GET = withRestaurantAuth({ permission: 'canViewAnalytics' }, async (_req, ctx) => {
  const answers = await getManagerInsights(ctx.restaurant.id);
  return NextResponse.json({ answers });
});
