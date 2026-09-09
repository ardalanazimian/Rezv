import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ «بازنده‌ی رقابت خطایِ دامنه‌ای می‌گیرد، نه ۵۰۰» — نمونه‌ی P2028
//
//  چرا این فایل وجود دارد:
//  تراکنشِ درجِ رزرو `timeout: 10_000` دارد (`reservations.ts:389`). وقتی
//  رقابتِ واقعی روی یک اسلات آن ۱۰ ثانیه را مصرف کند، Prisma یک
//  `P2028 (Transaction already closed)` پرتاب می‌کند. تا امروز:
//
//      isSerializationError → 40001 · 40P01 · P2034   (P2028 در فهرست نیست)
//      آخرین خطِ catch      → throw e   (خام)
//      errorResponse        → 500 INTERNAL
//
//  یعنی یک تداخلِ کاملاً عادی و درست‌مدیریت‌شده‌ی DB به مشتری ۵۰۰ می‌داد،
//  در حالی که صحت هیچ مشکلی نداشت (میز دوبار رزرو نمی‌شد).
//
//  ⚠️ این چهارمین نمونه‌ی **یک کلاسِ واحد** در همین بلوکِ catch است، و سه
//  تای قبلی هرکدام جداگانه وصله خوردند:
//    ۲۰۲۶-۰۸-۱۴  throwِ خامِ ioredis وقتی Redis قطع بود  (metrics.ts:170)
//    ۲۰۲۶-۰۸-۱۹  SLOT_LOCK_TIMEOUTی که دروغ می‌گفت      (reservations.ts:257)
//    ۲۰۲۶-۰۸-۲۵  deadlockِ 40P01 که خام بالا می‌رفت      (reservations.ts:282)
//    ۲۰۲۶-۰۹-۰۹  P2028 — همین فایل
//  الگو روشن است: **هر خطایی که از رقابت زاده می‌شود و در فهرستِ صریح نیست،
//  به ۵۰۰ ترجمه می‌شود.** پس این تست عمداً روی «کدِ دامنه‌ای دارد یا نه»
//  ادعا می‌کند، نه روی «P2028 خاص» — تا نمونه‌ی پنجم را هم بگیرد.
//
//  ⚠️ «نبودِ موضوع» اینجا pass نیست: اگر رقابت ساخته نشود و رزرو موفق شود،
//  تست fail می‌کند، نه skip — وگرنه یک سبزیِ توخالی می‌ماند که هیچ‌چیز
//  نسنجیده.
//
//  ⚠️ چرا این تست کُند است (~۱۳ ثانیه) و کوتاه‌تر نمی‌شود: موضوعِ سنجش
//  خودِ timeoutِ ۱۰ ثانیه‌ایِ محصول است. هر بلاک‌کننده‌ی کوتاه‌تر از آن،
//  پنجره‌ی P2028 را اصلاً باز نمی‌کند — و دقیقاً به همین دلیل
//  `slot-lock-failopen-double-booking.test.mts:274` عمداً زیرِ ۱۰ ثانیه
//  می‌ماند و این حالت را هرگز ندیده بود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation } = await import('../src/lib/reservations.ts');
const { dateKeyInTz } = await import('../src/lib/hours.ts');
const { isSerializationError, isTransactionTimeoutError } = await import('../src/lib/reservation-helpers.ts');
const { Prisma } = await import('@prisma/client');

const RUN = Date.now().toString(36);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DATE = dateKeyInTz(new Date(Date.now() + 3 * 864e5), 'Asia/Tehran');

const tenantIds: string[] = [];
const restaurantIds: string[] = [];
let realFetch: typeof globalThis.fetch;

before(() => {
  realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('این تست حق ندارد به شبکه‌ی بیرونی بزند');
  }) as unknown as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  for (const rid of restaurantIds) {
    await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId: rid } } }).catch(() => {});
    await db.reservationItem.deleteMany({ where: { reservation: { restaurantId: rid } } }).catch(() => {});
    await db.reservation.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
    await db.table.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
    await db.restaurant.delete({ where: { id: rid } }).catch(() => {});
  }
  for (const tid of tenantIds) await db.tenant.delete({ where: { id: tid } }).catch(() => {});
});

// ═══════════════════════════════════════════════════════════════════════
//  لایه ۱ — طبقه‌بندی: ارزان، و تنها چیزی که نمونه‌ی پنجم را هم پوشش می‌دهد
// ═══════════════════════════════════════════════════════════════════════
describe('لایه ۱ — طبقه‌بندیِ خطاهایِ زاده‌ی رقابت', () => {
  const mk = (code: string) => new Prisma.PrismaClientKnownRequestError(
    'probe', { code, clientVersion: 'test' },
  );

  test('انقضایِ تراکنش خطایِ serialization نیست (پس نباید retry شود) ولی باید ترجمه شود', () => {
    // این تفکیک عمدی است: retryکردنِ تراکنشی که ۱۰ ثانیه صبر کرده یعنی
    // ۵۰ ثانیه انتظار برای مشتری. ترجمه بله، retry نه.
    //
    // ⚠️ نسخه‌ی اولِ همین ردیف `mk('P2028')` را با متنِ `'probe'` می‌داد و
    // انتظارِ `true` داشت — یعنی **خودِ تست هم همان باورِ بیش‌ازحد گسترده را
    // کدگذاری کرده بود** که فقط کد را کافی می‌دانست. وقتی طبقه‌بند باریک شد
    // این ردیف قرمز شد، و قرمزی‌اش درست بود: تستی که ادعای غلطِ نویسنده‌اش را
    // تکرار کند، گاردِ آن ادعا نیست، بازتابش است.
    const expired = new Prisma.PrismaClientKnownRequestError(
      'Transaction API error: Transaction already closed: A query cannot be executed '
      + 'on an expired transaction. The timeout for this transaction was 10000 ms.',
      { code: 'P2028', clientVersion: 'test' },
    );
    assert.equal(isSerializationError(expired), false,
      'انقضا نباید وارد حلقه‌ی retry شود — هر تلاش ۱۰ ثانیه طول می‌کشد');
    assert.equal(isTransactionTimeoutError(expired), true,
      'انقضایِ واقعی باید شناخته شود تا به ۴۰۹ ترجمه شود');
  });

  test('P2028ی که از باگِ برنامه‌نویسی می‌آید retryable شمرده نمی‌شود', () => {
    // ⚠️ یافته‌ی بازبین (`rezv-e6`)، چند ساعت پس از نسخه‌ی اولِ همین فایل:
    // `P2028` کدِ **عمومیِ** Transaction API است. اندازه‌گیری‌شده روی همین
    // ماشین، هر دو با همین کد و هر دو «Transaction already closed»:
    //
    //   انقضا (شلوغی)        → "…on an expired transaction. The timeout…"
    //   هندلِ بسته (باگ)      → "…on a committed transaction."
    //
    // اگر فقط روی کد تفکیک شود، **یک باگِ قطعی به «دوباره تلاش کن» ترجمه
    // می‌شود**: هر بار یکسان شکست می‌خورد، مشتری بی‌نهایت retry می‌زند، و
    // هیچ‌کس خبردار نمی‌شود. پیش از وصله، همان باگ ۵۰۰ می‌داد و پیدا می‌شد.
    // یعنی وصله‌ی نیمه‌کاره از نبودِ وصله بدتر بود.
    const committed = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.$queryRaw()` invocation:\n\nTransaction API error: '
      + 'Transaction already closed: A query cannot be executed on a committed transaction.',
      { code: 'P2028', clientVersion: 'test' },
    );
    assert.equal(isTransactionTimeoutError(committed), false,
      'استفاده از تراکنشِ بسته یک باگ است، نه شلوغی — نباید به «دوباره تلاش کن» ترجمه شود');
    assert.equal(isSerializationError(committed), false,
      'و نباید وارد حلقه‌ی retry هم بشود');

    const notFound = new Prisma.PrismaClientKnownRequestError(
      'Transaction API error: Transaction not found. Transaction ID is invalid.',
      { code: 'P2028', clientVersion: 'test' },
    );
    assert.equal(isTransactionTimeoutError(notFound), false,
      '«Transaction not found» هم علتِ دیگری از همان کد است و شلوغی نیست');
  });

  test('انقضایِ واقعی با متنِ واقعیِ Prisma شناخته می‌شود', () => {
    // متنِ عینیِ Prisma، از اجرای واقعی روی همین مخزن گرفته شده — نه بازنویسی.
    // اگر Prisma روزی جمله را عوض کند، لایه‌ی ۲ (که انقضای واقعی را تولید
    // می‌کند) قرمز می‌شود؛ این ردیف فقط سریع‌تر می‌گوید کجا را نگاه کنی.
    const real = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.$queryRaw()` invocation:\n\nTransaction API error: '
      + 'Transaction already closed: A query cannot be executed on an expired transaction. '
      + 'The timeout for this transaction was 300 ms, however 1517 ms passed since the start '
      + 'of the transaction.',
      { code: 'P2028', clientVersion: 'test' },
    );
    assert.equal(isTransactionTimeoutError(real), true);
  });

  test('خطاهایِ serialization به‌اشتباه انقضای تراکنش شمرده نمی‌شوند', () => {
    for (const code of ['P2034']) {
      assert.equal(isTransactionTimeoutError(mk(code)), false,
        `${code} انقضای تراکنش نیست و مسیرِ retryِ خودش را دارد`);
    }
    assert.equal(isTransactionTimeoutError(new Error('boom')), false,
      'خطایِ نامربوط نباید انقضای تراکنش شمرده شود');
    assert.equal(isTransactionTimeoutError(null), false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  لایه ۲ — رفتارِ زنده: رقابتِ واقعی، تراکنشِ واقعی، خطایِ واقعی
// ═══════════════════════════════════════════════════════════════════════
describe('لایه ۲ — رقابتی که ۱۰ ثانیه‌ی تراکنش را مصرف می‌کند', () => {
  test('بازنده کدِ دامنه‌ای می‌گیرد، نه خطایِ خامی که به ۵۰۰ ترجمه شود', async () => {
    const tenant = await db.tenant.create({ data: { name: `[DEMO] txtimeout ${RUN}` } });
    tenantIds.push(tenant.id);
    const r = await db.restaurant.create({
      data: {
        tenantId: tenant.id, slug: `demo-txtimeout-${RUN}`, name: '[DEMO] txtimeout',
        clubPrefix: 'TXT', isOpen: true, onlineGating: false,
      },
    });
    restaurantIds.push(r.id);
    const t = await db.table.create({
      data: { restaurantId: r.id, number: 911, capacity: 2, minPartySize: 1, isActive: true },
    });

    const start = new Date(`${DATE}T16:30:00.000Z`);
    const end = new Date(start.getTime() + 90 * 60_000);

    // ردیفِ **commitنشده** روی همان میز/بازه. INSERTِ محصول پشتِ EXCLUDE
    // بلاک می‌شود و تراکنشش ۱۰ ثانیه‌اش را تمام می‌کند.
    let insertedResolve!: () => void;
    const inserted = new Promise<void>((res) => { insertedResolve = res; });
    let blockerInsertOk = false;

    const blocker = db.$transaction(async (tx) => {
      try {
        await tx.$executeRaw`
          INSERT INTO reservations (code, restaurant_id, table_id, party_size, slot_start, slot_end,
                                    status, source, merged_table_numbers, block_buffer_minutes)
          VALUES (${'BLK-' + RUN}, ${r.id}::uuid, ${t.id}::uuid, 2,
                  ${start}::timestamp, ${end}::timestamp, 'confirmed', 'manual', ARRAY[]::smallint[], 0)`;
        blockerInsertOk = true;
      } finally { insertedResolve(); }
      await sleep(13_000);              // ← عمداً بیشتر از ۱۰ ثانیه‌ی محصول
      throw new Error('__rollback__');  // ردیفِ بلاک‌کننده هرگز commit نمی‌شود
    }, { timeout: 30_000 }).catch(() => {});

    await inserted;
    assert.ok(blockerInsertOk,
      'ردیفِ بلاک‌کننده درج نشد — این تست بدونِ رقابت هیچ‌چیز نمی‌سنجد');
    await sleep(150);

    let outcome: 'fulfilled' | 'rejected' = 'fulfilled';
    let err: { name?: string; code?: string; status?: number; message?: string } = {};
    try {
      await createReservation({
        restaurantId: r.id, date: DATE, time: '20:00', partySize: 2,
        guest: { name: '[DEMO] victim', tableNumber: 911 }, source: 'manual', notifySms: false,
      });
    } catch (e) {
      outcome = 'rejected';
      err = e as typeof err;
    }
    await blocker;

    // نبودِ موضوع = خطا. اگر رزرو موفق شده، رقابت ساخته نشده و سبزیِ این
    // تست توخالی است.
    assert.equal(outcome, 'rejected',
      'رزرو نباید موفق می‌شد — رقابت ساخته نشد و تست موضوعی نداشت');

    // ادعایِ اصلی: خطا باید کدِ دامنه‌ای داشته باشد. عمداً روی «کد دارد»
    // ادعا می‌شود نه روی «P2028 نیست»، تا نمونه‌ی بعدیِ همین کلاس هم بیفتد.
    const allowed = new Set(['TABLE_CONFLICT', 'SLOT_FULL', 'CONCURRENCY_RETRY', 'SLOT_LOCK_TIMEOUT']);
    assert.ok(
      err.code && allowed.has(err.code),
      'بازنده‌ی رقابت باید کدِ دامنه‌ای بگیرد وگرنه errorResponse آن را ۵۰۰ی '
      + `عمومی می‌کند؛ گرفت: name=${err.name} code=${err.code} status=${err.status ?? '-'}`,
    );
    assert.ok(typeof err.status === 'number' && err.status >= 400 && err.status < 500,
      `خطا باید ApiErrorی با وضعیتِ ۴xx باشد، نه خطایِ خام؛ status=${err.status ?? '-'}`);

    // و **کدام** کدِ دامنه‌ای — چون این‌جا فقط یکی از آنها صادق است.
    // ردیفِ بلاک‌کننده هرگز commit نمی‌شود، پس بازخوانیِ اشغال (که فقط
    // داده‌ی commitشده را می‌بیند) نمی‌تواند ثابت کند میز پر است. ادعای
    // TABLE_CONFLICT این‌جا یک ادعایِ **اثبات‌نشده** است — دقیقاً همان چیزی
    // که «اول ثابت کن پر است، بعد ادعا کن» در `reservations.ts` منع می‌کند.
    assert.equal(err.code, 'CONCURRENCY_RETRY',
      'وقتی اشغال اثبات نمی‌شود، جوابِ صادق ۴۰۹ «دوباره تلاش کن» است — نه '
      + `ادعایِ اثبات‌نشده‌ی پر بودنِ میز؛ گرفت: ${err.code}`);

    // و صحت — که در تمامِ این ماجرا هرگز نشکسته بود — همچنان برقرار است.
    const rows = await db.reservation.count({ where: { restaurantId: r.id } });
    assert.equal(rows, 0,
      'بلاک‌کننده rollback شد و بازنده هم چیزی ننوشت — نباید ردیفی مانده باشد');
  });
});
