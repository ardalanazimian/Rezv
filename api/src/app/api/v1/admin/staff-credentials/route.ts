import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseQuery, zUuid, zPhone, zUsername, zPassword, z } from '@/lib/schemas';
import { normalizePhone } from '@/lib/otp';
import { hashPassword, normalizeUsername, passwordPolicyError, usernamePolicyError } from '@/lib/password';
import { audit } from '@/lib/audit';

import { withApiMetrics } from '@/lib/api-metrics';

const postSchema = z.object({
  restaurant_id: zUuid,
  phone: zPhone,
  username: zUsername,
  password: zPassword,
  name: z.string().trim().max(80).optional(),
  role: z.enum(['owner', 'manager', 'staff']).optional(),
});

const getSchema = z.object({ restaurant_id: zUuid });

/**
 * GET — کارکنانِ دارایِ نامِ کاربری برایِ یک رستوران (پنلِ شرکت).
 * ⚠️ هرگز `password_hash` برنمی‌گردد. حتی هشِ scrypt هم دادهٔ حساس است:
 * بیرون‌دادنش یعنی مهاجم می‌تواند آفلاین و بدونِ ریت‌لیمیت رویش حمله کند.
 */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const { restaurant_id } = parseQuery(req, getSchema);
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurant_id }, select: { id: true, tenantId: true, name: true },
    });
    if (!restaurant) throw Err.notFound('رستوران');
    const staff = await db.staff.findMany({
      where: { tenantId: restaurant.tenantId },
      select: {
        id: true, name: true, phone: true, role: true, isActive: true,
        username: true, passwordUpdatedAt: true, restaurantId: true,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({
      restaurant: { id: restaurant.id, name: restaurant.name, tenant_id: restaurant.tenantId },
      staff: staff.map(s => ({
        id: s.id, name: s.name, phone: s.phone, role: s.role, is_active: s.isActive,
        username: s.username,
        // فقط «آیا رمز دارد» و «کِی عوض شد» — نه خودِ هش.
        has_password: !!s.passwordUpdatedAt,
        password_updated_at: s.passwordUpdatedAt,
        restaurant_id: s.restaurantId,
      })),
    });
  } catch (e) { return errorResponse(e); }
}

/**
 * POST — ساخت/به‌روزرسانیِ نامِ کاربری و رمز برایِ یک بیزنس (پنلِ شرکت).
 *
 * ⚠️ چرا `phone` هم لازم است: ستونِ `staff.phone` اجباری و کلیدِ یکتاییِ
 * `(tenant_id, phone)` است. همان شماره مسیرِ ورودِ **دومِ** آن کاربر
 * (OTP) را هم زنده نگه می‌دارد — یعنی اگر رمزش را فراموش کرد و کاوه‌نگار
 * راه افتاده بود، راهِ برگشت دارد.
 *
 * upsert روی همان کلیدِ یکتاست، پس فراخوانیِ دوباره با همان شماره فقط
 * اعتبارنامه را عوض می‌کند و کارمندِ تکراری نمی‌سازد.
 */
async function POST_impl(req: Request) {
  const ip = clientIp(req);
  try {
    // نوشتنِ حساس ⇒ سطحِ `auth`، نه `search`.
    await enforceRateLimit(ip, RULES.auth);
    const admin = await requireAdmin(req);
    const b = await parseBody(req, postSchema);

    // سیاستِ رمز و نام‌کاربری از **تنها منبعِ حقیقت** خوانده می‌شود
    // (lib/password.ts)، نه از schemaی این فایل — وگرنه دو تعریفِ موازی
    // می‌شد و سخت‌ترکردنِ سیاست فقط یکی‌شان را عوض می‌کرد.
    const uErr = usernamePolicyError(b.username);
    if (uErr) throw Err.validation(uErr);
    const pErr = passwordPolicyError(b.password);
    if (pErr) throw Err.validation(pErr);

    const restaurant = await db.restaurant.findUnique({
      where: { id: b.restaurant_id }, select: { id: true, tenantId: true, name: true },
    });
    if (!restaurant) throw Err.notFound('رستوران');

    const username = normalizeUsername(b.username);
    const phone = normalizePhone(b.phone);

    // ⚠️ چکِ صریحِ تصاحبِ نام کاربری، پیش از نوشتن. قیدِ یکتاییِ DB هم
    // می‌گیردش، ولی خطای خامِ Prisma یک ۵۰۰ می‌دهد که به اپراتور نمی‌گوید
    // چه شد. اینجا یک ۴۲۲ِ خوانا می‌دهیم.
    const taken = await db.staff.findUnique({ where: { username }, select: { id: true, tenantId: true } });

    const existing = await db.staff.findUnique({
      where: { tenantId_phone: { tenantId: restaurant.tenantId, phone } },
      select: { id: true },
    });
    if (taken && taken.id !== existing?.id) {
      throw Err.validation('این نام کاربری قبلاً گرفته شده است');
    }

    const passwordHash = await hashPassword(b.password);
    const role = b.role ?? 'owner';

    const staff = await db.staff.upsert({
      where: { tenantId_phone: { tenantId: restaurant.tenantId, phone } },
      create: {
        tenantId: restaurant.tenantId, phone, name: b.name ?? null, role,
        isActive: true, username, passwordHash, passwordUpdatedAt: new Date(),
      },
      update: {
        username, passwordHash, passwordUpdatedAt: new Date(), isActive: true,
        ...(b.name === undefined ? {} : { name: b.name }),
        ...(b.role === undefined ? {} : { role }),
      },
      select: { id: true, username: true, role: true, phone: true, name: true, tenantId: true },
    });

    // ⚠️ رمز **هرگز** در audit نمی‌رود — فقط اینکه عوض شد و توسطِ که.
    await audit({
      action: 'admin.staff_credentials_set', actorId: admin.sub, actorType: 'admin', ip,
      restaurantId: restaurant.id,
      detail: {
        staff_id: staff.id, username, role: staff.role,
        tenant_id: restaurant.tenantId, created: !existing,
      },
    });

    return NextResponse.json({
      staff: {
        id: staff.id, username: staff.username, role: staff.role,
        phone: staff.phone, name: staff.name, tenant_id: staff.tenantId,
      },
      created: !existing,
    }, { status: existing ? 200 : 201 });
  } catch (e) { return errorResponse(e); }
}

export const GET = withApiMetrics('/api/v1/admin/staff-credentials', GET_impl);
export const POST = withApiMetrics('/api/v1/admin/staff-credentials', POST_impl);
