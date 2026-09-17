// ═══════════════════════════════════════════════════════════════════════
//  «دیرتر می‌رسم» و گیتِ عدمِ حضور — STATE M-13 (F001) و M-17 · حکم‌های CEO D-18/D-20
//
//  چرا این فایل وجود دارد (Feature Verification، ۲۰۲۶-۰۹-۱۶/۱۷):
//  ۱) `PATCH /restaurant/reservations/:code/status` **هیچ شرطِ زمانی** نداشت: پرسنل می‌توانست رزروِ
//     confirmed را چند روز **پیش** از ساعتش no_show کند — همان strike، همان برگشتِ کش‌بک — و پنل
//     دکمه‌ی «نیومد» را روی هر ردیفِ پیش‌رو نشان می‌داد (M-17).
//  ۲) مهمانِ دیرکرده هیچ راهی نداشت به رستوران بگوید در راه است (M-13).
//
//  قاعده‌ی پرسنل (D-20c): no_show فقط از `slotStart + مهلتِ رستوران (+ تمدیدِ درخواستیِ مهمان)` به
//  بعد؛ پیش از آن ۴۰۹ با خودِ مهلت. هشدار لازم نیست — پرسنل میز را می‌بیند.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import './helpers/test-env.mts';
process.env.JWT_SECRET ??= 'a'.repeat(32);
const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { genReservationCode } = await import('../src/lib/reservation-helpers');
const statusRoute = await import('../src/app/api/v1/restaurant/reservations/[code]/status/route.ts');
const etaRoute = await import('../src/app/api/v1/reservations/[code]/eta/route.ts');
const { GET: meReservations } = await import('../src/app/api/v1/me/reservations/route.ts');
const { GET: restaurantReservations } = await import('../src/app/api/v1/restaurant/reservations/route.ts');
const { GET: restaurantDetail } = await import('../src/app/api/v1/restaurants/[slug]/route.ts');
const policyRoute = await import('../src/app/api/v1/restaurant/cancellation-policy/route.ts');
const { GET: bell } = await import('../src/app/api/v1/restaurant/notifications/route.ts');
const { testIp } = await import('./helpers/test-ip.mts');
const { fixturePhone } = await import('./_phone.helper.mts');

// ⚠️ پیشوندِ ۰۹۴۷ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
const PHONE = '0947';
const SFX = randomUUID().slice(0, 6);
let tenantId = '';
let restaurantId = '';
let userId = '';
let staffToken = '';
let customerToken = '';
let otherCustomerToken = '';
let adminToken = '';
let capZeroRestaurantId = '';
let seq = 0;

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] late-gate ${SFX}` } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: `late-gate-${SFX}`, name: '[DEMO] رستورانِ مهلت', clubPrefix: 'LTG', lateGraceMinutes: 15 },
  });
  restaurantId = r.id;
  const staff = await db.staff.create({ data: { tenantId, phone: fixturePhone(PHONE), role: 'owner', isActive: true } });
  staffToken = signAccess({ sub: staff.id, kind: 'staff', tenantId, role: 'owner' });
  const u = await db.user.create({ data: { phone: fixturePhone(PHONE), firstName: '[DEMO]' } });
  userId = u.id;
  customerToken = signAccess({ sub: userId, kind: 'customer' });
  const other = await db.user.create({ data: { phone: fixturePhone(PHONE), firstName: '[DEMO] دیگری' } });
  otherCustomerToken = signAccess({ sub: other.id, kind: 'customer' });
  // ادمینِ پلتفرم = staffِ owner در tenantِ پلتفرم (lib/admin-auth.ts) — نوعِ توکنش هم «staff» است.
  const pt = await db.tenant.create({ data: { name: `[DEMO] platform late-gate ${SFX}` } });
  const admin = await db.staff.create({ data: { tenantId: pt.id, phone: fixturePhone(PHONE), role: 'owner', isActive: true } });
  adminToken = signAccess({ sub: admin.id, kind: 'staff', tenantId: pt.id, role: 'owner' });
  const r0 = await db.restaurant.create({
    data: {
      tenantId, slug: `late-gate0-${SFX}`, name: '[DEMO] رستورانِ بی‌تمدید', clubPrefix: 'LT0',
      lateGraceMinutes: 15, maxLateExtensionMinutes: 0,
    },
  });
  capZeroRestaurantId = r0.id;
});

/** رزروِ confirmed با فاصله‌ی دلخواه از ساعتش؛ هر رزرو میزِ خودش را دارد تا قیدِ no_table_overlap نخورد. */
async function reservation(minutesFromNowToSlot: number, opts: { restaurant?: string; status?: string } = {}) {
  const n = ++seq;
  const slotStart = new Date(Date.now() + minutesFromNowToSlot * 60_000);
  // کدِ واقعیِ رزرو (`zReservationCode`: RZ + ۷ نویسه) — کدِ دست‌سازِ اولِ همین تست ۴۲۲ می‌گرفت و کنترلِ مثبت گرفتش.
  const code = genReservationCode();
  const rid = opts.restaurant ?? restaurantId;
  const other = await db.table.create({ data: { restaurantId: rid, number: 100 + n, capacity: 4, isActive: true } });
  const resv = await db.reservation.create({
    data: {
      restaurantId: rid, userId, tableId: other.id, code, status: (opts.status ?? 'confirmed') as never, partySize: 2,
      slotStart, slotEnd: new Date(slotStart.getTime() + 90 * 60_000),
      guestName: '[DEMO] مهمان', guestPhone: fixturePhone(PHONE),
    },
    select: { id: true, code: true },
  });
  return resv;
}

const eta = (code: string, body: unknown, token = customerToken) =>
  etaRoute.POST(new Request('http://x/api', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-real-ip': testIp() },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ code }) } as never);

const lateRow = (id: string) => db.reservation.findUniqueOrThrow({
  where: { id }, select: { lateEtaSignaledAt: true, lateExtensionMinutes: true, lateWarnedAt: true, slotStart: true },
});

const staffHeaders = (rid = restaurantId) => ({
  authorization: `Bearer ${staffToken}`, 'content-type': 'application/json', 'x-real-ip': testIp(), 'x-restaurant-id': rid,
});

const markNoShow = (code: string) =>
  statusRoute.PATCH(new Request('http://x/api', {
    method: 'PATCH',
    headers: staffHeaders(),
    body: JSON.stringify({ status: 'no_show' }),
  }), { params: Promise.resolve({ code }) } as never);

const statusOf = async (id: string) =>
  (await db.reservation.findUniqueOrThrow({ where: { id }, select: { status: true } })).status;

describe('M-17 — پرسنل پیش از مهلتِ مهمان نمی‌تواند no_show ثبت کند', () => {
  test('رزروی که هنوز ساعتش نرسیده → ۴۰۹ با مهلت، و وضعیت دست نمی‌خورد', async () => {
    const r = await reservation(+5);
    const res = await markNoShow(r.code);
    assert.equal(res.status, 409, 'no_show پیش از ساعتِ رزرو یعنی جریمه‌ی مهمانی که هنوز فرصت داشت');
    const body = await res.json();
    assert.equal(body.error.code, 'NO_SHOW_BEFORE_DEADLINE');
    assert.ok(Number.isFinite(Date.parse(body.error.details.no_show_allowed_at)), 'پاسخ باید خودِ مهلت را بگوید');
    assert.equal(await statusOf(r.id), 'confirmed');
  });

  test('۱۰ دقیقه پس از ساعت، داخلِ مهلتِ ۱۵ دقیقه‌ای → ۴۰۹', async () => {
    const r = await reservation(-10);
    const res = await markNoShow(r.code);
    assert.equal(res.status, 409);
    assert.equal(await statusOf(r.id), 'confirmed');
  });

  test('کنترلِ مثبت: ۲۰ دقیقه پس از ساعت → ۲۰۰ و no_show', async () => {
    const r = await reservation(-20);
    const res = await markNoShow(r.code);
    assert.equal(res.status, 200, 'پس از مهلت، پرسنل باید بتواند — وگرنه گیت همه‌چیز را می‌بندد و سبزش بی‌معناست');
    assert.equal(await statusOf(r.id), 'no_show');
  });
});

describe('M-13 — POST /reservations/:code/eta («دیرتر می‌رسم»)', () => {
  test('مهمان: تمدید به سقفِ رستوران محدود می‌شود، مهلتِ تازه برمی‌گردد، هشدار ست و audit ثبت می‌شود', async () => {
    const r = await reservation(+5);
    const res = await eta(r.code, { minutes: 20 });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.extension_minutes, 15, 'سقفِ رستوران ۱۵ است (پیش‌فرضِ D-18)');
    assert.equal(body.capped, true);
    const row = await lateRow(r.id);
    assert.ok(row.lateEtaSignaledAt);
    assert.equal(row.lateExtensionMinutes, 15);
    assert.ok(row.lateWarnedAt, 'مهمانی که خودش خبر داده آگاه است — late_warned_at باید ست شود');
    assert.equal(body.deadline, new Date(row.slotStart.getTime() + 30 * 60_000).toISOString(), 'slot + grace(15) + تمدید(15)');
    const a = await db.auditLog.findFirst({ where: { action: 'reservation.late_signal', targetId: r.id } });
    assert.ok(a, 'سیگنال باید در audit ثبت شود');
    assert.equal((a!.detail as { granted_minutes: number }).granted_minutes, 15);
    const ev = await db.reservationEvent.count({ where: { reservationId: r.id } });
    assert.equal(ev, 0, 'reservation_events دفترِ انتقالِ وضعیت است — این سیگنال نباید آن‌جا برود');
  });

  test('تمدید مهلتِ پرسنل را هم جابه‌جا می‌کند', async () => {
    const r = await reservation(-10);
    assert.equal((await eta(r.code, { minutes: 10 })).status, 200);
    // حالا: ساعت+۱۰؛ مهلت = ساعت + ۱۵ + ۱۰ = ساعت+۲۵ → «نیومد» هنوز زود است
    const res = await markNoShow(r.code);
    assert.equal(res.status, 409);
    const body = await res.json();
    const row = await lateRow(r.id);
    assert.equal(body.error.details.no_show_allowed_at, new Date(row.slotStart.getTime() + 25 * 60_000).toISOString());
  });

  test('یک‌بار: درخواستِ دوم ۴۰۹ و تمدید عوض نمی‌شود', async () => {
    const r = await reservation(+5);
    assert.equal((await eta(r.code, { minutes: 10 })).status, 200);
    const res = await eta(r.code, { minutes: 20 });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error.code, 'LATE_SIGNAL_ALREADY_SENT');
    assert.equal((await lateRow(r.id)).lateExtensionMinutes, 10);
  });

  test('هم‌زمانی: دو درخواستِ موازی → دقیقاً یک ۲۰۰', async () => {
    const r = await reservation(+5);
    const [a, b] = await Promise.all([eta(r.code, { minutes: 10 }), eta(r.code, { minutes: 15 })]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const ext = (await lateRow(r.id)).lateExtensionMinutes;
    assert.ok(ext === 10 || ext === 15);
  });

  test('توکنِ پرسنل و ادمینِ پلتفرم رد می‌شوند و رزرو دست نمی‌خورد', async () => {
    const r = await reservation(+5);
    const cases: Array<[string, string]> = [['staff', staffToken], ['platform-admin', adminToken]];
    for (const [label, token] of cases) {
      const res = await eta(r.code, { minutes: 10 }, token);
      assert.equal(res.status, 403, `${label} نباید بتواند به جای مهمان خبر بدهد`);
    }
    assert.equal((await lateRow(r.id)).lateEtaSignaledAt, null);
  });

  test('درسِ V5: توکنِ staff که sub آن برابرِ userIdِ مهمان است هم رد می‌شود', async () => {
    // بدونِ بررسیِ صریحِ kind، بررسیِ مالکیت (`resv.userId === auth.sub`) این توکن را **می‌پذیرفت**:
    // هر دو uuid‌اند و هیچ‌چیز نوعِ principal را نمی‌سنجید. تستِ «توکنِ پرسنل» بالا این را نمی‌گیرد،
    // چون sub آن شناسه‌ی staff است و مالکیت خودش ردش می‌کند.
    const r = await reservation(+5);
    const forged = signAccess({ sub: userId, kind: 'staff', tenantId, role: 'owner' });
    const res = await eta(r.code, { minutes: 10 }, forged);
    assert.equal(res.status, 403);
    assert.equal((await lateRow(r.id)).lateEtaSignaledAt, null);
  });

  test('رزروِ کسِ دیگر → ۴۰۳ و بدونِ تغییر', async () => {
    const r = await reservation(+5);
    const res = await eta(r.code, { minutes: 10 }, otherCustomerToken);
    assert.equal(res.status, 403);
    assert.equal((await lateRow(r.id)).lateEtaSignaledAt, null);
  });

  test('پس از مهلت → ۴۰۹ deadline_passed', async () => {
    const r = await reservation(-20);
    const res = await eta(r.code, { minutes: 10 });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.code, 'LATE_SIGNAL_CLOSED');
    assert.equal(body.error.details.reason, 'deadline_passed');
  });

  test('رزروِ لغوشده → ۴۰۹ not_awaiting_guest', async () => {
    const r = await reservation(+5, { status: 'cancelled' });
    const res = await eta(r.code, { minutes: 10 });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error.details.reason, 'not_awaiting_guest');
  });

  test('سقفِ صفر (D-18): سیگنال ثبت می‌شود، تمدید ۰، و هشدار همچنان ست می‌شود', async () => {
    const r = await reservation(+5, { restaurant: capZeroRestaurantId });
    const res = await eta(r.code, { minutes: 20 });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.extension_minutes, 0);
    assert.equal(body.capped, true);
    const row = await lateRow(r.id);
    assert.ok(row.lateEtaSignaledAt);
    assert.ok(row.lateWarnedAt);
    assert.equal(body.deadline, new Date(row.slotStart.getTime() + 15 * 60_000).toISOString());
  });

  test('اعتبارسنجی: ۰، ۳۱، اعشار و رشته‌ی غیرعددی → ۴۲۲', async () => {
    // رشته‌ی عددی («10») عمداً پذیرفته می‌شود — «پذیرشِ نرمِ رشته‌ی عددی» در lib/validate.ts؛ این‌جا آزموده نمی‌شود.
    const r = await reservation(+5);
    for (const bad of [0, 31, 10.5, 'ده']) {
      const res = await eta(r.code, { minutes: bad });
      assert.equal(res.status, 422, `minutes=${JSON.stringify(bad)}`);
    }
    assert.equal((await lateRow(r.id)).lateEtaSignaledAt, null);
  });

  test('کدِ ناموجود → ۴۰۴ (کنترلِ غیابِ موضوع)', async () => {
    const res = await eta('RZAAAAAAA', { minutes: 10 });
    assert.equal(res.status, 404);
  });
});

describe('M-13 — دادهٔ دیرکرد به هر سه سطح می‌رسد، از همان guestDeadline', () => {
  test('/me/reservations: مهلت با تمدید، سقف، و وضعِ سیگنال', async () => {
    const r = await reservation(+5);
    assert.equal((await eta(r.code, { minutes: 10 })).status, 200);
    const res = await meReservations(new Request('http://x/api', { headers: { authorization: `Bearer ${customerToken}` } }));
    assert.equal(res.status, 200);
    const rows = await res.json() as Array<Record<string, any>>;
    const row = rows.find((x) => x.code === r.code);
    assert.ok(row, 'رزرو باید در پاسخ باشد');
    const slot = Date.parse(row.slotStart);
    assert.equal(row.late.deadline, new Date(slot + 25 * 60_000).toISOString(), 'slot + grace(15) + تمدید(10)');
    assert.equal(row.late.graceMinutes, 15);
    assert.equal(row.late.maxExtensionMinutes, 15);
    assert.equal(row.lateExtensionMinutes, 10);
    assert.ok(row.lateEtaSignaledAt);
  });

  test('/restaurant/reservations: no_show_allowed_at همان مهلتِ گیت، و دقیقه‌های سیگنال', async () => {
    const signaled = await reservation(+5);
    const silent = await reservation(+6);
    assert.equal((await eta(signaled.code, { minutes: 10 })).status, 200);
    const res = await restaurantReservations(new Request('http://x/api?date=all', { headers: staffHeaders() }), {} as never);
    assert.equal(res.status, 200);
    const list = (await res.json()).reservations as Array<Record<string, any>>;
    const a = list.find((x) => x.code === signaled.code)!;
    const b = list.find((x) => x.code === silent.code)!;
    assert.ok(a && b, 'هر دو رزرو باید در فهرستِ پنل باشند');
    assert.equal(a.no_show_allowed_at, new Date(Date.parse(a.slot_start) + 25 * 60_000).toISOString());
    assert.equal(a.late_eta_minutes, 10);
    assert.equal(b.no_show_allowed_at, new Date(Date.parse(b.slot_start) + 15 * 60_000).toISOString());
    assert.equal(b.late_eta_minutes, null, 'بدونِ سیگنال null است، نه ۰');
  });

  test('صفحه‌ی عمومیِ رستوران: booking_policy.late_grace_minutes', async () => {
    const slug = (await db.restaurant.findUniqueOrThrow({ where: { id: capZeroRestaurantId }, select: { slug: true } })).slug;
    const res = await restaurantDetail(new Request('http://x/api'), { params: Promise.resolve({ slug }) } as never);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.booking_policy.late_grace_minutes, 15);
  });

  test('زنگوله‌ی پنل «مهمان دیرتر می‌رسد» را با کدِ رزرو نشان می‌دهد', async () => {
    const r = await reservation(+5);
    assert.equal((await eta(r.code, { minutes: 10 })).status, 200);
    const res = await bell(new Request('http://x/api', { headers: staffHeaders() }), {} as never);
    assert.equal(res.status, 200);
    const items = (await res.json()).items as Array<{ title: string; text: string }>;
    const hit = items.find((i) => i.title === 'مهمان دیرتر می‌رسد' && i.text.includes(r.code));
    assert.ok(hit, 'سیگنالِ مهمان باید پیش از رسیدنِ مهلت در زنگوله باشد');
    assert.match(hit!.text, /۱۰|10/);
  });
});

describe('D-18 — تنظیمِ مهلت و سقف در routeِ سیاستِ لغو', () => {
  const base = { free_cancel_hours: 24, partial_penalty_hours: 2, partial_penalty_pct: 50, deposit_required: false, auto_confirm: true };
  const put = (body: unknown) => policyRoute.PUT(new Request('http://x/api', {
    method: 'PUT', headers: staffHeaders(capZeroRestaurantId), body: JSON.stringify(body),
  }), {} as never);

  test('GET هر دو فیلد را برمی‌گرداند', async () => {
    const res = await policyRoute.GET(new Request('http://x/api', { headers: staffHeaders(capZeroRestaurantId) }), {} as never);
    const body = await res.json();
    assert.equal(body.late_grace_minutes, 15);
    assert.equal(body.max_late_extension_minutes, 0);
  });

  test('بیرون از بازه → ۴۲۲ و مقدار دست نمی‌خورد', async () => {
    for (const bad of [{ late_grace_minutes: 9 }, { late_grace_minutes: 61 }, { max_late_extension_minutes: 31 }, { max_late_extension_minutes: -1 }]) {
      const res = await put({ ...base, ...bad });
      assert.equal(res.status, 422, JSON.stringify(bad));
    }
    const row = await db.restaurant.findUniqueOrThrow({ where: { id: capZeroRestaurantId }, select: { lateGraceMinutes: true, maxLateExtensionMinutes: true } });
    assert.deepEqual(row, { lateGraceMinutes: 15, maxLateExtensionMinutes: 0 });
  });

  test('داخلِ بازه ذخیره می‌شود؛ PUTِ بدونِ این دو فیلد (پنلِ قدیمی) آن‌ها را عوض نمی‌کند', async () => {
    try {
      const res = await put({ ...base, late_grace_minutes: 30, max_late_extension_minutes: 5 });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.late_grace_minutes, 30);
      assert.equal(body.max_late_extension_minutes, 5);
      const legacy = await put(base);
      assert.equal(legacy.status, 200);
      const after = await legacy.json();
      assert.equal(after.late_grace_minutes, 30, 'پنلی که فیلد را نمی‌فرستد نباید آن را به پیش‌فرض برگرداند');
      assert.equal(after.max_late_extension_minutes, 5);
    } finally {
      await db.restaurant.update({ where: { id: capZeroRestaurantId }, data: { lateGraceMinutes: 15, maxLateExtensionMinutes: 0 } });
    }
  });
});

after(async () => {
  // ۰۸۹/FP-009: رزروِ no_show ردیفِ دفترِ اقتصاد دارد؛ حذف‌ها با catch، دیتابیسِ هر اجرا تازه است.
  for (const rid of [restaurantId, capZeroRestaurantId]) {
    await db.reservation.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
    await db.table.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
    await db.restaurant.delete({ where: { id: rid } }).catch(() => {});
  }
  await db.tenant.delete({ where: { id: tenantId } }).catch(() => {});
});
