import { NextResponse } from 'next/server';
import { acceptOffer } from '@/lib/waitlist';
import { verifyAccess } from '@/lib/jwt';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';
import { withIdempotency } from '@/lib/idempotency';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ id: zUuid });

/** نوعِ پاسخ همان خروجیِ خودِ `acceptOffer` است — کپی‌نویسی نمی‌شود تا اگر
 *  آنجا تغییر کند، کشِ idempotency هم بی‌صدا از هم‌خوانی نیفتد. */
type AcceptResult = Awaited<ReturnType<typeof acceptOffer>>;

// استخراج userId از توکن (اگر باشد). مشتری احراز‌هویت‌شده فقط روی ورودی خودش.
function callerId(req: Request): string | undefined {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return undefined;
  try { const p = verifyAccess(h.slice(7)); return p.kind === 'customer' ? p.sub : undefined; }
  catch { return undefined; }
}

/** POST /api/v1/waitlist/:id/accept — پذیرش آفر میز → رزرو ساخته می‌شود.
 *  ورودیِ متعلق‌به‌کاربر: نیازِ احرازِ هویتِ مشتری. ورودیِ مهمان: نیازِ
 *  ?token=... (guest_token همان که هنگامِ join برگردانده شد).
 *
 *  ── Idempotency (۲۰۲۶-۰۹-۱۱) ──
 *  این مسیر یک **رزروِ واقعی** می‌سازد و تنها جایی است که `reservation_code`
 *  را به مهمان می‌دهد؛ دقیقاً همان پروفایلِ خطری که `POST /reservations` برای
 *  آن `Idempotency-Key` گرفت. بدونش، یک retryِ شبکه‌ای پاسخِ موفق را برای
 *  همیشه گم می‌کرد. همان wrapper و همان قرارداد، فقط با scopeِ جدا. */
async function POST_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { id } = parseParams(await params, paramsSchema);
    const guestToken = new URL(req.url).searchParams.get('token') ?? undefined;
    const callerUserId = callerId(req);

    // ⚠️ هویتِ درخواست‌کننده بخشی از کلیدِ کش است (رجوع کن به lib/idempotency.ts):
    // بدونِ آن، هرکس همان Idempotency-Key را بفرستد پاسخِ نفرِ قبلی را می‌گرفت.
    // `id` هم داخلِ actor است چون مهمانِ ناشناس هویتِ پایداری ندارد و بدونِ آن
    // دو ورودیِ متفاوتِ یک مهمان با یک کلید به هم می‌چسبیدند.
    const actor = `${callerUserId ?? 'guest'}:${id}`;
    const idemKey = req.headers.get('idempotency-key') || undefined;
    const idem = await withIdempotency<AcceptResult>(idemKey, 'waitlist-accept', actor);
    if (idem.replayed) return NextResponse.json(idem.response);

    const result = await acceptOffer(id, 'customer', { callerUserId, guestToken });
    await idem.commit(result);  // ذخیره‌ی پاسخ برای replayهای بعدیِ همان کلید
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/waitlist/[id]/accept', POST_impl);
