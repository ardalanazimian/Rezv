import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  چهار گاردِ `lib/reservations.ts` که هیچ تستی لمسشان نمی‌کرد
//
//  ⚠️ چرا این فایل ساخته شد (نمونه‌گیریِ جهش، ۲۰۲۶-۰۸-۲۸): چهار تغییرِ
//  کوچک در `createReservation` از **هر ۱۶ فایلِ تستی که این ماژول را لمس
//  می‌کنند** سالم رد شدند. هیچ‌کدام خرابکاریِ آشکار نیستند؛ هر چهار دقیقاً
//  شبیهِ یک اشتباهِ انسانیِ معمولی‌اند:
//
//    R1  `partySize < 1`  →  `partySize < 0`      (off-by-one)
//    R3  `t.capacity < partySize`  →  `< partySize - 1`   (off-by-one)
//    R5  `hasMergeableTables === 0` → `< 0`  (شرطی که هرگز درست نمی‌شود)
//
//  اثرِ واقعیِ هرکدام روی کسب‌وکار: رزروِ صفرنفره · نشاندنِ گروه روی میزِ
//  کوچک‌تر · و پذیرشِ گروهی که هیچ میزی برایش نیست.
//
//  هر سه با تزریقِ دوباره‌ی همان جهش راستی‌آزمایی شده‌اند (هر بار exit=1).
//
//  ── و یک موردِ چهارم که **سوراخ نبود** ──
//  جهشِ `occupiedNumbers.has(t.number)` → `has(String(t.number))` (خطِ ۱۸۳)
//  هم زنده مانده بود، ولی بررسی نشان داد آن خط یک پیش‌بررسیِ **افزونه** است:
//  خطوطِ ۲۸۲ و ۳۰۸ داخلِ تراکنش همان تداخل را مستقل می‌گیرند
//  (`occupiedNow.has(manualTableNumber)`). پس زنده‌ماندنِ جهش این‌جا به‌معنای
//  «محافظت نیست» نبود، به‌معنای «افزونگی هست» بود. تستِ R4 پایین نگه داشته
//  شد چون **رفتار** را پین می‌کند — نه خطِ خاصی را — و هیچ تستِ دیگری آن
//  رفتار را نمی‌سنجید.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { createReservation } = await import('../src/lib/reservations.ts');

const SFX = String(Date.now()).slice(-8);
let tenantId = '';
let restaurantId = '';

/** فردا — تا هرگز در گذشته نیفتد. */
const DATE = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);

before(async () => {
  const tenant = await db.tenant.create({ data: { name: `[DEMO] resv-guard ${SFX}` } });
  tenantId = tenant.id;
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `demo-resv-guard-${SFX}`, name: '[DEMO] رستورانِ گاردها',
      clubPrefix: 'DRG', isOpen: true, onlineGating: false, openingHours: undefined,
    },
    select: { id: true },
  });
  restaurantId = r.id;

  // ⚠️ هر تست میزِ **مستقلِ** خودش را می‌گیرد. مدتِ پیش‌فرضِ رزرو چند ساعت
  // است، پس دو تستِ متوالی رویِ یک میز به‌طورِ کاذب به تداخل می‌خورند و
  // نتیجه‌ی تستِ تداخل بی‌معنا می‌شود. همه ظرفیتِ ۲ و غیرقابلِ‌ترکیب‌اند تا
  // مسیرِ appِ تستِ R5 هم واقعاً هیچ گزینه‌ای نداشته باشد.
  for (const n of [911, 912, 913, 914, 915]) {
    await db.table.create({
      data: { restaurantId, number: n, capacity: 2, isActive: true, isMergeable: false },
    });
  }
});

/** ورودیِ پایه‌ی مسیرِ manual (رزروِ دستیِ کارکن روی میزِ مشخص). */
function manual(partySize: number, tableNumber: number, time: string) {
  return {
    restaurantId, date: DATE, time, partySize, source: 'manual' as const,
    notifySms: false,
    guest: { name: '[DEMO] مهمان', phone: '09370000000', tableNumber },
  };
}

describe('گاردهای createReservation', () => {
  test('R1 — partySize صفر رد می‌شود', async () => {
    await assert.rejects(
      () => createReservation({ ...manual(0, 911, '19:00') }),
      /تعداد نفر نامعتبر/,
      'کفِ معتبر ۱ است؛ `< 0` به‌جای `< 1` رزروِ صفرنفره را می‌پذیرد',
    );
  });

  test('R1 — کنترلِ مثبت: partySize یک پذیرفته می‌شود', async () => {
    const r = await createReservation({ ...manual(1, 912, '19:30') });
    assert.ok(r, 'یک نفر باید معتبر باشد — وگرنه گاردی که همه را رد کند هم پاس می‌شد');
  });

  test('R3 — میزِ کوچک‌تر از گروه رد می‌شود', async () => {
    // میزِ ۹۱۳ ظرفیتِ ۲ دارد؛ گروهِ ۳ نفره نباید رویش بنشیند.
    await assert.rejects(
      () => createReservation({ ...manual(3, 913, '20:00') }),
      /میز|ظرفیت|TABLE_TOO_SMALL/i,
      '`capacity < partySize - 1` یک نفر بیشتر از ظرفیت را بی‌صدا می‌پذیرد',
    );
  });

  test('R3 — کنترلِ مثبت: گروهِ دقیقاً هم‌اندازه‌ی ظرفیت پذیرفته می‌شود', async () => {
    const r = await createReservation({ ...manual(2, 914, '20:30') });
    assert.ok(r);
  });

  test('R4 — دو رزرو روی یک میز در یک بازه رد می‌شود', async () => {
    const first = await createReservation({ ...manual(2, 915, '21:00') });
    assert.ok(first, 'رزروِ اول باید موفق باشد');
    await assert.rejects(
      () => createReservation({ ...manual(2, 915, '21:00') }),
      /TABLE_CONFLICT|میز/i,
      'دو مهمان نباید روی یک میز در یک بازه بنشینند. این ادعا رفتار را پین '
      + 'می‌کند، نه یک خطِ خاص را — امروز گاردِ داخلِ تراکنش (خطوطِ ۲۸۲/۳۰۸) '
      + 'اجرایش می‌کند.',
    );
  });

  test('R5 — گروهی که هیچ میزی ندارد رد می‌شود', async () => {
    // مسیرِ app (بدونِ tableNumber): باید خودش میز پیدا کند. بزرگ‌ترین میز
    // ظرفیتِ ۲ دارد و ترکیب‌پذیر نیست، پس برای ۸ نفر هیچ گزینه‌ای نیست.
    await assert.rejects(
      () => createReservation({
        restaurantId, date: DATE, time: '22:00', partySize: 8,
        source: 'app', notifySms: false,
        guestName: '[DEMO] مهمان', guestPhone: '09370000001',
      } as never),
      /میز|NO_TABLE|ظرفیت|SLOT_FULL/i,
      '`hasMergeableTables < 0` هرگز درست نمی‌شود، پس نبودِ میز بی‌صدا رد می‌شود',
    );
  });
});

after(async () => {
  await db.reservation.deleteMany({ where: { restaurantId } });
  await db.table.deleteMany({ where: { restaurantId } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.$disconnect();
});
