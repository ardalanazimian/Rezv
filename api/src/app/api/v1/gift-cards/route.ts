import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { createGiftCard, checkGiftCard } from '@/lib/loyalty';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseQuery, zPhone, zUuid, z } from '@/lib/schemas';

const querySchema = z.object({ code: z.string().min(1).max(50) });
const bodySchema = z.object({
  amount_toman: z.number().int().min(1).max(1_000_000_000),
  recipient_name: z.string().min(1).max(100).optional(),
  recipient_phone: zPhone.optional(),
  message: z.string().max(500).optional(),
  restaurant_id: zUuid.optional(),
});

/** GET /api/v1/gift-cards?code=GIFT... — بررسی موجودی کارت هدیه */
export async function GET(req: Request) {
  try {
    const { code } = parseQuery(req, querySchema);
    return NextResponse.json(await checkGiftCard(code));
  } catch (e) { return errorResponse(e); }
}

/** POST — خرید کارت هدیه. بدنه: { amount_toman, recipient_name?, recipient_phone?, message?, restaurant_id? } */
export async function POST(req: Request) {
  try {
    let buyerId: string | undefined;
    try { const a = authFromRequest(req); if (a.kind === 'customer') buyerId = a.sub; } catch {}
    const b = await parseBody(req, bodySchema);
    const card = await createGiftCard({
      buyerId, amountToman: b.amount_toman,
      recipientName: b.recipient_name, recipientPhone: b.recipient_phone,
      message: b.message, restaurantId: b.restaurant_id,
    });
    return NextResponse.json(card);
  } catch (e) { return errorResponse(e); }
}
