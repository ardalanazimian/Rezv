import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { getReferralStats, createReferral } from '@/lib/loyalty';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';

import { withApiMetrics } from '@/lib/api-metrics';

const inviteSchema = z.object({ phone: zPhone });

/** GET — آمار و کد دعوت کاربر */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    return NextResponse.json(await getReferralStats(auth.sub));
  } catch (e) { return errorResponse(e); }
}

/**
 * سقفِ روزانه‌ی دعوت به‌ازای هر کاربر.
 *
 * ⚠️ چرا لازم شد (یافته‌ی ممیزیِ نهایی، ۲۰۲۶-۰۸-۲۵) — این مسیر پول خرج
 * می‌کرد و هیچ سقفی نداشت:
 *   ۱. این POST هیچ `enforceRateLimit`ی نداشت.
 *   ۲. `createReferral` پیامک را **بدونِ `restaurantId`** صف می‌کند
 *      (`loyalty.ts`)، و worker فقط وقتی از موجودی کم می‌کند که
 *      `restaurantId` باشد ⇒ **هیچ موجودی‌ای مصرف نمی‌شد**.
 *   ۳. گاردِ تکراری فقط روی جفتِ (دعوت‌کننده، شماره) است، پس چرخاندنِ
 *      شماره آن را بی‌اثر می‌کند.
 * نتیجه: یک توکنِ مشتریِ معمولی می‌توانست پیامکِ نامحدودِ **به حسابِ
 * پلتفرم** به شماره‌های دلخواهِ شخصِ ثالث بفرستد — تنها سدش
 * `globalPerIp` (۱۲۰ در دقیقه) بود.
 *
 * دو سقف لازم است، نه یکی: per-IP جلوی انفجار را می‌گیرد، و per-user
 * جلوی همان حمله از چند IP (که برای یک حسابِ واقعی آسان است).
 */
const REFERRAL_PER_USER = { prefix: 'refer:user', max: 10, windowMs: 24 * 60 * 60_000 } as const;

/** POST — دعوت دوست با شماره. بدنه: { phone } */
async function POST_impl(req: Request) {
  try {
    // اول ریت‌لیمیت، بعد پارسِ بدنه — بدنه‌ی درخواستِ مردود خوانده نشود.
    await enforceRateLimit(clientIp(req), RULES.auth);
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await enforceRateLimit(auth.sub, REFERRAL_PER_USER);
    const { phone } = await parseBody(req, inviteSchema);
    return NextResponse.json(await createReferral(auth.sub, phone));
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/referral', GET_impl);
export const POST = withApiMetrics('/api/v1/me/referral', POST_impl);
