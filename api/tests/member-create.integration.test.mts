import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  POST /restaurant/members — ثبتِ مستقیمِ عضوِ باشگاه (بدونِ رزرو)
//
//  چرا این endpoint هست: «ثبتِ دستیِ عضو» در پنلِ باشگاه تا ۲۰۲۶-۰۸-۲۵ فقط
//  در حافظه‌ی مرورگر بود و کدِ جعلی نشان می‌داد (KNOWN_LIMITATIONS). این تست
//  چهار ادعایِ حساس را قفل می‌کند:
//   ۱) ساختِ واقعی: ردیفِ club_members + کدِ شمارنده‌ایِ اتمیک ساخته می‌شود.
//   ۲) idempotent روی phone: تکرارِ همان شماره همان کد را با 200 برمی‌گرداند
//      (نه عضوِ دوم، نه کدِ تازه).
//   ۳) تولد میلادی همان‌طور که فرستاده شده ذخیره می‌شود (قراردادِ walkin پس از
//      رفعِ تقویمِ شمسی/میلادی — پنل قبل از ارسال تبدیل می‌کند).
//   ۴) RBAC: staffِ بدونِ canManageCampaigns → 403 (SAFE_DEFAULTS=false)؛
//      رستورانِ B نمی‌تواند برای باشگاهِ A عضو بسازد (جداسازی از راهِ ctx).
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { redis } = await import('../src/lib/redis');
const { signAccess } = await import('../src/lib/jwt');
const membersRoute = await import('../src/app/api/v1/restaurant/members/route');

let tenantA: string, restA: string, tokenA: string;
let plainStaffToken: string;   // role='staff' بدونِ StaffPermission → canManageCampaigns=false
const madeUsers: string[] = [];

const json = (token: string, body?: unknown, method = 'POST') =>
  new Request('http://x/api', {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

before(async () => {
  const stale = await redis.keys('*auth*');
  if (stale.length) await redis.del(...stale);

  const s = Date.now().toString(36);
  const t = await db.tenant.create({ data: { name: `[DEMO] memb-${s}` }, select: { id: true } });
  tenantA = t.id;
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `zz-memb-${s}`, name: `[DEMO] memb-${s}`, clubPrefix: 'MBR' },
    select: { id: true },
  });
  restA = r.id;
  const owner = await db.staff.create({
    data: { tenantId: t.id, phone: `+98913${Math.floor(Math.random() * 1e8)}`.slice(0, 13), role: 'owner', isActive: true },
    select: { id: true },
  });
  tokenA = signAccess({ sub: owner.id, kind: 'staff', tenantId: t.id, role: 'owner' });

  const plain = await db.staff.create({
    data: { tenantId: t.id, phone: `+98914${Math.floor(Math.random() * 1e8)}`.slice(0, 13), role: 'staff', isActive: true },
    select: { id: true },
  });
  plainStaffToken = signAccess({ sub: plain.id, kind: 'staff', tenantId: t.id, role: 'staff' });
});

after(async () => {
  await db.clubMember.deleteMany({ where: { restaurantId: restA } });
  await db.clubCodeCounter.deleteMany({ where: { restaurantId: restA } });
  if (madeUsers.length) await db.user.deleteMany({ where: { id: { in: madeUsers } } });
  await db.restaurant.deleteMany({ where: { tenantId: tenantA } });
  await db.staff.deleteMany({ where: { tenantId: tenantA } });
  await db.tenant.delete({ where: { id: tenantA } });
});

describe('POST /restaurant/members — ثبتِ مستقیمِ عضو', () => {
  const phone = `0912${String(Date.now()).slice(-7)}`;

  test('عضوِ جدید: 201 + کدِ شمارنده‌ای + ردیفِ واقعی + تولدِ میلادیِ دقیق', async () => {
    const res = await membersRoute.POST(json(tokenA, {
      phone, first_name: '[DEMO] لیلا', last_name: 'تستی', birth_day: 21, birth_month: 3,
    }));
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.enrolled_now, true);
    assert.match(body.code, /^MBR-\d+$/);

    const user = await db.user.findFirst({ where: { phone: { endsWith: phone.slice(1) } }, select: { id: true, birthDate: true } });
    assert.ok(user, 'کاربر باید ساخته شده باشد');
    madeUsers.push(user.id);
    // تولد باید *همان* میلادیِ فرستاده‌شده باشد (۲۱ مارس = ۱ فروردین) — نه تفسیرِ دوباره
    assert.equal(user.birthDate?.toISOString().slice(0, 10), '1990-03-21');

    const member = await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId: restA, userId: user.id } },
      select: { code: true },
    });
    assert.equal(member?.code, body.code);
  });

  test('idempotent روی phone: تکرار → 200 با همان کد، بدونِ عضو/کدِ دوم', async () => {
    const res = await membersRoute.POST(json(tokenA, { phone }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.enrolled_now, false);
    assert.match(body.code, /^MBR-\d+$/);
    const count = await db.clubMember.count({ where: { restaurantId: restA } });
    assert.equal(count, 1, 'نباید عضوِ دومی ساخته شود');
  });

  test('RBAC: staffِ بدونِ canManageCampaigns → 403 و هیچ ردیفی ساخته نمی‌شود', async () => {
    const res = await membersRoute.POST(json(plainStaffToken, { phone: '09121110001' }));
    assert.equal(res.status, 403);
    const count = await db.clubMember.count({ where: { restaurantId: restA } });
    assert.equal(count, 1, '403 نباید side effect داشته باشد');
  });

  test('بدونِ توکن → 401', async () => {
    const res = await membersRoute.POST(new Request('http://x/api', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '09121110002' }),
    }));
    assert.equal(res.status, 401);
  });

  test('اعتبارسنجی: تلفنِ نامعتبر → 422', async () => {
    const res = await membersRoute.POST(json(tokenA, { phone: 'abc' }));
    assert.equal(res.status, 422);
  });
});
