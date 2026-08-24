import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { dbRead as db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseQuery, z } from '@/lib/schemas';
import { publicMenuUrl } from '@/lib/public-urls';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/restaurant/menu/qr — QRِ منویِ عمومیِ همین رستوران
//
//  چرا سمتِ سرور و نه در مرورگر: پنلِ بیزنس vanilla-JS و بدونِ build است، پس
//  نمی‌تواند کتابخانه‌ی npm را import کند. نوشتنِ رمزگذارِ QR با دست هم یعنی
//  پیاده‌سازیِ Reed-Solomon و ماسک‌گذاری از صفر — کاری که یک باگِ ریزش
//  QRهایِ چاپ‌شده‌ی رویِ میزها را غیرقابلِ‌اسکن می‌کند و تا شکایتِ مشتری
//  کسی نمی‌فهمد. اینجا از کتابخانه‌ی جاافتاده استفاده می‌شود.
//
//  ⚠️ محتوایِ QR **از سرور** ساخته می‌شود، نه از ورودیِ کلاینت: پنل فقط
//  می‌گوید «QRِ من را بده» و سرور slugِ رستورانِ توکن را خودش درمی‌آورد.
//  اگر slug از کوئری می‌آمد، هرکسی می‌توانست QRی بسازد که ظاهرش مالِ این
//  رستوران است ولی به آدرسِ دلخواهِ او می‌رود.
//
//  خروجی SVG است (نه PNG): برداری یعنی روی هر اندازه‌ای — از استیکرِ ۵
//  سانتی تا استندِ A4 — بدونِ افتِ کیفیت چاپ می‌شود، و حجمش ~۱.۵ کیلوبایت
//  در برابرِ چند ده کیلوبایتِ PNG. تبدیل به PNG در خودِ مرورگر انجام
//  می‌شود (canvas)، پس هر دو فرمت بدونِ بارِ اضافه روی سرور در دسترس‌اند.
// ═══════════════════════════════════════════════════════════════════════

const querySchema = z.object({
  // اندازه‌ی منطقیِ SVG. سقف دارد تا رشته‌ی خروجی بی‌مرز بزرگ نشود.
  size: z.number().int().min(128).max(2048).default(512),
});

export const GET = withRestaurantAuth({ permission: 'canManageSettings' }, async (req, ctx) => {
  const { size } = parseQuery(req, querySchema);

  const r = await db.restaurant.findUnique({
    where: { id: ctx.restaurant.id },
    select: { slug: true },
  });
  // رستورانِ بدونِ slug نمی‌تواند صفحه‌ی عمومی داشته باشد، پس QR هم بی‌معناست.
  if (!r?.slug) throw Err.notFound('رستوران');

  const url = publicMenuUrl(r.slug);
  const svg = await QRCode.toString(url, {
    type: 'svg',
    // سطحِ تصحیحِ خطایِ M: تعادلِ متعارف. QRِ روی میز خط‌وخش و لکه می‌گیرد،
    // ولی سطحِ بالاتر (Q/H) ماژول‌ها را ریزتر می‌کند که برایِ چاپِ کوچک بدتر است.
    errorCorrectionLevel: 'M',
    margin: 2,     // «ناحیه‌ی آرام» — کمتر از این، خواندنِ QR ناپایدار می‌شود
    width: size,
  });

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // عمداً هدرِ Cache-Control نمی‌گذاریم: `src/middleware.ts` روی هر پاسخِ
      // API مقدارِ `no-store` را می‌نشاند و هر چیزی که اینجا ست شود بازنویسی
      // می‌شود. گذاشتنش فقط کدِ مرده‌ای می‌سازد که ادعای کش‌شدن دارد ولی
      // اثری ندارد (با curl تأیید شد: پاسخ `no-store` برمی‌گردد).
      // ساختِ QR ارزان است (~۱.۶ کیلوبایت، بدونِ I/O جز یک کوئریِ slug).
      'X-Menu-Url': encodeURI(url),
    },
  });
});
