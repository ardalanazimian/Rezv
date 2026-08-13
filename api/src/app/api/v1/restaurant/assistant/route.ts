import { NextResponse } from 'next/server';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseBody, z } from '@/lib/schemas';
import { askAssistant, getAssistantStats } from '@/lib/assistant';

// ═══════════════════════════════════════════════════════════
//  GET  /restaurant/assistant  — آمارِ شفافیت (چند سؤال، چقدر یاد گرفته)
//  POST /restaurant/assistant  — پرسیدنِ یک سؤالِ آزادمتنِ فارسی
//
//  کاملاً آفلاین: هیچ فراخوانیِ AI/LLM بیرونی نیست. طبقه‌بندی و پاسخ از
//  lib/assistant.ts (Naive Bayesِ دستی + دادهٔ واقعیِ همین رستوران).
// ═══════════════════════════════════════════════════════════

const askSchema = z.object({
  message: z.string().min(1).max(500),
});

export const GET = withRestaurantAuth({ permission: 'canViewAnalytics' }, async (_req, ctx) => {
  const stats = await getAssistantStats(ctx.restaurant.id);
  return NextResponse.json(stats);
});

export const POST = withRestaurantAuth({ rateLimit: 'search', permission: 'canViewAnalytics' }, async (req, ctx) => {
  const b = await parseBody(req, askSchema);
  const result = await askAssistant({
    restaurantId: ctx.restaurant.id,
    staffId: ctx.auth.kind === 'staff' ? ctx.auth.sub : null,
    question: b.message,
  });
  return NextResponse.json(result);
});
