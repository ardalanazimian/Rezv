import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildTzFixture } from './helpers/tz-fixture.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رفعِ T2 (نیمه‌ی دوم) — `assistant-answers.ts`:`answerReservationsForDay`
//
//  همان کلاسِ باگِ روتِ reservations، جایِ دیگر: `دستیار` وقتی به «امروز
//  چند رزرو داریم؟» جواب می‌دهد، از `dayRange(offsetDays)` استفاده می‌کرد
//  که با `new Date()` + `setHours(0,0,0,0)` مرزِ روز را در تایم‌زونِ
//  پروسه‌ی سرور می‌ساخت — دقیقاً همان نقصی که در روتِ reservations رفع شد.
//  اینجا مستقیماً `generateAnswer('reservations_today', …, timezone)` را
//  صدا می‌زنیم (نه از راهِ HTTP/JWT — این تابع منطقِ خالص‌تری دارد و به
//  auth نیاز ندارد) و می‌سنجیم که رزروِ «امروزِ رستوران» در شمارش بیاید.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { generateAnswer } = await import('../src/lib/assistant-answers.ts');

const TAG = `aatz-${randomUUID().slice(0, 8)}`;
let tenantId = '', restaurantId = '';
let reservationSlot!: Date;
let fakedNow!: Date;
let restaurantTz = '';

before(async () => {
  const fx = buildTzFixture();
  reservationSlot = fx.reservationSlot;
  fakedNow = fx.fakedNow;
  restaurantTz = fx.tz;

  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: TAG, name: '[DEMO] رستورانِ دستیارِ تایم‌زون', timezone: restaurantTz, clubPrefix: 'AAT', isOpen: true },
    select: { id: true },
  });
  restaurantId = r.id;
  const table = await db.table.create({ data: { restaurantId, number: 1, capacity: 4, isActive: true }, select: { id: true } });
  await db.reservation.create({
    data: {
      restaurantId, code: `AAT-${TAG.slice(-6).toUpperCase()}`, partySize: 2,
      slotStart: reservationSlot, slotEnd: new Date(+reservationSlot + 90 * 60_000),
      status: 'confirmed', tableId: table.id, guestName: '[DEMO] مهمان', guestPhone: `+9892${TAG.slice(-8)}`,
      source: 'app',
    },
  });
});

after(async () => {
  await db.reservation.deleteMany({ where: { restaurantId } });
  await db.table.deleteMany({ where: { restaurantId } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
});

describe('T2 — پاسخِ دستیار به «امروز چند رزرو داریم» باید به وقتِ رستوران باشد', () => {
  test('reservations_today رزروِ «امروزِ رستوران» را می‌شمارد، حتی وقتی سرور روزِ دیگری است', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: fakedNow });
    const answer = await generateAnswer('reservations_today', restaurantId, [], restaurantTz);
    t.mock.timers.reset();
    assert.ok(!answer.includes('فعلاً هیچ رزروِ فعالی'),
      `انتظار می‌رفت دستیار ۱ رزروِ فعال برایِ «امروز» بشمارد؛ پاسخِ واقعی: «${answer}»`);
    assert.match(answer, /۱ رزرو/, `پاسخِ دستیار عددِ درست را نگفت: «${answer}»`);
  });

  test('reservations_tomorrow آن را نمی‌شمارد (مرزها همپوشان نیستند)', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: fakedNow });
    const answer = await generateAnswer('reservations_tomorrow', restaurantId, [], restaurantTz);
    t.mock.timers.reset();
    assert.ok(answer.includes('فعلاً هیچ رزروِ فعالی'),
      `رزروِ «امروزِ رستوران» نباید در شمارشِ «فردا» هم بیاید: «${answer}»`);
  });
});
