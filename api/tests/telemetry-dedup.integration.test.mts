import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ dedupِ تله‌متری (فازِ ۲، پروتکل §۱۴)
//
//  باگ: هیچ شناسه‌ی ارسالیِ کلاینتی و هیچ کانسترینتِ یکتایی وجود نداشت، و
//  `createMany` بدونِ skipDuplicates صدا زده می‌شد. کلاینت ذاتاً at-least-once
//  است: `flush(false)` صف را فقط داخلِ `.then(r => r.ok)` هرس می‌کند، پس یک
//  fetchِ در پرواز + رویدادِ `visibilitychange` همان دسته را دوباره با
//  sendBeacon می‌فرستد و **هر دو درج می‌شوند**. همین برایِ هر پاسخِ گم‌شده هم
//  رخ می‌دهد (دسته در localStorage می‌ماند و در بارگذاریِ بعدی دوباره می‌رود).
//
//  اینجا رفتارِ واقعیِ DB سنجیده می‌شود، نه فرض: ایندکسِ یکتایِ **جزئی** روی
//  event_id + skipDuplicates.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { recordEvents } = await import('../src/lib/platform-events.ts');

const SUFFIX = Date.now().toString(36);
const TYPE = `search.performed_${SUFFIX}`;

async function countMine() {
  return db.platformEvent.count({ where: { type: TYPE } });
}

before(async () => {
  await db.platformEvent.deleteMany({ where: { type: TYPE } }).catch(() => {});
});

after(async () => {
  await db.platformEvent.deleteMany({ where: { type: TYPE } }).catch(() => {});
});

describe('dedupِ تله‌متری با event_id (§۱۴)', () => {
  test('ارسالِ دوباره‌ی همان event_id ردیفِ دوم نمی‌سازد', async () => {
    const eventId = `dedup-${SUFFIX}-a`;
    const ev = { type: TYPE, source: 'customer' as const, eventId, payload: { q: 'x' } };

    const first = await recordEvents([ev]);
    assert.equal(first, 1, 'بارِ اول باید درج شود');

    // دقیقاً همان دسته دوباره — سناریویِ beacon + fetchِ هم‌زمان.
    const second = await recordEvents([ev]);
    assert.equal(second, 0, 'بارِ دوم نباید درج شود (accepted باید صادق بماند)');

    assert.equal(await countMine(), 1, 'باید دقیقاً یک ردیف در DB باشد');
  });

  test('همان دسته با هر دو رویدادِ تکراری در یک فراخوانی', async () => {
    const eventId = `dedup-${SUFFIX}-b`;
    const ev = { type: TYPE, source: 'customer' as const, eventId, payload: {} };
    const before = await countMine();
    const n = await recordEvents([ev, ev]);
    assert.equal(n, 1, 'دو نسخه‌ی یکسان در یک دسته → فقط یکی');
    assert.equal(await countMine(), before + 1);
  });

  test('event_idهایِ متفاوت هر دو درج می‌شوند (dedup بیش از حد سخت‌گیر نیست)', async () => {
    const before = await countMine();
    const n = await recordEvents([
      { type: TYPE, source: 'customer', eventId: `dedup-${SUFFIX}-c1`, payload: {} },
      { type: TYPE, source: 'customer', eventId: `dedup-${SUFFIX}-c2`, payload: {} },
    ]);
    assert.equal(n, 2);
    assert.equal(await countMine(), before + 2);
  });

  test('رویدادِ بدونِ event_id همچنان درج می‌شود (ایندکس جزئی است)', async () => {
    // رویدادهایِ تولیدشده‌ی سرور event_id ندارند و ذاتاً یکتا هستند؛ ایندکسِ
    // جزئی (WHERE event_id IS NOT NULL) نباید جلویشان را بگیرد.
    const before = await countMine();
    const n = await recordEvents([
      { type: TYPE, source: 'backend', payload: {} },
      { type: TYPE, source: 'backend', payload: {} },
    ]);
    assert.equal(n, 2, 'دو رویدادِ بدونِ شناسه باید هر دو درج شوند');
    assert.equal(await countMine(), before + 2);
  });

  test('پیش‌فرضِ سطحِ اعتماد کم‌اعتمادترین است (fail-closed)', async () => {
    const eventId = `dedup-${SUFFIX}-d`;
    await recordEvents([{ type: TYPE, source: 'customer', eventId, payload: {} }]);
    const row = await db.platformEvent.findFirst({
      where: { type: TYPE, eventId },
      select: { trustLevel: true, serverReceivedAt: true },
    });
    assert.ok(row, 'ردیف باید وجود داشته باشد');
    assert.equal(row.trustLevel, 'ANONYMOUS_CLIENT', 'نبودِ مقدار نباید سطحِ معتمد بدهد');
    assert.ok(row.serverReceivedAt instanceof Date, 'server_received_at باید ست شود');
  });

  test('سطحِ اعتمادِ صریح ذخیره می‌شود', async () => {
    const eventId = `dedup-${SUFFIX}-e`;
    await recordEvents([
      { type: TYPE, source: 'backend', eventId, trustLevel: 'SERVER_VERIFIED', payload: {} },
    ]);
    const row = await db.platformEvent.findFirst({ where: { type: TYPE, eventId }, select: { trustLevel: true } });
    assert.equal(row?.trustLevel, 'SERVER_VERIFIED');
  });

  test('occurredAt خارج از پنجره در مسیرِ واقعیِ درج هم کلمپ می‌شود', async () => {
    const eventId = `dedup-${SUFFIX}-f`;
    await recordEvents([
      { type: TYPE, source: 'customer', eventId, occurredAt: '2099-01-01T00:00:00.000Z', payload: {} },
    ]);
    const row = await db.platformEvent.findFirst({ where: { type: TYPE, eventId }, select: { occurredAt: true } });
    assert.ok(row, 'ردیف باید درج شده باشد');
    assert.ok(
      row.occurredAt.getUTCFullYear() < 2099,
      `سالِ ۲۰۹۹ باید کلمپ می‌شد، بود: ${row.occurredAt.toISOString()}`,
    );
  });
});
