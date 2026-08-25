import { NextResponse } from 'next/server';
import { qrCheckIn, resolveQrTable } from '@/lib/tables';
import { verifyAccess } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { withApiMetrics } from '@/lib/api-metrics';

const schema = z.object({ qr_code: z.string().min(1).max(200) });

/**
 * `userId` فراخوان، **فقط اگر** توکنِ مشتریِ معتبر داشته باشد. توکنِ خراب/
 * منقضی/کارمند ⇒ `undefined` و درخواست بدونِ خطا ادامه پیدا می‌کند (این مسیر
 * عمداً برای فراخوانِ بدونِ توکن هم باز است). همان الگویِ `callerId` در
 * `waitlist/[id]/accept/route.ts` — دوباره اختراع نشده.
 */
function callerCustomerId(req: Request): string | undefined {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return undefined;
  try {
    const p = verifyAccess(h.slice(7));
    return p.kind === 'customer' ? p.sub : undefined;
  } catch {
    return undefined;
  }
}

/**
 * POST /api/v1/checkin — مهمان استیکرِ QRِ رویِ میز را اسکن می‌کند؛ رزروِ
 * فعالِ همان میز از مسیرِ چرخه‌ی حیات `checked_in` و سپس `seated` می‌شود.
 * بدنه: `{ qr_code }`.
 *
 * ── مدلِ اعتبارسنجی: «بدونِ احراز هویتِ کاربر، با اعتبارنامه‌ی QR» ──
 *
 * این مسیر عمداً توکنِ کاربر نمی‌خواهد. مهمانِ بدونِ حساب هم باید بتواند سرِ
 * میز بنشیند، و اسکن‌کننده **مهمان** است نه پرسنل: تنها فراخوانِ این
 * endpoint در کلِ سه اپ `apps/customer/js/features/checkin.js:79` است؛ پنلِ
 * رستوران نه صدایش می‌زند (ثبتِ ورودش از
 * `PATCH /restaurant/reservations/{code}/status` می‌رود) و نه اصلاً اسکنرِ QR
 * دارد — فقط QR را تولید و چاپ می‌کند.
 *
 * اعتبارنامه خودِ کد است: ۵۰ بیت آنتروپیِ رمزنگارانه از `genQrToken()` در
 * `lib/tables.ts` (`randomBytes(10)` → ۱۰ نویسه از الفبایِ ۳۲تایی؛
 * `256 % 32 === 0` پس بدونِ modulo bias — اندازه‌گیریِ تجربی روی ۲M نویسه:
 * ۴٫۹۹۹۹۸۵ بیت به‌ازای نویسه). حدس‌زدنی نیست.
 *
 * ── چرا دیگر از گاردِ کارمند رد نمی‌شود ──
 * سخت‌سازیِ ۲۰۲۶-۰۸-۲۴ کلِ route را زیرِ گاردِ کارمند برد. آن تغییر شکافِ
 * تنانت را می‌بست ولی **قابلیت را برای کاربرِ واقعی می‌کشت** — تأییدشده با
 * اجرای زنده روی همین درخت با یک کدِ واقعیِ میز:
 *   بدونِ توکن  → `401 UNAUTHORIZED`
 *   توکنِ مشتری → `403 FORBIDDEN_TENANT`
 * یعنی تنها مصرف‌کننده‌ی موجود (اپِ مشتری) هرگز نمی‌توانست موفق شود.
 *
 * شکافِ تنانت حالا **ساختاراً** بسته است، نه با نقش: رستوران از خودِ کدِ QR
 * مشتق می‌شود (`resolveQrTable`)، پس فراخوان اصلاً شعبه‌ای انتخاب نمی‌کند و
 * چیزی برای «عبورِ متقاطع» باقی نمی‌ماند. گاردِ `restaurantId` در خودِ
 * `qrCheckIn` هم دست‌نخورده مانده (دفاع در عمق برای هر فراخوانِ دیگر).
 *
 * ── سه لایه‌ی جبرانی ──
 *  ۱. ریت‌لیمیتِ اختصاصیِ per-IP (`RULES.qrCheckin`) — حسابِ کاملش آنجاست.
 *  ۲. پنجره‌ی زمانی: فقط رزروی که از −۳۰ دقیقه تا `slotEnd` فعال است
 *     (از قبل در `qrCheckIn` بود و دست نخورد).
 *  ۳. `reservation_code` فقط به صاحبِ همان رزرو برمی‌گردد؛ برای بقیه `null`.
 *
 * ── چه چیزی هنوز باز است (صادقانه، پنهان نشده) ──
 * کسی که یک کدِ معتبر را واقعاً در اختیار دارد (عکسِ استیکر) می‌تواند رزروِ
 * همان میز را در همان پنجره‌ی زمانی بنشاند. بستنش عاملِ دوم می‌خواهد
 * (`guest_token` روی رزرو یا QRِ رزرو-محور). امروز **هیچ‌کدام در اسکیما وجود
 * ندارند** — `reservations` ستونِ `guest_token` ندارد (تأییدشده روی DBِ زنده)؛
 * الگویِ موجود فقط رویِ `waitlist_entries` است (مهاجرت‌های ۰۴۱/۰۴۴). این
 * دقیقاً همان شاخه‌ی احتیاطیِ ثبت‌شده در `docs/recovery/PHASE-2-PLAN.md`
 * (بندِ «وابستگی» در P0-2) است: «اگر توکن در دسترس نبود، لایه‌ی ۱ و ۳ فوراً
 * اعمال و لایه‌ی ۲ … به‌عنوانِ موردِ فازِ ۳ ثبت شود، به‌جایِ شکستنِ محصول».
 */
async function POST_impl(req: Request) {
  try {
    // اول ریت‌لیمیت، بعد پارسِ بدنه: بدنه‌ی درخواستِ مردود اصلاً خوانده نشود.
    await enforceRateLimit(clientIp(req), RULES.qrCheckin);

    const { qr_code } = await parseBody(req, schema);

    // رستوران از خودِ اعتبارنامه مشتق می‌شود، نه از توکنِ فراخوان.
    const table = await resolveQrTable(qr_code);
    // ⚠️ کدِ ناموجود و کدی که به میزی تعلق ندارد باید **دقیقاً** یک پاسخ
    // بدهند — همان `Err.notFound('میز')`ی که خودِ qrCheckIn برای میزِ
    // رستورانِ دیگر می‌دهد. هر پیام/کدِ متفاوتی اینجا یک اوراکلِ وجود/عدمِ
    // وجودِ کد می‌سازد.
    if (!table) throw Err.notFound('میز');

    const result = await qrCheckIn(qr_code, table.restaurantId, { userId: callerCustomerId(req) });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام
//    (رجوع کن به lib/api-metrics.ts). قبلاً این شمارش از راهِ گاردِ کارمند
//    می‌آمد؛ با حذفِ آن گارد باید صریح جایگزین می‌شد، وگرنه این مسیر از
//    آلارم‌های نرخِ خطا/تأخیر بیرون می‌افتاد.
export const POST = withApiMetrics('/api/v1/checkin', POST_impl);
