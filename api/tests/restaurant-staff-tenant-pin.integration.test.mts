import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  پینِ `GET /restaurant/staff` برایِ توکنِ ادمینِ پلتفرم
//
//  ⚠️ چرا (اولین ورودِ واقعیِ ادمین، ۲۰۲۶-۰۹-۰۲): توکنِ platform-admin رویِ
//  این route ۲۰۰ گرفت در حالی که رویِ همه‌ی routeهای `withRestaurantAuth`
//  ۴۰۴ می‌گرفت. دلیل: این تنها مصرف‌کننده‌ی `withStaffAuth` است که رستوران
//  نمی‌خواهد، فقط تنانت. تصمیمِ نهایی: **خودِ route دست نخورد.**
//
//  پس چیزی که باید پین شود همین است: پاسخ فقط staffِ **همان تنانت** است —
//  نه یک کلمه بیشتر. اگر روزی فیلترِ `where: { tenantId: auth.tenantId }`
//  (`restaurant/staff/route.ts:100`) برداشته یا شل شود، این‌جا قرمز می‌شود
//  — و آن روز این route از «کمی سخاوتمند» به «نشتِ cross-tenantِ کارکنان»
//  تبدیل شده است.
//
//  ساختار: کارکنِ تنانتِ دیگر **باید وجود داشته باشد** و صریحاً assert
//  می‌شود — وگرنه «غایب است» بی‌معنا می‌بود (قاعده‌ی ۵ِ CLAUDE.md).
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const staffRoute = await import('../src/app/api/v1/restaurant/staff/route');

const SFX = String(Date.now()).slice(-7);
const saved: Record<string, string | undefined> = {};
let platformTenantId = '';
let otherTenantId = '';
let adminId = '';
let otherStaffId = '';
let token = '';

describe('restaurant/staff — توکنِ ادمینِ پلتفرم فقط staffِ تنانتِ خودش را می‌بیند', () => {
  before(async () => {
    saved.PLATFORM_ADMIN_TENANT_ID = process.env.PLATFORM_ADMIN_TENANT_ID;

    const pt = await db.tenant.create({ data: { name: `[DEMO] ${SFX}-plat` }, select: { id: true } });
    platformTenantId = pt.id;
    process.env.PLATFORM_ADMIN_TENANT_ID = pt.id;
    const admin = await db.staff.create({
      data: { tenantId: pt.id, phone: fixturePhone('0971'), name: '[DEMO] مدیرِ پلتفرم', role: 'owner', isActive: true },
      select: { id: true },
    });
    adminId = admin.id;
    token = signAccess({ sub: admin.id, kind: 'staff', tenantId: pt.id, role: 'owner' });

    // تنانتِ دیگر با یک کارکن — موضوعِ ادعای «نباید دیده شود».
    const ot = await db.tenant.create({ data: { name: `[DEMO] ${SFX}-other` }, select: { id: true } });
    otherTenantId = ot.id;
    const os = await db.staff.create({
      data: { tenantId: ot.id, phone: fixturePhone('0972'), name: '[DEMO] کارکنِ تنانتِ دیگر', role: 'owner', isActive: true },
      select: { id: true },
    });
    otherStaffId = os.id;
  });

  after(async () => {
    if (saved.PLATFORM_ADMIN_TENANT_ID === undefined) delete process.env.PLATFORM_ADMIN_TENANT_ID;
    else process.env.PLATFORM_ADMIN_TENANT_ID = saved.PLATFORM_ADMIN_TENANT_ID;
    await db.staff.deleteMany({ where: { tenantId: { in: [platformTenantId, otherTenantId] } } });
    await db.tenant.deleteMany({ where: { id: { in: [platformTenantId, otherTenantId] } } });
    await db.$disconnect();
  });

  test('پیش‌شرط: کارکنِ تنانتِ دیگر واقعاً در DB هست', async () => {
    const n = await db.staff.count({ where: { id: otherStaffId, tenantId: otherTenantId } });
    assert.equal(n, 1, 'بدونِ این، «غایب است» هیچ‌چیز را ثابت نمی‌کند');
  });

  test('۲۰۰ و فقط staffِ تنانتِ پلتفرم — کارکنِ تنانتِ دیگر غایب است', async () => {
    const res = await staffRoute.GET(new Request('http://x/api/v1/restaurant/staff', {
      headers: { authorization: `Bearer ${token}`, 'x-real-ip': testIp() },
    }));
    assert.equal(res.status, 200, 'رفتارِ فعلی: withStaffAuth رستوران نمی‌خواهد — عمداً دست‌نخورده');
    const body = await res.json();
    assert.ok(Array.isArray(body.items) && body.items.length >= 1, 'باید دستِ‌کم خودِ ادمین را برگرداند');

    const ids = new Set(body.items.map((s: { id: string }) => s.id));
    assert.ok(ids.has(adminId), 'کنترلِ مثبت: خودِ ادمین باید در فهرست باشد');
    assert.ok(!ids.has(otherStaffId),
      'کارکنِ تنانتِ دیگر نباید دیده شود — این تنها چیزی است که این route را از نشتِ cross-tenant جدا می‌کند');

    // و نه فقط «آن یکی غایب است»: **هر** آیتم باید متعلق به تنانتِ پلتفرم باشد.
    const rows = await db.staff.findMany({ where: { id: { in: [...ids] } }, select: { tenantId: true } });
    assert.ok(rows.length === ids.size && rows.every(r => r.tenantId === platformTenantId),
      'هر آیتمِ برگشتی باید tenantId = تنانتِ پلتفرم داشته باشد');
  });
});
