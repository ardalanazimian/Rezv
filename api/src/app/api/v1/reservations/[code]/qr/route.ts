import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, parseQuery, zReservationCode, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/reservations/:code/qr — QRِ کدِ رزرو (SVG)
//
//  ⚠️ باگی که این روت از آن زاده شد (ممیزیِ ۲۰۲۶-۰۸-۲۱):
//
//  `apps/customer/js/features/trips.js` تابعی به نامِ `qrSVG` داشت که
//  **QR نبود** — یک الگویِ شبه‌تصادفی از hashِ متن، با سه مربعِ گوشه که
//  شبیهِ finder pattern دیده می‌شد. کامنتِ خودش هم اعتراف می‌کرد:
//  «الگوی شبه‌تصادفی قطعی از hash متن (نمایشی)».
//
//  یعنی دکمه‌ی «QR ورود» و کارتِ کیفِ پول، تصویری نشان می‌دادند که **هیچ
//  اسکنری نمی‌خواند**. مهمان آن را جلویِ میزبان می‌گرفت و هیچ اتفاقی
//  نمی‌افتاد. این دقیقاً همان «دادهٔ جعلی که باید واقعی باشد» است.
//
//  چرا سمتِ سرور: اپِ مشتری بدونِ build است و نمی‌تواند کتابخانه‌ی npm را
//  import کند؛ نوشتنِ رمزگذارِ QR با دست هم یعنی Reed-Solomon و ماسک‌گذاری
//  از صفر. همان دلیلی که `/restaurant/menu/qr` و `/restaurant/tables/:id/qr`
//  را سمتِ سرور کرد (بندِ ۴۳: توسعه به‌جای تکرار).
//
//  ── امنیت ──
//  دقیقاً همان قواعدِ `GET /reservations/:code`: احراز هویتِ اجباری، مشتری
//  فقط رزروِ خودش، کارکنان فقط رزروهایِ تنانتِ خودشان، و rate-limit برایِ
//  جلوگیری از enumerationِ کدِ ۸ نویسه‌ای. بدونِ این‌ها، این روت همان
//  IDORی می‌شد که در روتِ خواهرش بسته شده بود — با این تفاوت که «فقط یک
//  تصویر است» آدم را گول می‌زند: خودِ تصویر تأیید می‌کند که آن کد وجود دارد.
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({ code: zReservationCode });
const querySchema = z.object({
  size: z.number().int().min(128).max(2048).default(360),
});

async function GET_impl(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    const auth = authFromRequest(req);
    const { code } = parseParams(await params, paramsSchema);
    const { size } = parseQuery(req, querySchema);

    const r = await db.reservation.findUnique({
      where: { code },
      select: { userId: true, restaurant: { select: { tenantId: true } } },
    });
    if (!r) throw Err.notFound('رزرو');

    // ۴۰۴ نه ۴۰۳ — تا وجود/عدم‌وجودِ کد لو نرود.
    if (auth.kind === 'staff') {
      if (r.restaurant.tenantId !== auth.tenantId) throw Err.notFound('رزرو');
    } else if (r.userId !== auth.sub) {
      throw Err.notFound('رزرو');
    }

    // محتوایِ QR خودِ کدِ رزرو است، نه یک URL: میزبان با هر اسکنرِ عمومی
    // آن را می‌خواند و همان رشته را در پنل جستجو می‌کند. اگر URL می‌گذاشتیم،
    // اسکنر میزبان را به صفحه‌ای می‌برد که برایِ کارکنان ساخته نشده.
    const svg = await QRCode.toString(code, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: size,
    });

    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/reservations/[code]/qr', GET_impl);
