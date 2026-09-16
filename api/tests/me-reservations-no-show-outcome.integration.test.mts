// ═══════════════════════════════════════════════════════════════════════
//  GET /me/reservations — «عدم حضور» با واقعیت‌های ثبت‌شده‌اش (STATE M-15 · F002)
//
//  چرا این فایل وجود دارد (Feature Verification، ۲۰۲۶-۰۹-۱۷):
//  بعد از عدم‌حضور، پیامکِ مهمان می‌گفت «عدم حضور ثبت شد» ولی کارتِ اپ
//  «لغوشده» نشان می‌داد — در حالی که سرور همان لحظه کش‌بکِ رزرو را برگردانده و
//  یک strike ثبت کرده بود. کلاینت نمی‌توانست حقیقت را بگوید چون این route
//  هیچ‌کدام از آن واقعیت‌ها را برنمی‌گرداند.
//
//  این تست فقط **داده** را پین می‌کند، نه متن را: هر جمله‌ی «چرا؟» در اپ باید
//  از همین فیلدها ساخته شود. پس هر فیلد باید از منبعِ واقعی‌اش بیاید:
//    recordedAt / byRestaurant ← ردیفِ reservation_events با toStatus=no_show
//    cashbackReversedPoints    ← ردیفِ جبرانیِ points_ledger با کلیدِ cashback-reversal:<id>
//    strikeRecorded            ← ردیفِ economy_ledger_entries با source=reservation_no_show
//    strikeDecayDays           ← همان ثابتِ economy.ts، نه عددی در کلاینت
//
//  ⚠️ ۰۸۹ / FP-009: ردیف‌های دفترِ امتیاز حذف‌شدنی نیستند، پس هر تست کاربرِ
//  تازه‌ی خودش را می‌سازد و پاک‌سازی به ردیفِ دفتر دست نمی‌زند.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import './helpers/test-env.mts';
process.env.JWT_SECRET ??= 'a'.repeat(32);
const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { transitionReservation } = await import('../src/lib/lifecycle');
const { STRIKE_DECAY_PERIOD_DAYS } = await import('../src/lib/economy');
const { CASHBACK_KEY_PREFIX } = await import('../src/lib/loyalty');
const { GET: meReservations } = await import('../src/app/api/v1/me/reservations/route.ts');
const { fixturePhone } = await import('./_phone.helper.mts');

const SFX = randomUUID().slice(0, 6);
const made = { tenantIds: [] as string[], restaurantIds: [] as string[] };
let seq = 0;

type NoShow = {
  recordedAt: string | null;
  byRestaurant: boolean;
  cashbackReversedPoints: number;
  strikeRecorded: boolean;
  strikeDecayDays: number;
};
type Row = { id: string; code: string; status: string; noShow?: NoShow | null };

/** رستوران + کاربرِ تازه + یک رزرو در گذشته (بیرون از هر مهلتِ تأخیر). */
async function seed(opts: { cashback: number | null }) {
  const n = ++seq;
  const t = await db.tenant.create({ data: { name: `[DEMO] noshow-outcome ${SFX}-${n}` } });
  made.tenantIds.push(t.id);
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug: `nso-${SFX}-${n}`, name: '[DEMO] کافه عدم‌حضور', clubPrefix: 'NSO' },
    select: { id: true },
  });
  made.restaurantIds.push(r.id);
  // ⚠️ پیشوندِ ۰۹۴۵ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
  const u = await db.user.create({ data: { phone: fixturePhone('0945'), firstName: '[DEMO]' } });
  const start = new Date(Date.now() - 60 * 60_000);
  const resv = await db.reservation.create({
    data: {
      restaurantId: r.id, userId: u.id, code: `NS${SFX}${n}`.slice(0, 12),
      status: 'confirmed', partySize: 2,
      slotStart: start, slotEnd: new Date(start.getTime() + 90 * 60_000),
      guestName: '[DEMO] مهمان', guestPhone: fixturePhone('0945'),
    },
    select: { id: true, code: true },
  });
  if (opts.cashback !== null) {
    await db.pointsLedger.create({
      data: {
        userId: u.id, restaurantId: r.id, delta: opts.cashback, reason: 'cashback',
        note: `کش‌بک رزرو ${resv.code}`, idempotencyKey: `${CASHBACK_KEY_PREFIX}${resv.id}`,
      },
    });
  }
  return { userId: u.id, resv, token: signAccess({ sub: u.id, kind: 'customer' }) };
}

async function rows(token: string): Promise<Row[]> {
  const res = await meReservations(new Request('http://t/api/v1/me/reservations', {
    headers: { authorization: `Bearer ${token}` },
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body), 'شکلِ پاسخ آرایه‌ی خام می‌ماند');
  return body as Row[];
}

function only(list: Row[], id: string): Row {
  const row = list.find((x) => x.id === id);
  assert.ok(row, 'رزروِ ساخته‌شده باید در پاسخ باشد — نبودنش یعنی تست چیزی نمی‌سنجد');
  return row;
}

describe('GET /me/reservations — واقعیت‌های عدم‌حضور (M-15)', () => {
  test('عدم‌حضورِ خودکار: زمان، عامل، کش‌بکِ برگشتی و strike از منبعِ واقعی', async () => {
    const s = await seed({ cashback: 40 });
    await transitionReservation({ reservationId: s.resv.id, to: 'running_late', actor: 'cron', isAutomatic: true });
    await transitionReservation({ reservationId: s.resv.id, to: 'no_show', actor: 'cron', isAutomatic: true });

    const row = only(await rows(s.token), s.resv.id);
    assert.equal(row.status, 'no_show');
    assert.ok(row.noShow, 'ردیفِ no_show باید شیءِ noShow داشته باشد');
    const ns = row.noShow!;
    assert.equal(typeof ns.recordedAt, 'string');
    assert.ok(Number.isFinite(Date.parse(ns.recordedAt!)), 'recordedAt باید ISOِ معتبر باشد');
    assert.equal(ns.byRestaurant, false, 'عاملِ cron «رستوران» نیست');
    assert.equal(ns.cashbackReversedPoints, 40, 'مقدارِ ردیفِ جبرانیِ دفتر، نه عددِ حدسی');
    assert.equal(ns.strikeRecorded, true);
    assert.equal(ns.strikeDecayDays, STRIKE_DECAY_PERIOD_DAYS, 'ثابتِ سرور، نه کپی در کلاینت');
  });

  test('عدم‌حضورِ ثبت‌شده توسطِ پرسنل: byRestaurant=true', async () => {
    const s = await seed({ cashback: 25 });
    await transitionReservation({ reservationId: s.resv.id, to: 'no_show', actor: `staff:${randomUUID()}` });
    const ns = only(await rows(s.token), s.resv.id).noShow!;
    assert.equal(ns.byRestaurant, true);
    assert.equal(ns.cashbackReversedPoints, 25);
  });

  test('بدونِ کش‌بک: cashbackReversedPoints دقیقاً ۰ است، نه undefined و نه حذف', async () => {
    const s = await seed({ cashback: null });
    await transitionReservation({ reservationId: s.resv.id, to: 'no_show', actor: 'cron', isAutomatic: true });
    const ns = only(await rows(s.token), s.resv.id).noShow!;
    assert.strictEqual(ns.cashbackReversedPoints, 0);
  });

  // ⚠️ جهشِ جزئی که دو تستِ بالا از آن رد می‌شوند: خواندنِ ردیفِ **اصلیِ** کش‌بک به‌جای
  // ردیفِ جبرانی، در هر دو حالت همان عدد را می‌دهد (|−40| = |+40|). تنها حالتی که این دو
  // را جدا می‌کند کش‌بکی است که **برنگشته** — دقیقاً شکستی که lifecycle.ts لاگ می‌کند و
  // نمی‌اندازد. اینجا با نوشتنِ کش‌بک **بعد** از انتقال بازسازی می‌شود.
  test('کش‌بکی که برنگشته، «برگشته» گزارش نمی‌شود', async () => {
    const s = await seed({ cashback: null });
    await transitionReservation({ reservationId: s.resv.id, to: 'no_show', actor: 'cron', isAutomatic: true });
    await db.pointsLedger.create({
      data: {
        userId: s.userId, restaurantId: (await db.reservation.findUniqueOrThrow({ where: { id: s.resv.id } })).restaurantId,
        delta: 30, reason: 'cashback', note: `کش‌بک رزرو ${s.resv.code}`,
        idempotencyKey: `${CASHBACK_KEY_PREFIX}${s.resv.id}`,
      },
    });
    const ns = only(await rows(s.token), s.resv.id).noShow!;
    assert.strictEqual(ns.cashbackReversedPoints, 0,
      'ردیفِ اصلیِ کش‌بک هست ولی جبرانی نیست — گفتنِ «۳۰ امتیاز برگشت» دروغ است');
  });

  test('no_showِ بدونِ رویداد (دادهٔ قدیمی): هیچ ادعایی ساخته نمی‌شود', async () => {
    const s = await seed({ cashback: null });
    await db.reservation.update({ where: { id: s.resv.id }, data: { status: 'no_show' } });
    const ns = only(await rows(s.token), s.resv.id).noShow!;
    assert.strictEqual(ns.recordedAt, null, 'زمانی که ثبت نشده ساخته نمی‌شود');
    assert.strictEqual(ns.strikeRecorded, false, 'strikeی که در دفترِ اقتصاد نیست ادعا نمی‌شود');
    assert.strictEqual(ns.cashbackReversedPoints, 0);
  });

  test('کنترلِ منفی: رزروی که عدم‌حضور نیست noShow=null دارد', async () => {
    const s = await seed({ cashback: 40 });
    const row = only(await rows(s.token), s.resv.id);
    assert.equal(row.status, 'confirmed');
    assert.strictEqual(row.noShow, null, 'فیلد برای همه‌ی ردیف‌ها حاضر است و فقط برای no_show پر می‌شود');
  });
});

after(async () => {
  // ۰۸۹: ردیف‌های دفتر می‌مانند، پس رزرو/کاربر/رستورانی که به دفتر یا دفترِ اقتصاد
  // گره خورده حذف نمی‌شود. هر حذف `.catch` دارد چون FK عمداً رد می‌کند؛ دیتابیسِ
  // هر اجرا تازه است.
  for (const id of made.restaurantIds) {
    await db.reservation.deleteMany({ where: { restaurantId: id } }).catch(() => {});
    await db.restaurant.delete({ where: { id } }).catch(() => {});
  }
  for (const id of made.tenantIds) await db.tenant.delete({ where: { id } }).catch(() => {});
});
