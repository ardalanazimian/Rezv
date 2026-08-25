import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ «امتیازِ باشگاه از مسیرِ واقعیِ پنل» (فازِ ۲، پروتکل §۱۳/§۴)
//
//  ── باگِ ۱: تنها نویسنده‌ی دفترِ امتیاز از رابطِ کاربری دسترس‌ناپذیر بود ──
//  اندازه‌گیریِ زنده روی دو رزروِ همسان نشان داد:
//   • مسیرِ واقعیِ پنل (`apps/business/js/reservations.js:182` →
//     `PATCH /restaurant/reservations/:code/status` با `{status:'checked_in'}`):
//     انتقال HTTP 200 ولی `points_ledger` **صفر ردیف** و
//     `GET /me/points` → `{"balance":0,"history":[]}`.
//   • مسیرِ `POST /reservations/:code/arrive` (که `markArrival` را صدا می‌زند):
//     امتیاز می‌داد — ولی grep در `apps/business/js/` صفر فراخوانی داشت.
//  یعنی امتیاز فقط از مسیری داده می‌شد که هیچ کاربری آن را نمی‌زند.
//
//  رفع: hookِ امتیاز به `transitionReservation` — همان تابعی که خودش را
//  «تنها نقطه‌ی مجاز تغییر وضعیت» تعریف کرده — منتقل شد، نه به روتِ status
//  (که پیاده‌سازیِ دومِ موازی می‌ساخت) و نه با سیم‌کشیِ پنل به `/arrive`
//  (که سه مسیرِ دیگر را بی‌امتیاز می‌گذاشت).
//
//  ── باگِ ۲: `club_members.tier` هیچ نویسنده‌ای نداشت ──
//  `grep -rn "tier" api/src/ | grep -iE "update|upsert|set "` → صفر نتیجه.
//  ستون با `@default("bronze")` ساخته می‌شد و برای همیشه bronze می‌ماند —
//  در حالی که `waitlist.ts` اولویتِ صف و `restaurant/sms` سگمنتِ کمپین را
//  از همین ستون می‌خوانند.
//
//  ⚠️ این تست‌ها عمداً **روتِ واقعیِ پنل** را با `Request` واقعی صدا می‌زنند
//  (نه `markArrival` را) — چون دقیقاً همان لایه‌ای بود که باگ در آن زندگی
//  می‌کرد. تستی که `markArrival` را صدا می‌زد از قبل سبز بود و باگ را ندید.
// ═══════════════════════════════════════════════════════════════════════

import { fixturePhone } from './_phone.helper.mts';

// ⚠️ پیشوندِ ۰۹۲۱ مالِ همین فایل است — عوضش نکن و در فایلِ دیگری تکرارش نکن.
// برخوردِ شماره در رانرِ تک‌پروسه‌ای، hookِ `before` را می‌اندازد و node:test
// **کلِ** سوئیت را cancel می‌کند (شرح کامل در tests/_phone.helper.mts).
// این واقعاً همین‌جا رخ داد: نسخه‌ی اولِ این فایل شماره را دستی می‌ساخت و
// دو اجرای کاملِ سوئیت را با دو نشانه‌ی کاملاً متفاوت قرمز کرد.
const OWNER_PHONE_PREFIX = '0921';

const { db } = await import('../src/lib/db.ts');
const { redis } = await import('../src/lib/redis.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const { getClubPointsBalance } = await import('../src/lib/loyalty.ts');
const { markArrival } = await import('../src/lib/reservations.ts');
const { genReservationCode } = await import('../src/lib/reservation-helpers.ts');
const statusRoute = await import('../src/app/api/v1/restaurant/reservations/[code]/status/route.ts');
const membersRoute = await import('../src/app/api/v1/restaurant/members/route.ts');
const mePointsRoute = await import('../src/app/api/v1/me/points/route.ts');

const SFX = Date.now().toString(36).slice(-6);
let tenantId = '';
let restaurantId = '';
let staffToken = '';
let userId = '';
let customerToken = '';

const staffReq = (body: unknown) =>
  new Request('http://x/api', {
    method: 'PATCH',
    headers: { authorization: `Bearer ${staffToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const codeArg = (code: string) => ({ params: Promise.resolve({ code }) });

/** چک‌ینِ پنل — دقیقاً همان درخواستی که `apps/business/js/reservations.js` می‌فرستد. */
async function panelCheckIn(code: string) {
  return statusRoute.PATCH(staffReq({ status: 'checked_in' }), codeArg(code) as never);
}

async function seedConfirmed() {
  const now = new Date();
  // کدِ رزرو باید با `zReservationCode` بخواند (`^RZ[Base32]{7}$`) وگرنه روتِ
  // واقعی قبل از رسیدن به منطق، ۴۲۲ اعتبارسنجی می‌دهد و تست بی‌معنا می‌شود.
  return db.reservation.create({
    data: {
      restaurantId, userId,
      code: genReservationCode(),
      guestName: '[DEMO] مهمان', guestPhone: null,
      partySize: 2,
      slotStart: new Date(+now - 10 * 60_000),
      slotEnd: new Date(+now + 60 * 60_000),
      status: 'confirmed' as never,
    },
  });
}

/**
 * سطلِ `RULES.auth` سقفِ ۲۰ در دقیقه دارد و بینِ فایل‌ها مشترک است (همه با
 * IPِ «unknown»). این تابع فقط سطل‌هایی را که *خودِ این فایل* مصرف می‌کند
 * صفر می‌کند — عمداً `rl:chkin:*` را دست نمی‌زند تا تستِ ریت‌لیمیتِ چک‌ینِ QR
 * در فایلِ دیگر خراب نشود.
 *
 * ⚠️ `beforeEach` عمداً **داخلِ** describe است، نه سطحِ فایل: در این رانرِ
 * تک‌پروسه‌ای، هوکِ سطحِ فایل هوکِ ریشه می‌شود و قبل از *هر* تستِ سوئیت اجرا
 * می‌شود — که یعنی پاک‌کردنِ سطلِ تستِ ریت‌لیمیتِ دیگران.
 */
async function clearOwnRateLimits() {
  for (const p of ['rl:auth:*', 'rl:srch:*']) {
    const keys = await redis.keys(p);
    if (keys.length) await redis.del(...keys);
  }
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] tenant panel-checkin ${SFX}` } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: `zz-panelci-${SFX}`, name: '[DEMO] رستورانِ چک‌این', clubPrefix: 'PCI' },
  });
  restaurantId = r.id;
  const staff = await db.staff.create({
    data: {
      tenantId, phone: fixturePhone(OWNER_PHONE_PREFIX),
      role: 'owner', isActive: true,
    },
  });
  staffToken = signAccess({ sub: staff.id, kind: 'staff', tenantId, role: 'owner' });
  const u = await db.user.create({
    data: { phone: fixturePhone(OWNER_PHONE_PREFIX), firstName: '[DEMO]', lastName: 'عضو' },
  });
  userId = u.id;
  customerToken = signAccess({ sub: userId, kind: 'customer' });
  await db.clubMember.create({ data: { restaurantId, userId, code: `PCI-${SFX}` } });
});

after(async () => {
  await db.pointsLedger.deleteMany({ where: { userId } }).catch(() => {});
  await db.reservationEvent.deleteMany({
    where: { reservation: { restaurantId } },
  }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { userId } }).catch(() => {});
  await db.customerInsight.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.guestProfile.deleteMany({ where: { userId } }).catch(() => {});
  await db.customerEconomyProfile.deleteMany({ where: { userId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('امتیازِ حضور از مسیرِ واقعیِ پنل (§۱۳)', () => {
  beforeEach(clearOwnRateLimits);

  test('کنترلِ مثبت: PATCH .../status انتقال را واقعاً انجام می‌دهد', async () => {
    // بدونِ این، تستی که روتِ همیشه-۴۰۳ بگیرد هم می‌توانست «امتیاز صفر» را
    // به‌عنوانِ باگ گزارش کند. اول ثابت می‌کنیم سیمِ auth/RBAC/انتقال سالم است.
    const resv = await seedConfirmed();
    const res = await panelCheckIn(resv.code);
    // ⚠️ پیامِ assert نباید بدنه را مصرف کند (`await res.text()` بدنه را
    // می‌بندد و `res.json()`ِ بعدی «Body has already been read» می‌دهد).
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.status, 'checked_in');
    assert.equal(body.changed, true);
  });

  test('🔴 چک‌ینِ پنل یک ردیفِ دفتر با restaurant_id و کدِ رزرو می‌سازد', async () => {
    const resv = await seedConfirmed();
    const before = await db.pointsLedger.count({ where: { userId, restaurantId } });

    const res = await panelCheckIn(resv.code);
    assert.equal(res.status, 200);

    const rows = await db.pointsLedger.findMany({
      where: { userId, restaurantId }, orderBy: { createdAt: 'desc' }, take: 1,
    });
    assert.equal(
      await db.pointsLedger.count({ where: { userId, restaurantId } }), before + 1,
      'مسیرِ واقعیِ پنل باید دقیقاً یک ردیفِ دفتر بسازد (قبلاً صفر می‌ساخت)',
    );
    assert.equal(rows[0].delta, 50, 'امتیازِ حضور');
    assert.equal(rows[0].restaurantId, restaurantId, 'ردیف باید به همین رستوران نسبت داده شود');
    assert.ok(rows[0].note?.includes(resv.code), 'یادداشت باید کدِ رزرو را داشته باشد (حسابرسی‌پذیری)');
  });

  test('🔴 GET /me/points عددِ درست را به خودِ مشتری نشان می‌دهد', async () => {
    // این همان چیزی بود که در اندازه‌گیریِ زنده `{"balance":0,"history":[]}` بود.
    const expected = await db.pointsLedger.aggregate({ where: { userId }, _sum: { delta: true } });
    const res = await mePointsRoute.GET(
      new Request('http://x/api', { headers: { authorization: `Bearer ${customerToken}` } }),
      { params: Promise.resolve({}) } as never,
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.balance > 0, `مشتری باید موجودیِ واقعی ببیند، دید: ${body.balance}`);
    assert.equal(body.balance, expected._sum.delta ?? 0, 'موجودیِ API = جمعِ دفتر');
    assert.ok(body.history.length > 0, 'تاریخچه نباید خالی باشد');
  });

  test('🔴 چک‌ینِ تکراری از همان مسیر امتیازِ دوباره نمی‌دهد (idempotent)', async () => {
    const resv = await seedConfirmed();
    await panelCheckIn(resv.code);
    const afterFirst = await getClubPointsBalance(userId, restaurantId);

    const second = await panelCheckIn(resv.code);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).changed, false, 'انتقالِ دوم نباید چیزی عوض کند');
    assert.equal(
      await getClubPointsBalance(userId, restaurantId), afterFirst,
      'تکرار نباید امتیاز اضافه کند',
    );
  });

  test('🔴 arrive + status روی یک رزرو مجموعاً یک‌بار امتیاز می‌دهند', async () => {
    // ⚠️ خطرِ مستقیمِ این رفع: حالا هر دو مسیر امتیاز می‌دهند. اگر hook در هر
    // دو جا کپی می‌شد (روت + markArrival)، رزروی که هم `/arrive` و هم
    // `/status` بخورد دو بار امتیاز می‌گرفت. تنها ضامن، `changed`ِ اتمیک است.
    const resv = await seedConfirmed();
    const before = await getClubPointsBalance(userId, restaurantId);

    await markArrival({ code: resv.code, restaurantId, actorStaffId: 'staff-arrive' });
    await panelCheckIn(resv.code);

    assert.equal(
      (await getClubPointsBalance(userId, restaurantId)) - before, 50,
      'دو مسیرِ متفاوت روی یک رزرو = یک‌بار امتیاز',
    );
  });

  test('🔴 دو چک‌ینِ کاملاً هم‌زمان از مسیرِ پنل فقط یک‌بار امتیاز می‌دهند', async () => {
    const resv = await seedConfirmed();
    const before = await getClubPointsBalance(userId, restaurantId);

    const results = await Promise.allSettled([panelCheckIn(resv.code), panelCheckIn(resv.code)]);
    assert.ok(results.some(r => r.status === 'fulfilled'), 'حداقل یکی باید موفق شود');

    const delta = (await getClubPointsBalance(userId, restaurantId)) - before;
    assert.equal(delta, 50, `فقط یک‌بار ۵۰ امتیاز، نه دوبار — اختلاف: ${delta}`);
  });

  test('کشِ ستونیِ club_members.points با دفتر واگرا نمی‌شود', async () => {
    const member = await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId, userId } }, select: { points: true },
    });
    assert.equal(
      member?.points, await getClubPointsBalance(userId, restaurantId),
      'ستونِ کش باید با جمعِ دفترِ همان رستوران برابر بماند',
    );
  });
});

describe('سطحِ باشگاه (tier) واقعاً نوشته می‌شود (§۱۳)', () => {
  beforeEach(clearOwnRateLimits);

  test('کنترلِ منفی: عضوِ تازه با امتیازِ کم هنوز bronze است', async () => {
    // اگر تستِ بعدی بدونِ این بود، یک `tier='silver'`ِ هاردکد هم پاسش می‌کرد.
    const balance = await getClubPointsBalance(userId, restaurantId);
    assert.ok(balance < 300, `پیش‌شرطِ سناریو: موجودی باید زیرِ آستانه‌ی نقره‌ای باشد، بود: ${balance}`);
    const m = await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId, userId } }, select: { tier: true },
    });
    assert.equal(m?.tier, 'bronze');
  });

  test('🔴 عبور از آستانه‌ی ۳۰۰ سطح را به نقره‌ای می‌برد', async () => {
    const { tierFromPoints } = await import('../src/lib/loyalty.ts');
    const { addClubPoints } = await import('../src/lib/loyalty.ts');
    const balance = await getClubPointsBalance(userId, restaurantId);
    const need = 300 - balance;
    assert.ok(need > 0, 'سناریو باید واقعاً از آستانه عبور کند');

    const after = await addClubPoints({
      userId, restaurantId, delta: need, reason: 'adjustment', note: '[DEMO] عبور از آستانه',
    });
    assert.equal(after, 300);

    const m = await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId, userId } }, select: { tier: true },
    });
    assert.equal(m?.tier, 'silver', 'tier باید از رویِ دفتر به‌روز شود، نه ثابت بماند');
    assert.equal(m?.tier, tierFromPoints(300).key, 'همان تابعِ نمایش، نه تعریفِ دوم');
  });

  test('🔴 چک‌ینِ بعدی از مسیرِ پنل هم tier را نگه/به‌روز می‌دارد', async () => {
    const resv = await seedConfirmed();
    await panelCheckIn(resv.code);
    const balance = await getClubPointsBalance(userId, restaurantId);
    const { tierFromPoints } = await import('../src/lib/loyalty.ts');
    const m = await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId, userId } }, select: { tier: true },
    });
    assert.equal(m?.tier, tierFromPoints(balance).key);
  });

  test('🔴 کسرِ امتیاز سطح را پایین هم می‌آورد (نه فقط بالا)', async () => {
    const { addClubPoints, tierFromPoints } = await import('../src/lib/loyalty.ts');
    const pre = await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId, userId } }, select: { tier: true },
    });
    // پیش‌شرطِ صریح — وگرنه اگر tier اصلاً نوشته نشود (باگِ اصلی) این تست
    // با «هنوز bronze است» به‌طورِ کاذب سبز می‌ماند.
    assert.notEqual(pre?.tier, 'bronze', 'پیش‌شرط: باید از سطحِ پایه بالاتر رفته باشد');
    const balance = await getClubPointsBalance(userId, restaurantId);
    const after = await addClubPoints({
      userId, restaurantId, delta: -(balance - 10), reason: 'adjustment', note: '[DEMO] کسر',
    });
    assert.equal(after, 10);
    const m = await db.clubMember.findUnique({
      where: { restaurantId_userId: { restaurantId, userId } }, select: { tier: true },
    });
    assert.equal(m?.tier, 'bronze');
    assert.equal(m?.tier, tierFromPoints(10).key);
  });

  test('🔴 توزیعِ سطوحِ پنل همه‌ی سطوحِ ممکن را می‌شناسد (نه فقط سه‌تا)', async () => {
    // ⚠️ پیامدِ مستقیمِ زنده‌شدنِ tier: حالا مقدارِ چهارم (`platinum`) واقعاً
    // نوشته می‌شود. مصرف‌کننده‌ای که فقط سه کلید را مقداردهی اولیه می‌کرد،
    // عضوِ پلاتینیوم را با `undefined` گزارش می‌کرد.
    const { LOYALTY_TIERS } = await import('../src/lib/loyalty.ts');
    const res = await membersRoute.GET(
      new Request('http://x/api/v1/restaurant/members', {
        headers: { authorization: `Bearer ${staffToken}` },
      }),
      { params: Promise.resolve({}) } as never,
    );
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    for (const t of LOYALTY_TIERS) {
      assert.equal(typeof body.tiers[t.key], 'number', `سطحِ ${t.key} باید سطلِ خودش را داشته باشد`);
    }
    const sum = Object.values(body.tiers as Record<string, number>).reduce((a, b) => a + b, 0);
    assert.equal(sum, body.total, 'جمعِ سطل‌ها باید با کلِ اعضا بخواند');
  });

  test('تعریفِ سطح یکتاست — loyalty-status همان شیء را بازصادر می‌کند', async () => {
    const a = await import('../src/lib/loyalty.ts');
    const b = await import('../src/lib/loyalty-status.ts');
    assert.equal(a.tierFromPoints, b.tierFromPoints, 'دو تابعِ موازی ممنوع');
    assert.equal(a.LOYALTY_TIERS, b.LOYALTY_TIERS, 'دو جدولِ آستانه‌ی موازی ممنوع');
  });
});
