import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { getCustomerEconomyProfile } from '@/lib/economy';
import { Err, errorResponse } from '@/lib/errors';

/**
 * GET /api/v1/me/economy — پروفایلِ اقتصادِ یکپارچه‌ی مشتری.
 *
 * ⚠️ reliabilityScoreِ خام عمداً برنمی‌گرده — طبقِ طراحی، اون عددِ داخلیه
 * (تصمیم‌گیریِ الگوریتمی، مثلاً resolvePolicy). مشتری فقط reputationTierِ
 * مشتق‌شده رو می‌بینه — نشون‌دادنِ عددِ خامِ تنبیهی ضدِ تجربه‌ست.
 */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();

    const profile = await getCustomerEconomyProfile(db as any, auth.sub);
    const recentLedger = await db.economyLedgerEntry.findMany({
      where: { userId: auth.sub },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      reputation_tier: profile.reputationTier,
      xp_total: profile.xpTotal,
      wallet_balance: profile.walletBalance,
      strike_count: profile.strikeCount,
      recent_activity: recentLedger.map((l) => ({
        kind: l.kind, amount: l.amount, source: l.source, created_at: l.createdAt,
      })),
    });
  } catch (e) { return errorResponse(e); }
}
