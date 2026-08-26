import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ دسته‌ی امنیت/جداسازیِ فازِ ۲ (پروتکل §۳، §۷، §۸)
//
//  هر تست دقیقاً یک حفره‌ی تأییدشده را پین می‌کند. همه‌ی این‌ها پیش از رفع
//  در همین کدبیسِ «۱۰۰٪ سبز» زنده بودند — یعنی سبزبودنِ تست اثباتِ امنیت نبود.
//
//   ۱. POST /gift-cards ناشناس ارزشِ پولیِ خرج‌شدنی می‌ساخت (بدونِ auth، بدونِ
//      ریت‌لیمیت، بدونِ هیچ پرداختی) — تا سقفِ یک میلیارد تومان.
//   ۲. redeemGiftCardTx دامنه‌ی رستوران را چک نمی‌کرد → جابه‌جاییِ ارزش بینِ تنانت‌ها.
//   ۳. GET /waitlist/[id] با **بدونِ توکن** ورودیِ کاربرِ دیگر را برمی‌گرداند.
//   ۴. GET /restaurant/reservations/[code]/events فقط tenant-scope بود، نه branch.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const { ApiError } = await import('../src/lib/errors.ts');
const { isFeatureEnabled } = await import('../src/lib/feature-flags.ts');
const { redeemGiftCardTx } = await import('../src/lib/loyalty.ts');
const giftRoute = await import('../src/app/api/v1/gift-cards/route.ts');
const waitlistRoute = await import('../src/app/api/v1/waitlist/[id]/route.ts');
const eventsRoute = await import('../src/app/api/v1/restaurant/reservations/[code]/events/route.ts');

let tenantId: string;
let restA: string;
let restB: string;
let userA: string;
let userB: string;
let staffB: string;
let tokenUserB: string;
let entryOfUserA: string;
let resvCodeA: string;

before(async () => {
  const sfx = Date.now();
  const t = await db.tenant.create({ data: { name: '[DEMO] tenant (security-hardening test)' } });
  tenantId = t.id;
  const [a, b] = await Promise.all([
    db.restaurant.create({ data: { tenantId, slug: `sec-a-${sfx}`, name: '[DEMO] رستورانِ A', clubPrefix: 'SCA' } }),
    db.restaurant.create({ data: { tenantId, slug: `sec-b-${sfx}`, name: '[DEMO] رستورانِ B', clubPrefix: 'SCB' } }),
  ]);
  restA = a.id; restB = b.id;

  const [ua, ub] = await Promise.all([
    db.user.create({ data: { phone: `+98912${String(sfx).slice(-7)}` } }),
    db.user.create({ data: { phone: `+98913${String(sfx).slice(-7)}` } }),
  ]);
  userA = ua.id; userB = ub.id;
  tokenUserB = signAccess({ sub: userB, kind: 'customer' });

  // کارمندِ قفل‌شده به شعبه‌ی B
  const s = await db.staff.create({
    data: { tenantId, phone: `0914${String(sfx).slice(-7)}`, role: 'staff', restaurantId: restB },
  });
  staffB = s.id;

  // ورودیِ صفِ متعلق به userA
  const e = await db.waitlistEntry.create({
    data: { restaurantId: restA, userId: userA, partySize: 2, status: 'waiting' },
  });
  entryOfUserA = e.id;

  // رزروِ شعبه‌ی A
  const start = new Date(Date.now() + 7_200_000);
  const r = await db.reservation.create({
    data: {
      // کد باید دقیقاً با zReservationCode بخواند: RZ + ۷ کاراکتر Base32
      // (بدونِ I/O/0/1). عددِ خام مجاز نیست — ۴۲۲ می‌دهد، نه ۴۰۴.
      restaurantId: restA, code: `RZ${String(sfx).slice(-7).replace(/[01]/g, '2')}`,
      guestName: '[DEMO] مهمان', guestPhone: '+989120000001',
      partySize: 2, slotStart: start, slotEnd: new Date(+start + 5_400_000),
      status: 'confirmed',
    },
  });
  resvCodeA = r.code;
});

after(async () => {
  await db.waitlistEntry.deleteMany({ where: { restaurantId: { in: [restA, restB] } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId: { in: [restA, restB] } } }).catch(() => {});
  await db.giftCard.deleteMany({ where: { restaurantId: { in: [restA, restB] } } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: [userA, userB] } } }).catch(() => {});
});

describe('کارتِ هدیه — دیگر ارزشِ پولیِ ناشناس تولید نمی‌شود (§۳/§۷)', () => {
  test('خریدِ کارتِ هدیه به‌صورتِ پیش‌فرض خاموش است (fail-closed)', async () => {
    // قاعده‌ی کلیِ فلگ‌ها fail-open است، ولی این یکی عمداً استثناست چون در
    // وضعیتِ فعلی بدونِ هیچ مرحله‌ی پرداختی ارزشِ خرج‌شدنی می‌سازد.
    assert.equal(await isFeatureEnabled('gift_card_purchase_enabled'), false);
  });

  test('POST ناشناس رد می‌شود (نه ۲۰۰ با کارتِ ساخته‌شده)', async () => {
    const before = await db.giftCard.count();
    const res = await giftRoute.POST(new Request('https://x.test/api/v1/gift-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': testIp() },
      body: JSON.stringify({ amount_toman: 1_000_000_000 }),
    }));
    assert.notEqual(res.status, 200, 'فراخوانِ ناشناس هرگز نباید کارت بسازد');
    const afterCount = await db.giftCard.count();
    assert.equal(afterCount, before, 'هیچ کارتی نباید ساخته شده باشد');
  });

  test('کارتِ مقیدِ رستورانِ A رویِ صورت‌حسابِ رستورانِ B خرج نمی‌شود', async () => {
    const card = await db.giftCard.create({
      data: {
        code: `GIFTSEC${Date.now().toString(36).toUpperCase().slice(-6)}`,
        restaurantId: restA, amountToman: 500_000, balanceToman: 500_000,
      },
    });
    await assert.rejects(
      () => db.$transaction((tx) => redeemGiftCardTx(tx, card.code, 100_000, restB)),
      (e: unknown) => {
        assert.ok(e instanceof ApiError);
        assert.match(e.message, /رستوران دیگری/);
        return true;
      },
    );
    // رگرسیونِ معکوس: رویِ رستورانِ خودش باید همچنان کار کند.
    const ok = await db.$transaction((tx) => redeemGiftCardTx(tx, card.code, 100_000, restA));
    assert.equal(ok.applied, 100_000);
  });

  test('کارتِ بدونِ قیدِ رستوران همه‌جا معتبر می‌ماند (سازگاری با گذشته)', async () => {
    const card = await db.giftCard.create({
      data: {
        code: `GIFTANY${Date.now().toString(36).toUpperCase().slice(-6)}`,
        restaurantId: null, amountToman: 200_000, balanceToman: 200_000,
      },
    });
    const ok = await db.$transaction((tx) => redeemGiftCardTx(tx, card.code, 50_000, restB));
    assert.equal(ok.applied, 50_000, 'کارتِ سراسری نباید باطل شده باشد');
    await db.giftCard.delete({ where: { id: card.id } }).catch(() => {});
  });
});

describe('لیستِ انتظار — خواندنِ ناشناسِ ورودیِ کاربرِ دیگر بسته شد (§۷)', () => {
  test('بدونِ هیچ توکنی → ۴۰۴ (قبلاً کلِ ورودی را می‌داد)', async () => {
    const res = await waitlistRoute.GET(
      new Request(`https://x.test/api/v1/waitlist/${entryOfUserA}`, {
        headers: { 'x-real-ip': testIp() },
      }),
      { params: Promise.resolve({ id: entryOfUserA }) },
    );
    assert.equal(res.status, 404, 'درخواستِ بدونِ توکن نباید ورودیِ کاربرِ دیگر را ببیند');
  });

  test('با توکنِ کاربرِ دیگر → ۴۰۴', async () => {
    const res = await waitlistRoute.GET(
      new Request(`https://x.test/api/v1/waitlist/${entryOfUserA}`, {
        headers: { Authorization: `Bearer ${tokenUserB}`, 'x-real-ip': testIp() },
      }),
      { params: Promise.resolve({ id: entryOfUserA }) },
    );
    assert.equal(res.status, 404);
  });

  test('با توکنِ صاحبِ ورودی → ۲۰۰ (قابلیت نشکسته)', async () => {
    const tokenA = signAccess({ sub: userA, kind: 'customer' });
    const res = await waitlistRoute.GET(
      new Request(`https://x.test/api/v1/waitlist/${entryOfUserA}`, {
        headers: { Authorization: `Bearer ${tokenA}`, 'x-real-ip': testIp() },
      }),
      { params: Promise.resolve({ id: entryOfUserA }) },
    );
    assert.equal(res.status, 200, 'صاحبِ ورودی باید همچنان ببیند');
  });
});

describe('تاریخچه‌ی رزرو — محدود به شعبه، نه تنانت (§۷)', () => {
  test('کارمندِ قفل‌شده به شعبه‌ی B تاریخچه‌ی رزروِ شعبه‌ی A را نمی‌بیند', async () => {
    const tokenStaffB = signAccess({ sub: staffB, kind: 'staff', role: 'staff', tenantId });
    const res = await eventsRoute.GET(
      new Request(`https://x.test/api/v1/restaurant/reservations/${resvCodeA}/events`, {
        headers: { Authorization: `Bearer ${tokenStaffB}`, 'x-real-ip': testIp() },
      }),
      { params: Promise.resolve({ code: resvCodeA }) },
    );
    assert.equal(res.status, 404, 'رزروِ شعبه‌ی دیگر باید ۴۰۴ بدهد، نه تاریخچه');
  });
});
