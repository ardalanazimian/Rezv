import { NextResponse } from 'next/server';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { getRecentActivity } from '@/lib/notifications';

// GET /api/v1/restaurant/notifications — فعالیتِ اخیرِ واقعیِ رستوران
// (رزروِ جدید، نظرِ جدید، هشدارِ ریزش) برایِ زنگوله‌یِ اعلانِ پنل.
// ⚠️ رفعِ باگِ RBAC (یافته‌ی ریویوی Copilot روی PR): این endpoint نامِ
// مشتری و churnRiskScore برمی‌گرداند — دقیقاً همان دیتایِ حساسی که
// analytics/customers پشتِ canViewAnalytics محافظت می‌کنند. بدونِ این
// مجوز، هر staffِ احرازشده (حتی بدونِ دسترسیِ آنالیتیکس) می‌توانست این
// داده را از مسیرِ اعلان دور بزند.
export const GET = withRestaurantAuth({ permission: 'canViewAnalytics', rateLimit: 'search' }, async (_req, ctx) => {
  const items = await getRecentActivity(ctx.restaurant.id);
  return NextResponse.json({ items });
});
