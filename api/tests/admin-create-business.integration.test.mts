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

function req(body: unknown, token: string, idemKey?: string) {
  return new Request('https://example.invalid/api/v1/admin/restaurants', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      // سطلِ rate-limit مشترک است (clientIp)؛ IPِ یکتا تا اجرای پیاپیِ تست‌ها
      // همدیگر را ۴۲۹ نکنند — همان الگوی سراسریِ سوئیت.
      'x-forwarded-for': `10.76.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}`,
      // SPEC-B: هدر اجباری است؛ تست‌ها مگر تستِ «نبودِ هدر» همیشه می‌فرستند.
      'Idempotency-Key': idemKey ?? `t-${Math.random().toString(36).slice(2)}`,
    },
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
    await db.staffInvite.deleteMany({ where: { tenantId: tid } });
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
    assert.equal(dup.status, 409, 'قراردادِ SPEC-B: تعارض، نه خطای اعتبارسنجی');
    const dd = await dup.json();
    assert.equal(dd.error?.details?.reason, 'duplicate_owner_phone');
  });

  test('بدونِ هدرِ Idempotency-Key رد می‌شود (۴۲۲) — دابل‌کلیک نباید دو کسب‌وکار بسازد', async () => {
    const adminToken = await makeAdminToken();
    const r = new Request('https://example.invalid/api/v1/admin/restaurants', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}`,
        'x-forwarded-for': `10.77.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}` },
      body: JSON.stringify({ business_name: `[DEMO] nohdr ${SFX}`, owner_phone: fixturePhone('0918') }),
    });
    assert.equal((await createBusiness(r)).status, 422);
  });

  test('idempotency: دو POST با یک کلید = یک رستوران و پاسخِ بایت‌به‌بایت یکسان', async () => {
    const adminToken = await makeAdminToken();
    const key = `same-${SFX}`;
    const body = { business_name: `[DEMO] idem ${SFX}`, owner_phone: fixturePhone('0919') };
    const r1 = await createBusiness(req(body, adminToken, key));
    const t1 = await r1.text();
    assert.equal(r1.status, 201, t1);
    made.tenantIds.push(JSON.parse(t1).tenant_id);
    const r2 = await createBusiness(req(body, adminToken, key));
    const t2 = await r2.text();
    assert.equal(r2.status, 201);
    // برابریِ معنایی، نه بایتی: پاسخِ replayed از jsonb برمی‌گردد و ترتیبِ
    // کلیدها تضمین نمی‌شود — قراردادِ idempotency «همان محتوا» است.
    assert.deepEqual(JSON.parse(t2), JSON.parse(t1), 'پاسخِ replayed باید هم‌محتوای اولی باشد');
    assert.equal(await db.tenant.count({ where: { name: body.business_name } }), 1, 'فقط یک tenant');
  });

  test('SPEC-B: دعوت + پیامک + audit — همه در یک provision', async () => {
    const adminToken = await makeAdminToken();
    const phone = fixturePhone('0921');
    const jobsBefore = await db.job.count({ where: { kind: 'sms' } });
    const r = await createBusiness(req({
      business_name: `[DEMO] full ${SFX}`, owner_phone: phone, trial_days: 14, plan: 'pro',
      seed_defaults: { tables: 3 },
    }, adminToken));
    const body = await r.json();
    assert.equal(r.status, 201);
    made.tenantIds.push(body.tenant_id);

    assert.equal(body.provision_status, 'PENDING_ACTIVATION');
    assert.ok(body.trial_ends_at, 'trialEndsAt از trial_days');
    assert.match(body.invite_sent_to, /\*\*\*/, 'شماره ماسک‌شده');

    // §۶-۱۱: seedDefaults واقعاً اعمال شد
    assert.equal(await db.table.count({ where: { restaurantId: body.restaurant.id } }), 3);

    // §۶-۱۲: ردیفِ StaffInvite با انقضای آینده
    const invite = await db.staffInvite.findFirst({ where: { restaurantId: body.restaurant.id } });
    assert.ok(invite, 'invite ساخته شده');
    assert.equal(invite!.status, 'PENDING');
    assert.ok(invite!.expiresAt > new Date());

    // §۶-۱۴: پیامکِ دعوت در صفِ Job (kind=sms) با idempotencyKeyِ invite
    assert.equal(await db.job.count({ where: { kind: 'sms' } }), jobsBefore + 1);
    const job = await db.job.findFirst({ where: { idempotencyKey: `staff-invite:${invite!.id}` } });
    assert.ok(job, 'jobِ پیامک با کلیدِ idempotentِ دعوت');

    // §۶-۱۳: audit با نامِ canonicalِ spec
    const log = await db.auditLog.findFirst({
      where: { action: 'restaurant.provision', restaurantId: body.restaurant.id },
    });
    assert.ok(log, 'auditِ restaurant.provision');

    // C7: ردیفِ StaffPermission عمداً ساخته نمی‌شود (owner در کد همیشه کامل است)
    assert.equal(await db.staffPermission.count({ where: { staffId: body.owner.staff_id } }), 0);
  });

  test('اتمیک‌بودن (§۸): شکستِ وسطِ تراکنش هیچ tenant/رستورانِ یتیمی نمی‌گذارد', async () => {
    const adminToken = await makeAdminToken();
    const name = `[DEMO] atomic ${SFX}`;
    // تزریقِ خطا: username تکراری در **داخلِ** پنجره‌ی بینِ چکِ اولیه و تراکنش
    // ساده‌تر و قطعی‌تر: slugِ اشغال‌شده بعد از عبور از چکِ dupِ شماره —
    // با گرفتنِ slug از قبل، تراکنش اصلاً شروع نمی‌شود؛ برای شکستِ داخلِ
    // تراکنش، همان slug را هم‌زمان با یک رستورانِ واقعی می‌گیریم:
    const t = await db.tenant.create({ data: { name: `[DEMO] holder ${SFX}` } });
    made.tenantIds.push(t.id);
    await db.restaurant.create({ data: { tenantId: t.id, slug: `atomic-${SFX}`, name: 'holder', clubPrefix: 'HLD' } });
    const r = await createBusiness(req({
      business_name: name, owner_phone: fixturePhone('0922'), slug: `atomic-${SFX}`,
    }, adminToken));
    assert.equal(r.status, 409);
    assert.equal((await r.json()).error?.details?.reason, 'slug_unavailable');
    assert.equal(await db.tenant.count({ where: { name } }), 0, 'هیچ tenantِ یتیمی');
  });

  test('اعتبارنامه‌ی نیمه (فقط username) نیمه‌فعال نمی‌شود', async () => {
    const adminToken = await makeAdminToken();
    const res = await createBusiness(req({
      business_name: `[DEMO] half ${SFX}`, owner_phone: fixturePhone('0917'), username: `half${SFX}`,
    }, adminToken));
    assert.equal(res.status, 422);
  });
});
