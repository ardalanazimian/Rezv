import { NextResponse } from 'next/server';
import { dbRead as db } from '@/lib/db';
import { enforceRateLimit, clientIp } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, z } from '@/lib/schemas';
import { publicOrderView, SITE_RULES } from '@/lib/site-orders';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/site/orders/{code} — پیگیریِ عمومیِ وضعیتِ سفارش
//
//  شفافیتِ مسیرِ فعال‌سازی: متقاضی با کدِ پیگیری می‌بیند سفارشش در چه مرحله‌ای
//  است (در انتظار / تماس گرفته شد / فعال شد / رد شد) بدونِ نیاز به حساب.
//
//  کد ۶ نویسه از الفبای بدونِ کاراکترِ مبهم است (≈۱٫۱ میلیارد حالت) و ریت‌لیمیت
//  ۳۰ در دقیقه دارد؛ خروجی هم فقط فیلدهای غیرحساس است (نه ایمیل/IP/یادداشتِ داخلی).
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({
  code: z.string().regex(/^RZO-[A-Z2-9]{5,12}$/, 'کدِ پیگیری معتبر نیست'),
});

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), SITE_RULES.track);
    const { code } = parseParams(await params, paramsSchema);

    const order = await db.siteOrder.findUnique({
      where: { code },
      select: {
        code: true, kind: true, status: true, planName: true, months: true,
        amountToman: true, businessName: true, trialEndsAt: true, activatedAt: true,
        planExpiresAt: true, rejectedReason: true, createdAt: true,
      },
    });
    if (!order) throw Err.notFound('سفارش');

    return NextResponse.json(publicOrderView(order));
  } catch (e) { return errorResponse(e); }
}
