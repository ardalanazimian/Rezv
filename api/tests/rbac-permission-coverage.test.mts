import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  پوششِ RBAC رویِ درختِ `/v1/restaurant/**`
//
//  ⚠️ باگی که این فایل از آن زاده شد (ممیزیِ RBAC، تأییدشده با درخواستِ زنده
//  رویِ APIِ واقعی): شش routeِ زیرِ `restaurant/` هیچ کلیدِ `permission:`
//  نداشتند. یعنی `withRestaurantAuth` فقط auth + محدوده‌ی شعبه را اعمال
//  می‌کرد و لایه‌ی RBAC کاملاً رد می‌شد. با کارمندی که **هر ۹ مجوزش صریحاً
//  `false`** بود:
//
//    GET  /restaurant/reservations?date=today  → ۲۰۰، به‌همراهِ
//         `"phone":"+989121234567"` برایِ **هر** مهمان (نام + شماره)
//    POST /restaurant/notes                     → ۲۰۱، یادداشتِ تیمی ساخته شد
//
//  یعنی «کارمندِ بدونِ دسترسی» عملاً خواندنِ کاملِ داده‌ی شخصیِ مهمان‌ها و
//  نوشتن در دفترِ سرویس را داشت. مجوزها در پنل ست می‌شدند، در DB ذخیره
//  می‌شدند، در پاسخِ لاگین برمی‌گشتند و منو را هم محدود می‌کردند — ولی سرور
//  هیچ‌وقت نگاهشان نمی‌کرد. یک کنترلِ امنیتیِ کاملاً تزئینی.
//
//  این فایل سه لایه دارد:
//    ۱) کنترلِ مثبت  — کارمندِ همه‌false رویِ هر روت ۴۰۳ می‌گیرد
//    ۲) کنترلِ منفی  — همان کارمند با مجوزِ درست ۲۰۰ می‌گیرد (یعنی گاردی که
//                      «همیشه رد کند» هم این تست را پاس نمی‌کند)
//    ۳) گاردِ ساختاری — هیچ routeِ تازه‌ای زیرِ `restaurant/` بدونِ
//                      `permission:` اضافه نمی‌شود، مگر با استثنایِ صریح و
//                      مستند در همین فایل.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');

const reservationsRoute = await import('../src/app/api/v1/restaurant/reservations/route');
const reservationEventsRoute = await import('../src/app/api/v1/restaurant/reservations/[code]/events/route');
const waitlistRoute = await import('../src/app/api/v1/restaurant/waitlist/route');
const notesRoute = await import('../src/app/api/v1/restaurant/notes/route');
const chatsRoute = await import('../src/app/api/v1/restaurant/chats/route');
const heartbeatRoute = await import('../src/app/api/v1/restaurant/heartbeat/route');
const staffRoute = await import('../src/app/api/v1/restaurant/staff/route');
// ── پنج روتی که خودِ گاردِ ساختاریِ همین فایل کشفشان کرد (نه فهرستِ ورودی) ──
const chatThreadRoute = await import('../src/app/api/v1/restaurant/chats/[id]/route');
const photosRoute = await import('../src/app/api/v1/restaurant/photos/route');
const reviewsRoute = await import('../src/app/api/v1/restaurant/reviews/route');
const cashbackRoute = await import('../src/app/api/v1/restaurant/cashback/route');
const eventsRoute = await import('../src/app/api/v1/restaurant/events/route');
const branchesRoute = await import('../src/app/api/v1/restaurant/branches/route');

const TAG = 'rbacpc';

let tenantId: string;
let restaurantId: string;
let tableId: string;
let userId: string;
let resvCode: string;
let noteId: string;

let ownerId: string;
let managerId: string;
let lockedStaffId: string;   // هر ۹ مجوز false — قهرمانِ داستان
let resStaffId: string;      // فقط canManageReservations
let wlStaffId: string;       // فقط canManageWaitlist
let staffKeyStaffId: string; // فقط canManageStaff (کلیدی که هیچ اجراکننده‌ای ندارد)

/** همه‌ی ۹ کلید صریحاً false — پیش‌فرضِ ستون‌هایِ DB بعضی true است، پس صریح می‌نویسیم. */
const ALL_FALSE = {
  canManageReservations: false, canManageTables: false, canManageWaitlist: false,
  canViewAnalytics: false, canViewRevenue: false, canManageCampaigns: false,
  canManageCoupons: false, canManageStaff: false, canManageSettings: false,
};

const phone = () => `+9892${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13);

const token = (sub: string, role: 'owner' | 'manager' | 'staff') =>
  signAccess({ sub, kind: 'staff', tenantId, role });

/**
 * هر درخواست IPِ یکتا می‌گیرد. سهمیه‌ی rate-limit بر پایه‌ی IP است و بینِ همه‌ی
 * فایل‌هایِ `_all.runner.mts` مشترک — بدونِ این، همین فایل به‌تنهایی سقفِ
 * `search` (۶۰/دقیقه) را رد می‌کرد و ۴۲۹ می‌گرفت، که با ۴۰۳ اشتباه گرفته
 * می‌شد. سقفِ واقعیِ روت‌ها دست‌نخورده می‌ماند؛ فقط bucket جدا می‌شود.
 */
let ipSeq = 0;
function req(tok: string | null, path: string, method = 'GET', body?: unknown) {
  ipSeq += 1;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-real-ip': `10.77.${Math.floor(ipSeq / 250) % 250}.${ipSeq % 250}`,
  };
  if (tok) headers.authorization = `Bearer ${tok}`;
  return new Request(`http://x/api/v1/restaurant${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

before(async () => {
  const s = Date.now().toString(36);
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-${s}` }, select: { id: true } });
  tenantId = t.id;

  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-${TAG}-${s}`, name: `[DEMO] ${TAG}-${s}`, clubPrefix: 'RBC',
      tables: { create: [{ number: 1, capacity: 4 }] },
    },
    select: { id: true, tables: { select: { id: true } } },
  });
  restaurantId = r.id;
  tableId = r.tables[0].id;

  const mk = async (role: 'owner' | 'manager' | 'staff', perms?: typeof ALL_FALSE) => {
    const st = await db.staff.create({
      data: { tenantId, role, isActive: true, phone: phone() },
      select: { id: true },
    });
    if (perms) await db.staffPermission.create({ data: { staffId: st.id, ...perms } });
    return st.id;
  };

  ownerId = await mk('owner');
  managerId = await mk('manager');
  lockedStaffId = await mk('staff', ALL_FALSE);
  resStaffId = await mk('staff', { ...ALL_FALSE, canManageReservations: true });
  wlStaffId = await mk('staff', { ...ALL_FALSE, canManageWaitlist: true });
  staffKeyStaffId = await mk('staff', { ...ALL_FALSE, canManageStaff: true });

  // مهمانِ واقعی با شماره — همان چیزی که در باگ نشت می‌کرد.
  const u = await db.user.create({
    data: { phone: phone(), firstName: '[DEMO]', lastName: 'مهمان' },
    select: { id: true },
  });
  userId = u.id;

  // ⚠️ `zReservationCode` یعنی دقیقاً `/^RZ[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/`.
  // تلاشِ اولِ همین تست یک کدِ خودساخته فرستاد و ۴۲۲ گرفت — یعنی اعتبارسنجیِ روت
  // واقعی است و این هلپر قراردادِ واقعی را قفل می‌کند، نه سلیقه را.
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  resvCode = 'RZ' + Array.from({ length: 7 },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
  const slotStart = new Date(Date.now() + 3 * 3_600_000);
  await db.reservation.create({
    data: {
      code: resvCode, restaurantId, tableId, userId, partySize: 2,
      slotStart, slotEnd: new Date(slotStart.getTime() + 5_400_000),
      status: 'confirmed', source: 'app',
    },
  });

  const note = await db.staffNote.create({
    data: { restaurantId, body: '[DEMO] یادداشتِ سرویس', pinned: false },
    select: { id: true },
  });
  noteId = note.id;
});

after(async () => {
  await db.staffNote.deleteMany({ where: { restaurantId } });
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } });
  await db.reservation.deleteMany({ where: { restaurantId } });
  await db.table.deleteMany({ where: { restaurantId } });
  await db.restaurant.deleteMany({ where: { id: restaurantId } });
  await db.staffPermission.deleteMany({ where: { staff: { tenantId } } });
  await db.staff.deleteMany({ where: { tenantId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
});

// ─────────────────────────────────────────────────────────────────────
//  ۱) کنترلِ مثبت — کارمندِ صریحاً محدودشده باید ۴۰۳ بگیرد
// ─────────────────────────────────────────────────────────────────────
describe('کارمندی که هر ۹ مجوزش false است — همه‌ی routeهای رفع‌شده ۴۰۳ می‌دهند', () => {
  test('🔴 GET /restaurant/reservations — نشتِ نام و شماره‌ی همه‌ی مهمان‌ها', async () => {
    // 🔴 هسته‌ی باگ: پیش از رفع، این درخواست ۲۰۰ می‌داد و بدنه‌اش `phone` داشت.
    const tok = token(lockedStaffId, 'staff');
    const res = await reservationsRoute.GET(req(tok, '/reservations?date=today'));
    assert.equal(res.status, 403);
    const raw = await res.text();
    assert.ok(!raw.includes('"phone"'), 'پاسخِ ۴۰۳ نباید هیچ فیلدِ phone داشته باشد');
  });

  test('🔴 GET /restaurant/reservations/:code/events — audit logِ چرخه‌ی عمر', async () => {
    const tok = token(lockedStaffId, 'staff');
    const res = await reservationEventsRoute.GET(
      req(tok, `/reservations/${resvCode}/events`),
      { params: Promise.resolve({ code: resvCode }) },
    );
    assert.equal(res.status, 403);
  });

  test('🔴 GET /restaurant/waitlist — نام و شماره‌ی نفراتِ صف', async () => {
    const tok = token(lockedStaffId, 'staff');
    const res = await waitlistRoute.GET(req(tok, '/waitlist'));
    assert.equal(res.status, 403);
  });

  test('🔴 GET /restaurant/chats — اینباکس، شاملِ شماره‌ی مشتری', async () => {
    const tok = token(lockedStaffId, 'staff');
    const res = await chatsRoute.GET(req(tok, '/chats'));
    assert.equal(res.status, 403);
  });

  test('🔴 GET /restaurant/notes — یادداشت‌های داخلیِ تیم', async () => {
    const tok = token(lockedStaffId, 'staff');
    const res = await notesRoute.GET(req(tok, '/notes'));
    assert.equal(res.status, 403);
  });

  test('🔴 POST /restaurant/notes — و واقعاً هیچ یادداشتی ساخته نمی‌شود', async () => {
    // 🔴 هسته‌ی باگ: پیش از رفع، این ۲۰۱ می‌داد و ردیف در DB می‌نشست.
    //    فقط چکِ status کافی نیست — اثرِ جانبی هم باید صفر باشد.
    const before = await db.staffNote.count({ where: { restaurantId } });
    const tok = token(lockedStaffId, 'staff');
    const res = await notesRoute.POST(req(tok, '/notes', 'POST', { body: '[DEMO] نباید ساخته شود' }));
    assert.equal(res.status, 403);
    const afterCount = await db.staffNote.count({ where: { restaurantId } });
    assert.equal(afterCount, before, 'هیچ یادداشتی نباید ساخته شده باشد');
  });

  test('🔴 PATCH /restaurant/notes — و سنجاق واقعاً عوض نمی‌شود', async () => {
    const tok = token(lockedStaffId, 'staff');
    const res = await notesRoute.PATCH(req(tok, '/notes', 'PATCH', { id: noteId, pinned: true }));
    assert.equal(res.status, 403);
    const row = await db.staffNote.findUnique({ where: { id: noteId }, select: { pinned: true } });
    assert.equal(row?.pinned, false, 'یادداشت نباید سنجاق شده باشد');
  });

  test('🔴 DELETE /restaurant/notes — و یادداشت واقعاً حذف نمی‌شود', async () => {
    const tok = token(lockedStaffId, 'staff');
    const res = await notesRoute.DELETE(req(tok, `/notes?id=${noteId}`, 'DELETE'));
    assert.equal(res.status, 403);
    const row = await db.staffNote.findUnique({ where: { id: noteId }, select: { id: true } });
    assert.ok(row, 'یادداشت باید هنوز موجود باشد');
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۲) کنترلِ منفی — گاردی که «همیشه رد کند» باید اینجا بشکند
// ─────────────────────────────────────────────────────────────────────
describe('همان کارمند با مجوزِ درست — ۲۰۰ (قابلیت نشکسته)', () => {
  test('canManageReservations → GET /reservations = ۲۰۰ و داده‌ی واقعی', async () => {
    const res = await reservationsRoute.GET(req(token(resStaffId, 'staff'), '/reservations?date=all'));
    assert.equal(res.status, 200);
    const body = await res.json() as { reservations: { code: string }[] };
    assert.ok(body.reservations.some(r => r.code === resvCode), 'رزروِ ساخته‌شده باید دیده شود');
  });

  test('canManageReservations → GET /reservations/:code/events = ۲۰۰', async () => {
    const res = await reservationEventsRoute.GET(
      req(token(resStaffId, 'staff'), `/reservations/${resvCode}/events`),
      { params: Promise.resolve({ code: resvCode }) },
    );
    assert.equal(res.status, 200);
  });

  test('canManageReservations → GET /chats = ۲۰۰', async () => {
    const res = await chatsRoute.GET(req(token(resStaffId, 'staff'), '/chats'));
    assert.equal(res.status, 200);
  });

  test('canManageReservations → چرخه‌ی کاملِ notes (GET/POST/PATCH/DELETE) = ۲۰۰', async () => {
    const tok = token(resStaffId, 'staff');

    const g = await notesRoute.GET(req(tok, '/notes'));
    assert.equal(g.status, 200);

    const p = await notesRoute.POST(req(tok, '/notes', 'POST', { body: '[DEMO] یادداشتِ مجاز' }));
    assert.equal(p.status, 201);
    const { id } = await p.json() as { id: string };

    const pa = await notesRoute.PATCH(req(tok, '/notes', 'PATCH', { id, pinned: true }));
    assert.equal(pa.status, 200);
    const pinned = await db.staffNote.findUnique({ where: { id }, select: { pinned: true } });
    assert.equal(pinned?.pinned, true);

    const d = await notesRoute.DELETE(req(tok, `/notes?id=${id}`, 'DELETE'));
    assert.equal(d.status, 200);
    assert.equal(await db.staffNote.findUnique({ where: { id } }), null);
  });

  test('canManageWaitlist → GET /waitlist = ۲۰۰', async () => {
    const res = await waitlistRoute.GET(req(token(wlStaffId, 'staff'), '/waitlist'));
    assert.equal(res.status, 200);
  });

  test('⚠️ مجوزها واقعاً تفکیک‌شده‌اند — کارمندِ صف نمی‌تواند رزروها را بخواند', async () => {
    // بدونِ این، یک گاردِ «هر مجوزی کافی است» هم بالا را پاس می‌کرد.
    const res = await reservationsRoute.GET(req(token(wlStaffId, 'staff'), '/reservations?date=today'));
    assert.equal(res.status, 403);
  });

  test('⚠️ و برعکس — کارمندِ رزرو نمی‌تواند صفِ انتظار را بخواند', async () => {
    const res = await waitlistRoute.GET(req(token(resStaffId, 'staff'), '/waitlist'));
    assert.equal(res.status, 403);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۳) owner/manager نباید بشکنند (سازگاری با گذشته — §۳۲)
// ─────────────────────────────────────────────────────────────────────
describe('owner و manager همچنان همه‌جا عبور می‌کنند', () => {
  for (const [label, getId, role] of [
    ['owner', () => ownerId, 'owner'],
    ['manager', () => managerId, 'manager'],
  ] as [string, () => string, 'owner' | 'manager'][]) {
    test(`${label}: هر پنج روتِ رفع‌شده ۲۰۰/۲۰۱ می‌دهند`, async () => {
      const tok = token(getId(), role);

      assert.equal((await reservationsRoute.GET(req(tok, '/reservations?date=today'))).status, 200);
      assert.equal((await waitlistRoute.GET(req(tok, '/waitlist'))).status, 200);
      assert.equal((await chatsRoute.GET(req(tok, '/chats'))).status, 200);
      assert.equal((await notesRoute.GET(req(tok, '/notes'))).status, 200);
      assert.equal(
        (await reservationEventsRoute.GET(
          req(tok, `/reservations/${resvCode}/events`),
          { params: Promise.resolve({ code: resvCode }) },
        )).status,
        200,
      );

      const p = await notesRoute.POST(req(tok, '/notes', 'POST', { body: `[DEMO] یادداشتِ ${label}` }));
      assert.equal(p.status, 201);
      const { id } = await p.json() as { id: string };
      await db.staffNote.delete({ where: { id } });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  ۴) heartbeat — استثنایِ عمدی، قفل‌شده تا سهواً عوض نشود
// ─────────────────────────────────────────────────────────────────────
describe('POST /restaurant/heartbeat — عمداً بدونِ permission', () => {
  test('⚠️ کارمندِ همه‌false هم باید بتواند heartbeat بزند (وگرنه رستوران از کاتالوگ حذف می‌شود)', async () => {
    // اگر کسی رویِ این روت `permission:` بگذارد، شیفتی که فقط یک کارمندِ محدود
    // پشتِ پنل دارد بعد از ۹۰ ثانیه `lastSeenAt` تازه ندارد و
    // `restaurants/route.ts` رستوران را از لیستِ اپِ مشتری حذف می‌کند —
    // قطعِ خاموشِ رزروِ آنلاین. این تست همان تصمیم را قفل می‌کند.
    const before = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { lastSeenAt: true } });
    const res = await heartbeatRoute.POST(req(token(lockedStaffId, 'staff'), '/heartbeat', 'POST', {}));
    assert.equal(res.status, 200);
    const after = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { lastSeenAt: true } });
    assert.notEqual(after?.lastSeenAt?.getTime(), before?.lastSeenAt?.getTime(), 'lastSeenAt باید تازه شده باشد');
  });

  test('ولی همچنان auth می‌خواهد — بدونِ توکن ۴۰۱', async () => {
    const res = await heartbeatRoute.POST(req(null, '/heartbeat', 'POST', {}));
    assert.equal(res.status, 401);
  });

  test('و هیچ داده‌ای برنمی‌گرداند (پایه‌ی استدلالِ استثنا)', async () => {
    const res = await heartbeatRoute.POST(req(token(lockedStaffId, 'staff'), '/heartbeat', 'POST', {}));
    const body = await res.json() as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ['interval', 'ok'], 'پاسخ فقط ok و interval است');
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۵) `canManageStaff` — تصمیمِ ثبت‌شده: کلید هم‌ارزِ owner است، تفویض نمی‌شود
// ─────────────────────────────────────────────────────────────────────
describe('مدیریتِ کارکنان — گاردِ نقش، نه گاردِ مجوز', () => {
  test('⚠️ کارمندِ دارای canManageStaff همچنان ۴۰۳ می‌گیرد (نه ارتقاءِ سهوی)', async () => {
    // ⚠️ این تست عمداً وضعِ «ناهم‌خوان با UI» را قفل می‌کند، نه وضعِ «درست» را.
    //    اگر کسی برایِ رفعِ بن‌بستِ تبِ «کارکنان» در پنل، اینجا
    //    `requirePermission(auth,'canManageStaff')` را جایگزینِ چکِ نقش کند،
    //    یک درِ خودارتقایی باز می‌شود (تستِ بعدی همان را نشان می‌دهد).
    //    رفعِ درست سمتِ `apps/business/js/routing.js` است، نه اینجا.
    const res = await staffRoute.GET(req(token(staffKeyStaffId, 'staff'), '/staff'));
    assert.equal(res.status, 403);
  });

  test('🔴 اثباتِ اینکه چرا: تفویضِ canManageStaff یعنی خودارتقایی به دسترسیِ کامل', async () => {
    // اگر گارد به مجوز تبدیل شود، همین PATCH پاس می‌شد و کارمند در یک درخواست
    // هر ۹ مجوز را به خودش می‌داد — `target.role === 'owner'` فقط هدفِ owner
    // را می‌گیرد، نه خودِ staff را. با گاردِ فعلی (نقش) این ۴۰۳ است.
    const res = await staffRoute.PATCH(req(
      token(staffKeyStaffId, 'staff'), '/staff', 'PATCH',
      {
        staff_id: staffKeyStaffId,
        permissions: { canManageSettings: true, canViewRevenue: true, canManageReservations: true },
      },
    ));
    assert.equal(res.status, 403);
    const perm = await db.staffPermission.findUnique({
      where: { staffId: staffKeyStaffId },
      select: { canManageSettings: true, canViewRevenue: true },
    });
    assert.equal(perm?.canManageSettings, false, 'هیچ مجوزی نباید ارتقا یافته باشد');
    assert.equal(perm?.canViewRevenue, false);
  });

  test('owner همچنان فهرستِ کارکنان را می‌بیند (قابلیت نشکسته)', async () => {
    const res = await staffRoute.GET(req(token(ownerId, 'owner'), '/staff'));
    assert.equal(res.status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۵ب) پنج شکافی که **خودِ گاردِ ساختاریِ پایینِ همین فایل** کشفشان کرد
//
//  ⚠️ اینها در فهرستِ ورودیِ ممیزی نبودند. علتِ جا افتادنشان یک اشتباهِ روشِ
//  grep است: شمارشِ `permission:` در سطحِ **فایل** انجام شده بود، نه در سطحِ
//  **متد**. در هر پنج فایل، متدِ *نوشتن* مجوز داشت و همان فایل «پوشش‌داده‌شده»
//  به‌نظر می‌رسید — در حالی که `GET`ِ کنارش باز بود. دری که فقط از یک طرف قفل
//  است. (branches/route.ts هم همین شکل را داشت ولی عمداً باز ماند — سوییتِ
//  جداگانه‌اش پایین‌تر است.)
// ─────────────────────────────────────────────────────────────────────
describe('شکاف‌های کشف‌شده توسطِ گاردِ ساختاری — GETِ باز کنارِ نوشتنِ بسته', () => {
  const routeArg = (id: string) => ({ params: Promise.resolve({ id }) });

  test('🔴 GET /restaurant/chats/:id — تاریخچه‌ی گفتگو با مشتری', async () => {
    const thread = await db.chatThread.create({
      data: { restaurantId, userId }, select: { id: true },
    });
    try {
      const denied = await chatThreadRoute.GET(
        req(token(lockedStaffId, 'staff'), `/chats/${thread.id}`), routeArg(thread.id));
      assert.equal(denied.status, 403);

      const ok = await chatThreadRoute.GET(
        req(token(resStaffId, 'staff'), `/chats/${thread.id}`), routeArg(thread.id));
      assert.equal(ok.status, 200, 'canManageReservations باید عبور کند');
    } finally {
      await db.chatThread.delete({ where: { id: thread.id } });
    }
  });

  test('🔴 GET /restaurant/photos — گالری + وضعیتِ بازبینی', async () => {
    assert.equal((await photosRoute.GET(req(token(lockedStaffId, 'staff'), '/photos'))).status, 403);
    assert.equal((await photosRoute.GET(req(token(ownerId, 'owner'), '/photos'))).status, 200);
  });

  test('🔴 GET /restaurant/reviews — نظرات و امتیازها', async () => {
    assert.equal((await reviewsRoute.GET(req(token(lockedStaffId, 'staff'), '/reviews'))).status, 403);
    assert.equal((await reviewsRoute.GET(req(token(ownerId, 'owner'), '/reviews'))).status, 200);
  });

  test('🔴 GET /restaurant/cashback — پیکربندیِ مالیِ کش‌بک', async () => {
    assert.equal((await cashbackRoute.GET(req(token(lockedStaffId, 'staff'), '/cashback'))).status, 403);
    assert.equal((await cashbackRoute.GET(req(token(ownerId, 'owner'), '/cashback'))).status, 200);
  });

  test('🔴 GET /restaurant/events — رویدادهای ویژه (قیمت/ظرفیت/انتشار)', async () => {
    assert.equal((await eventsRoute.GET(req(token(lockedStaffId, 'staff'), '/events'))).status, 403);
    assert.equal((await eventsRoute.GET(req(token(ownerId, 'owner'), '/events'))).status, 200);
  });

  test('⚠️ هیچ‌کدام برایِ کارمندِ فقط-صف باز نشده (تفکیکِ واقعیِ کلیدها)', async () => {
    const tok = token(wlStaffId, 'staff');
    assert.equal((await photosRoute.GET(req(tok, '/photos'))).status, 403);
    assert.equal((await cashbackRoute.GET(req(tok, '/cashback'))).status, 403);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۵ج) branches GET — استثنایِ عمدی (هم‌الگو با heartbeat)، قفل‌شده
// ─────────────────────────────────────────────────────────────────────
describe('GET /restaurant/branches — عمداً بدونِ permission', () => {
  test('⚠️ کارمندِ همه‌false هم سوییچرِ شعبه را می‌گیرد (وگرنه contextِ پنل می‌شکند)', async () => {
    const res = await branchesRoute.GET(req(token(lockedStaffId, 'staff'), '/branches'));
    assert.equal(res.status, 200);
    const body = await res.json() as { branches: unknown[]; current_restaurant_id: string };
    assert.equal(body.current_restaurant_id, restaurantId);
  });

  test('ولی POSTِ همان فایل بسته است — ساختِ شعبه canManageSettings می‌خواهد', async () => {
    // یعنی استثنا فقط شاملِ *خواندنِ context* است، نه عملیاتِ حساسِ همان منبع.
    const before = await db.restaurant.count({ where: { tenantId } });
    const res = await branchesRoute.POST(
      req(token(lockedStaffId, 'staff'), '/branches', 'POST', { name: '[DEMO] شعبه‌ی غیرمجاز' }));
    assert.equal(res.status, 403);
    assert.equal(await db.restaurant.count({ where: { tenantId } }), before);
  });

  test('و مرزِ تنانت همچنان اعمال می‌شود — فقط شعبه‌های تنانتِ خودش', async () => {
    const res = await branchesRoute.GET(req(token(lockedStaffId, 'staff'), '/branches'));
    const body = await res.json() as { branches: { id: string }[] };
    assert.deepEqual(body.branches.map(b => b.id), [restaurantId]);
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ۶) گاردِ ساختاری — routeِ تازه بدونِ permission اضافه نشود
// ─────────────────────────────────────────────────────────────────────

const RESTAURANT_DIR = fileURLToPath(new URL('../src/app/api/v1/restaurant/', import.meta.url));

/**
 * استثناهایِ عمدی. هر ورودی باید یک «مدرک» داشته باشد: رشته‌ای که باید در
 * خودِ فایل موجود باشد. یعنی استثنا فقط تا وقتی معتبر است که دلیلش هنوز در
 * کد نوشته شده باشد — استثنایِ ساکت ممکن نیست.
 *
 * ⚠️ اضافه‌کردن به این جدول باید یک تصمیمِ آگاهانه باشد، نه راهِ فرارِ سریع از
 *    یک تستِ قرمز. هر ورودیِ تازه یعنی یک routeِ رستورانی که RBAC ندارد.
 */
const DELIBERATE_EXCEPTIONS: Record<string, { why: string; proof: RegExp }> = {
  'heartbeat/route.ts → POST': {
    why: 'سیگنالِ liveness؛ هیچ داده‌ای برنمی‌گرداند و فقط lastSeenAtِ رستورانِ خودِ کارمند را می‌نویسد. '
       + 'گذاشتنِ مجوز باعث می‌شود شیفتِ کارمندِ محدود، رستوران را از کاتالوگِ اپِ مشتری حذف کند.',
    proof: /بدونِ `permission:` — عمدی/,
  },
  'branches/route.ts → GET': {
    why: 'endpointِ context، نه داده‌ی کسب‌وکار: loadBranches() در پنل برایِ هر کاربرِ لاگین‌کرده و '
       + 'بی‌قید صدا زده می‌شود (همان الگویِ heartbeat)، و خروجی فقط نام/اسلاگِ شعبه‌هایِ تنانتِ خودش '
       + 'است. POSTِ همین فایل canManageSettings دارد. تصمیمِ محصولی — به معمار ارجاع شده.',
    proof: /بدونِ `permission:` — عمدی/,
  },
  'staff/route.ts → GET': {
    why: 'با withStaffAuth (نه withRestaurantAuth) کار می‌کند و گاردش نقشِ owner/manager است — '
       + 'سخت‌گیرانه‌تر از هر کلیدِ مجوز. تفویضِ canManageStaff عمداً پیاده نشده (درِ خودارتقایی).',
    proof: /assertManagerOrOwner/,
  },
  'staff/route.ts → POST': { why: 'همان بالا.', proof: /assertManagerOrOwner/ },
  'staff/route.ts → PATCH': { why: 'همان بالا.', proof: /assertManagerOrOwner/ },
  'staff/password/route.ts → POST': {
    why: 'کارمند رمزِ **خودش** را عوض می‌کند. با withStaffAuth کار می‌کند (که نقش و isActive را از DB '
       + 'تازه می‌کند) و دامنه‌اش با `id: auth.sub` به همان یک ردیف قفل است — یعنی هیچ کلیدِ مجوزی '
       + 'نمی‌تواند سخت‌گیرتر باشد. کلیدِ RBAC اینجا حتی مضر بود: کارمندِ محدودشده هم باید بتواند '
       + 'رمزِ خودش را عوض کند، وگرنه اولین کاری که هر کاربرِ تازه باید بکند برایش بسته است.',
    // مدرکِ ساختاری: دامنه واقعاً به خودِ کاربر قفل است، نه یک ادعا در کامنت.
    proof: /where:\s*\{\s*id:\s*auth\.sub\s*\}/,
  },
};

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, out);
    else if (entry === 'route.ts') out.push(full);
  }
  return out;
}

const HTTP_METHODS = 'GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS';
/** `export const GET = withRestaurantAuth({ ...opts }` — آبجکتِ opts در این کدبیس همیشه تخت است. */
const GUARDED = new RegExp(
  String.raw`export\s+const\s+(${HTTP_METHODS})\s*=\s*withRestaurantAuth\(\s*(\{[^}]*\})`,
  'g',
);
/** هر export شدنِ یک متدِ HTTP، به هر شکلی (const یا function). */
const ANY_HANDLER = new RegExp(
  String.raw`export\s+(?:const|async\s+function|function)\s+(${HTTP_METHODS})\b`,
  'g',
);

describe('گاردِ ساختاری — هر routeِ زیرِ restaurant/ باید permission داشته باشد', () => {
  const files = routeFiles(RESTAURANT_DIR);

  test('کنترلِ مثبتِ خودِ اسکنر: درختِ routeها واقعاً پیدا و پارس می‌شود', async () => {
    // بدونِ این، یک glob یا regexِ خراب «صفر تخلف» گزارش می‌کرد و تستِ اصلی
    // بی‌صدا سبز می‌ماند — دقیقاً همان کلاسِ باگی که این فایل درباره‌اش است.
    assert.ok(files.length >= 40, `انتظار حداقل ۴۰ فایلِ route، پیدا شد ${files.length}`);
    let guarded = 0;
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      guarded += [...src.matchAll(GUARDED)].filter(m => m[2].includes('permission:')).length;
    }
    assert.ok(guarded >= 50, `انتظار حداقل ۵۰ هندلرِ دارایِ permission، پیدا شد ${guarded}`);
  });

  test('🔴 هیچ متدِ HTTPی بدونِ permission نمانده (جز استثناهایِ صریح)', async () => {
    const violations: string[] = [];

    for (const full of files) {
      const rel = relative(RESTAURANT_DIR, full).split(sep).join('/');
      const src = readFileSync(full, 'utf8');
      const withPermission = new Set(
        [...src.matchAll(GUARDED)].filter(m => m[2].includes('permission:')).map(m => m[1]),
      );
      for (const m of src.matchAll(ANY_HANDLER)) {
        const id = `${rel} → ${m[1]}`;
        if (!withPermission.has(m[1]) && !(id in DELIBERATE_EXCEPTIONS)) violations.push(id);
      }
    }

    assert.deepEqual(
      violations, [],
      'routeهای زیر بدونِ `permission:` هستند. یا کلیدِ درست را اضافه کن، '
      + 'یا با دلیلِ مکتوب به DELIBERATE_EXCEPTIONS در همین فایل اضافه‌شان کن:\n  '
      + violations.join('\n  '),
    );
  });

  test('⚠️ هر استثنا هنوز وجود دارد و دلیلش هنوز در کد نوشته است', async () => {
    // استثنایِ کهنه (فایلِ حذف/بازنویسی‌شده) خودش یک سوراخ است: جدول می‌گوید
    // «بررسی شده» ولی چیزی که بررسی شده دیگر آنجا نیست.
    for (const [id, { proof }] of Object.entries(DELIBERATE_EXCEPTIONS)) {
      const [rel, method] = id.split(' → ');
      const full = join(RESTAURANT_DIR, ...rel.split('/'));
      const src = readFileSync(full, 'utf8');
      assert.match(src, proof, `استثنایِ «${id}» دیگر دلیلش را در کد ندارد — دوباره تصمیم بگیر`);
      // هنوز واقعاً همان متد را export می‌کند؟ استثنا برایِ متدِ ناموجود = فهرستِ کهنه.
      assert.match(
        src, new RegExp(String.raw`export\s+(?:const|async\s+function|function)\s+${method}\b`),
        `استثنایِ «${id}» به متدی اشاره می‌کند که دیگر export نمی‌شود`,
      );
      // و اگر حالا مجوز گرفته، باید از فهرست حذف شود (وگرنه استثنا بی‌معنا انباشته می‌شود).
      const guarded = [...src.matchAll(GUARDED)]
        .filter(m => m[2].includes('permission:')).map(m => m[1]);
      assert.ok(
        !guarded.includes(method),
        `«${id}» حالا permission دارد — از فهرستِ استثناها حذفش کن`,
      );
    }
  });

  test('⚠️ کلیدهای استفاده‌شده واقعاً در PermissionKey تعریف شده‌اند (نه تایپو)', async () => {
    // یک کلیدِ غلط‌املایی در TypeScript گرفته می‌شود، ولی این تست همان قفل را
    // مستقل از کامپایلر هم می‌گذارد و ضمناً فهرستِ زنده‌ی کلیدها را نشان می‌دهد.
    const permSrc = readFileSync(fileURLToPath(new URL('../src/lib/permissions.ts', import.meta.url)), 'utf8');
    const declared = new Set([...permSrc.matchAll(/'(can[A-Za-z]+)'/g)].map(m => m[1]));
    assert.ok(declared.size >= 9, `انتظار حداقل ۹ کلید، پیدا شد ${declared.size}`);

    const used = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/permission:\s*'([^']+)'/g)) used.add(m[1]);
    }
    for (const k of used) assert.ok(declared.has(k), `کلیدِ ناشناخته در route: ${k}`);
  });
});
