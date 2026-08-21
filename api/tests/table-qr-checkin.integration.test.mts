import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.invalid';

// ═══════════════════════════════════════════════════════════════════════
//  check-inِ QRِ میز — مسیرِ کامل، روی Postgresِ زنده و روت‌هایِ واقعی
//
//  ⚠️ باگی که این فایل از آن زاده شد (ممیزیِ ۲۰۲۶-۰۸-۲۱): این قابلیت
//  **شیپ شده بود ولی برای هیچ رستورانِ واقعی کار نمی‌کرد**.
//
//   • `assignQrCode()` در `lib/tables.ts` وجود داشت ولی صفر فراخوان داشت.
//   • نه `POST /restaurant/tables` و نه `PATCH …/:id` کدِ QR را ست می‌کرد.
//   • تنها جایی که در کلِ پروژه `qr_code` نوشته می‌شد `prisma/seed.ts` بود
//     — داده‌ی `[DEMO]` با الگویِ `T-DEMO…`.
//   • هیچ‌کدام از سه اپ هم پارامترِ ورودِ QR را نمی‌خواندند.
//
//  نتیجه: `POST /api/v1/checkin` که عمومی و بدونِ احراز هویت سرو می‌شود،
//  برایِ هر میزی جز میزهایِ دمو «میز پیدا نشد» می‌داد.
//
//  این فایل کلِ زنجیره را قفل می‌کند: ساختِ میز → کدِ QR → SVG → اسکن →
//  نشستنِ مهمان و اشغالِ میز.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { redis } = await import('../src/lib/redis');
const { signAccess } = await import('../src/lib/jwt');
const { tableCheckInUrl, appBase } = await import('../src/lib/public-urls');
const tablesRoute = await import('../src/app/api/v1/restaurant/tables/route');
const tableQrRoute = await import('../src/app/api/v1/restaurant/tables/[id]/qr/route');
const checkinRoute = await import('../src/app/api/v1/checkin/route');

const TAG = 'tqr';
let A: Ctx, B: Ctx;
let seq = 0;

type Ctx = { tenantId: string; restaurantId: string; token: string };

const routeArg = (id: string) => ({ params: Promise.resolve({ id }) });

const jsonReq = (token: string, body?: unknown, method = 'POST') =>
  new Request('http://x/api', {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const getReq = (token: string, qs = '') =>
  new Request(`http://x/api${qs}`, { headers: { authorization: `Bearer ${token}` } });

/**
 * شمارنده‌ی rate-limit را صفر می‌کند. رانر همه‌ی فایل‌ها را در یک process
 * اجرا می‌کند و کلیدِ محدودیت بر پایه‌ی IP است، پس سهمیه بینِ فایل‌ها
 * مشترک است — بدونِ این، این فایل سهمیه را می‌سوزاند و فایلِ بعدی ۴۲۹
 * می‌گیرد. سقفِ خودِ روت دست‌نخورده و واقعی می‌ماند.
 */
async function clearRateLimit() {
  const stale = await redis.keys('*auth*');
  if (stale.length) await redis.del(...stale);
  const search = await redis.keys('*search*');
  if (search.length) await redis.del(...search);
}

async function makeTenant(label: string): Promise<Ctx> {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `zz-${label}`, name: `[DEMO] ${label}`, clubPrefix: 'TQR' },
    select: { id: true },
  });
  const staff = await db.staff.create({
    data: {
      tenantId: t.id, role: 'owner', isActive: true,
      phone: `+9893${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13),
    },
    select: { id: true },
  });
  return {
    tenantId: t.id,
    restaurantId: r.id,
    token: signAccess({ sub: staff.id, kind: 'staff', tenantId: t.id, role: 'owner' }),
  };
}

/** میز را از راهِ روتِ واقعی می‌سازد (نه insertِ مستقیم) و پاسخ را برمی‌گرداند. */
async function createTableViaRoute(ctx: Ctx, capacity = 4) {
  await clearRateLimit();
  const res = await tablesRoute.POST(jsonReq(ctx.token, { number: ++seq + 500, capacity }), { params: Promise.resolve({}) } as never);
  return { status: res.status, body: await res.json() as { id: string; number: number; qr_code: string | null } };
}

/** رزروی که همین حالا فعال است — تا اسکنِ QR بتواند بنشاندش. */
async function makeLiveReservation(ctx: Ctx, tableId: string, status = 'confirmed') {
  const now = new Date();
  return db.reservation.create({
    data: {
      code: `TQR${++seq}${Date.now().toString(36).slice(-5)}`.toUpperCase(),
      restaurantId: ctx.restaurantId, tableId, partySize: 2,
      slotStart: new Date(+now - 10 * 60_000), slotEnd: new Date(+now + 80 * 60_000),
      status: status as never, blockBufferMinutes: 15,
    },
    select: { id: true, code: true },
  });
}

before(async () => {
  await clearRateLimit();
  const s = Date.now().toString(36);
  A = await makeTenant(`${TAG}-a-${s}`);
  B = await makeTenant(`${TAG}-b-${s}`);
});

after(async () => {
  await clearRateLimit();
  const rests = [A.restaurantId, B.restaurantId];
  await db.reservation.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.table.deleteMany({ where: { restaurantId: { in: rests } } });
  await db.restaurant.deleteMany({ where: { id: { in: rests } } });
  await db.staff.deleteMany({ where: { tenantId: { in: [A.tenantId, B.tenantId] } } });
  await db.tenant.deleteMany({ where: { id: { in: [A.tenantId, B.tenantId] } } });
});

// ─────────────────────────────────────────────────────────────────────
describe('تخصیصِ کدِ QR هنگام ساختِ میز', () => {
  test('⚠️ میزِ تازه‌ساخته کدِ QR دارد (قابلیت دیگر مرده نیست)', async () => {
    // ⚠️ قفلِ اصلی. پیش از رفع، `qr_code` همیشه null بود و کلِ زنجیره
    //    همین‌جا می‌مرد.
    const { status, body } = await createTableViaRoute(A);
    assert.equal(status, 201);
    assert.ok(body.qr_code, 'میزِ جدید باید کدِ QR بگیرد');
    assert.match(body.qr_code!, /^T-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/,
      'کد باید الفبایِ خوانا داشته باشد (بدونِ I/O/0/1 که در چاپ اشتباه می‌شوند)');
  });

  test('کدِ هر میز یکتاست', async () => {
    const a = await createTableViaRoute(A);
    const b = await createTableViaRoute(A);
    assert.notEqual(a.body.qr_code, b.body.qr_code);
  });

  test('کدِ میزِ موجود با ساختِ دوباره عوض نمی‌شود (استیکرِ چاپ‌شده باطل نشود)', async () => {
    const { body } = await createTableViaRoute(A);
    const { assignQrCode } = await import('../src/lib/tables');
    const again = await assignQrCode(body.id, A.restaurantId);
    assert.equal(again, body.qr_code, 'بدونِ regenerate باید همان کدِ قبلی برگردد');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('endpointِ SVGِ QRِ میز', () => {
  test('SVGِ واقعی برمی‌گرداند و آدرسِ داخلش به اپِ مشتری می‌رود', async () => {
    const { body } = await createTableViaRoute(A);
    const res = await tableQrRoute.GET(getReq(A.token, '?size=256'), routeArg(body.id));

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /image\/svg\+xml/);

    const svg = await res.text();
    assert.match(svg, /^<\?xml|^<svg/, 'باید SVGِ واقعی باشد');
    assert.ok(svg.length > 200, 'SVGِ QR نباید تقریباً خالی باشد');

    // آدرسِ داخلِ QR باید به اپِ مشتری برود، نه سایتِ مارکتینگ.
    const url = decodeURI(res.headers.get('X-Checkin-Url') ?? '');
    assert.equal(url, tableCheckInUrl(body.qr_code!));
    assert.ok(url.startsWith(appBase()), 'باید رویِ دامنه‌ی اپِ مشتری باشد');
    assert.match(url, /\?checkin=/, 'کد باید در query باشد — اپ routingِ سرور ندارد');
  });

  test('⚠️ جداسازیِ تنانت: رستورانِ B نمی‌تواند QRِ میزِ A را بگیرد', async () => {
    // ⚠️ بدونِ این، هر رستوران می‌توانست استیکرِ معتبرِ رستورانِ دیگری را
    //    چاپ کند — یعنی ثبتِ ورود روی میزهایِ کسی که مالکش نیست.
    const { body } = await createTableViaRoute(A);
    const res = await tableQrRoute.GET(getReq(B.token), routeArg(body.id));
    assert.equal(res.status, 404, 'باید «پیدا نشد» بدهد، نه SVG');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('اسکنِ QR — مسیرِ کاملِ مهمان', () => {
  test('⚠️ اسکن رزرو را می‌نشاند و میز را اشغال می‌کند', async () => {
    // ⚠️ همان چیزی که هرگز کار نمی‌کرد: از ساختِ میز تا نشستنِ مهمان.
    const { body } = await createTableViaRoute(A);
    const resv = await makeLiveReservation(A, body.id);

    const res = await checkinRoute.POST(
      new Request('http://x/api/v1/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ qr_code: body.qr_code }),
      }),
    );

    assert.equal(res.status, 200);
    const out = await res.json() as { reservation_code: string | null; status: string; table_number: number };
    assert.equal(out.reservation_code, resv.code, 'باید همان رزرو را پیدا کند');
    assert.equal(out.status, 'seated');
    assert.equal(out.table_number, body.number);

    const after = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    assert.equal(after?.status, 'seated', 'رزرو واقعاً باید seated شده باشد');

    const tbl = await db.table.findUnique({ where: { id: body.id }, select: { state: true } });
    assert.equal(tbl?.state, 'occupied', 'میز باید اشغال شده باشد');
  });

  test('اسکن بدونِ ورود کار می‌کند (مهمانِ بدونِ حساب هم باید بنشیند)', async () => {
    // درخواست هیچ هدرِ Authorization ندارد — عمداً.
    const { body } = await createTableViaRoute(A);
    await makeLiveReservation(A, body.id);
    const res = await checkinRoute.POST(new Request('http://x/api/v1/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qr_code: body.qr_code }),
    }));
    assert.equal(res.status, 200, 'خودِ کدِ QR اعتبارنامه است، لاگین لازم نیست');
  });

  test('میزِ بدونِ رزروِ فعال: صادقانه می‌گوید رزروی نیست، ادعای ثبت نمی‌کند', async () => {
    const { body } = await createTableViaRoute(A);
    const res = await checkinRoute.POST(new Request('http://x/api/v1/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qr_code: body.qr_code }),
    }));
    assert.equal(res.status, 200);
    const out = await res.json() as { reservation_code: string | null };
    assert.equal(out.reservation_code, null, 'نباید رزروی از خودش بسازد');
  });

  test('کدِ ناشناس رد می‌شود', async () => {
    const res = await checkinRoute.POST(new Request('http://x/api/v1/checkin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qr_code: 'T-ZZZZZZZZZZ' }),
    }));
    assert.equal(res.status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('آدرسِ داخلِ QR', () => {
  test('رویِ دامنه‌ی اپ است، نه سایتِ مارکتینگ', async () => {
    // ⚠️ اگر این به `siteBase()` می‌رفت، QRِ رویِ میزها مهمان را به سایتِ
    //    مارکتینگ می‌برد که اصلاً کدِ ورود را نمی‌شناسد.
    const url = tableCheckInUrl('T-ABCDEFGHJK');
    assert.equal(url, 'https://app.example.invalid/?checkin=T-ABCDEFGHJK');
  });

  test('کد encode می‌شود (کدِ عجیب آدرس را نمی‌شکند)', async () => {
    assert.match(tableCheckInUrl('a b&c'), /checkin=a%20b%26c/);
  });
});
