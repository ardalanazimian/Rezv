import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// import پویا عمداً — به دلیل باگ محیطیِ import استاتیک چندنامی در ترکیب
// tsx+node:test در این sandbox (شرح کامل در tests/validate.test.mts).
const jwtLib = await import('../src/lib/jwt.ts');
const { signAccess, signRefresh, verifyAccess, verifyRefresh, accessFromRefresh, authFromRequest } = jwtLib;

describe('signAccess / verifyAccess — مشتری', () => {
  test('round-trip: مشتری امضاشده درست verify می‌شود', () => {
    const token = signAccess({ sub: 'user-1', kind: 'customer' });
    const payload = verifyAccess(token);
    assert.equal(payload.sub, 'user-1');
    assert.equal(payload.kind, 'customer');
  });
  test('توکن دستکاری‌شده (امضای نامعتبر) رد می‌شود', () => {
    const token = signAccess({ sub: 'user-1', kind: 'customer' });
    const tampered = token.slice(0, -2) + 'xx';
    assert.throws(() => verifyAccess(tampered));
  });
  test('توکنی که با secretِ دیگری امضا شده (مثلاً refresh) با verifyAccess رد می‌شود', () => {
    const refreshToken = signRefresh({ sub: 'user-1', kind: 'customer' });
    assert.throws(() => verifyAccess(refreshToken));
  });
});

describe('signAccess / verifyAccess — staff (tenant/role)', () => {
  test('tenantId و role در توکن staff حفظ می‌شود', () => {
    const token = signAccess({ sub: 'staff-1', kind: 'staff', tenantId: 't-1', role: 'manager' });
    const payload = verifyAccess(token);
    assert.equal(payload.kind, 'staff');
    if (payload.kind === 'staff') {
      assert.equal(payload.tenantId, 't-1');
      assert.equal(payload.role, 'manager');
    }
  });
});

describe('امنیت: algorithm confusion و issuer/audience', () => {
  test('توکنی که با jwt خودمون امضا نشده (رشته‌ی دلخواه) رد می‌شود', () => {
    assert.throws(() => verifyAccess('not.a.jwt'));
  });
  test('توکن refresh را نمی‌توان با verifyAccess (secret متفاوت) تأیید کرد', () => {
    const refreshToken = signRefresh({ sub: 'user-1', kind: 'customer' });
    // چون از JWT_REFRESH_SECRET امضا شده، با accessSecret تطابق ندارد
    assert.throws(() => verifyAccess(refreshToken));
  });
  test('توکن با header alg=none و بدون امضا رد می‌شود (جلوگیری از الگوریتم confusion)', () => {
    const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const forged = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: 'attacker', kind: 'staff', tenantId: 't-1', role: 'owner' })}.`;
    assert.throws(() => verifyAccess(forged));
  });
});

describe('signRefresh / verifyRefresh', () => {
  test('round-trip refresh مشتری', () => {
    const token = signRefresh({ sub: 'user-1', kind: 'customer' });
    const payload = verifyRefresh(token);
    assert.equal(payload.sub, 'user-1');
    assert.equal(payload.kind, 'customer');
    assert.ok(payload.jti, 'jti باید تولید شده باشد');
  });
  test('هر فراخوانیِ signRefresh یک jti یکتا تولید می‌کند', () => {
    const t1 = verifyRefresh(signRefresh({ sub: 'u', kind: 'customer' }));
    const t2 = verifyRefresh(signRefresh({ sub: 'u', kind: 'customer' }));
    assert.notEqual(t1.jti, t2.jti);
  });
  test('signRefresh با ورودی رشته‌ای (sub خام) را customer در نظر می‌گیرد (سازگاری قدیمی)', () => {
    const token = signRefresh('legacy-user-id');
    const payload = verifyRefresh(token);
    assert.equal(payload.kind, 'customer');
    assert.equal(payload.sub, 'legacy-user-id');
  });
  test('refresh با tenantId/role برای staff حفظ می‌شود', () => {
    const token = signRefresh({ sub: 's-1', kind: 'staff', tenantId: 't-9', role: 'owner' });
    const payload = verifyRefresh(token);
    assert.equal(payload.kind, 'staff');
    if (payload.kind === 'staff') {
      assert.equal(payload.tenantId, 't-9');
      assert.equal(payload.role, 'owner');
    }
  });
});

describe('accessFromRefresh — تبدیل هم‌نوع برای صدور access جدید', () => {
  test('برای مشتری، فقط sub/kind منتقل می‌شود', () => {
    const access = accessFromRefresh({ sub: 'u-1', jti: 'j-1', kind: 'customer' });
    assert.deepEqual(access, { sub: 'u-1', kind: 'customer' });
  });
  test('برای staff، tenantId/role هم منتقل می‌شود (باگ C3 رفع‌شده: دیگر به customer تنزل نمی‌یابد)', () => {
    const access = accessFromRefresh({ sub: 's-1', jti: 'j-1', kind: 'staff', tenantId: 't-1', role: 'manager' });
    assert.deepEqual(access, { sub: 's-1', kind: 'staff', tenantId: 't-1', role: 'manager' });
  });
});

describe('authFromRequest', () => {
  test('بدون هدر Authorization رد می‌شود', () => {
    const req = new Request('https://x.test/api', { headers: { 'x-real-ip': testIp() } });
    assert.throws(() => authFromRequest(req));
  });
  test('هدر بدون Bearer رد می‌شود', () => {
    const req = new Request('https://x.test/api', {
      headers: { authorization: 'Basic xxx', 'x-real-ip': testIp() },
    });
    assert.throws(() => authFromRequest(req));
  });
  test('هدر Bearer معتبر پارس می‌شود', () => {
    const token = signAccess({ sub: 'u-1', kind: 'customer' });
    const req = new Request('https://x.test/api', {
      headers: { authorization: `Bearer ${token}`, 'x-real-ip': testIp() },
    });
    const payload = authFromRequest(req);
    assert.equal(payload.sub, 'u-1');
  });
});
