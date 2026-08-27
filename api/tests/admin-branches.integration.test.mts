// ═══════════════════════════════════════════════════════════════════════
//  SPEC-B §۸ — شعبه‌ی جدید زیرِ همان tenant + سقفِ branchLimit + نگاتیوِ مجوز
// ═══════════════════════════════════════════════════════════════════════
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import './helpers/test-env.mts';
process.env.JWT_SECRET ??= 'a'.repeat(32);
const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { POST: createBranchRoute } = await import('../src/app/api/v1/admin/restaurants/[id]/branches/route.ts');
const { fixturePhone } = await import('./_phone.helper.mts');

const SFX = Math.random().toString(36).slice(2, 8);
const made = { tenantIds: [] as string[] };
const uip = () => `10.79.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function makeAdminToken() {
  const t = await db.tenant.create({ data: { name: `[DEMO] platform-br ${SFX}` } });
  made.tenantIds.push(t.id);
  const s = await db.staff.create({ data: { tenantId: t.id, phone: fixturePhone('0941'), role: 'owner', isActive: true } });
  process.env.PLATFORM_ADMIN_TENANT_ID = t.id;
  return signAccess({ sub: s.id, kind: 'staff', tenantId: t.id, role: 'owner' });
}

/** یک tenant با سقفِ دلخواه و یک رستورانِ مبدأ. */
let _seq = 0;
async function makeTenantWithRestaurant(branchLimit: number) {
  const seq = ++_seq;   // دو فراخوانی با یک branchLimit نباید slug/نامِ یکسان بسازند
  const t = await db.tenant.create({ data: { name: `[DEMO] biz-br ${SFX}-${seq}`, branchLimit } });
  made.tenantIds.push(t.id);
  await db.staff.create({ data: { tenantId: t.id, phone: fixturePhone('0942'), role: 'owner', isActive: true } });
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `br-src-${SFX}-${seq}`, name: '[DEMO] مبدأ', clubPrefix: 'BRS' },
    select: { id: true },
  });
  return { tenantId: t.id, restaurantId: r.id };
}

function req(id: string, body: unknown, token: string) {
  return createBranchRoute(new Request(`https://example.invalid/api/v1/admin/restaurants/${id}/branches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-forwarded-for': uip() },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });
}

after(async () => {
  for (const tid of made.tenantIds) {
    await db.staffInvite.deleteMany({ where: { tenantId: tid } });
    const rests = await db.restaurant.findMany({ where: { tenantId: tid }, select: { id: true } });
    for (const r of rests) {
      await db.table.deleteMany({ where: { restaurantId: r.id } });
      await db.auditLog.deleteMany({ where: { restaurantId: r.id } });
      await db.restaurant.delete({ where: { id: r.id } }).catch(() => {});
    }
    await db.staff.deleteMany({ where: { tenantId: tid } });
    await db.tenant.delete({ where: { id: tid } }).catch(() => {});
  }
});

describe('شعبه‌ها (SPEC-B §۸)', () => {
  test('شعبه‌ی دوم زیرِ **همان** tenant ساخته می‌شود؛ staffِ جدید نه', async () => {
    const token = await makeAdminToken();
    const { tenantId, restaurantId } = await makeTenantWithRestaurant(3);
    const staffBefore = await db.staff.count({ where: { tenantId } });

    const res = await req(restaurantId, { branch_name: `[DEMO] شعبه‌ی دو ${SFX}` }, token);
    const body = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.tenant_id, tenantId, 'زیرِ همان tenant');
    assert.equal(await db.staff.count({ where: { tenantId } }), staffBefore, 'ownerِ مشترک — staffِ تازه ممنوع');

    const branch = await db.restaurant.findUnique({ where: { id: body.restaurant.id }, select: { provisionStatus: true } });
    assert.equal(branch!.provisionStatus, 'ACTIVE', 'مالک فعال است؛ شعبه ACTIVE متولد می‌شود');

    const log = await db.auditLog.findFirst({ where: { action: 'restaurant.branch_created', restaurantId: body.restaurant.id } });
    assert.ok(log, 'audit');
  });

  test('سقفِ branchLimit → ۴۰۹ با reason=branch_limit_reached', async () => {
    const token = await makeAdminToken();
    const { restaurantId } = await makeTenantWithRestaurant(1); // مبدأ خودش سقف را پر کرده
    const res = await req(restaurantId, { branch_name: `[DEMO] بیش‌ازسقف ${SFX}` }, token);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error?.details?.reason, 'branch_limit_reached');
  });

  test('نگاتیوِ مجوز: staffِ عادیِ یک رستوران → ۴۰۳', async () => {
    await makeAdminToken(); // فقط ستِ PLATFORM_ADMIN_TENANT_ID
    const { tenantId, restaurantId } = await makeTenantWithRestaurant(3);
    const s = await db.staff.findFirstOrThrow({ where: { tenantId }, select: { id: true } });
    const outsider = signAccess({ sub: s.id, kind: 'staff', tenantId, role: 'owner' });
    assert.equal((await req(restaurantId, { branch_name: 'x' }, outsider)).status, 403);
  });

  test('fail-closed: بدونِ PLATFORM_ADMIN_TENANT_ID → ۴۰۳ حتی برای ادمینِ واقعی', async () => {
    const token = await makeAdminToken();
    const { restaurantId } = await makeTenantWithRestaurant(3);
    const saved = process.env.PLATFORM_ADMIN_TENANT_ID;
    delete process.env.PLATFORM_ADMIN_TENANT_ID;
    try {
      assert.equal((await req(restaurantId, { branch_name: 'x' }, token)).status, 403);
    } finally {
      process.env.PLATFORM_ADMIN_TENANT_ID = saved;
    }
  });
});
