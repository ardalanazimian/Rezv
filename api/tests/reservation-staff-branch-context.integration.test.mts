import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixturePhone } from './_phone.helper.mts';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رزروِ دستیِ staff: رستوران از contextِ احراز، نه از بدنه
//
//  ⚠️ باگی که این فایل قفل می‌کند (ممیزیِ قراردادِ فرانت↔بک، ۲۰۲۶-۰۹-۱۳ —
//  با خواندنِ هر دو طرف پیدا شد، سپس با همین تست روی Postgresِ واقعی):
//
//  `POST /reservations` برای staff `restaurant_id` را **اجباری** در بدنه
//  می‌خواست، و پنلِ رستوران آن را از `STAFF_INFO?.restaurant_id` می‌فرستد
//  (apps/business/js/reservations.js). `STAFF_INFO` فقط در لاگین پر می‌شود؛
//  بازیابیِ نشست از localStorage — حالتِ روزمره‌ی تبلتِ رستوران — آن را خالی
//  می‌گذارد ⇒ هر رزروِ دستی ۴۲۲ «restaurant_id: الزامی است». بعد از تعویضِ
//  شعبه هم کهنه بود ⇒ ۴۰۳. همان بدنه در صفِ آفلاین هم می‌نشست و هنگامِ
//  همگام‌سازی «تداخل» حساب و دور ریخته می‌شد.
//
//  قاعده‌ی CLAUDE.md همین را می‌گوید: رستوران فقط از contextِ احراز.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { dateKeyInTz } = await import('../src/lib/hours.ts');
const route = await import('../src/app/api/v1/reservations/route');

const SFX = String(Date.now()).slice(-8);
const DATE = dateKeyInTz(new Date(Date.now() + 24 * 3600_000), 'Asia/Tehran');
let tenantId = '', branchA = '', branchB = '', staffToken = '', customerToken = '', userId = '';

function post(body: unknown, opts: { token: string; branch?: string; idem?: string }) {
  const headers: Record<string, string> = {
    'content-type': 'application/json', 'x-real-ip': testIp(), authorization: `Bearer ${opts.token}`,
  };
  if (opts.branch) headers['x-restaurant-id'] = opts.branch;
  if (opts.idem) headers['idempotency-key'] = opts.idem;
  return route.POST(new Request('http://x/api/v1/reservations', { method: 'POST', headers, body: JSON.stringify(body) }));
}
async function read(res: Response) {
  const raw = await res.text();
  return { status: res.status, body: raw ? JSON.parse(raw) : null, raw };
}
/** همان شکلی که پنل پس از بازیابیِ نشست می‌فرستد: restaurant_id غایب. */
function panelBody(time: string, tableNumber: number) {
  return {
    date: DATE, time, party_size: 2, notify_sms: false,
    guest: { name: '[DEMO] مهمانِ دستی', table_number: tableNumber },
  };
}

describe('POST /reservations — staff بدونِ restaurant_id در بدنه', () => {
  before(async () => {
    const t = await db.tenant.create({ data: { name: `[DEMO] staff-branch ${SFX}`, plan: 'pro' }, select: { id: true } });
    tenantId = t.id;
    // A اول ساخته می‌شود ⇒ شعبه‌ی پیش‌فرضِ تنانت (قدیمی‌ترین) است.
    const a = await db.restaurant.create({
      data: { tenantId, slug: `demo-sb-a-${SFX}`, name: '[DEMO] شعبه‌ی A', clubPrefix: 'DSA', isOpen: true, onlineGating: false },
      select: { id: true },
    });
    branchA = a.id;
    const b = await db.restaurant.create({
      data: { tenantId, slug: `demo-sb-b-${SFX}`, name: '[DEMO] شعبه‌ی B', clubPrefix: 'DSB', isOpen: true, onlineGating: false },
      select: { id: true },
    });
    branchB = b.id;
    for (const restaurantId of [branchA, branchB]) {
      for (const n of [41, 42, 43, 44]) {
        await db.table.create({ data: { restaurantId, number: n, capacity: 4, isActive: true, isMergeable: false } });
      }
    }
    const owner = await db.staff.create({
      data: { tenantId, phone: fixturePhone('0971'), name: '[DEMO] مالک', role: 'owner', isActive: true },
      select: { id: true },
    });
    staffToken = signAccess({ sub: owner.id, kind: 'staff', tenantId, role: 'owner' });
    const u = await db.user.create({ data: { phone: fixturePhone('0972') }, select: { id: true } });
    userId = u.id;
    customerToken = signAccess({ sub: userId, kind: 'customer' });
  });

  after(async () => {
    await db.reservation.deleteMany({ where: { restaurantId: { in: [branchA, branchB] } } });
    await db.clubMember.deleteMany({ where: { restaurantId: { in: [branchA, branchB] } } });
    await db.table.deleteMany({ where: { restaurantId: { in: [branchA, branchB] } } });
    await db.auditLog.deleteMany({ where: { restaurantId: { in: [branchA, branchB] } } }).catch(() => {});
    await db.restaurant.deleteMany({ where: { tenantId } });
    await db.staff.deleteMany({ where: { tenantId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  test('نشستِ بازیابی‌شده (بدونِ restaurant_id و بدونِ هدر) → ۲۰۱ روی شعبه‌ی پیش‌فرض', async () => {
    const r = await read(await post(panelBody('19:00', 41), { token: staffToken }));
    assert.equal(r.status, 201, `پیش از رفع اینجا ۴۲۲ «restaurant_id: الزامی است» بود: ${r.raw.slice(0, 200)}`);
    const row = await db.reservation.findFirst({ where: { code: r.body.code }, select: { restaurantId: true, source: true } });
    assert.ok(row, 'رزرو باید واقعاً در DB باشد، نه فقط ۲۰۱');
    assert.equal(row.restaurantId, branchA);
    assert.equal(row.source, 'manual');
  });

  test('شعبه‌ی فعال از هدر می‌آید → رزرو روی همان شعبه می‌نشیند', async () => {
    const r = await read(await post(panelBody('19:00', 41), { token: staffToken, branch: branchB }));
    assert.equal(r.status, 201, r.raw.slice(0, 200));
    const row = await db.reservation.findFirst({ where: { code: r.body.code }, select: { restaurantId: true } });
    assert.equal(row?.restaurantId, branchB, 'رستوران باید از contextِ احراز باشد، نه پیش‌فرض');
  });

  test('بدنه‌ای که شعبه‌ی دیگری را نام ببرد هنوز ۴۰۳ است (صفِ آفلاینِ شعبه‌ی قبلی)', async () => {
    const r = await read(await post({ ...panelBody('20:00', 42), restaurant_id: branchA }, { token: staffToken, branch: branchB }));
    assert.equal(r.status, 403, r.raw.slice(0, 200));
    assert.equal(await db.reservation.count({ where: { restaurantId: branchA, tableId: { not: null }, slotStart: { gte: new Date(`${DATE}T00:00:00Z`) }, guestName: '[DEMO] مهمانِ دستی' } }), 1,
      'فقط رزروِ تستِ اول روی A است — ۴۰۳ نباید چیزی ساخته باشد');
  });

  test('کنترلِ مثبت: بدنه‌ای که همان شعبه‌ی فعال را نام ببرد → ۲۰۱', async () => {
    const r = await read(await post({ ...panelBody('20:00', 43), restaurant_id: branchB }, { token: staffToken, branch: branchB }));
    assert.equal(r.status, 201, r.raw.slice(0, 200));
  });

  test('مشتری بدونِ restaurant_id → ۴۲۲ (برای او اجباری می‌ماند)', async () => {
    const r = await read(await post({ date: DATE, time: '21:00', party_size: 2 }, { token: customerToken }));
    assert.equal(r.status, 422, r.raw.slice(0, 200));
    assert.match(r.body.error.message, /restaurant_id/);
  });

  test('ردِ TABLE_CONFLICT کلیدِ idempotency را آزاد می‌کند: همان کلید با میزِ آزاد → ۲۰۱، نه ۴۰۹', async () => {
    // میزِ ۴۱ِ شعبه‌ی A را تستِ اول در ۱۹:۰۰ گرفته است.
    const key = randomUUID();
    const clash = await read(await post(panelBody('19:00', 41), { token: staffToken, idem: key }));
    assert.equal(clash.status, 409, clash.raw.slice(0, 200));
    assert.notEqual(clash.body.error.code, 'IDEMPOTENCY_CONFLICT', 'اولی باید تداخلِ واقعیِ میز باشد');

    const retry = await read(await post(panelBody('19:00', 44), { token: staffToken, idem: key }));
    assert.equal(retry.status, 201,
      `پیش از رفع، همان کلید تا ۶۰ ثانیه IDEMPOTENCY_CONFLICT می‌گرفت: ${retry.raw.slice(0, 200)}`);

    // کنترلِ مثبت: پس از موفقیت، همان کلید replay می‌شود (نه رزروِ دوم).
    const replay = await read(await post(panelBody('19:00', 44), { token: staffToken, idem: key }));
    assert.equal(replay.status, 201);
    assert.equal(replay.body.code, retry.body.code, 'replay باید همان رزرو را برگرداند');
  });
});
