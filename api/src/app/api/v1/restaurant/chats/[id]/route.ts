import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseBody, parseQuery, z } from '@/lib/schemas';
import { postMessage, markRead, serializeMessage } from '@/lib/chat';

// اطمینان از اینکه thread متعلق به همین رستوران است (جلوگیری از دیدن چتِ رستوران دیگر).
async function ownedThread(threadId: string, restaurantId: string) {
  const t = await db.chatThread.findUnique({ where: { id: threadId }, select: { id: true, restaurantId: true } });
  if (!t || t.restaurantId !== restaurantId) throw Err.forbidden();
  return t;
}

const getQuery = z.object({ after: z.string().max(40).optional() });

/** GET /api/v1/restaurant/chats/:id?after=<iso> — پیام‌های یک گفتگو (polling) */
// ⚠️ رفعِ ممیزیِ RBAC: `POST` (فرستادنِ پیام) از قبل `canManageReservations`
// داشت ولی همین `GET` (خواندنِ کلِ تاریخچه‌ی گفتگو با مشتری) نداشت — یعنی
// گاردِ نوشتن بسته بود و گاردِ خواندن باز. هم‌راستا با `VIEW_PERMISSION.chat`.
export const GET = withRestaurantAuth({ permission: 'canManageReservations', rateLimit: 'search' }, async (req, ctx, params: { id: string }) => {
  await ownedThread(params.id, ctx.restaurant.id);
  const { after } = parseQuery(req, getQuery);

  const where: Record<string, unknown> = { threadId: params.id };
  if (after) { const d = new Date(after); if (!isNaN(+d)) where.createdAt = { gt: d }; }
  const messages = await db.chatMessage.findMany({ where, orderBy: { createdAt: 'asc' }, take: 100 });

  if (!after || messages.some(m => m.sender === 'user')) {
    await markRead(params.id, 'staff').catch(() => {});
  }
  return NextResponse.json({ items: messages.map(serializeMessage), server_time: new Date().toISOString() });
});

const postSchema = z.object({ body: z.string().min(1).max(2000).trim() });

/** POST /api/v1/restaurant/chats/:id — پاسخِ کارمند */
export const POST = withRestaurantAuth({ permission: 'canManageReservations', rateLimit: 'auth' }, async (req, ctx, params: { id: string }) => {
  await ownedThread(params.id, ctx.restaurant.id);
  const { body } = await parseBody(req, postSchema);
  const msg = await postMessage({ threadId: params.id, sender: 'staff', staffId: ctx.auth.sub, body });
  return NextResponse.json(serializeMessage(msg), { status: 201 });
});
