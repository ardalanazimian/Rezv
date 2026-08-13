import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { createReservation } from '@/lib/reservations';
import { normalizePhone } from '@/lib/otp';
import { withIdempotency } from '@/lib/idempotency';
import { clientIp } from '@/lib/ratelimit';
import { assertUserNotBanned } from '@/lib/ban';
import { isFeatureEnabled, featureFlagLabel } from '@/lib/feature-flags';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, z, zUuid, zDateStr, zTimeStr, zPartySize, zPhone } from '@/lib/schemas';

// Schema ورودیِ رزرو — یک‌جا تعریف، خطاهای یکدست، type inference.
// نکته‌ی امنیتی: قبلاً preorder/guest/coupon_code/gift_card_* اصلاً اعتبارسنجی
// نمی‌شدند و مستقیم (فقط با ?? پیش‌فرض) به createReservation می‌رفتند — یعنی
// شکلِ دلخواه از کلاینت مستقیم وارد منطق مالی/رزرو می‌شد.
const reservationSchema = z.object({
  restaurant_id: zUuid,
  date: zDateStr,
  time: zTimeStr,
  party_size: zPartySize,
  // ستونِ DB از نوع text[] است و createReservation هم string[] می‌گیرد؛ schema پیش‌تر
  // z.string() بود که هم buildِ TypeScript را می‌شکست و هم در زمانِ اجرا آرایه را رد می‌کرد.
  preferences: z.array(z.string().max(100)).max(20).optional(),
  preorder: z.array(z.object({
    menu_item_id: zUuid,
    qty: z.number().int().min(1).max(50).optional(),
  })).max(50).optional(),
  guest: z.object({
    name: z.string().min(1).max(100).optional(),
    phone: zPhone.optional(),
    table_number: z.number().int().min(1).max(999).optional(),
    note: z.string().max(500).optional(),
  }).optional(),
  notify_sms: z.boolean().optional(),
  duration_minutes: z.number().int().min(15).max(600).optional(),
  hold: z.boolean().optional(),
  coupon_code: z.string().min(1).max(50).optional(),
  gift_card_code: z.string().min(1).max(50).optional(),
  gift_card_amount: z.number().min(0).max(1_000_000_000).optional(),
});

/** POST /api/v1/reservations — مشتری (app) یا staff (manual) */
export async function POST(req: Request) {
  try {
    const auth = authFromRequest(req);
    // بن سختِ پلتفرم: قبل از هر پردازشِ دیگری (حتی claimِ idempotency) رد می‌شود
    // — فقط برایِ مشتریِ آنلاین؛ رزروِ دستیِ staff برایِ مهمانِ حاضر مشمول نیست.
    if (auth.kind === 'customer') await assertUserNotBanned(auth.sub);
    // سوییچِ قابلیت (Company Control Plane، فازِ ۳): فقط رزروِ آنلاینِ مشتری را
    // می‌بندد؛ رزروِ دستیِ staff (source='manual') در قطعیِ اضطراری هم کار می‌کند.
    if (auth.kind === 'customer' && !(await isFeatureEnabled('reservations_enabled'))) {
      throw Err.featureDisabled(featureFlagLabel('reservations_enabled'));
    }
    // Validation متمرکز: همه‌ی خطاها با هم، فرمتِ یکدست (به‌جای if دستی)، + سقفِ حجمِ بدنه.
    const b = await parseBody(req, reservationSchema);

    // ── Idempotency: اگر کلاینت هدر Idempotency-Key بفرستد، double-submit
    //    (دوبار زدن دکمه یا retry شبکه) رزرو دوم نمی‌سازد؛ پاسخ اول برمی‌گردد. ──
    const idemKey = req.headers.get('idempotency-key') || undefined;
    const idem = await withIdempotency<any>(idemKey, 'reservation');
    if (idem.replayed) return NextResponse.json(idem.response, { status: 201 });

    const isStaff = auth.kind === 'staff';
    let staffGuestUserId: string | undefined;
    if (isStaff) {
      const r = await db.restaurant.findUnique({ where: { id: b.restaurant_id }, select: { tenantId: true } });
      if (!r || r.tenantId !== auth.tenantId) throw Err.forbidden();
      if (b.guest && !b.guest.name) throw Err.validation('اسم مهمان برای رزرو دستی الزامی است');
      // اگر شماره‌ی مهمان داده شده، کاربر واقعی را پیدا/بساز تا منطق آماده‌ی
      // عضویت باشگاه + کش‌بک (که قبلاً فقط برای userId اجرا می‌شد) برای رزروهای
      // دستی staff هم واقعاً اجرا شود — قبلاً این رزروها هرگز عضو باشگاه نمی‌شدند.
      if (b.guest?.phone) {
        try {
          const phone = normalizePhone(b.guest.phone);
          const nameParts = String(b.guest.name || '').trim().split(/\s+/);
          const user = await db.user.upsert({
            where: { phone },
            create: { phone, firstName: nameParts[0] || null, lastName: nameParts.slice(1).join(' ') || null },
            update: {},
          });
          staffGuestUserId = user.id;
        } catch {
          // شماره نامعتبر بود — مشکلی نیست، رزرو به‌صورت مهمان بدون حساب ادامه پیدا می‌کند
        }
      }
    }

    const result = await createReservation({
      restaurantId: b.restaurant_id,
      date: b.date, time: b.time,
      partySize: b.party_size,
      preferences: b.preferences,
      preorder: (b.preorder ?? []).map((p: { menu_item_id: string; qty?: number }) =>
        ({ menuItemId: p.menu_item_id, qty: p.qty ?? 1 })),
      userId: auth.kind === 'customer' ? auth.sub : staffGuestUserId,
      // شرطی ساخته می‌شود تا TypeScript خودش name را به string باریک کند.
      // (اعتبارسنجیِ زمانِ اجرا بالاتر انجام شده و پیامِ فارسیِ روشن می‌دهد.)
      guest: isStaff && b.guest?.name ? {
        name: b.guest.name, phone: b.guest.phone,
        tableNumber: b.guest.table_number, note: b.guest.note,
      } : undefined,
      source: isStaff ? 'manual' : 'app',
      notifySms: b.notify_sms,
      durationMinutes: b.duration_minutes,  // اختیاری: مدت سفارشی رزرو
      hold: b.hold === true,                // اختیاری: رزرو هولد موقت (pending با انقضا)
      couponCode: b.coupon_code,            // checkout: کوپن (یا کارت هدیه، نه هردو)
      giftCardCode: b.gift_card_code,
      giftCardAmount: b.gift_card_amount,
      ip: clientIp(req),                    // برای تشخیص سوءاستفاده‌ی چندحسابی کوپن (M1)
    });
    await idem.commit(result);  // ذخیره‌ی پاسخ برای replayهای بعدی همان کلید
    return NextResponse.json(result, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
