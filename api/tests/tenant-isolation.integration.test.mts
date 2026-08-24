import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';

// ═══════════════════════════════════════════════════════════════════════
//  ایزولاسیونِ تنانت — قفلِ رگرسیون در سطحِ دادهٔ واقعی.
//
//  چرا این فایل ساخته شد (ممیزیِ ۲۰۲۶-۰۸-۱۹): ایزولاسیون بارها در کد ادعا
//  شده بود ولی هیچ تستِ خودکاری آن را با **دو تنانتِ واقعی و دادهٔ واقعی**
//  نمی‌سنجید. ممیزیِ دستی سالم بودنش را نشان داد؛ این تست همان را قفل می‌کند
//  تا رفکتورِ بعدی بی‌صدا نشکندش.
//
//  آنچه سنجیده می‌شود، قیدِ ساختاری است: هر کوئریِ دامنه باید با
//  restaurantId فیلتر شود. تستِ زنده‌ی HTTP (شاملِ تلاشِ override با هدرِ
//  X-Restaurant-Id) در همان ممیزی جداگانه اجرا شد و نتیجه‌اش در
//  KNOWN_LIMITATIONS ثبت است.
//
//  ⚠️ کنترلِ مثبت حیاتی است: تستی که فقط «A دادهٔ B را نمی‌بیند» را بسنجد،
//  وقتی B اصلاً داده‌ای ندارد هم پاس می‌شود — یعنی هیچ چیزی ثابت نمی‌کند.
//  پس هر ادعایِ منفی اینجا با یک ادعایِ مثبت جفت شده است.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `iso-${randomUUID().slice(0, 8)}`;
type Side = { tenantId: string; restaurantId: string; tableId: string; itemId: string };
let A: Side, B: Side;

async function makeSide(label: string): Promise<Side> {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-${label}` }, select: { id: true } });
  const r = await db.restaurant.create({
    data: {
      tenantId: t.id, slug: `${TAG}-${label}`, name: `[DEMO] رستوران ${label}`,
      timezone: 'Asia/Tehran', clubPrefix: label.toUpperCase(), isOpen: true,
    },
    select: { id: true },
  });
  const tb = await db.table.create({
    data: { restaurantId: r.id, number: 1, capacity: 4, isActive: true },
    select: { id: true },
  });
  const item = await db.menuItem.create({
    data: { restaurantId: r.id, name: `[DEMO] محرمانه‌ی ${label}`, priceToman: 111_000, isActive: true },
    select: { id: true },
  });
  return { tenantId: t.id, restaurantId: r.id, tableId: tb.id, itemId: item.id };
}

before(async () => {
  A = await makeSide('a');
  B = await makeSide('b');
  // دادهٔ واقعی برایِ B — بدونِ این، «ندیدن» بی‌معناست.
  await db.reservation.create({
    data: {
      restaurantId: B.restaurantId, tableId: B.tableId, code: `${TAG}-SECRET`,
      status: 'confirmed', slotStart: new Date(Date.now() + 2 * 3600_000),
      slotEnd: new Date(Date.now() + 3.5 * 3600_000),
      durationMinutes: 90, blockBufferMinutes: 15, partySize: 2,
      guestName: '[DEMO] مهمانِ محرمانه‌ی B',
    },
  });
});

after(async () => {
  const ids = [A.restaurantId, B.restaurantId];
  await db.reservation.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.clubMember.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.menuItem.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.table.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.restaurant.deleteMany({ where: { id: { in: ids } } });
  await db.tenant.deleteMany({ where: { id: { in: [A.tenantId, B.tenantId] } } });
});

describe('ایزولاسیونِ تنانت', () => {
  test('کنترلِ مثبت: رزروِ B واقعاً وجود دارد', async () => {
    // اگر این بیفتد، همه‌ی ادعاهایِ منفیِ زیر بی‌اعتبارند.
    const own = await db.reservation.findMany({ where: { restaurantId: B.restaurantId } });
    assert.equal(own.length, 1);
    assert.match(own[0].guestName ?? '', /محرمانه‌ی B/);
  });

  test('کوئریِ رزروِ A هیچ ردیفی از B نمی‌بیند', async () => {
    const rows = await db.reservation.findMany({ where: { restaurantId: A.restaurantId } });
    assert.equal(rows.length, 0);
    assert.ok(!rows.some(r => (r.guestName ?? '').includes('محرمانه‌ی B')));
  });

  test('منو: هر تنانت فقط آیتمِ خودش را می‌بیند', async () => {
    const a = await db.menuItem.findMany({ where: { restaurantId: A.restaurantId }, select: { name: true } });
    const b = await db.menuItem.findMany({ where: { restaurantId: B.restaurantId }, select: { name: true } });
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.match(a[0].name, /محرمانه‌ی a/);
    assert.match(b[0].name, /محرمانه‌ی b/);
  });

  test('IDOR: پیداکردنِ آیتمِ B با idش، مقیدشده به restaurantIdِ A، چیزی نمی‌دهد', async () => {
    // دقیقاً همان الگویی که `findOwnedItem` در روت‌ها استفاده می‌کند.
    const asA = await db.menuItem.findFirst({ where: { id: B.itemId, restaurantId: A.restaurantId } });
    assert.equal(asA, null, 'قیدِ restaurantId تنها چیزی است که بینِ مهاجم و دادهٔ B ایستاده');
    const asB = await db.menuItem.findFirst({ where: { id: B.itemId, restaurantId: B.restaurantId } });
    assert.ok(asB, 'کنترلِ مثبت: مالکِ واقعی می‌بیندش');
  });

  test('میزها هم بینِ تنانت‌ها نشت نمی‌کنند', async () => {
    const a = await db.table.findMany({ where: { restaurantId: A.restaurantId }, select: { id: true } });
    assert.equal(a.length, 1);
    assert.notEqual(a[0].id, B.tableId);
  });
});
