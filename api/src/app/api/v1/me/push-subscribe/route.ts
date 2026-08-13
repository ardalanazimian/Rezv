import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

// این endpoint هنوز چیزی ذخیره نمی‌کند و هیچ pushِ واقعی ارسال نمی‌شود —
// زیرساختِ push (VAPID/FCM/APNs + جدولِ push_subscriptions) هنوز ساخته نشده.
//
// ⚠️ رفعِ باگِ صداقتِ داده (یافته‌ی زنده): قبلاً POST همیشه
// `{ok:true, enabled:true}` برمی‌گرداند — یعنی قراردادِ API صریحاً ادعا
// می‌کرد اشتراکِ push فعال شد، در حالی که هیچ‌جا ذخیره نمی‌شد و هیچ pushی
// هم قرار نبود ارسال شود. حالا شکلِ پاسخ با GET (که از قبل صادق بود:
// `enabled:false, ready:false`) هم‌راستا شد. فرانتِ فعلی (customer/js/
// user-profile.js) این پاسخ را اصلاً نمی‌خواند (fire-and-forget با catch
// خالی) — پس این رفع هیچ رفتارِ کاربریِ فعلی را نمی‌شکند، فقط قراردادِ API
// را صادق می‌کند برایِ هر مصرف‌کننده‌ی آینده.

const subscribeSchema = z.object({
  enabled: z.boolean().optional().default(true),
  token: z.string().optional(),      // توکنِ FCM/APNs در آینده
  endpoint: z.string().optional(),   // Web Push endpoint در آینده
});

/** POST /api/v1/me/push-subscribe — ثبتِ درخواستِ اشتراکِ push (فعلاً بدونِ ذخیره‌سازی/ارسالِ واقعی) */
export async function POST(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await parseBody(req, subscribeSchema); // اعتبارسنجیِ شکلِ ورودی، حتی اگر هنوز ذخیره نمی‌شود

    // وقتی جدولِ push_subscriptions اضافه شد، اینجا واقعاً upsert می‌شود و
    // enabled/ready واقعی برمی‌گردد. تا آن زمان، هیچ ادعایی نمی‌کنیم.
    return NextResponse.json({ ok: true, enabled: false, ready: false });
  } catch (e) { return errorResponse(e); }
}

/** GET /api/v1/me/push-subscribe — وضعیتِ فعلیِ اشتراکِ push */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    // فعلاً همیشه false تا زیرساختِ push آماده شود
    return NextResponse.json({ enabled: false, ready: false });
  } catch (e) { return errorResponse(e); }
}
