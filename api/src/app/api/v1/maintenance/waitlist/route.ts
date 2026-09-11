import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { expireOffers, tryPromoteNext } from '@/lib/waitlist';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';

import { withApiMetrics } from '@/lib/api-metrics';

/**
 * POST /api/v1/maintenance/waitlist — نگهداری لیست انتظار (cron).
 * انقضای آفرهای بی‌پاسخ + تلاش برای ارتقای صف هر رستوران.
 *
 * ⚠️ باگ M5: پردازش موازی محدود به‌جای حلقه‌ی سریال (جلوگیری از timeout در مقیاس).
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * درجه‌ی موازیِ جاروبِ ارتقا.
 *
 * ⚠️ تصمیمِ اندازه‌گیری‌شده (۲۰۲۶-۰۹-۰۵)، نه ثابتِ ارثی. ادعایِ رایج این بود
 * که «همین cron هم شبکه‌ی ایمنی است و هم مولدِ همزمانی‌ای که باگِ ۱۲/۱۲ را
 * می‌سازد». نیمه‌ی دومش **غلط** است و مکانیزمش دو خط پایین‌تر پیداست:
 * کوئریِ زیر `distinct: ['restaurantId']` دارد، پس هر رستوران در هر جاروب
 * دقیقاً **یک بار** ظاهر می‌شود و هیچ دو workerی هرگز روی میزهایِ یک
 * رستوران رقابت نمی‌کنند. رقابتی که باگ را می‌سازد بینِ این جاروب و
 * **ترافیکِ کاربر** (merge/walk-in روی همان رستوران) است، نه بینِ workerها.
 * پس ۸ فشارِ درون-رستورانی تولید نمی‌کند؛ فقط بارِ بین-رستورانی می‌سازد.
 * گاردِ این استدلال یک تستِ صریح است، نه این کامنت:
 * `waitlist-promotion-observability.test.mts` («distinct یعنی هر رستوران یک بار»).
 */
const SWEEP_CONCURRENCY = 8;

async function POST_impl(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;

    const expiry = await expireOffers();
    const withQueue = await db.waitlistEntry.findMany({
      where: { status: 'waiting' }, distinct: ['restaurantId'], select: { restaurantId: true },
    });

    // ⚠️ رفعِ ۲۰۲۶-۰۹-۰۵: قبلاً این‌جا `promoteNext` **بدونِ هیچ گاردی** صدا
    // زده می‌شد. یک رستورانِ خراب کلِ جاروب را می‌انداخت: `Promise.all` رد
    // می‌شد، endpoint یک ۵۰۰ی عمومی می‌داد، و رستوران‌هایِ بعدیِ سهمِ آن
    // worker **اصلاً پردازش نمی‌شدند**. یعنی دو سرِ طیف هر دو غلط بودند —
    // این‌جا throwِ خام، و داخلِ expireOffers بلعِ کامل. حالا هر رستوران
    // مستقل است و شکستش شمرده می‌شود (`site=sweep`).
    const results = await mapWithConcurrency(
      withQueue, SWEEP_CONCURRENCY, (w) => tryPromoteNext(w.restaurantId, 'sweep'),
    );
    // ⚠️ `expiry.promotionsMade` تا ۲۰۲۶-۰۹-۰۵ در این عدد **نبود**: ارتقاهایی
    // که پس از منقضی‌شدنِ یک آفر (و آزادشدنِ میزش) داخلِ `expireOffers` رخ
    // می‌دادند هرگز شمرده نمی‌شدند، پس cron می‌توانست چند مهمان را واقعاً
    // ارتقا بدهد و `promoted: 0` گزارش کند. با تستِ زنده پیدا شد.
    const promoted = expiry.promotionsMade + results.filter(r => r.promoted).length;

    // ── قراردادِ وضعیتِ HTTP — چرا «همه شکست خوردند» و نه «یکی شکست خورد» ──
    // `cron/run.sh:6` با `curl -sf` صدا می‌زند و در :10-11 یا `✓ waitlist` یا
    // `✗ waitlist failed` چاپ می‌کند. تا امروز این خط **همیشه** `✓` بود، حتی
    // وقتی هیچ ارتقایی موفق نمی‌شد — یک سبزِ جعلی در لاگِ عملیات، یعنی اولین
    // جایی که اپراتور نگاه می‌کند.
    //
    // ولی آستانه‌ی `failures > 0` هم اشتباه بود: یک رستوران با یک مشکلِ
    // داده‌ای، کلِ jobِ ناوگان را هر ۲ دقیقه قرمز می‌کرد و ظرفِ یک هفته
    // اپراتور یاد می‌گرفت `✗` را نادیده بگیرد — همان دامِ «قرمز در کارِ عادی
    // ⇒ گارد بی‌اثر».
    //
    // پس مرز این است: **مکانیزم** خراب است یا **یک مستأجر**؟
    //   • حداقل یک تلاش موفق  → مکانیزم کار می‌کند؛ شکست‌هایِ تکی در متریک
    //     و آلارم دیده می‌شوند (rezervno_waitlist_promotion_failed_total)،
    //     نه در یک تیکِ دودویی. → ۲۰۰، با عدد در بدنه.
    //   • همه‌ی تلاش‌ها شکست خوردند (و تلاشی وجود داشت) → این دیگر دادهٔ یک
    //     رستوران نیست؛ خودِ مسیرِ ارتقا خواب است. → ۵۰۳ تا `curl -f` رد شود.
    //
    // ⚠️ محدودیتِ صریحِ این قاعده: با یک رستورانِ فعال، «همه» یعنی «یکی»، پس
    // این تیک در مقیاسِ کوچک بیشترین حساسیت و در مقیاسِ بزرگ کمترین را دارد.
    // سیگنالِ مستقل از مقیاس همان شمارنده‌ی برچسب‌دار است، نه این وضعیت.
    //
    // بدنه در **هر دو** حالت `expired_offers` را می‌آورد: انقضاها واقعاً
    // انجام شده‌اند و یک `✗` نباید به‌معنایِ «هیچ کاری نشد» خوانده شود.
    const attempts = expiry.promotionAttempts + results.length;
    const failures = expiry.promotionFailures + results.filter(r => !r.ok).length;
    const body = {
      ok: failures === 0,
      expired_offers: expiry.expired,
      // ⚠️ عددِ غیرِصفر اینجا «کارِ روزمره» نیست: یعنی جبرانِ `acceptOffer`
      // واقعاً شکست خورده و ورودی‌هایی روی `accepted` گیر کرده بودند که هیچ
      // اجرای بعدی نمی‌دیدشان (BE-005 §۴). بی‌صدا نگه‌داشتنش یعنی تنها
      // نشانه‌ی آن نقص فقط در لاگ بماند.
      orphans_released: expiry.orphansReleased,
      promoted,
      promotion_attempts: attempts,
      promotion_failures: failures,
    };
    if (attempts > 0 && failures === attempts) {
      return NextResponse.json(
        { ...body, error: 'همه‌ی تلاش‌هایِ ارتقا شکست خوردند — مسیرِ ارتقا خواب است، نه دادهٔ یک رستوران' },
        { status: 503 },
      );
    }
    return NextResponse.json(body);
  } catch (e) { return errorResponse(e); }
}


// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/maintenance/waitlist', POST_impl);
// Vercel Cron از GET استفاده می‌کند؛ به همان منطقِ POSTِ شمرده‌شده وصل است.
export const GET = POST;
