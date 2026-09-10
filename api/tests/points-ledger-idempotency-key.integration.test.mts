import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  فازِ ۱ (پروتکل §۱۳) — PHASE1-LEDGER-EVIDENCE — ستونِ `idempotency_key`
//
//  زمینه: `points_ledger` قبلاً هیچ `@@unique`ای نداشت. idempotencyِ اعطای
//  امتیازِ چک‌این فقط از یک compare-and-setِ اپلیکیشنی در `lifecycle.ts`
//  می‌آمد — که با تستِ واقعی (`checkin-points-panel-path.integration` و
//  توصیف‌گرِ «اثباتِ idempotency» در همان فایل) درست ثابت شد کار می‌کند.
//  ولی آن ضامن فقط برای مسیرِ چک‌ین بود؛ نویسنده‌هایِ دیگرِ ledger
//  (referral، cashback، birthday/anniversary) هرکدام ضامنِ خودشان را
//  داشتند یا اصلاً نداشتند (cashback — رجوع کن به یافته‌یِ گزارش).
//
//  تصمیمِ مالک (۲۰۲۶-۰۹-۰۹): یک ستونِ صریحِ `idempotency_key` (nullable) +
//  یک ایندکسِ `UNIQUE` معمولی رویِ همان ستون (migration ۰۸۱ — عیناً الگویِ
//  از قبل موجودِ `Job.idempotencyKey` در همین schema؛ NULL در Postgres با
//  NULL برابر شمرده نمی‌شود، پس نیازی به WHERE/partial نیست) به‌عنوانِ
//  لایه‌ی دومِ ساختاریِ سطحِ DB برایِ **همه‌ی** نویسنده‌ها — نه فقط چک‌ین.
//
//  این فایل دو چیز را اثبات می‌کند که هیچ‌جایِ دیگر اثبات نشده بود:
//   ۱. خودِ قید در DB واقعاً کار می‌کند (falsifiability: حذفِ ایندکس →
//      insertِ دوم موفق می‌شود → بازگردانی → insertِ دوم P2002 می‌گیرد).
//   ۲. هر نویسنده‌ی واقعیِ ledger (نه فقط چک‌ین) واقعاً یک کلیدِ درست
//      می‌سازد — از جمله مسیرِ کش‌بک (`reservations.ts:615`) که پیش از این
//      تغییر **هیچ پوششِ تستی** نداشت (`grep cashback tests/*.mts` فقط
//      روتِ پیکربندیِ کش‌بک را می‌زد، نه خودِ نوشتنِ ledger).
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { fixturePhone } = await import('./_phone.helper.mts');
const { addPoints, addClubPoints, createReferral, completeReferral } = await import('../src/lib/loyalty.ts');
const { createReservation } = await import('../src/lib/reservations.ts');
const { weekdayInTz, dateKeyInTz } = await import('../src/lib/hours');

const TAG = `plik-${randomUUID().slice(0, 8)}`;
const SLOT_DATE = dateKeyInTz(new Date(Date.now() + 31 * 86_400_000), 'Asia/Tehran');
const SLOT_TIME = '19:00';

let tenantId = '';
let restaurantId = '';
let userId = '';
let referrerId = '';
let cashbackUserId = '';
let menuItemId = '';

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-r`, name: `[DEMO] ${TAG}`, timezone: 'Asia/Tehran',
      clubPrefix: 'PLK', isOpen: true, onlineGating: false,
    },
  });
  restaurantId = r.id;
  await db.table.create({ data: { restaurantId, number: 1, capacity: 4, isActive: true } });

  const u = await db.user.create({
    data: { phone: fixturePhone('0955'), firstName: '[DEMO]', lastName: 'کلیدِ دفتر' },
  });
  userId = u.id;
  await db.clubMember.create({ data: { restaurantId, userId, code: `PLK-${TAG.slice(-4)}` } });

  const ref = await db.user.create({
    data: { phone: fixturePhone('0956'), firstName: '[DEMO]', lastName: 'دعوت‌کننده' },
  });
  referrerId = ref.id;

  const cbUser = await db.user.create({
    data: { phone: fixturePhone('0957'), firstName: '[DEMO]', lastName: 'کش‌بک' },
  });
  cashbackUserId = cbUser.id;

  const item = await db.menuItem.create({
    data: { restaurantId, name: `[DEMO] آیتم ${TAG}`, priceToman: 200_000 },
  });
  menuItemId = item.id;
  void weekdayInTz; // فقط برای همسانی با الگویِ preorder-validation؛ این‌جا لازم نیست
});

after(async () => {
  await db.pointsLedger.deleteMany({ where: { userId: { in: [userId, referrerId, cashbackUserId] } } }).catch(() => {});
  await db.referral.deleteMany({ where: { referrerId } }).catch(() => {});
  await db.reservationItem.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.menuItem.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.customerEconomyProfile.deleteMany({ where: { userId: { in: [userId, referrerId, cashbackUserId] } } }).catch(() => {});
  await db.economyLedgerEntry.deleteMany({ where: { userId: { in: [userId, referrerId, cashbackUserId] } } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: [userId, referrerId, cashbackUserId] } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('ستونِ idempotency_key — قیدِ واقعی در DB (فازِ ۱، §۱۳)', () => {
  test('🔴 دو insertِ مستقیم با همان کلید → دومی P2002 می‌گیرد (اثباتِ ساختاری، نه رفتاری)', async () => {
    const key = `test:${TAG}:direct`;
    await db.pointsLedger.create({
      data: { userId, restaurantId, delta: 1, reason: 'adjustment', note: '[DEMO] اول', idempotencyKey: key },
    });
    await assert.rejects(
      db.pointsLedger.create({
        data: { userId, restaurantId, delta: 1, reason: 'adjustment', note: '[DEMO] دوم', idempotencyKey: key },
      }),
      (e: any) => e.code === 'P2002',
      'insertِ دوم با همان کلید باید unique_violation بدهد',
    );
    const rows = await db.pointsLedger.count({ where: { idempotencyKey: key } });
    assert.equal(rows, 1, 'فقط یک ردیف باید با این کلید مانده باشد');
  });

  test('🔴 falsifiability: حذفِ ایندکس → insertِ دوم موفق می‌شود (قرمز) → بازگردانی → دوباره P2002 (سبز)', async () => {
    const key = `test:${TAG}:falsifiability`;
    await db.pointsLedger.create({
      data: { userId, restaurantId, delta: 1, reason: 'adjustment', note: '[DEMO] اول', idempotencyKey: key },
    });

    // ── قرمز: ایندکس را موقتاً حذف کن ──
    await db.$executeRawUnsafe('DROP INDEX IF EXISTS points_ledger_idempotency_key_key');
    let secondSucceeded = false;
    try {
      await db.pointsLedger.create({
        data: { userId, restaurantId, delta: 1, reason: 'adjustment', note: '[DEMO] دوم-بدونِ-قید', idempotencyKey: key },
      });
      secondSucceeded = true;
    } finally {
      const rowsWithoutIndex = await db.pointsLedger.count({ where: { idempotencyKey: key } });
      assert.equal(secondSucceeded, true, 'بدونِ ایندکس، insertِ دوم باید موفق شود — این خودِ اثباتِ قرمز است');
      assert.equal(rowsWithoutIndex, 2, 'بدونِ ایندکس، دو ردیفِ تکراری واقعاً ساخته می‌شوند (باگی که قید باید جلویش را بگیرد)');

      // ── بازگردانی: دوباره‌سازیِ همان ایندکس (عیناً migration 081 — UNIQUE
      // معمولی، بدونِ WHERE؛ NULL در Postgres با NULL برابر شمرده نمی‌شود) ──
      await db.pointsLedger.deleteMany({ where: { idempotencyKey: key } }); // پاک‌سازیِ ردیفِ تکراریِ حالتِ قرمز
      await db.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS points_ledger_idempotency_key_key ON points_ledger (idempotency_key)',
      );
    }

    // ── سبز: با ایندکسِ بازگردانده‌شده، دوباره همان سناریو ──
    await db.pointsLedger.create({
      data: { userId, restaurantId, delta: 1, reason: 'adjustment', note: '[DEMO] اول-دوباره', idempotencyKey: key },
    });
    await assert.rejects(
      db.pointsLedger.create({
        data: { userId, restaurantId, delta: 1, reason: 'adjustment', note: '[DEMO] دوم-دوباره', idempotencyKey: key },
      }),
      (e: any) => e.code === 'P2002',
      'بعدِ بازگردانیِ ایندکس، insertِ دوم باید دوباره unique_violation بدهد',
    );
    const finalRows = await db.pointsLedger.count({ where: { idempotencyKey: key } });
    assert.equal(finalRows, 1, 'با ایندکسِ سالم، فقط یک ردیف می‌ماند');
  });

  test('NULL با NULL تداخل نمی‌کند — چند ردیفِ بدونِ کلید مجاز است (تصمیمِ nullable)', async () => {
    await db.pointsLedger.create({
      data: { userId, restaurantId, delta: 1, reason: 'adjustment', note: '[DEMO] بی‌کلیدِ ۱', idempotencyKey: null },
    });
    await db.pointsLedger.create({
      data: { userId, restaurantId, delta: 1, reason: 'adjustment', note: '[DEMO] بی‌کلیدِ ۲', idempotencyKey: null },
    });
    const nullRows = await db.pointsLedger.count({ where: { userId, restaurantId, idempotencyKey: null } });
    assert.ok(nullRows >= 2, 'UNIQUE معمولیِ Postgres نباید NULLها را با هم یکتا بشمارد');
  });

  test('addPoints/addClubPoints پارامترِ idempotencyKey را عیناً به ستون می‌رسانند', async () => {
    const k1 = `test:${TAG}:addPoints`;
    await addPoints({ userId, delta: 1, reason: 'adjustment', note: '[DEMO]', idempotencyKey: k1 });
    const row1 = await db.pointsLedger.findFirst({ where: { idempotencyKey: k1 } });
    assert.equal(row1?.idempotencyKey, k1);

    const k2 = `test:${TAG}:addClubPoints`;
    await addClubPoints({ userId, restaurantId, delta: 1, reason: 'adjustment', note: '[DEMO]', idempotencyKey: k2 });
    const row2 = await db.pointsLedger.findFirst({ where: { idempotencyKey: k2 } });
    assert.equal(row2?.idempotencyKey, k2);
  });
});

describe('نویسنده‌هایِ واقعی — هرکدام کلیدِ درست می‌سازند (فازِ ۱، §۱۳)', () => {
  test('🔴 referral: کلید = referral:{referral.id}', async () => {
    const phone = fixturePhone('0958');
    await createReferral(referrerId, phone);
    const before = await db.pointsLedger.count({ where: { userId: referrerId } });

    const ref = await db.referral.findFirst({ where: { referrerId, inviteePhone: phone } });
    assert.ok(ref, 'پیش‌شرط: ردیفِ دعوت باید ساخته شده باشد');

    const invitee = await db.user.create({
      data: { phone: fixturePhone('0959'), firstName: '[DEMO]', lastName: 'دعوت‌شده' },
    });
    const result = await completeReferral(phone, invitee.id);
    assert.ok(result?.rewarded, 'پاداش باید داده شود');

    const rows = await db.pointsLedger.findMany({ where: { userId: referrerId }, orderBy: { createdAt: 'desc' }, take: 1 });
    assert.equal(await db.pointsLedger.count({ where: { userId: referrerId } }), before + 1, 'دقیقاً یک ردیفِ دفتر');
    assert.equal(rows[0].idempotencyKey, `referral:${ref!.id}`, 'کلید باید به خودِ ردیفِ referral گره بخورد');

    await db.user.deleteMany({ where: { id: invitee.id } }).catch(() => {});
  });

  test('🔴 cashback (reservations.ts:615): کلید = cashback:{reservationId} — مسیری که قبلاً هیچ تستی نداشت', async () => {
    const before = await db.pointsLedger.count({ where: { userId: cashbackUserId, restaurantId } });

    const resv = await createReservation({
      restaurantId, date: SLOT_DATE, time: SLOT_TIME, partySize: 2,
      userId: cashbackUserId, source: 'app', notifySms: false,
      preorder: [{ menuItemId, qty: 1 }],
    });

    assert.ok(resv.checkout && resv.checkout.cashback > 0, `پیش‌شرط: cbBasePctِ پیش‌فرض (۵٪) باید کش‌بکِ مثبت بدهد — شد: ${JSON.stringify(resv.checkout)}`);

    // ⚠️ خروجیِ عمومیِ createReservation فقط `code` را برمی‌گرداند، نه `id`
    // (شکلِ قراردادیِ API) — idِ داخلی را از خودِ ردیفِ reservation می‌خوانیم
    // تا نشان دهیم کلید دقیقاً به همان ردیف گره خورده، نه به یک متنِ حدسی.
    const realResv = await db.reservation.findUnique({ where: { code: resv.code }, select: { id: true } });
    assert.ok(realResv, 'پیش‌شرط: رزرو باید واقعاً در DB باشد');

    const rows = await db.pointsLedger.findMany({
      where: { userId: cashbackUserId, restaurantId, reason: 'cashback' },
      orderBy: { createdAt: 'desc' }, take: 1,
    });
    assert.equal(
      await db.pointsLedger.count({ where: { userId: cashbackUserId, restaurantId } }), before + 1,
      'دقیقاً یک ردیفِ کش‌بک',
    );
    assert.equal(rows[0].delta, resv.checkout!.cashback);
    assert.equal(rows[0].idempotencyKey, `cashback:${realResv!.id}`, 'کلید باید به خودِ رزرو گره بخورد، نه به note');
  });
});
