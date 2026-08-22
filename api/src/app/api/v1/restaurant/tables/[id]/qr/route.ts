import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { assignQrCode } from '@/lib/tables';
import { tableCheckInUrl } from '@/lib/public-urls';
import { audit } from '@/lib/audit';
import { clientIp } from '@/lib/ratelimit';
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

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/v1/restaurant/tables/:id/qr — بازتولیدِ کد (ابطالِ استیکرِ قبلی)
//
//  ⚠️ چرا این روت لازم بود: `assignQrCode` از روزِ اول پارامترِ `regenerate`
//  داشت و کامنتِ خودش هم دلیلش را نوشته بود («وقتی استیکرِ قدیمی گم/کپی
//  شده») — ولی **هیچ‌کس با `regenerate: true` صدایش نمی‌زد**. یعنی قابلیت
//  پیاده بود و از بیرون به آن نمی‌شد رسید؛ همان الگویِ «کدِ خفته» که در
//  خودِ check-inِ QR (PR #61) و فیچرِ بیعانه (§۲u) هم دیده شد.
//
//  ⚠️ این عمل **برگشت‌ناپذیر** است: کدِ قبلی برنمی‌گردد و هر استیکری که با
//  آن چاپ شده از همان لحظه مرده است — مهمانی که آن را اسکن کند «میز پیدا
//  نشد» می‌گیرد. پس دو محافظ دارد:
//    • `audit` با اکشنِ `table.qr_regenerated` — تا معلوم باشد چه کسی و کِی
//      (مثلاً وقتی مهمان می‌گوید QR کار نمی‌کند).
//    • تأییدِ صریح در UIِ پنل، با متنی که همین اثر را می‌گوید.
//
//  جدا از GET نگه داشته شد، نه یک پارامترِ `?regenerate=1` رویِ همان GET:
//  یک GET نباید حالت را عوض کند (prefetchِ مرورگر یا هر خزنده‌ای می‌توانست
//  استیکرهایِ یک رستوران را دسته‌جمعی باطل کند).
// ═══════════════════════════════════════════════════════════════════════
export const POST = withRestaurantAuth(
  { rateLimit: 'auth', permission: 'canManageTables' },
  async (req, ctx, rawParams: { id: string }) => {
    const { id } = parseParams(rawParams, paramsSchema);

    // مالکیتِ تنانت پیش از هر کاری — با حدسِ UUID نباید بشود استیکرِ میزِ
    // رستورانِ دیگری را باطل کرد (خرابکاریِ ساده و کاملاً نامرئی).
    const table = await db.table.findUnique({
      where: { id },
      select: { restaurantId: true, number: true, qrCode: true },
    });
    if (!table || table.restaurantId !== ctx.restaurant.id) throw Err.notFound('میز');

    const previous = table.qrCode;
    const code = await assignQrCode(id, ctx.restaurant.id, { regenerate: true });

    await audit({
      action: 'table.qr_regenerated',
      actorId: ctx.auth.sub,
      actorType: 'staff',
      targetId: id,
      restaurantId: ctx.restaurant.id,
      ip: clientIp(req),
      // کدِ قبلی ثبت می‌شود تا اگر مهمانی با استیکرِ قدیمی مشکل داشت، بشود
      // فهمید کدام کد و کِی باطل شده. کدِ جدید ثبت نمی‌شود — در DB هست و
      // نوشتنش در لاگ فقط سطحِ حساسیتِ لاگ را بالا می‌برد.
      detail: { table_number: table.number, previous_code: previous ?? null },
    });

    return NextResponse.json({ code, table_number: table.number });
  },
);
