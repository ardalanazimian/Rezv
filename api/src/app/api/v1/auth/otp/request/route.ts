import { NextResponse } from 'next/server';
import { requestOtp } from '@/lib/otp';
import { errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';

import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ phone: zPhone });

async function POST_impl(req: Request) {
  try {
    // ⚠️ سقفِ per-IP — تا امروز **هیچ‌جا اعمال نمی‌شد**. `RULES.otpPerIp`
    // از روزِ اول تعریف شده بود ولی صفر مصرف‌کننده داشت (grep تأیید شد).
    //
    // چرا نبودش مهم بود: سقفِ per-phone پایین‌تر (`otp.ts`) فقط جلوی
    // آزارِ **یک شماره** را می‌گیرد. مهاجمی که هزار شماره‌ی متفاوت را از یک
    // IP صدا بزند هیچ سدی نداشت جز `globalPerIp` (۱۲۰/دقیقه در middleware)
    // که برای این کار بسیار گشاد است — و هر درخواست یک **پیامکِ واقعیِ
    // پولی** می‌فرستد. یعنی هم هزینه‌ی مستقیم، هم آزارِ کاربرانِ واقعی.
    //
    // اول ریت‌لیمیت، بعد پارسِ بدنه: بدنه‌ی درخواستِ مردود اصلاً خوانده نشود.
    await enforceRateLimit(clientIp(req), RULES.otpPerIp);

    const { phone } = await parseBody(req, schema);
    const r = await requestOtp(phone);
    return r.devCode ? NextResponse.json(r) : new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/otp/request', POST_impl);
