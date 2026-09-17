// ═══════════════════════════════════════════════════════════════════════
//  بنِ کاربر: یادداشتِ داخلیِ ادمین هرگز به خودِ کاربر نمی‌رسد (STATE M-14 · F003)
//
//  چرا این فایل وجود دارد (Feature Verification، ۲۰۲۶-۰۹-۱۷):
//  `Err.userBanned(user.bannedReason)` متنِ آزادِ ادمین را در `details.reason` ِ پاسخِ
//  JSON می‌گذاشت — همان متنی که placeholderِ مودالِ بن با «شکایتِ رسمیِ رستوران»
//  پیشنهاد می‌داد. اپ آن را رندر نمی‌کرد، ولی **تحویل** می‌داد: هر کسی که پاسخِ
//  شبکه را ببیند یادداشتِ داخلی را می‌خواند. و مسیرِ refresh همان را با دست می‌ساخت.
//
//  ادعاها روی **متنِ خامِ بدنه‌ی پاسخ** سنجیده می‌شوند، نه روی یک فیلدِ خاص: اگر
//  یادداشت زیرِ هر کلیدی (reason، note، message، …) برگردد، این تست قرمز می‌شود.
//
//  تا امروز هیچ تستِ runtimeی برای بن نبود — `ban.test.mts` فقط تابعِ خالصِ
//  `isCurrentlyBanned` را می‌سنجد و بقیه را «در سندباکس زنده تست‌شده» می‌خواند.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import './helpers/test-env.mts';
process.env.JWT_SECRET ??= 'a'.repeat(32);
const { db } = await import('../src/lib/db');
const { signAccess, signRefresh } = await import('../src/lib/jwt');
const { banUser, assertUserNotBanned } = await import('../src/lib/ban');
const { requestOtp, normalizePhone } = await import('../src/lib/otp');
// ⚠️ extensionless، همان‌طور که کدِ تولید import می‌کند — وگرنه دو نسخه‌ی ApiError
// ساخته می‌شود و errorResponse خطا را ۵۰۰ می‌بیند (tsx dual-module).
const { errorResponse } = await import('../src/lib/errors');
const { POST: otpVerify } = await import('../src/app/api/v1/auth/otp/verify/route.ts');
const { POST: refreshRoute } = await import('../src/app/api/v1/auth/refresh/route.ts');
const { POST: banRoute } = await import('../src/app/api/v1/admin/users/[userId]/ban/route.ts');
const { testIp } = await import('./helpers/test-ip.mts');
const { fixturePhone } = await import('./_phone.helper.mts');

const SFX = randomUUID().slice(0, 6);
let seq = 0;
/** یادداشتِ داخلیِ یکتا — تا جست‌وجوی متنِ خام فقط همین را پیدا کند. */
const note = () => `شکایتِ رسمیِ رستوران «نمونه» — یادداشتِ داخلی ${SFX}-${++seq}`;

const savedEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ['OTP_DEV_MODE', 'PLATFORM_ADMIN_TENANT_ID']) savedEnv[k] = process.env[k];
  process.env.OTP_DEV_MODE = 'true';
});
afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

/** کاربر با شماره‌ی **نرمال‌شده** — `verifyOtp` با `+98…` upsert می‌کند؛ `09…` یعنی کاربرِ دیگر. */
async function makeUser() {
  // ⚠️ پیشوندِ ۰۹۴۶ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
  const raw = fixturePhone('0946');
  const u = await db.user.create({ data: { phone: normalizePhone(raw), firstName: '[DEMO] بن' } });
  // گاردِ خودِ فیکسچر: routeِ verify با `normalizePhone(raw)` upsert می‌کند. اگر روزی کسی
  // `phone: raw` بنویسد، verify کاربرِ **دیگری** (بن‌نشده) می‌سازد و هر ادعای زیر دروغ می‌شود.
  const stored = await db.user.findUniqueOrThrow({ where: { id: u.id }, select: { phone: true } });
  assert.equal(stored.phone, normalizePhone(raw), 'فیکسچر باید همان شماره‌ای را داشته باشد که verify جست‌وجو می‌کند');
  return { id: u.id, raw };
}

async function verifyAs(raw: string) {
  const { devCode } = await requestOtp(raw);
  assert.ok(devCode, 'OTP_DEV_MODE باید کد را برگرداند — بدونِ آن تست به مسیرِ بن نمی‌رسد');
  return otpVerify(new Request('http://t/api/v1/auth/otp/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': testIp() },
    body: JSON.stringify({ phone: raw, code: devCode }),
  }));
}

function assertNoNote(text: string, internal: string) {
  assert.ok(!text.includes(internal), `یادداشتِ داخلی در بدنه‌ی خامِ پاسخ است:\n${text}`);
  assert.ok(!text.includes(SFX), 'هیچ تکه‌ای از یادداشت نباید برسد');
}

describe('بن: فقط کلیدِ عمومی به کاربر می‌رسد، نه یادداشتِ داخلی (M-14)', () => {
  test('کنترلِ مثبت: کاربرِ بن‌نشده با همین مسیر توکن می‌گیرد', async () => {
    const u = await makeUser();
    const res = await verifyAs(u.raw);
    assert.equal(res.status, 200, 'اگر این سبز نباشد، تست‌های بعدی به چکِ بن نمی‌رسند و سبزشان بی‌معناست');
    const body = await res.json();
    assert.equal(typeof body.access, 'string');
  });

  test('otp/verify: ۴۰۳ USER_BANNED با reason_key و بدونِ یادداشت', async () => {
    const u = await makeUser();
    const internal = note();
    await banUser(u.id, randomUUID(), { reasonKey: 'promo_abuse', note: internal }, null);
    const res = await verifyAs(u.raw);
    const text = await res.text();
    assert.equal(res.status, 403);
    assertNoNote(text, internal);
    const body = JSON.parse(text);
    assert.equal(body.error.code, 'USER_BANNED');
    assert.equal(body.error.details.reason_key, 'promo_abuse');
    assert.ok(Number.isFinite(Date.parse(body.error.details.banned_at)), 'banned_at باید ISO باشد');
    assert.equal('reason' in body.error.details, false, 'کلیدِ قدیمیِ reason نباید برگردد');
  });

  test('auth/refresh: همان قرارداد — بدنه‌ی دست‌سازِ این route هم یادداشت را نمی‌فرستد', async () => {
    const u = await makeUser();
    const internal = note();
    await banUser(u.id, randomUUID(), { reasonKey: 'repeated_no_show', note: internal }, null);
    const res = await refreshRoute(new Request('http://t/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': testIp() },
      body: JSON.stringify({ refresh: signRefresh({ sub: u.id, kind: 'customer' }) }),
    }));
    const text = await res.text();
    assert.equal(res.status, 403);
    assertNoNote(text, internal);
    const body = JSON.parse(text);
    assert.equal(body.error.code, 'USER_BANNED');
    assert.equal(body.error.details.reason_key, 'repeated_no_show');
  });

  test('assertUserNotBanned (رزرو، صف، نظر، ماموریت، جایزه): همان قرارداد', async () => {
    const u = await makeUser();
    const internal = note();
    await banUser(u.id, randomUUID(), { reasonKey: 'abusive_conduct', note: internal }, null);
    let caught: unknown = null;
    try { await assertUserNotBanned(u.id); } catch (e) { caught = e; }
    assert.ok(caught, 'کاربرِ بن‌شده باید رد شود');
    const res = errorResponse(caught);
    const text = await res.text();
    assert.equal(res.status, 403);
    assertNoNote(text, internal);
    assert.equal(JSON.parse(text).error.details.reason_key, 'abusive_conduct');
  });

  test('بنِ قدیمی (بدونِ کلید): reason_key=null، و یادداشت باز هم نمی‌رسد', async () => {
    const u = await makeUser();
    const internal = note();
    await db.user.update({ where: { id: u.id }, data: { bannedAt: new Date(), bannedReason: internal } });
    const res = await verifyAs(u.raw);
    const text = await res.text();
    assert.equal(res.status, 403);
    assertNoNote(text, internal);
    assert.strictEqual(JSON.parse(text).error.details.reason_key, null);
  });
});

describe('POST /admin/users/:id/ban — کلیدِ عمومی اجباری است', () => {
  async function adminToken() {
    const t = await db.tenant.create({ data: { name: `[DEMO] platform ${SFX}-${++seq}` } });
    const s = await db.staff.create({ data: { tenantId: t.id, phone: fixturePhone('0946'), role: 'owner', isActive: true } });
    process.env.PLATFORM_ADMIN_TENANT_ID = t.id;
    return signAccess({ sub: s.id, kind: 'staff', tenantId: t.id, role: 'owner' });
  }
  async function ban(token: string, userId: string, body: unknown) {
    return banRoute(new Request(`http://t/api/v1/admin/users/${userId}/ban`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-forwarded-for': testIp() },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ userId }) });
  }

  test('بدونِ reason_key → ۴۲۲ VALIDATION و کاربر بن نمی‌شود', async () => {
    const token = await adminToken();
    const u = await makeUser();
    const res = await ban(token, u.id, { reason: note() });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error.code, 'VALIDATION');
    const row = await db.user.findUniqueOrThrow({ where: { id: u.id }, select: { bannedAt: true } });
    assert.strictEqual(row.bannedAt, null);
  });

  test('reason_keyِ خارج از فهرست → ۴۲۲ VALIDATION', async () => {
    const token = await adminToken();
    const u = await makeUser();
    const res = await ban(token, u.id, { reason_key: 'because_i_said_so', reason: note() });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error.code, 'VALIDATION');
  });

  test('با کلید و یادداشت → ۲۰۰؛ هر دو ذخیره می‌شوند، هرکدام در ستونِ خودش', async () => {
    const token = await adminToken();
    const u = await makeUser();
    const internal = note();
    const res = await ban(token, u.id, { reason_key: 'user_request', reason: internal });
    assert.equal(res.status, 200);
    const row = await db.user.findUniqueOrThrow({
      where: { id: u.id }, select: { bannedAt: true, bannedReason: true, bannedReasonKey: true },
    });
    assert.ok(row.bannedAt);
    assert.equal(row.bannedReasonKey, 'user_request');
    assert.equal(row.bannedReason, internal, 'یادداشتِ داخلی برای ادمین می‌ماند');
  });
});
