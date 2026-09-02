import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testIp } from './helpers/test-ip.mts';
import { fixturePhone } from './_phone.helper.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  POST /v1/waitlist/:id/accept — قراردادِ `Idempotency-Key`
//
//  باگی که این فایل پین می‌کند (۲۰۲۶-۰۸-۲۶): این route تنها نقطه‌ی نوشتنِ
//  «پذیرشِ آفر» است و برخلافِ خواهرهایش `/reservations` و
//  `/restaurant/walkin` هدرِ `Idempotency-Key` را **نمی‌خواند**.
//
//  ⚠️ دقتِ ادعا — حفره‌ی رزروِ تکراری نبود. `acceptOffer` ادعایِ اتمیک دارد
//  (`updateMany` با شرطِ `status:'offered'`)، پس درخواستِ دوم هرگز رزروِ دوم
//  نمی‌سازد. چیزی که می‌شکست **صداقتِ پاسخ** بود (§۶): رزروِ کاربر ساخته
//  می‌شد ولی پاسخِ دوم می‌گفت نشده.
//
//  ⚠️ کدِ خطا با **اجرای زنده** سنجیده شد، نه از رویِ کد — و حدسِ اولم غلط
//  بود. برایِ دو-بار-زدنِ *پشتِ‌سرِ‌هم* گاردِ بیرونیِ `e.status !== 'offered'`
//  زودتر شلیک می‌کند: **۴۲۲ VALIDATION «آفری برای پذیرش وجود ندارد»**.
//  ۴۱۰ RESERVATION_EXPIRED فقط در رقابتِ واقعیِ هم‌زمان رخ می‌دهد، وقتی هر دو
//  درخواست از آن گارد رد شده باشند و دومی `claimed.count === 0` بگیرد.
//
//  تستِ ۲ کنترلِ منفیِ همین ادعاست: بدونِ هدر، همان ۴۲۲ هنوز رخ می‌دهد.
//  بدونِ آن، «همیشه پاسخِ اول را بازپخش کن» هم سبز می‌شد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { joinWaitlist, promoteNext } = await import('../src/lib/waitlist.ts');
const { POST } = await import('../src/app/api/v1/waitlist/[id]/accept/route.ts');

const TAG = `wlidem-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string;

/** فراخوانیِ واقعیِ routeِ HTTP — IPِ یکتا تا سطلِ ریت‌لیمیت با بقیه‌ی فایل‌ها
 *  قاطی نشود (به helpers/test-ip.mts رجوع کن). */
async function callAccept(
  entryId: string, guestToken: string, idemKey?: string,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { 'x-real-ip': testIp() };
  if (idemKey) headers['idempotency-key'] = idemKey;
  const url = `http://t.local/api/v1/waitlist/${entryId}/accept?token=${encodeURIComponent(guestToken)}`;
  const res = await POST(new Request(url, { method: 'POST', headers }),
    { params: Promise.resolve({ id: entryId }) });
  return { status: res.status, body: await res.json() };
}

/** یک ورودیِ مهمان که آفرِ زنده دارد (میزِ آزاد + promoteNext). */
async function seedOfferedGuest(tableNumber: number) {
  await db.table.create({
    data: { restaurantId, number: tableNumber, capacity: 4, isActive: true, state: 'free' },
  });
  const joined = await joinWaitlist({
    restaurantId, partySize: 2,
    guest: { name: '[DEMO] مهمانِ صف', phone: fixturePhone('0928') },
  });
  const promoted = await promoteNext(restaurantId);
  assert.equal(promoted.promoted, true, 'فیکسچر: آفر باید ساخته شود');
  assert.equal(promoted.entryId, joined.id, 'فیکسچر: آفر باید مالِ همین ورودی باشد');
  return { entryId: joined.id as string, guestToken: joined.guest_token as string };
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: TAG, name: '[DEMO] رستورانِ idempotency', clubPrefix: 'WI',
      timezone: 'Asia/Tehran', isOpen: true, lastSeenAt: new Date(),
    },
    select: { id: true },
  });
  restaurantId = r.id;
});

after(async () => {
  await db.waitlistEntry.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ${restaurantId}::uuid`.catch(() => 0);
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('پذیرشِ آفرِ صف — Idempotency-Key', () => {
  test('با کلیدِ یکسان، درخواستِ دوم همان پاسخِ موفق را بازپخش می‌کند (نه ۴۲۲)', async () => {
    const { entryId, guestToken } = await seedOfferedGuest(101);
    const key = randomUUID();

    const first = await callAccept(entryId, guestToken, key);
    assert.equal(first.status, 200, `اولی باید موفق باشد: ${JSON.stringify(first.body)}`);
    assert.ok(first.body.reservation_code, 'اولی باید کدِ رزرو بدهد');

    const second = await callAccept(entryId, guestToken, key);
    assert.equal(second.status, 200,
      `دومی باید بازپخش شود، نه ${second.status}: ${JSON.stringify(second.body)}`);
    assert.equal(second.body.reservation_code, first.body.reservation_code,
      'کدِ رزروِ بازپخش‌شده باید دقیقاً همان کدِ اول باشد');

    // و واقعاً فقط **یک** رزرو ساخته شده باشد
    const n = await db.reservation.count({ where: { restaurantId } });
    assert.equal(n, 1, `فقط یک رزرو باید ساخته شود، نه ${n}`);
  });

  test('کنترلِ منفی: بدونِ هدر، درخواستِ دوم همان ۴۲۲ِ قدیمی را می‌گیرد', async () => {
    const { entryId, guestToken } = await seedOfferedGuest(102);

    const first = await callAccept(entryId, guestToken);
    assert.equal(first.status, 200, `اولی باید موفق باشد: ${JSON.stringify(first.body)}`);

    const second = await callAccept(entryId, guestToken);
    assert.equal(second.status, 422,
      'بدونِ کلید، رفتارِ قدیمی باید دست‌نخورده بماند — وگرنه این تست چیزی را ' +
      'به هدر نسبت می‌دهد که خودِ acceptOffer انجام داده');
    assert.equal(second.body.error?.code, 'VALIDATION');
  });

  test('شکستِ واقعی کلید را قفل نمی‌کند: retry علتِ واقعی را می‌بیند، نه ۴۰۹', async () => {
    // ورودیِ ناموجود → ۴۰۴. اگر کلید در in_progress رها شود، تلاشِ دومِ
    // بلافاصله ۴۰۹ IDEMPOTENCY_CONFLICT می‌گیرد و علتِ واقعی گم می‌شود
    // (STALE_IN_PROGRESS_MS شصت ثانیه است، پس خودبه‌خود آزاد نمی‌شود).
    const ghost = randomUUID();
    const key = randomUUID();

    const first = await callAccept(ghost, 'bogus-token', key);
    assert.equal(first.status, 404, `انتظار ۴۰۴: ${JSON.stringify(first.body)}`);

    const retry = await callAccept(ghost, 'bogus-token', key);
    assert.equal(retry.status, 404,
      `retry باید همان ۴۰۴ را بدهد، نه ${retry.status} — کلید باید آزاد شده باشد`);
    assert.notEqual(retry.body.error?.code, 'IDEMPOTENCY_CONFLICT');
  });

  test('کلیدِ یکسان بینِ دو مهمانِ متفاوت بازپخش نمی‌شود', async () => {
    // هویتِ درخواست‌کننده باید جزوِ کلیدِ کش باشد؛ وگرنه هر کسی با حدسِ کلید
    // پاسخِ نفرِ قبلی — شاملِ کدِ رزرو که خودش شناسه‌ی دسترسیِ مهمان است —
    // را می‌گرفت.
    const a = await seedOfferedGuest(103);
    const sharedKey = randomUUID();
    const resA = await callAccept(a.entryId, a.guestToken, sharedKey);
    assert.equal(resA.status, 200, `A باید موفق باشد: ${JSON.stringify(resA.body)}`);

    const b = await seedOfferedGuest(104);
    const resB = await callAccept(b.entryId, b.guestToken, sharedKey);
    assert.equal(resB.status, 200, `B باید مسیرِ خودش را برود: ${JSON.stringify(resB.body)}`);
    assert.notEqual(resB.body.reservation_code, resA.body.reservation_code,
      'B هرگز نباید کدِ رزروِ A را ببیند');
  });
});
