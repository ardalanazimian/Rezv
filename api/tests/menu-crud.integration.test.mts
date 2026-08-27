import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  CRUDِ منو — تستِ integration زنده رویِ Postgresِ واقعی
//
//  روت‌هایِ واقعی مستقیم import و با Requestِ واقعی صدا زده می‌شوند (نه فقط
//  منطقِ داخلی) تا سیمِ auth/RBAC/اعتبارسنجی/مالکیت هم واقعاً تست شود.
//
//  دو ادعایِ حساس که این تست قفلشان می‌کند:
//   ۱) جداسازیِ رستوران: با حدسِ UUID نمی‌شود منویِ رستورانِ دیگری را
//      خواند/ویرایش/حذف کرد (IDOR).
//   ۲) یکپارچگیِ تاریخچه: آیتمی که در پیش‌سفارشِ ثبت‌شده به‌کار رفته حذفِ
//      سخت نمی‌شود (onDelete: Restrict) — بایگانی می‌شود و پاسخ صریح می‌گوید.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const menuRoute = await import('../src/app/api/v1/restaurant/menu/route');
const menuItemRoute = await import('../src/app/api/v1/restaurant/menu/[id]/route');

let tenantA: string, tenantB: string;
let restA: string, restB: string;
let tokenA: string, tokenB: string;
let seededItemId: string;   // آیتمِ رستورانِ A که در پیش‌سفارش به‌کار رفته
let userId: string;

/**
 * دومین آرگومانِ روت در این نسخه‌ی Next.js `{ params: Promise<...> }` است —
 * نه خودِ آبجکتِ params. withRestaurantAuth صریحاً awaitش می‌کند (رجوع کن به
 * توضیحِ داخلِ with-restaurant-auth.ts). تستِ اولِ من همین را اشتباه فرستاد و
 * ۴۲۲ گرفت؛ یعنی این هلپر قراردادِ واقعیِ روت را قفل می‌کند، نه سلیقه را.
 */
const routeArg = (id: string) => ({ params: Promise.resolve({ id }) });

const json = (token: string, body?: unknown, method = 'POST') =>
  new Request('http://x/api', {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-real-ip': testIp(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

async function makeTenantWithOwner(label: string) {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: {
      tenantId: t.id, slug: `zz-${label}`, name: `[DEMO] ${label}`, clubPrefix: 'MNU',
      tables: { create: [{ number: 1, capacity: 4 }] },
    },
    select: { id: true, tables: { select: { id: true } } },
  });
  const staff = await db.staff.create({
    data: { tenantId: t.id, phone: `+9891${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13), role: 'owner', isActive: true },
    select: { id: true },
  });
  const token = signAccess({ sub: staff.id, kind: 'staff', tenantId: t.id, role: 'owner' });
  return { tenantId: t.id, restaurantId: r.id, tableId: r.tables[0].id, token };
}

before(async () => {
  // ⚠️ اینجا قبلاً کلِ سطل‌های `*auth*` سراسری پاک می‌شد، چون `new Request()`ِ
  // بدونِ هدر همیشه IPِ `unknown` می‌داد و سهمیه بینِ همه‌ی فایل‌های رانر مشترک
  // بود. آن پاک‌سازی سطلِ فایل‌های دیگر را هم خالی می‌کرد و ریت‌لیمیت را از تستِ
  // آن‌ها پنهان می‌کرد. حالا `json()` با `testIp()` IPِ یکتا می‌گیرد؛ سقفِ خودِ
  // روت (`rateLimit:'auth'`) دست‌نخورده و واقعی می‌ماند.
  const s = Date.now().toString(36);
  const a = await makeTenantWithOwner(`menu-a-${s}`);
  const b = await makeTenantWithOwner(`menu-b-${s}`);
  tenantA = a.tenantId; restA = a.restaurantId; tokenA = a.token;
  tenantB = b.tenantId; restB = b.restaurantId; tokenB = b.token;

  // آیتمی که در یک پیش‌سفارشِ واقعی به‌کار رفته (برایِ تستِ حذف)
  const item = await db.menuItem.create({
    data: { restaurantId: restA, name: '[DEMO] آیتمِ دارای سابقه', priceToman: 150_000 },
    select: { id: true },
  });
  seededItemId = item.id;
  const u = await db.user.create({ data: { phone: `+98912${s.slice(-7)}` .slice(0,13) }, select: { id: true } });
  userId = u.id;
  const resv = await db.reservation.create({
    data: {
      code: 'RZ' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      restaurantId: restA, tableId: a.tableId, userId: u.id, partySize: 2,
      slotStart: new Date(Date.now() - 86_400_000), slotEnd: new Date(Date.now() - 79_200_000),
      status: 'completed', source: 'app',
    },
    select: { id: true },
  });
  await db.reservationItem.create({ data: { reservationId: resv.id, menuItemId: seededItemId, qty: 1 } });
});

after(async () => {
  const rests = [restA, restB];
  await db.reservationItem.deleteMany({ where: { menuItem: { restaurantId: { in: rests } } } });
  await db.reservation.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.menuItem.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.table.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.restaurant.deleteMany({ where: { id: { in: rests } } });
  await db.staff.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
});

describe('CRUDِ منو', () => {
  let createdId: string;

  test('POST — ساختِ آیتم', async () => {
    const res = await menuRoute.POST(json(tokenA, { name: '[DEMO] پاستا', price_toman: 185_000, category: 'غذای اصلی', emoji: '🍝' }));
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.name, '[DEMO] پاستا');
    assert.equal(body.price_toman, 185_000);
    assert.equal(body.category, 'غذای اصلی');
    createdId = body.id;
  });

  test('POST — نامِ تکراری رد می‌شود', async () => {
    const res = await menuRoute.POST(json(tokenA, { name: '[DEMO] پاستا', price_toman: 1000 }));
    assert.notEqual(res.status, 201, 'آیتمِ هم‌نام نباید ساخته شود');
  });

  test('GET — آیتم‌ها برمی‌گردند (شاملِ غیرفعال‌ها)', async () => {
    await menuRoute.POST(json(tokenA, { name: '[DEMO] غیرفعال', price_toman: 50_000, is_active: false }));
    const res = await menuRoute.GET(json(tokenA, undefined, 'GET'));
    assert.equal(res.status, 200);
    const body = await res.json();
    const names = body.items.map((i: { name: string }) => i.name);
    assert.ok(names.includes('[DEMO] پاستا'));
    assert.ok(names.includes('[DEMO] غیرفعال'), 'پنل باید آیتمِ غیرفعال را هم ببیند');
  });

  test('GET — منویِ خالی آرایه‌ی خالیِ ۲۰۰ می‌دهد، نه خطا', async () => {
    const res = await menuRoute.GET(json(tokenB, undefined, 'GET'));
    assert.equal(res.status, 200, 'خالی‌بودن یک واقعیت است، نه شکست');
    const body = await res.json();
    assert.deepEqual(body.items, []);
  });

  test('PATCH — ویرایشِ قیمت و دسته', async () => {
    const res = await menuItemRoute.PATCH(json(tokenA, { price_toman: 210_000, category: 'ویژه' }, 'PATCH'), routeArg(createdId));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.price_toman, 210_000);
    assert.equal(body.category, 'ویژه');
  });

  test('جداسازیِ رستوران: تنانتِ B نمی‌تواند آیتمِ A را ویرایش کند', async () => {
    const res = await menuItemRoute.PATCH(json(tokenB, { price_toman: 1 }, 'PATCH'), routeArg(createdId));
    assert.equal(res.status, 404, 'باید «یافت نشد» بدهد — نه ۲۰۰ و نه افشایِ وجودِ id');
    const still = await db.menuItem.findUnique({ where: { id: createdId }, select: { priceToman: true } });
    assert.equal(still!.priceToman, 210_000, 'قیمت نباید عوض شده باشد');
  });

  test('جداسازیِ رستوران: تنانتِ B نمی‌تواند آیتمِ A را حذف کند', async () => {
    const res = await menuItemRoute.DELETE(json(tokenB, undefined, 'DELETE'), routeArg(createdId));
    assert.equal(res.status, 404);
    assert.ok(await db.menuItem.findUnique({ where: { id: createdId } }), 'آیتم باید سرِ جایش بماند');
  });

  test('DELETE — آیتمِ بدونِ سابقه واقعاً حذف می‌شود', async () => {
    const res = await menuItemRoute.DELETE(json(tokenA, undefined, 'DELETE'), routeArg(createdId));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.archived, false);
    assert.equal(await db.menuItem.findUnique({ where: { id: createdId } }), null);
  });

  test('DELETE — آیتمِ دارایِ پیش‌سفارش حذف نمی‌شود، بایگانی می‌شود', async () => {
    const res = await menuItemRoute.DELETE(json(tokenA, undefined, 'DELETE'), routeArg(seededItemId));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.archived, true, 'باید بایگانی شود، نه حذف');
    assert.equal(body.used_in_orders, 1);

    const row = await db.menuItem.findUnique({ where: { id: seededItemId }, select: { isActive: true } });
    assert.ok(row, 'ردیف باید بماند تا سابقه‌ی مبلغِ رزروِ گذشته نشکند');
    assert.equal(row.isActive, false, 'ولی از منو برداشته شود');
  });
});
