import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { resolveStaffRestaurant } from '@/lib/staff-helpers';
import { parseParams, zReservationCode, z } from '@/lib/schemas';

const paramsSchema = z.object({ code: zReservationCode });

// GET /reservations/[code] — جزئیات یک رزرو
// ⚠️ امنیت (رفع IDOR): قبلاً این endpoint بدون احراز هویت و بدون چک مالکیت،
// کل رکورد رزرو (نام مهمان، تلفن، آیتم‌ها) را با هر code برمی‌گرداند. چون code
// قابل brute-force است (۸ کاراکتر)، این یک نشت PII بود. حالا:
//  • احراز هویت اجباری است،
//  • مشتری فقط رزرو خودش را می‌بیند (userId == sub)،
//  • staff فقط رزروهای رستوران خودش را (tenantId منطبق)،
//  • و rate-limit برای جلوگیری از enumeration.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    const auth = authFromRequest(req);
    const { code } = parseParams(await params, paramsSchema);

    const r = await db.reservation.findUnique({
      where: { code },
      include: {
        restaurant: { select: { name: true, slug: true, tenantId: true } },
        table: { select: { number: true } },
        items: { include: { menuItem: { select: { name: true, priceToman: true } } } },
      },
    });
    if (!r) throw Err.notFound('رزرو');

    // چک مالکیت/دسترسی
    if (auth.kind === 'staff') {
      // ⚠️ رفعِ نشتِ شعبه (فازِ ۲، §۷): چکِ قبلی فقط tenant-level بود، پس
      // کارمندِ قفل‌شده به شعبه‌ی A رکوردِ کاملِ رزروِ شعبه‌ی B را می‌دید
      // (نامِ مهمان، شماره، پیش‌سفارش). همان کلاسِ حفره‌ای که P0-1 بست، این‌جا
      // با صدا نزدنِ resolveStaffRestaurant باز مانده بود.
      // ۴۰۴ (نه ۴۰۳) تا وجود/عدمِ وجود لو نرود — رفتارِ قبلی حفظ شده.
      const branch = await resolveStaffRestaurant(auth, req);
      if (r.restaurantId !== branch.id) throw Err.notFound('رزرو');
    } else {
      if (r.userId !== auth.sub) throw Err.notFound('رزرو');
    }

    // tenantId داخلی را از پاسخ حذف کن (نباید به کلاینت برود)
    const { restaurant, ...rest } = r;
    return NextResponse.json({
      ...rest,
      restaurant: { name: restaurant.name, slug: restaurant.slug },
    });
  } catch (e) { return errorResponse(e); }
}
