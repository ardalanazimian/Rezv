import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { requirePermission } from '@/lib/permissions';
import { resolveStaffRestaurant } from '@/lib/staff-helpers';
import { db } from '@/lib/db';
import { transitionReservation } from '@/lib/lifecycle';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseParams, safeJson, zReservationCode, z } from '@/lib/schemas';

const paramsSchema = z.object({ code: zReservationCode });
const bodySchema = z.object({ reason: z.string().max(500).optional() });

/**
 * POST /api/v1/reservations/:code/cancel — لغو رزرو. بدنه: { reason }
 * برای staff دلیل اجباری است (فیچر ۷).
 *
 * ⚠️ باگ H7: قبلاً این route مستقیم status را می‌نوشت و state machine چرخه‌ی حیات
 * را دور می‌زد: نه اعتبارسنجی انتقال، نه رویداد audit، نه چک وضعیت پایانی، نه اعلان.
 * پس حتی یک رزرو completed/no_show هم «لغو» می‌شد. حالا از transitionReservation
 * استفاده می‌شود که: انتقال نامعتبر (مثلاً از وضعیت پایانی) را رد می‌کند، رویداد
 * audit ثبت می‌کند، اعلان می‌فرستد و کش availability را درست (pattern-based) باطل
 * می‌کند. تمایز کاربر/رستوران در actor و دلیل حفظ می‌شود (سازگاری رفتاری).
 */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const auth = authFromRequest(req);
    await enforceRateLimit(clientIp(req), RULES.auth);
    const { code } = parseParams(await params, paramsSchema);
    const { reason } = bodySchema.parse(await safeJson(req));

    const resv = await db.reservation.findUnique({
      where: { code },
      select: { id: true, userId: true, restaurantId: true, restaurant: { select: { tenantId: true } } },
    });
    if (!resv) throw Err.notFound('رزرو');

    // مجوز: staff باید هم‌تنانت باشد و دلیل بدهد؛ مشتری باید صاحب رزرو باشد.
    let actor: string;
    if (auth.kind === 'staff') {
      // ⚠️ رفعِ P1 (فازِ ۲، پروتکل §۷) — دو حفره‌ی هم‌زمان که این مسیر داشت،
      // در حالی که مسیرِ خواهرش (.../restaurant/reservations/[code]/status)
      // هر دو را از قبل بسته بود:
      //
      //  ۱. **RBAC دور می‌خورد.** هیچ requirePermission ای نبود. مالکی که
      //     عمداً canManageReservations را برایِ یک کارمند خاموش کرده بود،
      //     همچنان نمی‌توانست جلویش را بگیرد — کارمند به‌جایِ status از
      //     cancel استفاده می‌کرد و همان انتقالِ پایانی را انجام می‌داد.
      //
      //  ۲. **قفلِ شعبه دور می‌خورد.** چک فقط tenant-level بود
      //     (`restaurant.tenantId === auth.tenantId`) و staff.restaurantId را
      //     کاملاً نادیده می‌گرفت — یعنی کارمندِ قفل‌شده به شعبه‌ی A می‌توانست
      //     رزروِ شعبه‌ی B را لغو کند. دقیقاً همان کلاسِ حفره‌ای که P0-1 داخلِ
      //     resolveStaffRestaurant بست، این‌جا با **صدا نزدنش** دوباره باز بود.
      //
      // رفع با همان دو helperِ موجود (§۲۲ reuse before abstraction)؛ مسیرِ
      // مشتری و قاعده‌ی «دلیل اجباری» عیناً دست‌نخورده می‌مانند.
      await requirePermission(auth, 'canManageReservations');
      const branch = await resolveStaffRestaurant(auth, req);
      if (resv.restaurantId !== branch.id) throw Err.notFound('رزرو');
      if (!reason?.trim()) throw Err.validation('دلیل لغو برای رستوران الزامی است');
      actor = `staff:${auth.sub}`;
    } else {
      if (resv.userId !== auth.sub) throw Err.forbidden();
      actor = `customer:${auth.sub}`;
    }

    // ذخیره‌ی دلیل لغو روی رکورد (فیلد اختصاصی) + انتقال از طریق state machine.
    if (reason?.trim()) {
      await db.reservation.update({ where: { id: resv.id }, data: { cancelReason: reason.trim() } });
    }
    const result = await transitionReservation({
      reservationId: resv.id,
      to: 'cancelled',
      actor,
      reason: reason?.trim() || undefined,
      isAutomatic: false,
    });
    return NextResponse.json({ code, status: result.status });
  } catch (e) { return errorResponse(e); }
}
