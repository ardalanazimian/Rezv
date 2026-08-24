import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { topupSms, getSmsBalance } from '@/lib/sms-balance';
import { audit } from '@/lib/audit';
import { errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';

const paramsSchema = z.object({ id: zUuid });
const topupSchema = z.object({ amount: z.number().int().min(1).max(1_000_000), note: z.string().max(500).optional() });

/**
 * GET — موجودی و تاریخچه‌ی SMS یک رستوران.
 * POST — شارژ موجودی SMS رستوران (توسط ادمین پلتفرم). ثبت در audit.
 *
 * body (POST): { amount: number, note?: string }
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);
    const { id } = parseParams(await params, paramsSchema);
    const balance = await getSmsBalance(id);
    return NextResponse.json(balance);
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = adminAuthFromRequest(req);
    const { id } = parseParams(await params, paramsSchema);
    const body = await parseBody(req, topupSchema);
    const amount = body.amount;

    const result = await topupSms(id, amount, admin.sub, body.note);

    // ثبت عملیات مالی در audit
    await audit({
      action: 'admin.action', actorId: admin.sub, actorType: 'admin',
      targetId: id, restaurantId: id, ip: clientIp(req),
      detail: { operation: 'sms_topup', amount, new_balance: result.balance },
    });

    return NextResponse.json({ ok: true, balance: result.balance, added: amount });
  } catch (e) { return errorResponse(e); }
}
