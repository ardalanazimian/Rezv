import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ «دفترِ امتیاز تنها مرجع است» (فازِ ۲، پروتکل §۱۳ — P1-6)
//
//  باگِ اول (واگراییِ دو عدد): تنها جایی که امتیازِ باشگاه داده می‌شد
//  (markArrival) مستقیماً `club_members.points` را increment می‌کرد و هیچ
//  ردیفی در PointsLedger نمی‌ساخت. نتیجه: SMSِ خوش‌آمد عددِ ستونی را می‌گفت،
//  ولی اپِ مشتری (getPointsBalance) و فهرستِ اعضایِ پنل هردو از دفتر می‌خواندند
//  — یعنی آن ۵۰ امتیاز برایِ خودِ مشتری نامرئی بود و هیچ ردِ حسابرسی نداشت.
//
//  باگِ دوم (رقابتِ دوباره‌دادن): «آیا این بارِ اول است؟» با یک readِ *قبل از*
//  انتقال تصمیم گرفته می‌شد. دو چک‌این هم‌زمان هردو وضعیتِ قبلی را می‌دیدند و
//  هردو امتیاز می‌دادند. حالا به `changed`ِ خودِ تراکنشِ انتقال گره خورده.
//
//  باگِ سوم (اسکوپِ اشتباه): GET /restaurant/members جمعِ دفتر را **بدونِ**
//  فیلترِ رستوران می‌گرفت، یعنی موجودیِ کلِ پلتفرمِ کاربر را به‌عنوانِ
//  «امتیازِ او در باشگاهِ این رستوران» به پرسنل نشان می‌داد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { markArrival } = await import('../src/lib/reservations.ts');
const { getClubPointsBalance, getPointsBalance } = await import('../src/lib/loyalty.ts');

const SFX = Date.now().toString(36);
let tenantId = '';
let restaurantA = '';
let restaurantB = '';
let userId = '';

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] tenant club-points ${SFX}` } });
  tenantId = t.id;
  const a = await db.restaurant.create({
    data: { tenantId, slug: `clubA-${SFX}`, name: '[DEMO] رستورانِ الف', clubPrefix: 'CLA' },
  });
  const b = await db.restaurant.create({
    data: { tenantId, slug: `clubB-${SFX}`, name: '[DEMO] رستورانِ ب', clubPrefix: 'CLB' },
  });
  restaurantA = a.id; restaurantB = b.id;
  const u = await db.user.create({
    data: { phone: `+9891200${SFX.slice(-5)}`, firstName: '[DEMO]', lastName: 'عضو' },
  });
  userId = u.id;
  await db.clubMember.create({ data: { restaurantId: restaurantA, userId, code: `CLA${SFX.slice(-4)}` } });
  await db.clubMember.create({ data: { restaurantId: restaurantB, userId, code: `CLB${SFX.slice(-4)}` } });
});

after(async () => {
  await db.pointsLedger.deleteMany({ where: { userId } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId: { in: [restaurantA, restaurantB] } } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { userId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

let seq = 0;
async function seedConfirmed(restaurantId: string) {
  seq += 1;
  const now = new Date();
  return db.reservation.create({
    data: {
      restaurantId, userId,
      code: `RZCLB${String(seq).padStart(2, '0')}`,
      guestName: '[DEMO] مهمان', guestPhone: null,
      partySize: 2,
      slotStart: new Date(+now - 10 * 60_000),
      slotEnd: new Date(+now + 60 * 60_000),
      status: 'confirmed' as never,
    },
  });
}

describe('امتیازِ باشگاه از مسیرِ دفتر (§۱۳)', () => {
  test('چک‌این یک ردیفِ دفتر با restaurant_id و reason می‌سازد', async () => {
    const resv = await seedConfirmed(restaurantA);
    const before = await db.pointsLedger.count({ where: { userId, restaurantId: restaurantA } });

    await markArrival({ code: resv.code, restaurantId: restaurantA, actorStaffId: 'staff-test' });

    const rows = await db.pointsLedger.findMany({
      where: { userId, restaurantId: restaurantA },
      orderBy: { createdAt: 'desc' }, take: 1,
    });
    assert.equal(
      await db.pointsLedger.count({ where: { userId, restaurantId: restaurantA } }),
      before + 1,
      'باید دقیقاً یک ردیفِ دفتر اضافه شده باشد',
    );
    assert.equal(rows[0].delta, 50, 'مقدارِ امتیازِ حضور');
    assert.equal(rows[0].restaurantId, restaurantA, 'ردیف باید به رستوران نسبت داده شود');
    assert.ok(rows[0].note?.includes(resv.code), 'یادداشت باید کدِ رزرو را داشته باشد (قابلِ حسابرسی)');
  });

  test('کشِ ستونی با دفتر واگرا نمی‌شود', async () => {
    const member = await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId: restaurantA, userId } },
      select: { points: true },
    });
    const ledger = await getClubPointsBalance(userId, restaurantA);
    assert.equal(member?.points, ledger, 'club_members.points باید با جمعِ دفترِ همان رستوران برابر باشد');
  });

  test('موجودی به رستوران اسکوپ می‌شود — امتیازِ الف به ب نشت نمی‌کند', async () => {
    const a = await getClubPointsBalance(userId, restaurantA);
    const b = await getClubPointsBalance(userId, restaurantB);
    assert.ok(a > 0, 'رستورانِ الف باید امتیاز داشته باشد');
    assert.equal(b, 0, 'رستورانِ ب که چک‌این نداشته باید صفر باشد');

    // موجودیِ پلتفرمی عمداً جمعِ همه است — این دو مفهومِ متفاوت‌اند و نباید
    // یکی به‌جایِ دیگری نمایش داده شود (همان باگِ فهرستِ اعضا).
    assert.equal(await getPointsBalance(userId), a + b, 'موجودیِ پلتفرمی = جمعِ همه‌ی رستوران‌ها');
  });

  test('چک‌ین تکراری امتیازِ دوباره نمی‌دهد (idempotent)', async () => {
    const resv = await seedConfirmed(restaurantA);
    await markArrival({ code: resv.code, restaurantId: restaurantA, actorStaffId: 's1' });
    const afterFirst = await getClubPointsBalance(userId, restaurantA);

    await markArrival({ code: resv.code, restaurantId: restaurantA, actorStaffId: 's1' });
    assert.equal(await getClubPointsBalance(userId, restaurantA), afterFirst, 'تکرار نباید امتیاز اضافه کند');
  });

  test('دو چک‌ینِ هم‌زمان فقط یک‌بار امتیاز می‌دهند (رقابت)', async () => {
    const resv = await seedConfirmed(restaurantA);
    const before = await getClubPointsBalance(userId, restaurantA);

    // همان سناریویِ واقعی: اسکنِ QR و دکمه‌ی پرسنل در یک لحظه.
    const results = await Promise.allSettled([
      markArrival({ code: resv.code, restaurantId: restaurantA, actorStaffId: 'qr' }),
      markArrival({ code: resv.code, restaurantId: restaurantA, actorStaffId: 'staff' }),
    ]);
    assert.ok(results.some(r => r.status === 'fulfilled'), 'حداقل یکی باید موفق شود');

    const after = await getClubPointsBalance(userId, restaurantA);
    assert.equal(after - before, 50, `فقط یک‌بار ۵۰ امتیاز، نه دوبار — اختلاف: ${after - before}`);
  });
});
