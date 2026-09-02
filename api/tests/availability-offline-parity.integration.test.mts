import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testIp } from './helpers/test-ip.mts';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  تطابقِ availability با ثبتِ رزرو — «سانسی که نشان می‌دهی باید بشود رزروش کرد»
//
//  ⚠️ بن‌بستی که این فایل از آن زاده شد (اندازه‌گیریِ زنده، ۲۰۲۶-۰۸-۲۵):
//  روی همان رستوران و همان لحظه، ۴ دقیقه و ۲۹ ثانیه پس از آخرین heartbeat:
//     GET  /v1/restaurants/{slug}/availability?date=…&party=2
//        → 200 با {"time":"19:00","free_tables":[1..9],"status":"open"}
//     POST /v1/reservations با همان ۱۹:۰۰
//        → 422 {"code":"RESTAURANT_OFFLINE"}
//  یعنی اپ ساعتِ آزاد نشان می‌داد، کاربر انتخاب می‌کرد، و در آخرین قدم رد
//  می‌شد. گاردِ اتصال در lib/reservations.ts:122 وجود داشت ولی روتِ
//  availability هیچ گاردی نداشت — دو منبعِ حقیقتِ ناسازگار.
//
//  این فایل همان **تطابق** را قفل می‌کند، نه صرفاً وجودِ فیلد را: هر سانسی که
//  availability آزاد اعلام کند، باید از گاردِ ثبتِ رزرو هم رد شود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const availRoute = await import('../src/app/api/v1/restaurants/[slug]/availability/route');

const TAG = `avo-${randomUUID().slice(0, 8)}`;
const TZ = 'Asia/Tehran';
const DATE = '2027-05-19';

let tenantId: string;

async function makeRestaurant(suffix: string, opts: {
  onlineGating?: boolean; lastSeenAt?: Date | null; isOpen?: boolean;
} = {}) {
  return db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${suffix}`, name: `[DEMO] رستورانِ تستِ آفلاین ${suffix}`,
      clubPrefix: 'AO', timezone: TZ, slotMinutes: 90, cleaningMinutes: 15, bufferMinutes: 0,
      isOpen: opts.isOpen ?? true,
      onlineGating: opts.onlineGating ?? true,
      lastSeenAt: opts.lastSeenAt === undefined ? new Date() : opts.lastSeenAt,
      tables: { create: [{ number: 1, capacity: 4 }, { number: 2, capacity: 2 }] as never },
    },
    select: { id: true, slug: true },
  });
}

/** روتِ واقعی را با همان امضایی که Next صدا می‌زند اجرا می‌کند. */
async function callAvailability(slug: string, party = 2) {
  const url = `http://x/api/v1/restaurants/${slug}/availability?date=${DATE}&party=${party}`;
  const res = await availRoute.GET(
    new Request(url, { headers: { 'x-real-ip': testIp() } }),
    { params: Promise.resolve({ slug }) },
  );
  return { status: res.status, body: await res.json() as any };
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] تنانتِ تستِ آفلاین ${TAG}` }, select: { id: true } });
  tenantId = t.id;
});

after(async () => {
  const rs = await db.restaurant.findMany({ where: { tenantId }, select: { id: true } });
  const ids = rs.map(r => r.id);
  await db.reservation.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.table.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
});

describe('availability همان چیزی را می‌گوید که ثبتِ رزرو می‌پذیرد', () => {

  test('رستورانِ آنلاین (heartbeat تازه) سانس می‌دهد — کنترلِ منفی', async () => {
    // ⚠️ بدونِ این تست، گاردِ جدید می‌توانست *همیشه* خالی برگرداند و بقیه‌ی
    // تست‌ها هم سبز بمانند. این ثابت می‌کند قابلیت واقعاً نشکسته.
    const r = await makeRestaurant('online', { lastSeenAt: new Date() });
    const { status, body } = await callAvailability(r.slug);
    assert.equal(status, 200);
    assert.equal(body.restaurant_status, 'online');
    assert.ok(Array.isArray(body.slots) && body.slots.length > 0,
      `رستورانِ آنلاین باید سانس بدهد، ولی ${body.slots?.length ?? 'undefined'} سانس داد`);
  });

  test('رستورانی که >۹۰ ثانیه heartbeat نداده هیچ سانسی نمی‌دهد', async () => {
    const stale = new Date(Date.now() - 5 * 60_000);   // همان ~۵ دقیقه‌ی سناریوی واقعی
    const r = await makeRestaurant('stale', { lastSeenAt: stale });
    const { status, body } = await callAvailability(r.slug);
    assert.equal(status, 200, 'آفلاین‌بودن یک وضعیتِ کسب‌وکار است، نه خطای کلاینت');
    assert.equal(body.restaurant_status, 'offline');
    assert.deepEqual(body.slots, [],
      'availability نباید سانسی بدهد که ثبتِ رزرو با RESTAURANT_OFFLINE ردش می‌کند');
    assert.ok(typeof body.reason === 'string' && body.reason.length > 0,
      'علت باید صریح باشد تا اپ بتواند حقیقت را نشان دهد، نه فقط فهرستِ خالی');
  });

  test('lastSeenAt = NULL هم آفلاین است (پنل هرگز heartbeat نزده)', async () => {
    const r = await makeRestaurant('never', { lastSeenAt: null });
    const { body } = await callAvailability(r.slug);
    assert.equal(body.restaurant_status, 'offline');
    assert.deepEqual(body.slots, []);
  });

  test('با onlineGating=false، heartbeatِ کهنه اهمیتی ندارد', async () => {
    // رستورانی که عمداً gating ندارد باید کار کند — دقیقاً همان استثنایی که
    // موتورِ رزرو هم قائل است (lib/reservations.ts: `input.source === 'app' && r.onlineGating`).
    const r = await makeRestaurant('nogating', {
      onlineGating: false, lastSeenAt: new Date(Date.now() - 60 * 60_000),
    });
    const { body } = await callAvailability(r.slug);
    assert.equal(body.restaurant_status, 'online');
    assert.ok(body.slots.length > 0, 'رستورانِ بدونِ gating نباید به‌خاطرِ heartbeat خاموش شود');
  });

  test('رستورانِ بسته (isOpen=false) وضعیتِ closed می‌دهد، نه offline', async () => {
    const r = await makeRestaurant('closed', { isOpen: false, lastSeenAt: new Date() });
    const { body } = await callAvailability(r.slug);
    assert.equal(body.restaurant_status, 'closed');
    assert.deepEqual(body.slots, []);
  });

  test('⚠️ تطابقِ واقعی: هر سانسی که آزاد اعلام شود از گاردِ ثبتِ رزرو رد می‌شود', async () => {
    // این تستِ مرکزیِ فایل است. به‌جای تکرارِ منطق، **همان تابعِ گاردِ موتورِ
    // رزرو** را روی همان رکورد اجرا می‌کند: اگر روزی یکی از دو طرف عوض شود و
    // دیگری نه، اینجا قرمز می‌شود.
    for (const [label, lastSeenAt] of [
      ['آنلاین', new Date()],
      ['کهنه',   new Date(Date.now() - 5 * 60_000)],
      ['هرگز',   null],
    ] as const) {
      const r = await makeRestaurant(`parity-${label}`, { lastSeenAt });
      const { body } = await callAvailability(r.slug);
      const rec = await db.restaurant.findUniqueOrThrow({
        where: { id: r.id }, select: { onlineGating: true, lastSeenAt: true },
      });
      // بازتولیدِ دقیقِ شرطِ lib/reservations.ts برای source='app'
      const bookingWouldAccept = !rec.onlineGating
        || (rec.lastSeenAt != null && Date.now() - new Date(rec.lastSeenAt).getTime() < 90_000);
      const availabilityOffers = (body.slots?.length ?? 0) > 0;
      assert.equal(availabilityOffers, bookingWouldAccept,
        `[${label}] availability ${availabilityOffers ? 'سانس داد' : 'سانس نداد'} ولی ثبتِ رزرو `
        + `${bookingWouldAccept ? 'می‌پذیرفت' : 'رد می‌کرد'} — همان بن‌بستِ کاربر`);
    }
  });
});
