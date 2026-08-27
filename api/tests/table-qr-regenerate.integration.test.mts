import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.invalid';

// ═══════════════════════════════════════════════════════════════════════
//  بازتولیدِ کدِ QRِ میز — `POST /restaurant/tables/:id/qr`
//
//  ⚠️ چرا این روت لازم بود: `assignQrCode` از روزِ اول پارامترِ `regenerate`
//  داشت و کامنتِ خودش هم دلیلش را نوشته بود («وقتی استیکرِ قدیمی گم/کپی
//  شده»)، ولی **هیچ‌کس با `regenerate: true` صدایش نمی‌زد** — قابلیت پیاده
//  بود و از بیرون به آن نمی‌شد رسید. همان الگویِ «کدِ خفته» که در خودِ
//  check-inِ QR (PR #61) و فیچرِ بیعانه (§۲u) هم دیده شد.
//
//  ادعایِ این قابلیت «کدِ تازه می‌سازد» نیست، «استیکرِ قبلی را **باطل**
//  می‌کند» است. پس تستِ محوریِ این فایل عوض‌شدنِ رشته نیست — این است که کدِ
//  قدیمی واقعاً دیگر مهمان را نمی‌نشاند. بدونِ آن، فقط یک ستونِ DB را
//  تست کرده بودیم، نه رفتارِ واقعیِ سرِ میز.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const tablesRoute = await import('../src/app/api/v1/restaurant/tables/route');
const tableQrRoute = await import('../src/app/api/v1/restaurant/tables/[id]/qr/route');
const checkinRoute = await import('../src/app/api/v1/checkin/route');

const TAG = 'tqrgen';
let A: Ctx, B: Ctx;
let seq = 0;

type Ctx = { tenantId: string; restaurantId: string; token: string; staffId: string };

const routeArg = (id: string) => ({ params: Promise.resolve({ id }) });

const jsonReq = (token: string, body?: unknown, method = 'POST') =>
  new Request('http://x/api', {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-real-ip': testIp(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const getReq = (token: string, qs = '') =>
  new Request(`http://x/api${qs}`, {
    headers: { authorization: `Bearer ${token}`, 'x-real-ip': testIp() },
  });

/*
 * ⚠️ اینجا قبلاً `clearRateLimit()` بود که `rl:auth:*`, `rl:srch:*` و
 * `rl:chkin:*` را **سراسری** پاک می‌کرد، چون IPِ هر `new Request()`ِ بی‌هدر
 * `unknown` است و سهمیه بینِ فایل‌های رانر مشترک می‌شد. آن پاک‌سازی سطلِ
 * فایل‌های دیگر را هم خالی می‌کرد. حالا هر Request با `testIp()` سطلِ جدا دارد.
 */

async function makeTenant(label: string): Promise<Ctx> {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `zz-${label}`, name: `[DEMO] ${label}`, clubPrefix: 'TQG' },
    select: { id: true },
  });
  const staff = await db.staff.create({
    data: {
      tenantId: t.id, role: 'owner', isActive: true,
      phone: `+9897${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13),
    },
    select: { id: true },
  });
  return {
    tenantId: t.id,
    restaurantId: r.id,
    staffId: staff.id,
    token: signAccess({ sub: staff.id, kind: 'staff', tenantId: t.id, role: 'owner' }),
  };
}

async function createTable(ctx: Ctx, capacity = 4) {
  const res = await tablesRoute.POST(jsonReq(ctx.token, { number: ++seq + 700, capacity }), { params: Promise.resolve({}) } as never);
  return await res.json() as { id: string; number: number; qr_code: string | null };
}

/** رزروی که همین حالا فعال است — تا اسکنِ QR بتواند بنشاندش. */
async function makeLiveReservation(ctx: Ctx, tableId: string) {
  const now = new Date();
  return db.reservation.create({
    data: {
      code: `TQG${++seq}${Date.now().toString(36).slice(-5)}`.toUpperCase(),
      restaurantId: ctx.restaurantId, tableId, partySize: 2,
      slotStart: new Date(+now - 10 * 60_000), slotEnd: new Date(+now + 80 * 60_000),
      status: 'confirmed' as never, blockBufferMinutes: 15,
    },
    select: { id: true, code: true },
  });
}

// اسکن دقیقاً همان‌طور که مهمان انجام می‌دهد: بدونِ هیچ توکنی. خودِ کدِ QR
// اعتبارنامه است (۵۰ بیت آنتروپی) — قراردادِ کاملش در
// `qr-checkin.integration.test.mts`. ادعاهای این فایل — ابطالِ واقعیِ کدِ
// قدیمی و کارکردنِ کدِ نو — از این تغییر مستقل‌اند.
const scan = (qrCode: string) =>
  checkinRoute.POST(new Request('http://x/api/v1/checkin', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': testIp() },
    body: JSON.stringify({ qr_code: qrCode }),
  }));

const regenerate = async (ctx: Ctx, tableId: string) => {
  return tableQrRoute.POST(jsonReq(ctx.token, {}), routeArg(tableId) as never);
};

before(async () => {
  const s = Date.now().toString(36);
  A = await makeTenant(`${TAG}-a-${s}`);
  B = await makeTenant(`${TAG}-b-${s}`);
});

after(async () => {
  const rests = [A.restaurantId, B.restaurantId];
  await db.auditLog.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.reservation.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.table.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.restaurant.deleteMany({ where: { id: { in: rests } } });
  await db.staffPermission.deleteMany({ where: { staff: { tenantId: { in: [A.tenantId, B.tenantId] } } } });
  await db.staff.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } });
  await db.tenant.deleteMany({ where: { id: { in: [A.tenantId, B.tenantId] } } });
});

// ─────────────────────────────────────────────────────────────────────
describe('بازتولیدِ کد', () => {
  test('کدِ تازه می‌سازد و با کدِ قبلی فرق دارد', async () => {
    const table = await createTable(A);
    assert.ok(table.qr_code, 'میزِ تازه باید از قبل کد داشته باشد');

    const res = await regenerate(A, table.id);
    assert.equal(res.status, 200);
    const body = await res.json() as { code: string; table_number: number };

    assert.notEqual(body.code, table.qr_code, 'کد باید عوض شده باشد');
    assert.match(body.code, /^T-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/, 'شکلِ کد باید همان الفبایِ خوانا بماند');
    assert.equal(body.table_number, table.number);

    const row = await db.table.findUnique({ where: { id: table.id }, select: { qrCode: true } });
    assert.equal(row?.qrCode, body.code, 'کدِ جدید باید واقعاً در DB نشسته باشد');
  });

  test('🔴 کدِ قدیمی دیگر مهمان را نمی‌نشاند (ابطالِ واقعی، نه فقط تغییرِ رشته)', async () => {
    // 🔴 ادعایِ اصلیِ این قابلیت همین است. اگر این تست نبود، «بازتولید» فقط
    //    یعنی یک ستونِ DB عوض شد — نه اینکه استیکرِ قدیمی واقعاً مرده باشد.
    const table = await createTable(A);
    const oldCode = table.qr_code!;
    await makeLiveReservation(A, table.id);

    // پیش از بازتولید، کدِ قدیمی کار می‌کند (کنترلِ مثبت — وگرنه تستِ بعدی بی‌معناست)
    const before = await scan(oldCode);
    assert.equal(before.status, 200, 'کدِ اولیه باید قبل از بازتولید کار کند');

    await regenerate(A, table.id);

    const after = await scan(oldCode);
    assert.equal(after.status, 404, 'استیکرِ قدیمی باید از کار افتاده باشد');
  });

  test('کدِ جدید کار می‌کند (قابلیت را نشکسته‌ایم، فقط کد را عوض کرده‌ایم)', async () => {
    const table = await createTable(A);
    const resv = await makeLiveReservation(A, table.id);

    const res = await regenerate(A, table.id);
    const { code } = await res.json() as { code: string };

    const out = await scan(code);
    assert.equal(out.status, 200);
    const body = await out.json() as { reservation_code: string | null; status: string; checked_in: boolean };
    // موفقیت از `checked_in` + وضعیتِ واقعیِ DB خوانده می‌شود، نه از
    // `reservation_code` (که فقط به صاحبِ رزرو داده می‌شود).
    assert.equal(body.checked_in, true);
    assert.equal(body.status, 'seated');
    const row = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    assert.equal(row?.status, 'seated', 'رزرو واقعاً باید seated شده باشد');
  });

  test('بازتولیدِ دوباره کدِ دیگری می‌دهد (هر بار تازه، نه یک‌بار)', async () => {
    const table = await createTable(A);
    const first = await (await regenerate(A, table.id)).json() as { code: string };
    const second = await (await regenerate(A, table.id)).json() as { code: string };
    assert.notEqual(first.code, second.code);
    assert.notEqual(first.code, table.qr_code);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('گاردها', () => {
  test('⚠️ جداسازیِ تنانت: رستورانِ B نمی‌تواند استیکرِ میزِ A را باطل کند', async () => {
    // ⚠️ بدونِ این، هر رستورانی با حدسِ UUID می‌توانست استیکرهایِ رقیبش را
    //    از کار بیندازد — خرابکاریِ ساده و کاملاً نامرئی.
    const table = await createTable(A);
    const before = table.qr_code;

    const res = await regenerate(B, table.id);
    assert.equal(res.status, 404, 'باید «پیدا نشد» بدهد، نه اینکه کد را عوض کند');

    const row = await db.table.findUnique({ where: { id: table.id }, select: { qrCode: true } });
    assert.equal(row?.qrCode, before, 'کد نباید دست‌خورده باشد');
  });

  test('میزِ ناموجود → ۴۰۴', async () => {
    const res = await regenerate(A, '11111111-1111-4111-8111-111111111111');
    assert.equal(res.status, 404);
  });

  test('بدونِ ورود → ۴۰۱', async () => {
    const table = await createTable(A);
    const res = await tableQrRoute.POST(
      new Request('http://x/api', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': testIp() },
        body: '{}',
      }),
      routeArg(table.id) as never,
    );
    assert.equal(res.status, 401);
  });

  test('⚠️ کارمندِ بدونِ دسترسیِ canManageTables نمی‌تواند باطل کند', async () => {
    // ⚠️ ابطالِ استیکر یک عملِ مدیریتیِ میز است، نه کارِ روزمره‌ی سالن.
    const table = await createTable(A);
    const before = table.qr_code;

    const weak = await db.staff.create({
      data: {
        tenantId: A.tenantId, role: 'staff', isActive: true,
        phone: `+9897${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13),
      },
      select: { id: true },
    });
    await db.staffPermission.create({ data: { staffId: weak.id, canManageTables: false } });
    const weakToken = signAccess({ sub: weak.id, kind: 'staff', tenantId: A.tenantId, role: 'staff' });

    const res = await tableQrRoute.POST(jsonReq(weakToken, {}), routeArg(table.id) as never);
    assert.equal(res.status, 403);

    const row = await db.table.findUnique({ where: { id: table.id }, select: { qrCode: true } });
    assert.equal(row?.qrCode, before, 'کد نباید عوض شده باشد');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('ردِ ممیزی و بی‌اثریِ GET', () => {
  test('⚠️ بازتولید در audit ثبت می‌شود، همراهِ کدِ قبلی', async () => {
    // ⚠️ عملِ برگشت‌ناپذیر باید ردِ انسانی داشته باشد: وقتی مهمان می‌گوید
    //    «QR کار نمی‌کند»، باید بشود فهمید چه کسی و کِی و کدام کد را باطل کرد.
    const table = await createTable(A);
    const oldCode = table.qr_code!;
    await regenerate(A, table.id);

    const row = await db.auditLog.findFirst({
      where: { action: 'table.qr_regenerated', targetId: table.id },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(row, 'باید یک ردیفِ audit ثبت شده باشد');
    assert.equal(row!.actorId, A.staffId, 'باید بداند چه کسی زد');
    assert.equal(row!.restaurantId, A.restaurantId);
    const detail = row!.detail as { previous_code?: string; table_number?: number };
    assert.equal(detail.previous_code, oldCode, 'کدِ باطل‌شده باید ثبت شود');
    assert.equal(detail.table_number, table.number);
  });

  test('⚠️ GET کد را عوض نمی‌کند (خواندن نباید حالت را تغییر دهد)', async () => {
    // ⚠️ دلیلِ اینکه بازتولید یک POSTِ جداست و نه `?regenerate=1` رویِ GET:
    //    prefetchِ مرورگر یا هر خزنده‌ای می‌توانست استیکرهایِ یک رستوران را
    //    دسته‌جمعی باطل کند.
    const table = await createTable(A);
    const first = await tableQrRoute.GET(getReq(A.token), routeArg(table.id) as never);
    assert.equal(first.status, 200);
    const second = await tableQrRoute.GET(getReq(A.token), routeArg(table.id) as never);

    const c1 = decodeURIComponent(first.headers.get('X-Table-Code') ?? '');
    const c2 = decodeURIComponent(second.headers.get('X-Table-Code') ?? '');
    assert.equal(c1, table.qr_code);
    assert.equal(c1, c2, 'دو GETِ پیاپی باید همان کد را بدهند');
  });
});
