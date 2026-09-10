import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testIp } from './helpers/test-ip.mts';
import { buildTzFixture } from './helpers/tz-fixture.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رفعِ T2 — «امروزِ» پنلِ رستوران باید به وقتِ **رستوران** باشد، نه سرور
//
//  باگ (`api/src/app/api/v1/restaurant/reservations/route.ts`، قبل از رفع):
//  `filter === 'today'` با `new Date()` و `setHours(0,0,0,0)` مرزِ روز را
//  در تایم‌زونِ **پروسه‌ی Node** می‌ساخت. `Restaurant.timezone` (پیش‌فرض
//  «Asia/Tehran»، schema.prisma:164) هرگز خوانده نمی‌شد. اگر سرور UTC اجرا
//  شود (پیش‌فرضِ کانتینر) و رستوران +۳:۳۰ باشد، از ۲۰:۳۰ تا نیمه‌شبِ
//  تهران، «امروزِ» پنل هنوز دیروزِ UTC است — همان کلاسِ باگِ ۷۵eb9df
//  («تاریخی که کارمند می‌بیند ≠ تاریخِ ثبت‌شده»).
//
//  چرا یک sleep تا ۲۰:۳۰ کافی نیست: قطعیت لازم است، نه شانس. این فایل به‌جایِ
//  صبرکردن برایِ ساعتِ واقعی، با `t.mock.timers` (مضاعف: فقط `Date`، نه
//  تایمرها — پس رِدیس/پریزما دست‌نخورده می‌مانند) ساعتِ فرآیند را روی یک
//  لحظه‌ی محاسبه‌شده (`helpers/tz-fixture.mts`) منجمد می‌کند و مرزِ ~نیمه‌شبِ
//  رستوران را واقعاً عبور می‌دهد. `t.mock.timers` به‌صورتِ خودکار بعدِ هر
//  تست ریست می‌شود (تأییدشده با آزمایشِ مستقلِ دومتستی — رجوع کن به گزارش)
//  پس نشتی به تست‌های بعدیِ همین پروسه‌ی مشترک (`_all.runner.mts`) ندارد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const reservationsRoute = await import('../src/app/api/v1/restaurant/reservations/route');

const TAG = `rtz-${randomUUID().slice(0, 8)}`;
let tenantId = '', restaurantId = '', staffId = '';
let reservationCode = '';
let reservationSlot!: Date;   // نیمه‌شبِ «امروزِ» رستوران (شروعِ بازه‌ی صحیح)
let fakedNow!: Date;          // ~۲۳:۵۵ به وقتِ رستوران، همان روزِ تقویمی

before(async () => {
  const fx = buildTzFixture();
  reservationSlot = fx.reservationSlot;
  fakedNow = fx.fakedNow;

  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: TAG, name: '[DEMO] رستورانِ تایم‌زونِ تست', timezone: fx.tz, clubPrefix: 'RTZ', isOpen: true },
    select: { id: true },
  });
  restaurantId = r.id;
  const staff = await db.staff.create({
    data: { tenantId, phone: `+9891${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13), role: 'owner', isActive: true },
    select: { id: true },
  });
  const table = await db.table.create({ data: { restaurantId, number: 1, capacity: 4, isActive: true }, select: { id: true } });
  reservationCode = `RTZ-${TAG.slice(-6).toUpperCase()}`;
  await db.reservation.create({
    data: {
      restaurantId, code: reservationCode, partySize: 2,
      slotStart: reservationSlot, slotEnd: new Date(+reservationSlot + 90 * 60_000),
      status: 'confirmed', tableId: table.id, guestName: '[DEMO] مهمانِ تایم‌زون', guestPhone: `+9892${TAG.slice(-8)}`,
      source: 'app',
    },
  });

  // توکن **بعدِ** فعال‌شدنِ ساعتِ جعلی امضا می‌شود (در هر تست جداگانه)، نه
  // اینجا — چون jsonwebtoken برایِ iat/exp از Date.now() واقعی/جعلی همان
  // لحظه استفاده می‌کند و باید با ساعتی که verify هم می‌بیند یکی باشد.
  staffId = staff.id;
});

after(async () => {
  await db.reservation.deleteMany({ where: { restaurantId } });
  await db.table.deleteMany({ where: { restaurantId } });
  await db.staff.deleteMany({ where: { tenantId } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
});

function reqWithQuery(token: string, qs = ''): Request {
  return new Request(`http://x/api/v1/restaurant/reservations${qs}`, {
    method: 'GET',
    headers: { 'x-real-ip': testIp(), authorization: `Bearer ${token}` },
  });
}

/**
 * ساعتِ فرآیند را روی `fakedNow` منجمد می‌کند، توکن را **زیرِ همان ساعت**
 * امضا می‌کند (iat/exp با لحظه‌ای که verify هم می‌بیند یکی بماند)، روتِ
 * واقعی را صدا می‌زند، و در پایان ساعت را ریست می‌کند.
 */
async function askFrozen(t: any, qs = ''): Promise<{ status: number; body: any }> {
  t.mock.timers.enable({ apis: ['Date'], now: fakedNow });
  const token = signAccess({ sub: staffId, kind: 'staff', tenantId, role: 'owner' });
  const res = await reservationsRoute.GET(reqWithQuery(token, qs) as any);
  const body = await res.json();
  t.mock.timers.reset();
  return { status: res.status, body };
}

describe('T2 — فیلترِ «امروز»ِ رزروهایِ رستوران باید به وقتِ رستوران باشد', () => {
  test('date=today (پیش‌فرض) رزروِ «امروزِ رستوران» را برمی‌گرداند، حتی وقتی سرور روزِ دیگری است', async (t) => {
    const { status, body } = await askFrozen(t, '');
    assert.equal(status, 200, JSON.stringify(body).slice(0, 300));
    const codes = (body.reservations ?? []).map((r: any) => r.code);
    assert.ok(codes.includes(reservationCode),
      `انتظار می‌رفت رزروِ ${reservationCode} در «امروز» باشد؛ فهرست: ${JSON.stringify(codes)}`);
  });

  test('date=tomorrow آن را شامل نمی‌شود (مرزها همپوشان نیستند)', async (t) => {
    const { status, body } = await askFrozen(t, '?date=tomorrow');
    assert.equal(status, 200, JSON.stringify(body).slice(0, 300));
    const codes = (body.reservations ?? []).map((r: any) => r.code);
    assert.ok(!codes.includes(reservationCode), `رزروِ «امروز» نباید در «فردا» هم ظاهر شود: ${JSON.stringify(codes)}`);
  });

  test('date=past آن را شامل نمی‌شود (بدونِ شکاف/همپوشانی با past)', async (t) => {
    const { status, body } = await askFrozen(t, '?date=past');
    assert.equal(status, 200, JSON.stringify(body).slice(0, 300));
    const codes = (body.reservations ?? []).map((r: any) => r.code);
    assert.ok(!codes.includes(reservationCode), `رزروِ «امروز» نباید در «past» هم ظاهر شود: ${JSON.stringify(codes)}`);
  });

  test('date=upcoming آن را شامل نمی‌شود', async (t) => {
    const { status, body } = await askFrozen(t, '?date=upcoming');
    assert.equal(status, 200, JSON.stringify(body).slice(0, 300));
    const codes = (body.reservations ?? []).map((r: any) => r.code);
    assert.ok(!codes.includes(reservationCode), `رزروِ «امروز» نباید در «upcoming» هم ظاهر شود: ${JSON.stringify(codes)}`);
  });
});
