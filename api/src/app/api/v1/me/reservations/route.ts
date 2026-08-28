import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { dbRead as db } from '@/lib/db';
import { Err, errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/** GET — تاریخچه برای «رزرو مجدد» */
async function GET_impl(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const list = await db.reservation.findMany({
      where: { userId: auth.sub },
      orderBy: { slotStart: 'desc' },
      take: 50,
      include: {
        restaurant: {
          select: {
            name: true, slug: true,
            cancellationPolicy: { select: { freeCancelHours: true } },
          },
        },
        items: { include: { menuItem: { select: { name: true } } } },
      },
    });
    // ⚠️ قراردادِ این route یک **آرایه‌ی خامِ ردیف‌های Prisma** است (نه `{items}`)
    // و چند تستِ E2E همان را پین کرده‌اند — پس فقط فیلد اضافه می‌شود، شکل نه.
    // `slotStart` از قبل با spread می‌آید و کلاینت برایِ محاسبه‌ی «دیرهنگام
    // بودنِ لغو» به آن نیاز دارد.
    //
    // چرا `freeCancelHours` این‌جا مسطح می‌شود و پیش‌فرضش سمتِ سرور است:
    // پنجره‌ی لغو یک قاعده‌ی **اجراشونده** است (economy.ts:111 امتیاز و strike
    // را از رویش می‌سازد). اگر کلاینت پیش‌فرضِ خودش را داشته باشد، روزی که
    // سرور عوض شود کلاینت عددِ کهنه را به مهمان نشان می‌دهد — یعنی همان
    // «جریمه‌ی اعلام‌نشده» از یک مسیرِ تازه. عددِ ۲۴ عمداً با
    // `economy.ts:154` و `restaurants/[slug]/route.ts:135` یکی است.
    return NextResponse.json(list.map(r => ({
      ...r,
      restaurant: r.restaurant && {
        name: r.restaurant.name,
        slug: r.restaurant.slug,
        freeCancelHours: r.restaurant.cancellationPolicy?.freeCancelHours ?? 24,
      },
    })));
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/me/reservations', GET_impl);
