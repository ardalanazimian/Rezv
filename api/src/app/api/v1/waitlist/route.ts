import { NextResponse } from 'next/server';
import { joinWaitlist } from '@/lib/waitlist';
import { authFromRequest, type AccessPayload } from '@/lib/jwt';
import { assertUserNotBanned } from '@/lib/ban';
import { isFeatureEnabled, featureFlagLabel } from '@/lib/feature-flags';
import { resolveStaffRestaurant } from '@/lib/staff-helpers';
import { errorResponse, Err } from '@/lib/errors';
import { parseBody, zUuid, zPartySize, zPhone, z } from '@/lib/schemas';

import { withApiMetrics } from '@/lib/api-metrics';

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
async function POST_impl(req: Request) {
  try {
    let userId: string | undefined;
    // ⚠️ باگِ امنیتیِ رفع‌شده (۲۰۲۶-۰۹-۱۱): اینجا `else isStaff = true` بود —
    // یعنی **هر** توکنی که «customer» نباشد کارمند شمرده می‌شد، و از آن دو چیز
    // می‌گرفت: عبور از kill-switchِ `waitlist_enabled` و ورودیِ صف به‌نامِ
    // «کارمند». چکِ تنانت هم اصلاً وجود نداشت و `restaurant_id` از **بدنه**
    // می‌آمد؛ پس کارمندِ رستورانِ A می‌توانست صفِ رستورانِ B را پر کند.
    // حالا فقط principalِ واقعیِ staff (تنها دو مقدارِ `kind` در lib/jwt.ts).
    let staffAuth: Extract<AccessPayload, { kind: 'staff' }> | undefined;
    try {
      const a = authFromRequest(req);
      if (a.kind === 'customer') userId = a.sub;
      else if (a.kind === 'staff') staffAuth = a;
    } catch { /* کاربرِ ناشناس — نبودِ توکن حالتِ معتبر است، نه خطا */ }
    const isStaff = staffAuth !== undefined;
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

    // ── محدوده‌ی تنانت/شعبه برایِ مسیرِ کارمند (CLAUDE.md: «restaurantId هرگز
    //    از body») ──
    //
    // این route عمداً به `withRestaurantAuth` تبدیل **نمی‌شود** — همان دلیلی که
    // در `reservations/route.ts` ثبت شده: همین مسیر به مشتری/مهمانِ ناشناس هم
    // سرویس می‌دهد و آن wrapper مسیرِ مشتری را می‌شکند. پس همان الگویِ آنجا
    // تکرار می‌شود، نه یک چکِ تازه: `resolveStaffRestaurant` عضویتِ واقعیِ
    // تنانت، فعال‌بودنِ کارمند و قفلِ شعبه (migration 018) را با هم می‌سنجد،
    // و بعد idِ آمده از بدنه با آن **تطبیق** داده می‌شود — نه اینکه جایگزینش
    // شود، تا درخواستِ ناهم‌خوان بی‌صدا روی شعبه‌ی دیگری ننشیند.
    if (staffAuth) {
      const branch = await resolveStaffRestaurant(staffAuth, req);
      if (branch.id !== b.restaurant_id) {
        throw Err.forbidden('افزودن به صفِ انتظار فقط برایِ شعبه‌ی فعالِ خودت مجاز است');
      }
    }
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

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/waitlist', POST_impl);
