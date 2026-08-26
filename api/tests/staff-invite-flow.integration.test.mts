// ═══════════════════════════════════════════════════════════════════════
//  SPEC-B — فلوی دعوتِ اولین‌ورودِ owner (§۶-۱، §۷، §۸)
//
//  قفل می‌کند: claimِ توکنِ معتبر/منقضی/باطل، پذیرشِ دعوت به‌عنوانِ
//  side-effectِ ورودِ موفق (هم OTP هم رمز — C10)، فعال‌شدنِ رستوران، resend
//  با ابطالِ توکنِ قبلی، و ثابت‌ماندنِ **شکلِ** پاسخِ verify (کلیدها).
// ═══════════════════════════════════════════════════════════════════════
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import './helpers/test-env.mts';
process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.OTP_DEV_MODE = 'true';
const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { provisionBusiness, resendInvite } = await import('../src/lib/provisioning');
const { POST: claim } = await import('../src/app/api/v1/auth/invite/[token]/claim/route.ts');
const { POST: otpRequest } = await import('../src/app/api/v1/auth/staff/request/route.ts');
const { POST: otpVerify } = await import('../src/app/api/v1/auth/staff/verify/route.ts');
const { POST: pwLogin } = await import('../src/app/api/v1/auth/staff/login/route.ts');
const { fixturePhone } = await import('./_phone.helper.mts');

const SFX = Math.random().toString(36).slice(2, 8);
const made = { tenantIds: [] as string[] };
const uip = () => `10.78.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

function jreq(url: string, body: unknown) {
  return new Request(`https://example.invalid${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': uip() },
    body: JSON.stringify(body),
  });
}
function claimReq(token: string) {
  return claim(jreq(`/api/v1/auth/invite/${token}/claim`, {}), { params: Promise.resolve({ token }) });
}

/** provision از راهِ خودِ lib — همان مسیری که route صدا می‌زند. */
async function makeProvisioned(phonePrefix: string, extra: Record<string, unknown> = {}) {
  const admin = { adminId: (await db.staff.findFirst({ select: { id: true } }))?.id ?? '00000000-0000-0000-0000-000000000000', ip: 'test' };
  const r = await provisionBusiness({
    businessName: `[DEMO] invitefl ${SFX}-${phonePrefix}`,
    ownerPhone: fixturePhone(phonePrefix),
    ...extra,
  } as any, admin);
  made.tenantIds.push(r.tenantId);
  const invite = await db.staffInvite.findUniqueOrThrow({ where: { id: r.inviteId }, select: { token: true, phone: true } });
  return { ...r, token: invite.token, phone: invite.phone };
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
    const staff = await db.staff.findMany({ where: { tenantId: tid }, select: { phone: true } });
    for (const s of staff) await db.otpCode.deleteMany({ where: { phone: s.phone } }).catch(() => {});
    await db.staff.deleteMany({ where: { tenantId: tid } });
    await db.tenant.delete({ where: { id: tid } }).catch(() => {});
  }
});

describe('claimِ دعوت (§۵-۴)', () => {
  test('توکنِ معتبر → نامِ رستوران + ماسکِ شماره + متدها؛ بدونِ mutate', async () => {
    const p = await makeProvisioned('0931');
    const res = await claimReq(p.token);
    assert.equal(res.status, 200);
    const d = await res.json();
    assert.equal(d.restaurant.slug, p.restaurant.slug);
    assert.match(d.phone_mask, /\*\*\*/);
    assert.deepEqual(d.methods, { otp: true, password: false });
    // claim چیزی را عوض نکرده
    const inv = await db.staffInvite.findFirst({ where: { token: p.token } });
    assert.equal(inv!.status, 'PENDING');
  });

  test('حسابِ دارای رمز → methods.password=true', async () => {
    const p = await makeProvisioned('0932', { username: `inv${SFX}`, password: 'Str0ngPass!' });
    const d = await (await claimReq(p.token)).json();
    assert.deepEqual(d.methods, { otp: true, password: true });
  });

  test('توکنِ منقضی → ۴۰۴ (جدولِ §۷)؛ نامعتبر هم ۴۰۴ (بدونِ افشا)', async () => {
    const p = await makeProvisioned('0933');
    await db.staffInvite.updateMany({ where: { token: p.token }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await claimReq(p.token)).status, 404);
    assert.equal((await claimReq('deadbeef'.repeat(8))).status, 404);
  });
});

describe('پذیرشِ دعوت = side-effectِ اولین ورودِ موفق (§۶-۱ / C10)', () => {
  test('OTP: request→verify ⇒ invite=ACCEPTED و restaurant=ACTIVE؛ شکلِ پاسخِ verify ثابت', async () => {
    const p = await makeProvisioned('0934');
    const local = p.phone.replace('+98', '0');

    const rq = await otpRequest(jreq('/api/v1/auth/staff/request', { phone: local }));
    const rqd = await rq.json().catch(() => ({}));
    const code = rqd.dev_code || rqd.devCode;
    assert.ok(code, `OTP_DEV_MODE باید کد بدهد: ${JSON.stringify(rqd)}`);

    const rv = await otpVerify(jreq('/api/v1/auth/staff/verify', { phone: local, code }));
    assert.equal(rv.status, 200);
    const rvd = await rv.json();
    // قفلِ شکل (C10): همان کلیدهای همیشگی — نه بیشتر نه کمتر
    assert.deepEqual(Object.keys(rvd).sort(), ['access', 'refresh', 'staff']);

    const inv = await db.staffInvite.findFirst({ where: { token: p.token } });
    assert.equal(inv!.status, 'ACCEPTED');
    const rest = await db.restaurant.findUnique({ where: { id: p.restaurant.id }, select: { provisionStatus: true } });
    assert.equal(rest!.provisionStatus, 'ACTIVE');

    const log = await db.auditLog.findFirst({ where: { action: 'staff.invite_accepted', restaurantId: p.restaurant.id } });
    assert.ok(log, 'auditِ پذیرش');
  });

  test('ورود با رمز هم دعوت را می‌پذیرد', async () => {
    const uname = `invpw${SFX}`;
    const p = await makeProvisioned('0935', { username: uname, password: 'Str0ngPass!' });
    const rv = await pwLogin(jreq('/api/v1/auth/staff/login', { username: uname, password: 'Str0ngPass!' }));
    assert.equal(rv.status, 200, await rv.clone().text());
    const inv = await db.staffInvite.findFirst({ where: { token: p.token } });
    assert.equal(inv!.status, 'ACCEPTED');
    const rest = await db.restaurant.findUnique({ where: { id: p.restaurant.id }, select: { provisionStatus: true } });
    assert.equal(rest!.provisionStatus, 'ACTIVE');
  });
});

describe('resend (§۸)', () => {
  test('توکنِ نو، انقضای نو؛ PENDING قبلی REVOKED و claimش ۴۰۴', async () => {
    const p = await makeProvisioned('0936');
    const jobsBefore = await db.job.count({ where: { kind: 'sms' } });
    const admin = { adminId: '00000000-0000-0000-0000-000000000000', ip: 'test' };
    const r = await resendInvite(p.restaurant.id, admin);
    assert.match(r.inviteSentTo, /\*\*\*/);

    const old = await db.staffInvite.findFirst({ where: { token: p.token } });
    assert.equal(old!.status, 'REVOKED');
    assert.equal((await claimReq(p.token)).status, 404, 'لینکِ لورفته‌ی قدیمی مرده');

    const fresh = await db.staffInvite.findFirst({ where: { restaurantId: p.restaurant.id, status: 'PENDING' } });
    assert.ok(fresh && fresh.token !== p.token, 'توکنِ تازه');
    assert.equal(await db.job.count({ where: { kind: 'sms' } }), jobsBefore + 1, 'پیامکِ مجدد صف شد');
  });
});
