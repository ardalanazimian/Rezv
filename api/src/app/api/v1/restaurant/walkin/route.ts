import { NextResponse } from 'next/server';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { normalizePhone } from '@/lib/otp';
import { createWalkin } from '@/lib/reservations';
import { parseBody, zPhone, zUuid, z } from '@/lib/schemas';

// ═══════════════════════════════════════════════════════════
//  POST /restaurant/walkin — ثبت ورود مهمان بدون رزروی قبلی (walk-in) توسط پرسنل.
//  منطق در لایه‌ی سرویس (lib/reservations.ts → createWalkin) است؛ این route
//  فقط اعتبارسنجی ورودی و صدازدنِ سرویس را انجام می‌دهد (route لاغر).
// ═══════════════════════════════════════════════════════════

const schema = z.object({
  phone: zPhone,
  party_size: z.number().int().min(1).max(30),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  table_id: zUuid.optional(),
  birth_day: z.number().int().min(1).max(31).optional(),
  birth_month: z.number().int().min(1).max(12).optional(),
});

export const POST = withRestaurantAuth({ rateLimit: 'auth', permission: 'canManageReservations' }, async (req, ctx) => {
  const b = await parseBody(req, schema);
  const phone = normalizePhone(b.phone);

  const result = await createWalkin({
    restaurantId: ctx.restaurant.id,
    clubPrefix: ctx.restaurant.clubPrefix,
    phone,
    partySize: b.party_size,
    firstName: b.first_name?.trim() || null,
    lastName: b.last_name?.trim() || null,
    tableId: b.table_id || null,
    birthDay: b.birth_day ?? null,
    birthMonth: b.birth_month ?? null,
  });

  return NextResponse.json({
    reservation_code: result.reservation.code,
    user_id: result.user.id,
    name: [result.user.firstName, result.user.lastName].filter(Boolean).join(' ') || 'مهمان',
    club_code: result.clubCode,
    enrolled_now: result.enrolledNow,
  }, { status: 201 });
});
