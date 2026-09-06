import { NextResponse } from 'next/server';
import { acceptOffer } from '@/lib/waitlist';
import { verifyAccess } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { withIdempotency } from '@/lib/idempotency';
import { parseParams, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ id: zUuid });

// استخراج userId از توکن (اگر باشد). مشتری احراز‌هویت‌شده فقط روی ورودی خودش.
function callerId(req: Request): string | undefined {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return undefined;
  try { const p = verifyAccess(h.slice(7)); return p.kind === 'customer' ? p.sub : undefined; }
  catch { return undefined; }
}

/** POST /api/v1/waitlist/:id/accept — پذیرش آفر میز → رزرو ساخته می‌شود.
 *  ورودیِ متعلق‌به‌کاربر: نیازِ احرازِ هویتِ مشتری. ورودیِ مهمان: نیازِ
 *  ?token=... (guest_token همان که هنگامِ join برگردانده شد). */
async function POST_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { id } = parseParams(await params, paramsSchema);
    const guestToken = new URL(req.url).searchParams.get('token') ?? undefined;
    const callerUserId = callerId(req);

    // ── Idempotency (رفعِ ۲۰۲۶-۰۸-۲۶) ────────────────────────────────────
    // این route هدرِ `Idempotency-Key` را می‌خواند، برخلافِ خواهرهایش
    // `/reservations` و `/restaurant/walkin` که از ۲۰۲۶-۰۸-۲۰ می‌خوانند.
    //
    // ⚠️ دقتِ ادعا — این حفره‌ی رزروِ تکراری **نبود**: `acceptOffer` ادعای
    // اتمیک دارد (`updateMany` با شرطِ `status:'offered'`)، پس دومین درخواست
    // هیچ‌وقت رزروِ دوم نمی‌سازد. چیزی که واقعاً می‌شکست **صداقتِ پاسخ** بود
    // (§۶، همان الگویِ SLOT_LOCK_TIMEOUT↔SLOT_FULL):
    //   دو-بار-زدنِ دکمه یا retryِ شبکه → درخواستِ اول رزرو را می‌سازد و
    //   ۲۰۰ برمی‌گرداند، درخواستِ دوم **۴۲۲ VALIDATION «آفری برای پذیرش وجود
    //   ندارد»** می‌گیرد (گاردِ `e.status !== 'offered'`؛ با اجرای زنده روی
    //   Postgres سنجیده شد، نه از رویِ کد — حدسِ اولم ۴۱۰ بود و غلط بود).
    //   در رقابتِ واقعیِ هم‌زمان که هر دو از آن گارد رد شوند، دومی
    //   `claimed.count === 0` می‌گیرد و ۴۱۰ RESERVATION_EXPIRED می‌شود.
    //   هر دو یک جنس‌اند: رزروِ کاربر ساخته شده ولی پاسخ می‌گوید نشده.
    // حالا با کلید، درخواستِ دوم عیناً همان پاسخِ موفقِ اول را بازپخش می‌کند.
    //
    // هویتِ درخواست‌کننده بخشی از کلیدِ کش است (رجوع کن به lib/idempotency.ts):
    // مشتریِ لاگین‌کرده با idِ خودش، مهمان با guest_tokenِ خودش که فقط برایِ
    // همان entry معتبر است (`assertCanActOnEntry`). بدونِ هیچ‌کدام،
    // `acceptOffer` در هر حالت ۴۰۴ می‌دهد؛ IP فقط برایِ آنکه دو ناشناس کلیدِ
    // هم را بازپخش نکنند.
    const idemKey = req.headers.get('idempotency-key') || undefined;
    const actor = callerUserId ? `customer:${callerUserId}`
      : guestToken ? `guest:${guestToken}`
      : `anon:${clientIp(req)}`;
    const idem = await withIdempotency<unknown>(idemKey, 'waitlist-accept', actor);
    if (idem.replayed) return NextResponse.json(idem.response);

    let result;
    try {
      result = await acceptOffer(id, 'customer', { callerUserId, guestToken });
    } catch (err) {
      // کلید را آزاد کن تا retry علتِ واقعی را ببیند، نه ۴۰۹ِ ۶۰ثانیه‌ای.
      await idem.release();
      throw err;
    }
    await idem.commit(result);
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/waitlist/[id]/accept', POST_impl);
