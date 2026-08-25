import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withStaffAuth } from '@/lib/with-restaurant-auth';
import { getEffectivePermissions, effectivePermissionsFrom, type PermissionKey } from '@/lib/permissions';
import { normalizePhone } from '@/lib/otp';
import type { AccessPayload } from '@/lib/jwt';
import { ApiError, Err } from '@/lib/errors';
import { parseBody, zPhone, zUuid, z } from '@/lib/schemas';

const permissionsSchema = z.object({
  canManageReservations: z.boolean().optional(),
  canManageTables: z.boolean().optional(),
  canManageWaitlist: z.boolean().optional(),
  canViewAnalytics: z.boolean().optional(),
  canViewRevenue: z.boolean().optional(),
  canManageCampaigns: z.boolean().optional(),
  canManageCoupons: z.boolean().optional(),
  canManageStaff: z.boolean().optional(),
  canManageSettings: z.boolean().optional(),
});

// نام: اختیاری، حداکثر ۸۰ کاراکتر. null صریح یعنی «پاک کن»، غایب یعنی «تغییر نده».
const zStaffName = z.string().max(80).nullable().optional();

const postSchema = z.object({
  phone: zPhone,
  name: zStaffName,
  // فقط 'staff' و 'manager' از این مسیر ساخته می‌شوند؛ owner/admin هرگز.
  role: z.enum(['staff', 'manager']).default('staff'),
  permissions: permissionsSchema.optional(),
});
const patchSchema = z.object({
  staff_id: zUuid,
  name: zStaffName,
  is_active: z.boolean().optional(),
  permissions: permissionsSchema.optional(),
  // ⚠️ همگام‌سازی‌شده با DB زنده (migration 018): تخصیص/تغییرِ شعبه.
  // null صریح یعنی «قفل شعبه را بردار» (دسترسی به همه‌ی شعبه‌ها)، غایب یعنی «تغییر نده».
  restaurant_id: zUuid.nullable().optional(),
});

type StaffPayload = Extract<AccessPayload, { kind: 'staff' }>;

// نکته: این route مدیریت کارکنان سطح tenant است، نه scoped به یک رستوران مشخص
// (resolveStaffRestaurant عمداً صدا زده نمی‌شود) — به همین دلیل withStaffAuth
// به‌جای withRestaurantAuth استفاده شده (به جای سوءاستفاده از یک abstraction نادرست).
//
// همچنین این route از requirePermission ماژولار استفاده نمی‌کند چون مدیریت خود
// کارکنان یک عملیات سطح‌بالای owner/manager است، نه ماژولی قابل‌تفویض به staff عادی
// (وگرنه یک manager می‌تواند به یک staff اجازه‌ی «مدیریت کارکنان» بدهد که شامل خودِ
// owner هم می‌شود — ریسک privilege-escalation).
//
// ═══ یافته‌ی بازِ ثبت‌شده: `canManageStaff` هیچ اجراکننده‌ای ندارد ═══
//
// شمارشِ واقعی رویِ `src/app/api`: تنها ظهورِ `canManageStaff` در کلِ درختِ
// route، همان فیلدِ `permissionsSchema` بالاست — یعنی این کلید **قابلِ‌دادن
// هست ولی هیچ‌جا اجرا نمی‌شود**. پیامدِ زنده: `apps/business/js/routing.js`
// (`VIEW_PERMISSION.staff = 'canManageStaff'`) تبِ «کارکنان» را برایِ کارمندی
// که این کلید را گرفته **باز می‌کند**، ولی هر درخواست اینجا ۴۰۳ می‌گیرد —
// بن‌بستِ UI، دقیقاً همان چیزی که کامنتِ خودِ routing.js می‌گوید نباید بشود.
//
// ⚠️ رفعِ ساده‌ی وسوسه‌انگیز (اضافه‌کردنِ `requirePermission(auth,
//    'canManageStaff')` در کنارِ چکِ نقش) **عمداً انجام نشد**، چون امنیت را
//    کم می‌کند نه زیاد. یک `staff` با `canManageStaff` می‌توانست:
//      • `PATCH` بزند با `staff_id` **خودش** و `permissions: {همه true}` —
//        گاردِ خطِ «owner قابلِ‌تغییر نیست» فقط هدفِ owner را می‌گیرد، نه
//        خودارتقاییِ یک staff → دسترسیِ هم‌ترازِ owner در یک درخواست؛
//      • `POST` بزند و کارمندِ تازه‌ای با شماره‌ی موبایلِ خودش بسازد → درِ
//        پشتیِ ماندگار (همان کلاسِ باگی که در تستِ staff-auth-guard قفل شده).
//    یعنی این کلید ذاتاً هم‌ارزِ owner است و «تفویضِ محدود» نیست.
//
// تصمیم: رفتارِ سرور دست‌نخورده می‌ماند (سخت‌گیرانه‌تر از کلید). هم‌راستاسازی
// باید سمتِ پنل انجام شود — تبِ «کارکنان» باید به نقشِ owner/manager گره
// بخورد، نه به `canManageStaff`. این خارج از مالکیتِ `api/` است و به معمار
// ارجاع شده. تا آن زمان، `tests/rbac-permission-coverage.test.mts` رفتارِ
// فعلی را قفل می‌کند تا کسی سهواً درِ خودارتقایی را باز نکند.

function assertManagerOrOwner(auth: AccessPayload): asserts auth is StaffPayload {
  if (auth.kind !== 'staff') throw Err.unauthorized();
  if (auth.role !== 'owner' && auth.role !== 'manager') throw Err.forbidden('فقط مدیر می‌تواند کارکنان را مدیریت کند');
}

function shapeStaff(
  s: { id: string; name: string | null; phone: string; role: string; isActive: boolean; restaurantId: string | null },
  permissions: Record<PermissionKey, boolean>,
) {
  return {
    id: s.id, name: s.name, phone: s.phone, role: s.role,
    is_active: s.isActive, restaurant_id: s.restaurantId,
    permissions,
  };
}

export const GET = withStaffAuth({}, async (_req, auth) => {
  assertManagerOrOwner(auth);
  // با include یک کوئری می‌گیریم و مجوز را در حافظه می‌سازیم — بدونِ N+1
  // (قبلاً برای هر staff یک findUnique جدا زده می‌شد).
  const staff = await db.staff.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { role: 'asc' },
    include: { permission: true },
  });
  const items = staff.map(s => shapeStaff(s, effectivePermissionsFrom(s.role, s.permission)));
  return NextResponse.json({ items });
});

// POST — افزودن یک عضو staff · بدنه: { phone, name?, role?, permissions? }
export const POST = withStaffAuth({ rateLimit: 'auth' }, async (req, auth) => {
  assertManagerOrOwner(auth);

  const b = await parseBody(req, postSchema);

  // فقط owner می‌تواند manager بسازد (بک‌اند و UI هر دو این را اعمال می‌کنند).
  if (b.role === 'manager' && auth.role !== 'owner') {
    throw Err.forbidden('فقط مالک می‌تواند مدیر اضافه کند');
  }

  const phone = normalizePhone(b.phone);          // → فرمتِ +98…؛ روی نامعتبر throw می‌کند
  const name = b.name?.trim() || null;

  let created;
  try {
    created = await db.staff.create({
      data: { tenantId: auth.tenantId, phone, name, role: b.role },
    });
  } catch (e) {
    // @@unique([tenantId, phone]) → شماره‌ی تکراری در همین تنانت
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiError('STAFF_PHONE_TAKEN', 'این شماره قبلاً به‌عنوانِ کارمند ثبت شده است', 409);
    }
    throw e;
  }

  // دسترسی‌ها فقط برای staff عادی معنا دارد (owner/manager همه‌چیز را دارند).
  if (b.permissions && b.role === 'staff') {
    await db.staffPermission.create({ data: { staffId: created.id, ...b.permissions } });
  }

  return NextResponse.json({ item: shapeStaff(created, await getEffectivePermissions(created.id, created.role)) }, { status: 201 });
});

// PATCH — به‌روزرسانی دسترسی/شعبه‌ی یک عضو staff · بدنه: { staff_id, permissions?, restaurant_id? }
export const PATCH = withStaffAuth({ rateLimit: 'auth' }, async (req, auth) => {
  assertManagerOrOwner(auth);

  const b = await parseBody(req, patchSchema);

  const target = await db.staff.findFirst({ where: { id: b.staff_id, tenantId: auth.tenantId } });
  if (!target) throw Err.notFound('کارمند');
  if (target.role === 'owner') throw Err.forbidden('دسترسی owner قابل‌تغییر نیست');

  if (b.permissions) {
    await db.staffPermission.upsert({
      where: { staffId: target.id },
      create: { staffId: target.id, ...b.permissions },
      update: b.permissions,
    });
  }

  // فیلدهای مستقیمِ staff را در یک آبجکت جمع می‌کنیم و در صورتِ نیاز یک‌بار update می‌زنیم.
  const data: { name?: string | null; isActive?: boolean; restaurantId?: string | null } = {};

  if (b.name !== undefined) data.name = b.name?.trim() || null;

  if (b.is_active !== undefined) {
    // ⚠️ سخت‌شده (۲۰۲۶-۰۸-۲۲): این شرط قبلاً فقط `=== false` را می‌گرفت، یعنی
    // تغییرِ وضعیتِ فعال‌بودنِ **خودِ** کاربر در جهتِ `true` هیچ گاردی نداشت.
    // درکنارِ باگِ گاردِ `withStaffAuth` (که هیچ کوئریِ DB نمی‌زد و کارمندِ
    // غیرفعال را تا ۱۵ دقیقه راه می‌داد)، این یعنی مدیرِ تازه‌اخراج‌شده
    // می‌توانست خودش را دوباره فعال کند و پنجره‌ی موقت را دائمی کند.
    // گاردِ اصلی یک لایه بالاتر بسته شد؛ این لایه‌ی دوم است: هیچ‌کس وضعیتِ
    // فعال‌بودنِ خودش را عوض نمی‌کند، در هیچ جهتی.
    if (target.id === auth.sub) throw Err.forbidden('نمی‌توانید وضعیتِ فعال‌بودنِ حسابِ خودتان را تغییر دهید');
    if (b.is_active === false && target.role === 'manager' && auth.role !== 'owner') {
      throw Err.forbidden('فقط مالک می‌تواند مدیر را غیرفعال کند');
    }
    data.isActive = b.is_active;
  }

  if (b.restaurant_id !== undefined) {
    if (b.restaurant_id !== null) {
      // چک تنانت: جلوگیری از قفل‌کردنِ کارمند به شعبه‌ای متعلق به تنانتِ دیگر (IDOR)
      const restaurant = await db.restaurant.findFirst({ where: { id: b.restaurant_id, tenantId: auth.tenantId }, select: { id: true } });
      if (!restaurant) throw Err.notFound('رستوران/شعبه');
    }
    data.restaurantId = b.restaurant_id;
  }

  if (Object.keys(data).length > 0) {
    await db.staff.update({ where: { id: target.id }, data });
  }

  return NextResponse.json({ ok: true });
});
