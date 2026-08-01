import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseQuery, z } from '@/lib/schemas';
import { postMessage, markRead, serializeMessage } from '@/lib/chat';

// اطمینان از اینکه این thread متعلق به همین کاربر است.
async function ownedThread(threadId: string, userId: string) {
  const t = await db.chatThread.findUnique({ where: { id: threadId }, select: { id: true, userId: true } });
  if (!t || t.userId !== userId) throw Err.forbidden();
  return t;
}

const getQuery = z.object({ after: z.string().max(40).optional() });

/**
 * GET /api/v1/me/chats/:id?after=<iso>  — پیام‌های یک گفتگو.
 * پارامترِ after برای polling: فقط پیام‌های جدیدتر از آن زمان (کارآمد).
 * همچنین پیام‌های staff را خوانده‌شده علامت می‌زند.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await enforceRateLimit(clientIp(req), RULES.search);
    const { id } = await params;
    await ownedThread(id, auth.sub);
    const { after } = parseQuery(req, getQuery);

    const where: Record<string, unknown> = { threadId: id };
    if (after) {
      const d = new Date(after);
      if (!isNaN(+d)) where.createdAt = { gt: d };
    }
    const messages = await db.chatMessage.findMany({
      where, orderBy: { createdAt: 'asc' }, take: 100,
    });

    // فقط اگر پیام جدیدی از سمت staff بوده، read بزن (کاهش نوشتنِ بی‌مورد در polling)
    if (!after || messages.some(m => m.sender === 'staff')) {
      await markRead(id, 'user').catch(() => {});
    }

    return NextResponse.json({ items: messages.map(serializeMessage), server_time: new Date().toISOString() });
  } catch (e) { return errorResponse(e); }
}

const postSchema = z.object({ body: z.string().min(1).max(2000).trim() });

/** POST /api/v1/me/chats/:id — ارسال پیام مشتری در یک گفتگوی موجود */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { id } = await params;
    await ownedThread(id, auth.sub);
    const { body } = await parseBody(req, postSchema);
    const msg = await postMessage({ threadId: id, sender: 'user', body });
    return NextResponse.json(serializeMessage(msg), { status: 201 });
  } catch (e) { return errorResponse(e); }
}
