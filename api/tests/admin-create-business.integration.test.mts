// ═══════════════════════════════════════════════════════════════════════
//  POST /admin/restaurants — ساختِ مستقیمِ کسب‌وکار از پنلِ شرکت (۲۰۲۶-۰۸-۲۶)
//
//  حکمِ معماریِ مالک: پنلِ شرکت پنلِ مادر است و onboardِ کسب‌وکار از همان‌جا
//  انجام می‌شود. این تست کلِ زنجیره را قفل می‌کند: ساخت (تراکنشی) → ورودِ
//  مالک با اعتبارنامه‌ای که همان لحظه ست شد → و نگاتیوِ مجوز (توکنِ staff
//  حق ندارد کسب‌وکار بسازد).
// ═══════════════════════════════════════════════════════════════════════
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import './helpers/test-env.mts';
// jwt.ts حداقلِ ۳۲ کاراکتر می‌خواهد؛ envِ گیت‌ها فقط ACCESS/REFRESH دارد.
process.env.JWT_SECRET ??= 'a'.repeat(32);
const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { POST: createBusiness } = await import('../src/app/api/v1/admin/restaurants/route.ts');
const { POST: staffLogin } = await import('../src/app/api/v1/auth/staff/login/route.ts');
const { fixturePhone } = await import('./_phone.helper.mts');

const SFX = Math.random().toString(36).slice(2, 8);
const made: { tenantIds: string[] } = { tenantIds: [] };

/** ادمینِ پلتفرمِ موقت — همان سه شرطی که requireAdmin از DB می‌خواهد. */
async function makeAdminToken() {
  const t = await db.tenant.create({ data: { name: `[DEMO] platform ${SFX}` } });
  made.tenantIds.push(t.id);
  const s = await db.staff.create({
    data: { tenantId: t.id, phone: fixturePhone('0912'), role: 'owner', isActive: true },
  });
  process.env.PLATFORM_ADMIN_TENANT_ID = t.id;
  return signAccess({ sub: s.id, kind: 'staff', tenantId: t.id, role: 'owner' });
}

function req(body: unknown, token: string) {
  return new Request('https://example.invalid/api/v1/admin/restaurants', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

after(async () => {
  // پاک‌سازیِ زنجیره‌ای از پایین به بالا (FKها).
  for (const tid of made.tenantIds) {
    const rests = await db.restaurant.findMany({ where: { tenantId: tid }, select: { id: true } });
    for (const r of rests) {
      await db.table.deleteMany({ where: { restaurantId: r.id } });
      await db.restaurant.delete({ where: { id: r.id } }).catch(() => {});
    }
    await db.staff.deleteMany({ where: { tenantId: tid } });
    await db.tenant.delete({ where: { id: tid } }).catch(() => {});
  }
});

describe('ساختِ کسب‌وکار از پنلِ شرکت', () => {
  test('ادمین می‌سازد و مالک با همان اعتبارنامه واقعاً وارد می‌شود', async () => {
    const adminToken = await makeAdminToken();
    const ownerPhone = fixturePhone('0913');
    const username = `demo${SFX}`;

    const res = await createBusiness(req({
      business_name: `[DEMO] biz ${SFX}`,
      owner_phone: ownerPhone,
      username, password: 'Str0ngPass!',
      plan: 'pro',
    }, adminToken));
    // بدنه یک‌بار خوانده می‌شود؛ پیامِ شکست از همان متن ساخته می‌شود.
    const body = await res.text();
    assert.equal(res.status, 201, body);
    const d = JSON.parse(body);
    made.tenantIds.push(d.tenant_id);

    assert.ok(d.restaurant.id, 'رستوران ساخته شده');
    assert.equal(d.owner.username, username);
    assert.equal(d.login.method, 'password');

    // میزهای شروع واقعاً ساخته شده‌اند (پنلِ خالی مرده است).
    assert.equal(await db.table.count({ where: { restaurantId: d.restaurant.id } }), 8);

    // و مالک همان لحظه می‌تواند وارد شود — قفلِ کلِ زنجیره.
    const login = await staffLogin(new Request('https://example.invalid/api/v1/auth/staff/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password: 'Str0ngPass!' }),
    }));
    assert.equal(login.status, 200);
    const ld = await login.json();
    assert.equal(ld.staff.restaurant_id, d.restaurant.id, 'ورود به همان رستورانِ تازه');
  });

  test('نگاتیوِ مجوز: توکنِ staffِ عادی نمی‌تواند کسب‌وکار بسازد', async () => {
    await makeAdminToken(); // فقط برای ستِ PLATFORM_ADMIN_TENANT_ID
    const t = await db.tenant.create({ data: { name: `[DEMO] tenant-b ${SFX}` } });
    made.tenantIds.push(t.id);
    const s = await db.staff.create({
      data: { tenantId: t.id, phone: fixturePhone('0914'), role: 'owner', isActive: true },
    });
    const outsider = signAccess({ sub: s.id, kind: 'staff', tenantId: t.id, role: 'owner' });

    const res = await createBusiness(req({
      business_name: `[DEMO] hijack ${SFX}`, owner_phone: fixturePhone('0915'),
    }, outsider));
    assert.equal(res.status, 403, 'مالکِ یک رستوران ادمینِ پلتفرم نیست');
  });

  test('شماره‌ی تکراری صریح رد می‌شود (نه کسب‌وکارِ دوم)', async () => {
    const adminToken = await makeAdminToken();
    const phone = fixturePhone('0916');
    const first = await createBusiness(req({ business_name: `[DEMO] one ${SFX}`, owner_phone: phone }, adminToken));
    assert.equal(first.status, 201);
    made.tenantIds.push((await first.json()).tenant_id);

    const dup = await createBusiness(req({ business_name: `[DEMO] two ${SFX}`, owner_phone: phone }, adminToken));
    assert.equal(dup.status, 422);
  });

  test('اعتبارنامه‌ی نیمه (فقط username) نیمه‌فعال نمی‌شود', async () => {
    const adminToken = await makeAdminToken();
    const res = await createBusiness(req({
      business_name: `[DEMO] half ${SFX}`, owner_phone: fixturePhone('0917'), username: `half${SFX}`,
    }, adminToken));
    assert.equal(res.status, 422);
  });
});
