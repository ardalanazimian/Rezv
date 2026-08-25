import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { createGiftCard, checkGiftCard } from '@/lib/loyalty';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { clientIp, enforceRateLimit, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseQuery, zPhone, zUuid, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

const querySchema = z.object({ code: z.string().min(1).max(50) });
const bodySchema = z.object({
  amount_toman: z.number().int().min(1).max(1_000_000_000),
  recipient_name: z.string().min(1).max(100).optional(),
  recipient_phone: zPhone.optional(),
  message: z.string().max(500).optional(),
  restaurant_id: zUuid.optional(),
});

/** GET /api/v1/gift-cards?code=GIFT... — بررسی موجودی کارت هدیه */
async function GET_impl(req: Request) {
  try {
    const { code } = parseQuery(req, querySchema);
    return NextResponse.json(await checkGiftCard(code));
  } catch (e) { return errorResponse(e); }
}

/**
 * POST — خرید کارت هدیه. بدنه: { amount_toman, recipient_name?, recipient_phone?, message?, restaurant_id? }
 *
 * ⚠️ رفعِ P0 (فازِ ۲، پروتکل §۳ و §۷) — سه نقصِ هم‌زمان که با هم یک «چاپِ پولِ
 * ناشناس» می‌ساختند:
 *
 *  ۱. **احراز هویت تزئینی بود.** `authFromRequest` داخلِ یک catchِ خالی بود، پس
 *     فراخوانِ ناشناس فقط buyerId=undefined می‌گرفت و ادامه می‌داد.
 *  ۲. **هیچ ریت‌لیمیتی نبود** (برخلافِ هر مسیرِ نوشتنیِ دیگرِ مشتری).
 *  ۳. **هیچ مرحله‌ی پرداختی وجود ندارد.** کارت مستقیم با
 *     `balanceToman = amount_toman` و وضعیتِ `active` ساخته می‌شد — تا سقفِ
 *     یک میلیارد تومان — و همان کارت در `reservations.ts` از طریقِ
 *     `redeemGiftCardTx` رویِ صورت‌حسابِ **واقعیِ** رستوران خرج می‌شود.
 *
 * چرا فقط auth کافی نبود: با auth هم یک کاربرِ عادیِ واردشده می‌توانست
 * بی‌نهایت کارتِ رایگان بسازد. مشکل «چه کسی» نبود، «بدونِ پرداخت» بود.
 *
 * چرا حذف نشد (§۲۱/§۳۲): خریدِ کارتِ هدیه یک قابلیتِ عمدیِ محصول است، نه کدِ
 * مرده. طبقِ §۳۲ «repair > isolate > replace»، این‌جا **isolate** درست است:
 * قابلیت سرِ جایش می‌ماند ولی تا وصل‌شدنِ پرداختِ واقعی (zarinpal که برایِ
 * بیعانه از قبل هست) پشتِ یک kill-switchِ **پیش‌فرض‌خاموش** قفل می‌شود.
 * مسیرِ مشروعِ صدورِ کارت (خرجِ سکه‌ی به‌دست‌آمده در `lib/rewards.ts`) اصلاً
 * از این تابع رد نمی‌شود و دست‌نخورده است — تأییدشده با grep.
 */
async function POST_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);

    // پیش‌فرضِ این فلگ خاموش است (رجوع کن به DEFAULT_OFF در lib/feature-flags.ts).
    if (!(await isFeatureEnabled('gift_card_purchase_enabled'))) {
      throw Err.featureDisabled('خریدِ کارتِ هدیه');
    }

    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();

    const b = await parseBody(req, bodySchema);
    const card = await createGiftCard({
      buyerId: auth.sub, amountToman: b.amount_toman,
      recipientName: b.recipient_name, recipientPhone: b.recipient_phone,
      message: b.message, restaurantId: b.restaurant_id,
    });
    return NextResponse.json(card);
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/gift-cards', GET_impl);
export const POST = withApiMetrics('/api/v1/gift-cards', POST_impl);
