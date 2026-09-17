import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  REPRO — تصاحبِ شماره‌ی کارمند/مالک از راهِ ردیف‌های اثبات‌نشده (P1-4 · BE-04 · BE-05)
//
//  ⚠️ این فایل عمداً `.repro.mts` است، نه `.test.mts`: در `_all.runner.mts` نیست و CI اجرایش
//  نمی‌کند. هر ادعای آن **ناوردای امنیتیِ مطلوب** است و امروز قرمز می‌شود — یعنی اثباتِ اینکه
//  حمله زنده است. رفعش یک تصمیمِ طراحیِ احراز است که قراردادِ قفل‌شده‌ی C10 (شکلِ پاسخِ
//  staff/verify و «پذیرشِ دعوت = اثرِ جانبیِ اولین ورود») را عوض می‌کند؛ پس به CEO بسته‌ی
//  تصمیم رفت، نه کد (docs/audit/impl/P1-4-PACKAGE.md). روزی که رفع ادغام شود، این فایل به
//  `.test.mts` تغییرِ نام می‌دهد و به runner اضافه می‌شود.
//
//  اجرا (DBِ تازه، OTP_DEV_MODE):
//    npx tsx --test --test-force-exit tests/staff-phone-hijack.repro.mts
//
//  هیچ پاک‌سازی‌ای نیست — DBِ هر اجرا تازه است (کلونِ قالب).
// ═══════════════════════════════════════════════════════════════════════

import './helpers/test-env.mts';
process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
process.env.OTP_DEV_MODE = 'true';

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { provisionBusiness } = await import('../src/lib/provisioning');
const { POST: addStaff } = await import('../src/app/api/v1/restaurant/staff/route.ts');
const { POST: trial } = await import('../src/app/api/v1/site/trial/route.ts');
const { POST: otpRequest } = await import('../src/app/api/v1/auth/staff/request/route.ts');
const { POST: otpVerify } = await import('../src/app/api/v1/auth/staff/verify/route.ts');
const { fixturePhone } = await import('./_phone.helper.mts');

// ⚠️ پیشوندهای ۰۹۹۴ (قربانی) و ۰۹۹۵ (مهاجم/مالکِ مشروع) مالِ همین فایل‌اند.
const SFX = Math.random().toString(36).slice(2, 8);
const uip = () => `10.94.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

function post(url: string, body: unknown, token?: string) {
  return new Request(`https://example.invalid${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-forwarded-for': uip(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const admin = { adminId: '00000000-0000-4000-8000-000000000001', ip: 'repro' };

/** یک کسب‌وکارِ فراهم‌شده با مالکِ خودش + توکنِ همان مالک. */
async function business(label: string) {
  const ownerPhone = fixturePhone('0995');
  const r = await provisionBusiness({ businessName: `[DEMO] hijack ${label} ${SFX}`, ownerPhone } as any, admin);
  const owner = await db.staff.findFirstOrThrow({ where: { tenantId: r.tenantId, role: 'owner' }, select: { id: true } });
  const token = signAccess({ sub: owner.id, kind: 'staff', tenantId: r.tenantId, role: 'owner' });
  return { tenantId: r.tenantId, token };
}

/** ورودِ OTPِ کاملِ پنلِ کسب‌وکار برای یک شماره — همان دو روتی که پنل صدا می‌زند. */
async function otpLogin(localPhone: string) {
  const rq = await otpRequest(post('/api/v1/auth/staff/request', { phone: localPhone }));
  const rqd = await rq.json().catch(() => ({}));
  const code = rqd.dev_code || rqd.devCode;
  if (!code) return { status: rq.status, body: rqd };
  const rv = await otpVerify(post('/api/v1/auth/staff/verify', { phone: localPhone, code }));
  return { status: rv.status, body: await rv.json().catch(() => ({})) };
}

describe('P1-4 — ناوردای مطلوب: شماره‌ی اثبات‌نشده هویتِ کسی را تعیین نمی‌کند', () => {
  test('کنترل (باید امروز سبز باشد): مالکِ فراهم‌شده با OTP واردِ تنانتِ خودش می‌شود', async () => {
    const ownerPhone = fixturePhone('0995');
    const r = await provisionBusiness({ businessName: `[DEMO] hijack control ${SFX}`, ownerPhone } as any, admin);
    const login = await otpLogin(ownerPhone);
    assert.equal(login.status, 200, JSON.stringify(login.body));
    assert.equal(login.body.staff.tenant_id, r.tenantId);
  });

  test('🔴 R1 (BE-04/T1): مهاجم شماره‌ی قربانی را بی‌اثبات به تنانتِ خودش اضافه می‌کند → اولین ورودِ قربانی نباید در تنانتِ مهاجم بنشیند', async () => {
    const attacker = await business('attacker-r1');
    const victim = fixturePhone('0994');
    const add = await addStaff(post('/api/v1/restaurant/staff', { phone: victim, role: 'manager' }, attacker.token));
    assert.equal(add.status, 201, 'پیش‌شرطِ حمله: افزودنِ شماره‌ی بی‌اثبات امروز پذیرفته می‌شود');

    const login = await otpLogin(victim);
    assert.ok(!(login.status === 200 && login.body?.staff?.tenant_id === attacker.tenantId),
      `ورودِ OTPِ قربانی در تنانتِ مهاجم نشست (status ${login.status}، role ${login.body?.staff?.role}) — عضویتی که صاحبِ شماره نپذیرفته، نشستِ او را تعیین کرد`);
  });

  test('🔴 R2 (BE-04): عضویتِ پذیرفته‌نشده نباید جلوی ثبت‌نامِ خودِ صاحبِ شماره را بگیرد', async () => {
    const attacker = await business('attacker-r2');
    const victim = fixturePhone('0994');
    const add = await addStaff(post('/api/v1/restaurant/staff', { phone: victim }, attacker.token));
    assert.equal(add.status, 201, 'پیش‌شرط');

    const res = await trial(post('/api/v1/site/trial', { business_name: `[DEMO] قربانی ${SFX}`, contact_name: '[DEMO] قربانی', phone: victim }));
    const body = await res.json().catch(() => ({}));
    assert.equal(res.status, 201,
      `دمو برای صاحبِ واقعیِ شماره رد شد (${res.status}: ${body?.error?.message ?? ''}) — او به «از همان شماره وارد شوید» و در نتیجه به تنانتِ مهاجم فرستاده می‌شود`);
  });

  test('🔴 R3 (T3): کارمندِ واقعیِ رستورانِ خودش، اگر مهاجم زودتر شماره‌اش را ثبت کرده باشد، نباید واردِ تنانتِ مهاجم شود', async () => {
    const attacker = await business('attacker-r3');
    const real = await business('real-r3');
    const victim = fixturePhone('0994');
    assert.equal((await addStaff(post('/api/v1/restaurant/staff', { phone: victim }, attacker.token))).status, 201);
    assert.equal((await addStaff(post('/api/v1/restaurant/staff', { phone: victim }, real.token))).status, 201);

    const login = await otpLogin(victim);
    assert.ok(!(login.status === 200 && login.body?.staff?.tenant_id === attacker.tenantId),
      'ردیفِ قدیمی‌ترِ مهاجم برنده شد — کارمندِ واقعی واردِ تنانتِ مهاجم می‌شود');
  });

  test('🔴 R4 (BE-05): فرمِ عمومیِ دمو (بدونِ OTP) نباید با شماره‌ی کسِ دیگر ردیفِ owner بسازد که فراهم‌سازیِ واقعیِ او را ببندد', async () => {
    const victim = fixturePhone('0994');
    const squat = await trial(post('/api/v1/site/trial', { business_name: `[DEMO] مهاجم ${SFX}`, contact_name: '[DEMO] مهاجم', phone: victim }));
    assert.equal(squat.status, 201, 'پیش‌شرطِ حمله: دمو با شماره‌ی دیگری بی‌اثبات ساخته می‌شود');

    let provisionError: unknown = null;
    try {
      await provisionBusiness({ businessName: `[DEMO] مالکِ واقعی ${SFX}`, ownerPhone: victim } as any, admin);
    } catch (e) { provisionError = e; }
    assert.equal(provisionError, null,
      `فراهم‌سازیِ واقعی برای صاحبِ شماره رد شد (${(provisionError as { code?: string })?.code ?? (provisionError as Error)?.message}) — یک فرمِ عمومیِ بی‌اثبات شماره‌ی مالک را قفل کرد`);
  });
});
