import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { assignQrCode } from '@/lib/tables';
import { tableCheckInUrl } from '@/lib/public-urls';
import { Err } from '@/lib/errors';
import { parseParams, parseQuery, zUuid, z } from '@/lib/schemas';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/restaurant/tables/:id/qr — QRِ check-inِ همین میز (SVG)
//
//  همان الگویِ `/restaurant/menu/qr` (بندِ ۴۳: توسعه به‌جای تکرار): پنلِ
//  بیزنس vanilla-JS و بدونِ build است و نمی‌تواند کتابخانه‌ی npm را import
//  کند، و نوشتنِ رمزگذارِ QR با دست یعنی Reed-Solomon از صفر — یک باگِ ریز
//  آنجا QRهایِ **چاپ‌شده رویِ میزها** را غیرقابلِ‌اسکن می‌کند و تا شکایتِ
//  مهمان کسی نمی‌فهمد.
//
//  ⚠️ محتوایِ QR از سرور ساخته می‌شود، نه از ورودیِ کلاینت: پنل فقط شناسه‌ی
//  میز را می‌دهد و سرور خودش کد را از دیتابیس درمی‌آورد و آدرس را می‌سازد.
//  اگر کد از کوئری می‌آمد، هرکسی می‌توانست استیکری بسازد که ظاهرش مالِ این
//  رستوران است ولی به آدرسِ دلخواهِ او می‌رود.
//
//  اگر میز هنوز کد ندارد (میزهایی که پیش از وصل‌شدنِ این قابلیت ساخته شده‌اند
//  و مهاجرتِ backfill به هر دلیلی به آن‌ها نرسیده) همین‌جا ساخته می‌شود —
//  رستوران‌دار نباید برای چیزی که خودش نساخته دنبالِ دکمه‌ی جدا بگردد.
//
//  خروجی SVG است نه PNG: برداری یعنی از استیکرِ ۵ سانتی تا استندِ A4 بدونِ
//  افتِ کیفیت. تبدیل به PNG در خودِ مرورگر (canvas) انجام می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const paramsSchema = z.object({ id: zUuid });
const querySchema = z.object({
  size: z.number().int().min(128).max(2048).default(512),
});

export const GET = withRestaurantAuth(
  { permission: 'canManageTables' },
  async (req, ctx, rawParams: { id: string }) => {
    const { id } = parseParams(rawParams, paramsSchema);
    const { size } = parseQuery(req, querySchema);

    // مالکیتِ تنانت پیش از هر کاری — با حدسِ UUID نباید بشود QRِ میزِ
    // رستورانِ دیگری را گرفت (که یعنی توانِ ساختِ استیکرِ جعلی برایِ آن‌ها).
    const table = await db.table.findUnique({
      where: { id },
      select: { restaurantId: true, number: true, name: true, qrCode: true },
    });
    if (!table || table.restaurantId !== ctx.restaurant.id) throw Err.notFound('میز');

    const code = table.qrCode ?? await assignQrCode(id, ctx.restaurant.id);
    const url = tableCheckInUrl(code);

    const svg = await QRCode.toString(url, {
      type: 'svg',
      // سطحِ M: تعادلِ متعارف. QRِ روی میز خط‌وخش و لکه می‌گیرد، ولی سطحِ
      // بالاتر (Q/H) ماژول‌ها را ریزتر می‌کند که برایِ چاپِ کوچک بدتر است.
      errorCorrectionLevel: 'M',
      margin: 2,   // «ناحیه‌ی آرام» — کمتر از این، خواندنِ QR ناپایدار می‌شود
      width: size,
    });

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        // عمداً `Cache-Control` نمی‌گذاریم: `src/middleware.ts` روی هر پاسخِ
        // API مقدارِ `no-store` را می‌نشاند و هرچه اینجا ست شود بازنویسی
        // می‌شود — گذاشتنش فقط کدِ مرده‌ای می‌سازد که ادعای کش دارد.
        'X-Table-Code': encodeURIComponent(code),
        'X-Table-Number': String(table.number),
        'X-Checkin-Url': encodeURI(url),
      },
    });
  },
);
