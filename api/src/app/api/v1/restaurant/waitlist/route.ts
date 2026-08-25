import { NextResponse } from 'next/server';
import { getQueue, promoteNext, leaveWaitlist } from '@/lib/waitlist';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseQuery, z } from '@/lib/schemas';

/**
 * GET /api/v1/restaurant/waitlist — صف لیست انتظار (داشبورد).
 *
 * ⚠️ رفعِ ناهم‌خوانیِ مجوز (ممیزیِ RBAC): `POST` و `DELETE` همین فایل از قبل
 * `canManageWaitlist` داشتند ولی `GET` نداشت — یعنی خواندنِ صف (که نام و
 * شماره‌ی هر نفرِ در انتظار را دارد) برایِ هر کارمندی باز بود، در حالی که
 * نوشتنش بسته بود. دری که فقط از یک طرف قفل است.
 */
export const GET = withRestaurantAuth(
  { permission: 'canManageWaitlist', rateLimit: 'search' },
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

/**
 * DELETE /api/v1/restaurant/waitlist?entry_id=... — حذفِ یک ورودی از صف توسطِ پرسنل
 * (مهمان رفته، اشتباه ثبت شده، …).
 *
 * ⚠️ فازِ ۲ (§۳): دکمه‌ی «حذف» در پنل از قبل وجود داشت ولی هیچ مسیرِ سروری
 * نداشت — فقط آرایه‌ی محلی را فیلتر می‌کرد و موفقیت اعلام می‌کرد. منطقِ واقعی
 * (`leaveWaitlist`) از قبل در lib بود و فقط به پرسنل وصل نشده بود؛ این‌جا
 * وصل می‌شود، نه اینکه سیستمِ تازه‌ای ساخته شود.
 */
export const DELETE = withRestaurantAuth(
  { permission: 'canManageWaitlist', rateLimit: 'auth' },
  async (req, ctx) => {
    const { entry_id } = parseQuery(req, z.object({ entry_id: z.string().uuid() }));
    const result = await leaveWaitlist(entry_id, { staffRestaurantId: ctx.restaurant.id });
    return NextResponse.json(result);
  },
);
