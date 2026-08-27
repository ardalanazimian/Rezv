import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ «تراکنشی‌بودن یک واقعیتِ سرور است، نه ادعای کلاینت»
//  (پروتکل §۷ ایزولاسیونِ tenant · §۸ حریمِ مشتری · §۱۳/§۱۷ رضایت)
//
//  یافته‌ی ۲۰۲۶-۰۸-۲۵ در `POST /v1/restaurant/sms`:
//   • `kind` مستقیم از بدنه می‌آمد؛ `kind === 'welcome'` ⇒ `isTransactional`
//     ⇒ فیلترِ رضایت به `return true` تبدیل می‌شد،
//   • `phones` هیچ‌وقت با این رستوران تطبیق داده نمی‌شد،
//   • و مسیرِ تراکنشی عمداً در دفترِ ارتباط‌گیری/تاریخچه‌ی کمپین ثبت نمی‌شود.
//  نتیجه: `{kind:'welcome', phones:[…۵۰۰ شماره‌ی دلخواه]}` انصرافِ همه را
//  نادیده می‌گرفت و **هیچ ردی** هم نمی‌گذاشت.
//
//  این فایل خودِ روت را با `Request` واقعی صدا می‌زند (نه تابعِ کمکی) و
//  نتیجه را از جدولِ واقعیِ `jobs` می‌خواند — چون باگ دقیقاً در همین لایه بود.
// ═══════════════════════════════════════════════════════════════════════

import { fixturePhone } from './_phone.helper.mts';

// ⚠️ پیشوندِ ۰۹۲۵ مالِ همین فایل است — در فایلِ دیگری تکرارش نکن
// (دلیل: tests/_phone.helper.mts).
const PHONE_PREFIX = '0925';

const { db } = await import('../src/lib/db.ts');
const { signAccess } = await import('../src/lib/jwt.ts');
const { genReservationCode } = await import('../src/lib/reservation-helpers.ts');
const smsRoute = await import('../src/app/api/v1/restaurant/sms/route.ts');

const SFX = Date.now().toString(36).slice(-6);
const ALL_OFF = { offers: false, availability: false, reminder: false, loyalty: false, dna: false };

let tenantId = '';
let restaurantId = '';
let ownerToken = '';
let otherTenantId = '';
let otherRestaurantId = '';
const madeUserIds: string[] = [];

const jsonReq = (body: unknown) =>
  new Request('http://x/api/v1/restaurant/sms', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ownerToken}`,
      'content-type': 'application/json',
      'x-real-ip': testIp(),
    },
    body: JSON.stringify(body),
  });

const post = async (body: unknown) => {
  const res = await smsRoute.POST(jsonReq(body));
  return { status: res.status, body: await res.json() };
};

/** قالب‌های پیامکِ صف‌شده برای یک شماره — از جدولِ واقعیِ `jobs`. */
async function queuedTemplatesFor(phone: string): Promise<string[]> {
  const rows = await db.$queryRaw<{ template: string }[]>`
    SELECT payload->>'template' AS template FROM jobs
    WHERE kind = 'sms' AND payload->>'to' = ${phone}
    ORDER BY created_at ASC
  `;
  return rows.map((r) => r.template);
}

async function makeUser(prefs: Record<string, boolean> = {}) {
  const local = fixturePhone(PHONE_PREFIX);
  const u = await db.user.create({
    data: { phone: '+98' + local.slice(1), firstName: '[DEMO] مهمان', notificationPrefs: prefs },
    select: { id: true, phone: true },
  });
  madeUserIds.push(u.id);
  return { ...u, local };
}

/** ورودِ واقعی: رزروی با وضعیتِ رسیده در رستورانِ داده‌شده. */
async function makeArrival(opts: {
  restaurant?: string; guestPhone?: string | null; userId?: string | null;
  status?: 'checked_in' | 'seated' | 'completed'; minutesAgo?: number;
}) {
  const now = Date.now();
  const ago = (opts.minutesAgo ?? 15) * 60_000;
  return db.reservation.create({
    data: {
      restaurantId: opts.restaurant ?? restaurantId,
      userId: opts.userId ?? null,
      code: genReservationCode(),
      guestName: '[DEMO] مهمان', guestPhone: opts.guestPhone ?? null, partySize: 2,
      slotStart: new Date(now - ago), slotEnd: new Date(now - ago + 90 * 60_000),
      status: (opts.status ?? 'checked_in') as never,
    },
    select: { id: true },
  });
}

/*
 * ⚠️ اینجا قبلاً `clearOwnRateLimits()` بود که `rl:auth:*` را **سراسری** پاک
 * می‌کرد. با `testIp()` هر Request سطلِ جدا دارد، پس دیگر لازم نیست — و آن
 * پاک‌سازی سطلِ فایل‌های دیگرِ همین رانر را هم خالی می‌کرد.
 */

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] tenant welcome-proof ${SFX}` } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-wproof-${SFX}`, name: '[DEMO] رستورانِ رسیدِ ورود',
      clubPrefix: 'WPR', smsBalance: 500,
    },
  });
  restaurantId = r.id;
  const owner = await db.staff.create({
    data: { tenantId, phone: fixturePhone(PHONE_PREFIX), role: 'owner', isActive: true },
    select: { id: true },
  });
  ownerToken = signAccess({ sub: owner.id, kind: 'staff', tenantId, role: 'owner' });

  // رستورانِ دومِ کاملاً مستقل — برای گاردِ ایزولاسیونِ tenant.
  const t2 = await db.tenant.create({ data: { name: `[DEMO] tenant welcome-other ${SFX}` } });
  otherTenantId = t2.id;
  const r2 = await db.restaurant.create({
    data: {
      tenantId: otherTenantId, slug: `zz-wproof2-${SFX}`, name: '[DEMO] رستورانِ دیگر',
      clubPrefix: 'WP2', smsBalance: 500,
    },
  });
  otherRestaurantId = r2.id;
});

after(async () => {
  // فقط شماره‌های پیشوندِ خودِ این فایل (هر دو شکلِ ذخیره) — نه کلِ صفِ sms:
  // رانر تک‌پروسه‌ای است و پاک‌کردنِ ردیف‌های دیگران بی‌صدا تستِ بعدی را
  // خراب می‌کند.
  await db.$executeRaw`
    DELETE FROM jobs WHERE kind = 'sms'
      AND (payload->>'to' LIKE ${PHONE_PREFIX + '%'} OR payload->>'to' LIKE ${'+98' + PHONE_PREFIX.slice(1) + '%'})
  `.catch(() => 0);
  await db.outreachLog.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.campaignLog.deleteMany({ where: { restaurantId } }).catch(() => {});
  for (const rid of [restaurantId, otherRestaurantId]) {
    await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId: rid } } }).catch(() => {});
    await db.reservation.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
  }
  await db.clubMember.deleteMany({ where: { userId: { in: madeUserIds } } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: madeUserIds } } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } }).catch(() => {});
});

describe('رسیدِ خوش‌آمد فقط با ورودِ تأییدشده‌ی سرور', () => {

  test('کنترلِ مثبت: مهمانی که واقعاً چک‌ین کرده رسیدش را می‌گیرد', async () => {
    // بدونِ این، همه‌ی تست‌های زیر با یک روتِ همیشه-۴۲۲ هم سبز می‌شدند.
    const u = await makeUser({ ...ALL_OFF });   // حتی با انصراف از همه‌چیز
    await makeArrival({ guestPhone: u.phone });
    const { status, body } = await post({ kind: 'welcome', phones: [u.phone] });

    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.queued, 1);
    assert.equal(body.unverified, 0);
    assert.deepEqual(await queuedTemplatesFor(u.phone), ['welcome_visit']);
  });

  test('🔴 فهرستِ شماره‌های دلخواه با ادعای welcome کاملاً رد می‌شود', async () => {
    // همان حمله: ۵ شماره‌ی بی‌ربط (نمونه‌ی کوچکِ همان ۵۰۰تایی) که همه هم
    // صریحاً از پیامِ تبلیغاتی انصراف داده‌اند.
    const victims = await Promise.all([makeUser(ALL_OFF), makeUser(ALL_OFF), makeUser(ALL_OFF)]);
    const outreachBefore = await db.outreachLog.count({ where: { restaurantId } });

    const { status, body } = await post({ kind: 'welcome', phones: victims.map((v) => v.phone) });

    assert.equal(status, 422, JSON.stringify(body));
    assert.equal(body.error?.details?.unverified, 3, 'باید صریح بگوید چند شماره تأیید نشد');
    for (const v of victims) {
      assert.deepEqual(await queuedTemplatesFor(v.phone), [], 'هیچ پیامکی نباید صف شود');
    }
    assert.equal(await db.outreachLog.count({ where: { restaurantId } }), outreachBefore,
      'و چیزی هم در دفترِ ارتباط‌گیری ثبت نمی‌شود — یعنی حمله بی‌رد بود');
  });

  test('🔴 فهرستِ ترکیبی: فقط شماره‌ی تأییدشده می‌رود، بقیه شمرده می‌شوند', async () => {
    const guest = await makeUser({ ...ALL_OFF });
    await makeArrival({ guestPhone: guest.phone });
    const strangers = await Promise.all([makeUser(ALL_OFF), makeUser(ALL_OFF)]);

    const { status, body } = await post({
      kind: 'welcome', phones: [guest.phone, ...strangers.map((s) => s.phone)],
    });

    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.queued, 1, 'فقط یک گیرنده‌ی واقعی');
    assert.equal(body.unverified, 2);
    assert.deepEqual(await queuedTemplatesFor(guest.phone), ['welcome_visit']);
    for (const s of strangers) assert.deepEqual(await queuedTemplatesFor(s.phone), []);
  });

  test('🔴 ورود در رستورانِ دیگر مجوزِ اینجا نیست (ایزولاسیونِ tenant §۷)', async () => {
    const u = await makeUser({ ...ALL_OFF });
    await makeArrival({ restaurant: otherRestaurantId, guestPhone: u.phone });

    const { status, body } = await post({ kind: 'welcome', phones: [u.phone] });

    assert.equal(status, 422, JSON.stringify(body));
    assert.deepEqual(await queuedTemplatesFor(u.phone), [],
      'ورودِ ثبت‌شده در tenantِ دیگر نباید گاردِ این رستوران را باز کند');
  });

  test('🔴 ورودِ کهنه (۳ روز پیش) دیگر مجوزِ ارسال نیست', async () => {
    const u = await makeUser({ ...ALL_OFF });
    await makeArrival({ guestPhone: u.phone, minutesAgo: 3 * 24 * 60 });

    const { status } = await post({ kind: 'welcome', phones: [u.phone] });
    assert.equal(status, 422, 'پنجره‌ی ۲۴ ساعته نباید به مجوزِ دائمی تبدیل شود');
    assert.deepEqual(await queuedTemplatesFor(u.phone), []);
  });

  test('🔴 اختلافِ فرمتِ شماره نباید رسیدِ مهمانِ واقعی را بیندازد', async () => {
    // پنل شماره را از `user.phone` می‌دهد (`+989…`) در حالی که رزرو ممکن است
    // `guest_phone`ِ خام (`09…`) داشته باشد — و برعکس. تطبیقِ تک‌فرمتی یعنی
    // مهمانِ واقعی «تأییدنشده» شود و رسیدش بی‌صدا نرود.
    const u = await makeUser();
    await makeArrival({ guestPhone: u.local });          // ذخیره: 09…
    const { status, body } = await post({ kind: 'welcome', phones: [u.phone] }); // ارسال: +98…
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.queued, 1);

    // جهتِ معکوس: رزرو فقط `user_id` دارد و شماره‌اش از حسابِ کاربر می‌آید.
    const u2 = await makeUser();
    await makeArrival({ userId: u2.id, guestPhone: null });
    const r2 = await post({ kind: 'welcome', phones: [u2.local] });              // ارسال: 09…
    assert.equal(r2.status, 200, JSON.stringify(r2.body));
    assert.equal(r2.body.queued, 1);
  });

  test('وضعیت‌های بعد از ورود (seated/completed) هم ورود حساب می‌شوند', async () => {
    // رزرو ممکن است تا لحظه‌ی ارسالِ رسید جلوتر رفته باشد؛ «رسیده بود» یک
    // واقعیتِ گذشته است و با انتقالِ بعدی باطل نمی‌شود.
    for (const status of ['seated', 'completed'] as const) {
      const u = await makeUser();
      await makeArrival({ guestPhone: u.phone, status });
      const res = await post({ kind: 'welcome', phones: [u.phone] });
      assert.equal(res.status, 200, `${status}: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.queued, 1);
    }
  });

  test('کنترلِ منفی: رزروِ تأییدشده‌ی بدونِ ورود مجوز نمی‌دهد', async () => {
    // اگر گارد روی «هر رزروی» بسته می‌شد، حمله فقط یک قدم گران‌تر می‌شد.
    const u = await makeUser({ ...ALL_OFF });
    await db.reservation.create({
      data: {
        restaurantId, code: genReservationCode(), guestName: '[DEMO] مهمان',
        guestPhone: u.phone, partySize: 2,
        slotStart: new Date(Date.now() + 3600_000), slotEnd: new Date(Date.now() + 2 * 3600_000),
        status: 'confirmed',
      },
    });
    const { status } = await post({ kind: 'welcome', phones: [u.phone] });
    assert.equal(status, 422, 'رزروِ آینده ≠ ورودِ انجام‌شده');
  });

  test('مسیرِ کمپین دست‌نخورده است: انصراف رعایت و در دفتر ثبت می‌شود', async () => {
    // کنترلِ منفیِ خودِ رفع: نباید مسیرِ بازاریابیِ سالم را شکسته باشیم.
    const optedOut = await makeUser({ offers: false });
    const willing = await makeUser({ offers: true });
    const outreachBefore = await db.outreachLog.count({ where: { restaurantId } });

    const { status, body } = await post({
      kind: 'campaign', phones: [optedOut.phone, willing.phone], message: '[DEMO] تخفیف',
    });

    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.queued, 1);
    assert.equal(body.opted_out, 1);
    assert.equal(body.unverified, 0, 'کمپین اصلاً از گاردِ ورود رد نمی‌شود');
    assert.deepEqual(await queuedTemplatesFor(optedOut.phone), []);
    assert.deepEqual(await queuedTemplatesFor(willing.phone), ['campaign']);
    assert.equal(await db.outreachLog.count({ where: { restaurantId } }), outreachBefore + 1,
      'کمپین باید ردِ ارتباط‌گیری بگذارد (برخلافِ مسیرِ تراکنشی)');
  });
});
