import { NextResponse } from 'next/server';
import { qrCheckIn } from '@/lib/tables';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { parseBody, z } from '@/lib/schemas';

const schema = z.object({ qr_code: z.string().min(1).max(200) });

/**
 * POST /api/v1/checkin — پرسنل کدِ QRِ میز را اسکن می‌کند؛ رزروِ فعالِ آن میز
 * seated می‌شود. بدنه: { qr_code }
 *
 * ⚠️ رفعِ P0-2 (فازِ ۲، پروتکل §۴ و §۷): این route قبلاً **کاملاً بدونِ احراز
 * هویت** بود — نه authFromRequest، نه withRestaurantAuth، نه ریت‌لیمیتِ
 * اختصاصی — و مستقیم وضعیتِ رزرو را جهش می‌داد. middleware هم احراز هویت
 * نمی‌کند (فقط بنِ IP، چکِ Origin و ریت‌لیمیتِ سراسری)، پس عملاً عمومی بود.
 *
 * حالا از withRestaurantAuth عبور می‌کند: پرسنلِ احرازشده + محدوده‌ی شعبه +
 * ریت‌لیمیتِ نوشتن (RULES.auth) + پوششِ خطا/تریسِ استاندارد. مجوزِ
 * canManageReservations همان چیزی است که مسیرِ معادلِ «تغییرِ وضعیتِ رزرو»
 * می‌خواهد، پس اسکنِ QR راهِ میان‌بُرِ RBAC نمی‌شود.
 *
 * چرا حذف نشد (پروتکل §۲۰/§۲۱): هیچ مصرف‌کننده‌ی فرانتی ندارد، ولی «بی‌مصرف
 * بودن» مجوزِ حذف نیست وقتی قابلیت عمداً بخشی از محصول است — جریانِ QR در
 * اپِ مشتری زنده است (features/trips.js). پس تعمیر شد، نه حذف.
 */
export const POST = withRestaurantAuth(
  { rateLimit: 'auth', permission: 'canManageReservations' },
  async (req, ctx) => {
    const { qr_code } = await parseBody(req, schema);
    const result = await qrCheckIn(qr_code, ctx.restaurant.id);
    return NextResponse.json(result);
  },
);
