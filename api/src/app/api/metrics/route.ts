import { timingSafeEqual } from 'crypto';
import { renderMetrics } from '@/lib/metrics';

// GET /api/metrics — هدف scrape برای Prometheus.
// خروجی در فرمت متنی استاندارد Prometheus (text/plain; version=0.0.4).
//
// ⚠️ رفعِ fail-open (۲۰۲۶-۰۸-۲۱): پیش از این، گاردِ توکن شرطی بود
// (`if (process.env.METRICS_TOKEN)`) — یعنی اگر متغیر ست نمی‌شد، این endpoint
// **کاملاً عمومی** بود. middleware هم جلویش را نمی‌گیرد: چکِ Origin فقط روی
// متدهای تغییردهنده (POST/PATCH/PUT/DELETE) اجرا می‌شود و این یک GET است.
//
// چه چیزی لو می‌رفت: خروجیِ Prometheus نام همه‌ی routeها، تعداد و نرخِ خطای
// هر کدام، طولِ صف‌ها، شمارِ رستوران‌ها و متریک‌های مدل را دارد — نقشه‌ی
// نسبتاً کاملی از ساختار و بارِ داخلیِ سامانه.
//
// این دقیقاً همان کلاسِ باگی است که برایِ `ALLOWED_ORIGINS` در `middleware.ts`
// بسته شده بود، ولی خواهرش اینجا باز مانده بود: یکی fail-fast، دیگری
// fail-open.
//
// چرا اینجا ۵۰۳ و نه throwِ سراسری مثلِ ALLOWED_ORIGINS: نبودِ آن متغیر کلِ
// ترافیکِ کاربر را بی‌صدا می‌شکند، پس متوقف‌کردنِ برنامه بجاست. ولی
// METRICS_TOKEN فقط به مانیتورینگ مربوط است — قطع‌کردنِ کلِ API به‌خاطرِ یک
// متغیرِ مانیتورینگ از خودِ نشتی بدتر است. پس فقط همین endpoint بسته می‌شود،
// با پیامی که اپراتور موقعِ scrape می‌بیند.
//
// در حالتِ غیرِproduction (توسعه/تست) اگر توکن ست نشده باشد، endpoint باز
// می‌ماند — همان راحتیِ قبلی، بدونِ ریسکِ تولید.
//
// ⚠️ مقایسه‌ی توکن حالا constant-time است. مقایسه‌ی `!==` رشته‌ای زودهنگام
// خارج می‌شود و طولِ پیشوندِ درست را لو می‌دهد؛ همان قاعده‌ای که برای توکنِ
// مهمانِ لیستِ انتظار (`tokensEqual`) رعایت شده.
export async function GET(req: Request) {
  const required = process.env.METRICS_TOKEN?.trim();

  if (!required) {
    if (process.env.NODE_ENV === 'production') {
      return new Response(
        'METRICS_TOKEN تنظیم نشده — این endpoint در production بدونِ توکن سرو نمی‌شود.\n' +
        'یک مقدارِ تصادفی بسازید (مثلاً `openssl rand -hex 32`) و در .env قرار دهید،\n' +
        'سپس همان را در observability/prometheus.yml به‌عنوان bearer_token بگذارید.\n',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } },
      );
    }
  } else {
    const provided = req.headers.get('authorization') ?? '';
    if (!safeEqual(provided, `Bearer ${required}`)) {
      return new Response('unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  // به‌روزرسانی gaugeهای لحظه‌ای پیش از خروجی (طول صف SMS قدیمی حذف شد؛
  // حالا متریک‌های صف Job از دیتابیس به‌روز می‌شوند)
  try {
    const { refreshQueueMetrics } = await import('@/lib/queue');
    await refreshQueueMetrics();
  } catch {
    // اگر صف/DB در دسترس نبود، آخرین مقدار می‌ماند
  }

  return new Response(renderMetrics(), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * مقایسه‌ی زمان-ثابتِ دو رشته. `timingSafeEqual` روی بافرهایِ هم‌طول کار
 * می‌کند، پس اختلافِ طول جداگانه (و پیش از مقایسه) رد می‌شود — خودِ طول راز
 * نیست، محتوا راز است.
 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
