import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';
import { testIp } from './helpers/test-ip.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  GET /restaurant/customers — کلیدِ کش باید `limit` را هم بشناسد
//
//  ⚠️ باگ (ممیزیِ قراردادِ فرانت↔بک، ۲۰۲۶-۰۹-۱۳): کلید
//  `customers:<id>:<segment>:<sort>:<cursor>` بود. داشبوردِ پنلِ رستوران
//  `sort=visits&limit=5` و تبِ پروفایل‌ها `sort=visits&limit=20` می‌خواهند؛
//  ظرفِ ۶۰ ثانیه هر کدام پاسخِ کشِ دیگری را می‌گرفت.
//
//  و باگِ دومِ همان روت، که همین تست پیدایش کرد: `next_cursor` ردیفِ اضافه
//  (rows[limit]) بود در حالی که صفحه‌ی بعد با `skip:1` خودِ ردیفِ مکان‌نما را
//  رد می‌کند ⇒ در هر مرزِ صفحه یک مشتری هرگز برنمی‌گشت.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const route = await import('../src/app/api/v1/restaurant/customers/route');

const SFX = String(Date.now()).slice(-7);
let tenantId = '', restaurantId = '', token = '';
const userIds: string[] = [];

function get(qs: string) {
  return route.GET(new Request(`http://x/api/v1/restaurant/customers?${qs}`, {
    headers: { 'x-real-ip': testIp(), authorization: `Bearer ${token}` },
  }));
}

describe('customers — کشِ مستقل برای هر limit', () => {
  before(async () => {
    const t = await db.tenant.create({ data: { name: `[DEMO] cust-cache ${SFX}`, plan: 'pro' }, select: { id: true } });
    tenantId = t.id;
    const r = await db.restaurant.create({
      data: { tenantId, slug: `demo-custcache-${SFX}`, name: '[DEMO] کشِ مشتریان', clubPrefix: 'DCC' },
      select: { id: true },
    });
    restaurantId = r.id;
    const owner = await db.staff.create({
      data: { tenantId, phone: fixturePhone('0961'), name: '[DEMO] مالک', role: 'owner', isActive: true },
      select: { id: true },
    });
    token = signAccess({ sub: owner.id, kind: 'staff', tenantId, role: 'owner' });
    for (const [i, visits] of [[2, 9], [3, 5], [4, 1]] as const) {
      const u = await db.user.create({ data: { phone: fixturePhone(`096${i}`), firstName: `[DEMO] ${i}` }, select: { id: true } });
      userIds.push(u.id);
      await db.customerInsight.create({ data: { restaurantId, userId: u.id, totalVisits: visits, updatedAt: new Date() } });
    }
  });

  after(async () => {
    await db.customerInsight.deleteMany({ where: { restaurantId } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.restaurant.deleteMany({ where: { tenantId } });
    await db.staff.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });
    await db.$disconnect();
  });

  test('limit=1 و بلافاصله limit=3 ⇒ ۱ و ۳ آیتم، نه پاسخِ کش‌شده‌ی قبلی', async () => {
    const small = await get('sort=visits&limit=1');
    assert.equal(small.status, 200);
    const s = await small.json();
    assert.equal(s.items.length, 1);
    assert.ok(s.next_cursor, 'کنترلِ مثبت: صفحه‌ی بعد وجود دارد');

    const big = await get('sort=visits&limit=3');
    const b = await big.json();
    assert.equal(b.items.length, 3, 'پیش از رفع، این پاسخِ کش‌شده‌ی limit=1 بود (۱ آیتم)');
    assert.deepEqual(b.items.map((x: { total_visits: number }) => x.total_visits), [9, 5, 1]);
  });

  test('صفحه‌بندی با next_cursor هیچ مشتری‌ای را جا نمی‌اندازد', async () => {
    const seen: number[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 5; page++) {
      const res = await get(`sort=visits&limit=1${cursor ? `&cursor=${cursor}` : ''}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      seen.push(...body.items.map((x: { total_visits: number }) => x.total_visits));
      cursor = body.next_cursor;
      if (!cursor) break;
    }
    assert.deepEqual(seen, [9, 5, 1], 'پیش از رفع [9, 1] بود — مشتریِ ۵ویزیتی در مرزِ صفحه گم می‌شد');
  });
});
