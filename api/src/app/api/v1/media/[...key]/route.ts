import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse, Err } from '@/lib/errors';
import { getObject } from '@/lib/media-store';
import { mimeFromKey, isValidStorageKey } from '@/lib/media';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════════════════
//  GET /api/v1/media/<year>/<month>/<uuid>.<ext> — سرو کردنِ عکسِ آپلودشده
//
//  ── چرا احراز هویت ندارد ──
//  عکسِ تأییدشده باید در صفحه‌ی عمومیِ رستوران و اپ مشتری بارگذاری شود، پس
//  ناگزیر عمومی است. عکسِ در انتظارِ تأیید هم با همین مسیر سرو می‌شود تا
//  رستوران‌دار و بازبینِ شرکت بتوانند ببینندش — ولی هیچ‌جای عمومی فهرست
//  نمی‌شود و نامش یک UUIDِ تصادفی است. یعنی «منتشرنشده» یعنی «لینک‌نشده»،
//  نه «قابلِ‌حدس».
//
//  ── سه هدرِ امنیتی، هر کدام دلیلِ مشخص ──
//  • nosniff: بدونِ آن، مرورگر می‌تواند محتوا را حدس بزند و فایلی که ما
//    image/png اعلام کرده‌ایم را HTML بخواند.
//  • CSP: default-src 'none' یعنی حتی اگر روزی چیزی از فیلترِ آپلود رد شد،
//    هیچ اسکریپت و درخواستِ بیرونی‌ای از دلِ این پاسخ اجرا نمی‌شود.
//  • Content-Disposition: inline با نامِ ثابت — جلوی حمله‌ی نامِ فایلِ
//    گمراه‌کننده در دانلود را می‌گیرد.
//
//  MIME از پسوندِ کلید می‌آید، نه از چیزی که در دیتابیس ذخیره شده: مسیرِ سرو
//  حتی به دیتابیس هم دست نمی‌زند، پس یک ردیفِ دستکاری‌شده نمی‌تواند
//  Content-Type را عوض کند.
// ═══════════════════════════════════════════════════════════════════════

async function GET_impl(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    const { key: segments } = await params;
    const key = (segments ?? []).join('/');

    if (!isValidStorageKey(key)) throw Err.notFound('عکس');
    const mime = mimeFromKey(key);
    if (!mime) throw Err.notFound('عکس');

    const bytes = await getObject(key);
    if (!bytes) throw Err.notFound('عکس');

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(bytes.byteLength),
        // نامِ فایل از UUID می‌آید و هرگز تغییر نمی‌کند → کشِ طولانی امن است.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition': 'inline',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/media/[...key]', GET_impl);
