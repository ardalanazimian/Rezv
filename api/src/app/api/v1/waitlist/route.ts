import { NextResponse } from 'next/server';
import { joinWaitlist } from '@/lib/waitlist';
import { authFromRequest } from '@/lib/jwt';
import { assertUserNotBanned } from '@/lib/ban';
import { isFeatureEnabled, featureFlagLabel } from '@/lib/feature-flags';
import { errorResponse, Err } from '@/lib/errors';
import { parseBody, zUuid, zPartySize, zPhone, z } from '@/lib/schemas';

const schema = z.object({
  restaurant_id: zUuid,
  party_size: zPartySize,
  guest: z.object({
    name: z.string().min(1).max(100).optional(),
    phone: zPhone.optional(),
    email: z.string().email().max(200).optional(),
  }).optional(),
  notify_sms: z.boolean().optional(),
  notify_push: z.boolean().optional(),
  notify_email: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

/** POST /api/v1/waitlist — پیوستن به لیست انتظار. بدنه: { restaurant_id, party_size, guest?, notify_* } */
export async function POST(req: Request) {
  try {
    let userId: string | undefined;
    let isStaff = false;
    try { const a = authFromRequest(req); if (a.kind === 'customer') userId = a.sub; else isStaff = true; } catch {}
    // ⚠️ رفع‌شده: بنِ سختِ پلتفرم قبلاً رویِ پیوستن به صف چک نمی‌شد.
    if (userId) await assertUserNotBanned(userId);
    // سوییچِ قابلیت (Company Control Plane، فازِ ۳): فقط پیوستنِ مشتری/مهمان را
    // می‌بندد؛ staff (که معمولاً مهمانِ حاضر را دستی وارد صف می‌کند) مستثناست.
    if (!isStaff && !(await isFeatureEnabled('waitlist_enabled'))) {
      throw Err.featureDisabled(featureFlagLabel('waitlist_enabled'));
    }
    const b = await parseBody(req, schema);
    // هم‌راستا با POST /reservations: اگر بلوکِ مهمان داده شود، نام الزامی است —
    // بدونِ نام، ورودیِ صف بی‌فایده است (نمی‌توان مهمان را صدا زد).
    // این چک پیش‌تر نبود و joinWaitlist مقدارِ undefined را در فیلدی با نوعِ string
    // دریافت می‌کرد (خطای TypeScript و رفتارِ نامشخص در زمانِ اجرا).
    if (b.guest && !b.guest.name) throw Err.validation('اسم مهمان برای پیوستن به صف الزامی است');
    const result = await joinWaitlist({
      restaurantId: b.restaurant_id,
      partySize: b.party_size,
      userId: isStaff ? undefined : userId,
      guest: b.guest?.name ? { name: b.guest.name, phone: b.guest.phone, email: b.guest.email } : undefined,
      notifySms: b.notify_sms, notifyPush: b.notify_push, notifyEmail: b.notify_email,
      note: b.note,
    });
    return NextResponse.json(result);
  } catch (e) { return errorResponse(e); }
}
