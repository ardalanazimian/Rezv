import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
// `Prisma` is already bound as a VALUE at :49 (`const { Prisma } = await import(...)`)
// for TransactionIsolationLevel. The TYPE namespace is a separate thing, so it is
// imported under an alias rather than shadowing the value binding.
import type { Prisma as PrismaTypes } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ «DB منبعِ حقیقتِ ضدِ double-booking است» — ادعایِ صریحِ redis.ts:163
//
//  چرا این فایل وجود دارد:
//  `withSlotLock` وقتی Redis در دسترس نیست fail-open می‌شود — قفل را کاملاً
//  رها می‌کند و بخشِ بحرانی را **بدونِ هیچ قفلی** اجرا می‌کند
//  (src/lib/redis.ts:162-168). توجیهش یک جمله‌ی داخلِ پرانتز است:
//  «DB منبعِ حقیقتِ ضدِ double-booking است». تا امروز آن جمله هیچ گاردی
//  نداشت که اگر روزی دروغ شود قرمز شود.
//
//  اگر آن جمله درست باشد، قطعیِ Redis فقط throughput می‌گیرد. اگر دروغ باشد،
//  یک قطعیِ Redis بی‌صدا اجازه‌ی رزروِ تکراریِ میزِ یک رستورانِ واقعی را
//  می‌دهد و هیچ‌چیز در محصول به کسی خبر نمی‌دهد.
//
//  این فایل آن جمله را به سه لایه تجزیه می‌کند و **هر سه** را زنده می‌سنجد:
//    ۱. EXCLUDE constraintِ `no_table_overlap` روی DBِ زنده وجود دارد و
//       مجموعه‌ی وضعیت‌هایش **دقیقاً** برابرِ ACTIVE_RESERVATION_STATUSES است
//       (حذفِ یک وضعیت از constraint = همان باگِ تاریخیِ C1، و یک جهشِ جزئی
//        است که با «constraint هست یا نه» گرفته نمی‌شود).
//    ۲. تراکنشِ درجِ رزرو واقعاً SERIALIZABLE است — با شمردنِ SIReadLockِ
//       زنده در pg_locks در حالی که تراکنشِ محصول باز و بلاک است. اگر کسی
//       isolation را به ReadCommitted تنزل دهد، این عدد صفر می‌شود.
//    ۳. رفتار: N درخواستِ واقعاً هم‌زمان با قفلِ fail-openِ **واقعی** (نه یک
//       bypass) دقیقاً یک برنده دارد و هیچ تداخلِ فیزیکی نمی‌سازد.
//
//  ⚠️ «نبودِ موضوع» اینجا هرگز pass نیست:
//    • اگر constraint نباشد → fail، نه skip.
//    • اگر شاخه‌ی fail-openِ redis.ts اصلاً اجرا نشده باشد (شمارنده تکان
//      نخورد) → fail، چون آن‌وقت این تست هیچ‌چیز را نسنجیده.
//    • تستِ write-skew یک **کنترلِ مثبت** دارد: همان اینترلیو در
//      READ COMMITTED باید واقعاً یک double-booking بسازد. اگر نسازد یعنی
//      خودِ harness ریس را تولید نکرده و سبزیِ نسخه‌ی SERIALIZABLE توخالی
//      است → fail.
//
//  ⚠️ شبکه‌ی بیرونی: این مسیر هیچ fetchِ بیرونی ندارد (notifySms:false)، ولی
//  طبقِ قاعده‌ی ۶ به‌هرحال fetch در طولِ این فایل بسته می‌شود تا هیچ اجرایی
//  به در دسترس بودنِ کسی گره نخورد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation } = await import('../src/lib/reservations.ts');
const { withSlotLock } = await import('../src/lib/redis.ts');
const { metrics } = await import('../src/lib/metrics.ts');
const { ACTIVE_RESERVATION_STATUSES } = await import('../src/lib/reservation-status.ts');
const { Prisma } = await import('@prisma/client');
const { dateKeyInTz } = await import('../src/lib/hours.ts');

const ACTIVE = [...ACTIVE_RESERVATION_STATUSES];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── قفلی که دقیقاً شاخه‌ی fail-openِ تولید را اجرا می‌کند ───────────────
// عمداً `withSlotLock` واقعی صدا زده می‌شود با یک LockClientی که set()اش
// throw می‌کند — یعنی خطوطِ ۱۶۲-۱۶۸ redis.ts (log + متریک + return fn())
// واقعاً اجرا می‌شوند. یک تابعِ «مستقیم fn() را صدا بزن» این را نمی‌سنجید.
let downSetCalls = 0;
const downClient = {
  set: async () => { downSetCalls++; throw new Error('connect ECONNREFUSED 127.0.0.1:6379'); },
  eval: async () => { throw new Error('connect ECONNREFUSED 127.0.0.1:6379'); },
} as unknown as Parameters<typeof withSlotLock>[3];

const failOpenLock = <T,>(key: string, ttl: number, fn: () => Promise<T>) =>
  withSlotLock(key, ttl, fn, downClient);

function fallbackCount(): number {
  const txt = metrics.slotLockFallback.render();
  const sample = txt.split('\n').find((l) => l.startsWith('rezervno_slot_lock_fallback_total '));
  if (!sample) return 0; // هنوز هیچ‌وقت inc نشده = صفر
  const v = Number(sample.split(' ')[1]);
  assert.ok(Number.isFinite(v), `نمونه‌ی نامفهومِ شمارنده: ${sample}`);
  return v;
}

/** تداخلِ فیزیکیِ واقعی: هم میزِ اصلی (table_id) هم میزهایِ ثانویه‌ی merge. */
async function physicalOverlaps(restaurantId: string) {
  return db.$queryRaw<{ a: string; b: string; num: number }[]>`
    WITH occ AS (
      SELECT r.id, r.restaurant_id, r.slot_start, r.block_end, t.number AS num
      FROM reservations r JOIN tables t ON t.id = r.table_id
      WHERE r.restaurant_id = ${restaurantId}::uuid
        AND r.status::text = ANY(${ACTIVE}) AND r.table_id IS NOT NULL
      UNION ALL
      SELECT r.id, r.restaurant_id, r.slot_start, r.block_end, unnest(r.merged_table_numbers) AS num
      FROM reservations r
      WHERE r.restaurant_id = ${restaurantId}::uuid
        AND r.status::text = ANY(${ACTIVE}) AND cardinality(r.merged_table_numbers) > 0
    )
    SELECT DISTINCT a.id AS a, b.id AS b, a.num AS num
    FROM occ a JOIN occ b
      ON a.restaurant_id = b.restaurant_id AND a.num = b.num AND a.id < b.id
    WHERE tsrange(a.slot_start, a.block_end) && tsrange(b.slot_start, b.block_end)
  `;
}

async function activeRows(restaurantId: string) {
  return db.$queryRaw<{ id: string; num: number | null; merged: number[] }[]>`
    SELECT r.id, t.number AS num, r.merged_table_numbers AS merged
    FROM reservations r LEFT JOIN tables t ON t.id = r.table_id
    WHERE r.restaurant_id = ${restaurantId}::uuid AND r.status::text = ANY(${ACTIVE})
  `;
}

// ── فیکسچر: هر سناریو رستورانِ خودش را دارد ─────────────────────────────
//  ⚠️ درسِ همین فایل (خطایِ واقعیِ خودم حینِ ساختش): اول همه‌ی سناریوها روی یک
//  رستوران با فاصله‌ی یک‌ساعته بودند، در حالی که بلاکِ هر رزرو ۹۰+۱۵=۱۰۵ دقیقه
//  است — سناریویِ بعدی با برنده‌ی سناریویِ قبلی تداخل می‌کرد و «صفر برنده»
//  می‌داد که به‌غلط شبیهِ باگِ محصول بود. جداسازیِ کاملِ فیکسچر لازم است.
const RUN = Math.random().toString(36).slice(2, 8);
const DATE = dateKeyInTz(new Date(Date.now() + 45 * 86_400_000), 'Asia/Tehran');
const restaurantIds: string[] = [];
const tenantIds: string[] = [];
let realFetch: typeof globalThis.fetch;

async function freshRestaurant(
  tag: string,
  tables: Array<{ number: number; capacity: number; minPartySize?: number; isMergeable?: boolean; mergeableWith?: number[] }>,
) {
  const tenant = await db.tenant.create({ data: { name: `[DEMO] slotlock ${RUN} ${tag}` } });
  tenantIds.push(tenant.id);
  const r = await db.restaurant.create({
    data: {
      tenantId: tenant.id, slug: `demo-slotlock-${RUN}-${tag}`, name: `[DEMO] ${tag}`,
      clubPrefix: 'SLK', isOpen: true, onlineGating: false,
    },
  });
  restaurantIds.push(r.id);
  for (const t of tables) {
    await db.table.create({
      data: {
        restaurantId: r.id, number: t.number, capacity: t.capacity,
        minPartySize: t.minPartySize ?? 1, isActive: true,
        isMergeable: t.isMergeable ?? false, mergeableWith: t.mergeableWith ?? [],
      },
    });
  }
  // نبودِ موضوع = خطا: اگر فیکسچر ساخته نشد، تست باید بلند شکست بخورد نه اینکه
  // بی‌صدا روی صفرِ ردیف سبز بماند.
  const made = await db.table.count({ where: { restaurantId: r.id } });
  assert.equal(made, tables.length, `فیکسچرِ ${tag} ساخته نشد — تست بدونِ موضوع اجرا نمی‌شود`);
  return r.id;
}

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
    await db.clubMember.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
    await db.clubCodeCounter.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
    await db.reservation.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
    await db.table.deleteMany({ where: { restaurantId: rid } }).catch(() => {});
    await db.restaurant.deleteMany({ where: { id: rid } }).catch(() => {});
  }
  for (const tid of tenantIds) await db.tenant.deleteMany({ where: { id: tid } }).catch(() => {});
});

// ═══════════════════════════════════════════════════════════════════════
//  لایه ۱ — خودِ constraint روی دیتابیسِ زنده (نه روی فایل)
// ═══════════════════════════════════════════════════════════════════════
describe('لایه ۱ — EXCLUDE constraintِ ضدِ رزروِ تکراری روی DBِ زنده', () => {
  test('no_table_overlap وجود دارد و مجموعه‌ی وضعیت‌هایش دقیقاً برابرِ ACTIVE_RESERVATION_STATUSES است', async () => {
    const rows = await db.$queryRaw<{ conname: string; def: string }[]>`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'reservations'::regclass AND contype = 'x'
    `;
    // نبودِ موضوع = خطا. یک DBِ بدونِ این constraint نباید «هیچ چیزی برای
    // سنجیدن نبود، پس سبز» بخواند.
    assert.equal(rows.length, 1,
      `دقیقاً یک EXCLUDE constraint روی reservations انتظار می‌رود، ${rows.length} پیدا شد`);
    const { conname, def } = rows[0];
    assert.equal(conname, 'no_table_overlap');

    // شکلِ محافظ: میز + بازه‌ی [slot_start, block_end)
    assert.match(def, /EXCLUDE USING gist/);
    assert.match(def, /table_id WITH =/);
    assert.match(def, /tsrange\(slot_start, block_end\) WITH &&/);
    assert.match(def, /table_id IS NOT NULL/);

    // ⚠️ جهشِ جزئی که «constraint هست؟» نمی‌گیرد: حذفِ **یک** وضعیت از WHERE.
    // این دقیقاً باگِ تاریخیِ C1 است (auto_confirmed/preparing/checked_in/
    // running_late/dining در لیست نبودند و میز در آن وضعیت‌ها دوباره
    // رزرو می‌شد). پس تساویِ مجموعه سنجیده می‌شود، نه صرفِ وجود.
    const inConstraint = new Set(
      [...def.matchAll(/'([a-z_]+)'::reservation_status/g)].map((m) => m[1]),
    );
    assert.deepEqual(
      [...inConstraint].sort(),
      [...ACTIVE].sort(),
      'مجموعه‌ی وضعیت‌های constraint با ACTIVE_RESERVATION_STATUSES یکی نیست — '
      + 'یعنی یک وضعیتِ فعال محافظتِ DB ندارد (بازگشتِ باگِ C1)',
    );
  });

  test('ستونِ block_end یک ستونِ generatedِ واقعی است (پایه‌ی محاسبه‌ی بازه‌ی بلاک)', async () => {
    const rows = await db.$queryRaw<{ is_generated: string; expr: string | null }[]>`
      SELECT is_generated, generation_expression AS expr
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'block_end'
    `;
    assert.equal(rows.length, 1, 'ستونِ block_end روی DBِ زنده وجود ندارد — constraint بی‌معنا می‌شود');
    assert.equal(rows[0].is_generated, 'ALWAYS');
    assert.match(String(rows[0].expr), /block_buffer_minutes/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  لایه ۲ — تراکنشِ درجِ رزرو واقعاً SERIALIZABLE است (سنجشِ زنده، نه grep)
// ═══════════════════════════════════════════════════════════════════════
describe('لایه ۲ — تراکنشِ محصول واقعاً SERIALIZABLE است', () => {
  test('در حینِ باز بودنِ تراکنشِ createReservation، SIReadLock روی reservations وجود دارد', async () => {
    const rid = await freshRestaurant('iso', [{ number: 811, capacity: 2 }]);
    const t = await db.table.findFirstOrThrow({ where: { restaurantId: rid, number: 811 } });
    const start = new Date(`${DATE}T18:30:00.000Z`);
    const end = new Date(start.getTime() + 90 * 60_000);

    // یک ردیفِ **commitنشده** روی همان میز/بازه می‌گذاریم. INSERTِ محصول پشتِ
    // همین EXCLUDE بلاک می‌شود، پس تراکنشش قطعاً باز می‌ماند و SELECTهای
    // داخلش (getOccupiedTableNumbers) از قبل SIReadLock گرفته‌اند — اگر واقعاً
    // SERIALIZABLE باشد. اگر کسی isolation را ReadCommitted کند، این عدد صفر
    // می‌شود و تست قرمز می‌شود.
    //
    // ⚠️ دو نسخه‌ی قبلیِ همین چیدمان flaky بودند و هر دو با اجرای کاملِ
    // `npm test` (۱۵۴۲ تست) لو رفتند، نه با اجرای تکیِ فایل:
    //   • نسخه‌ی ۱ یک پنجره‌ی **ثابتِ** ۲٫۵ ثانیه‌ای داشت؛ زیرِ بار محصول هنوز
    //     به INSERTش نرسیده بود و نمونه صفر می‌شد.
    //   • نسخه‌ی ۲ به‌جایش «آیا کسی پشتِ قفل منتظر است؟» را از
    //     pg_stat_activity می‌پرسید و همان لحظه نمونه می‌گرفت — ولی در
    //     processِ شلوغِ رانرِ کامل، *سشنِ دیگری* (نه محصول) منتظر بود و
    //     نمونه‌برداری زودتر از باز شدنِ تراکنشِ محصول اتفاق می‌افتاد.
    // درسِ مشترک: به هیچ **نماینده‌ی** غیرمستقیم اعتماد نکن. حالا خودِ
    // موضوع در طولِ کلِ پنجره نمونه‌برداری می‌شود و بیشینه‌اش برداشته
    // می‌شود. این ادعا را ضعیف نمی‌کند (هنوز «باید SIReadLock وجود داشته
    // باشد» است)، فقط منبعِ نویز را حذف می‌کند.
    // ⚠️ دو اصلاحِ دیگر که فقط در اجرای کاملِ `npm test` قابلِ کشف بودند:
    //  الف) `sleep(300)` تضمین نمی‌کرد ردیفِ بلاک‌کننده نوشته شده باشد؛ زیرِ
    //      بار، blocker هنوز منتظرِ اتصالِ استخر بود و محصول **بدونِ اینکه
    //      اصلاً پارک شود** موفق می‌شد. «محصول موفق شد» پس اثباتِ برقراریِ
    //      چیدمان نیست. حالا یک گیتِ صریح: محصول تنها بعد از INSERTِ واقعیِ
    //      blocker شروع می‌شود. گیت در `finally` آزاد می‌شود تا abortِ blocker
    //      هیچ‌وقت تست را معلق نگذارد — این احتیاط است، نه رفعِ یک باگِ
    //      مشاهده‌شده (یک probeِ اولیه معلق ماند ولی علتِ واقعی‌اش بعداً
    //      ENOSPC روی لولهٔ لاگ از آب درآمد، نه این گیت).
    //  ب) SIReadLock همیشه روی خودِ heap نمی‌نشیند: با index scan روی
    //      **ایندکس** ثبت می‌شود. فیلترِ `relation = 'reservations'::regclass`
    //      روی جدولِ خالی (seq scan) کار می‌کرد و روی دیتابیسِ پرِ اجرای
    //      کامل (index scan) صفر می‌داد. دامنه هنوز دقیقاً همین جدول است:
    //      خودش + ایندکس‌هایش.
    let maxSIRead = 0;
    let pollCount = 0;
    let lockDump = '';
    let blockerInsertedResolve!: () => void;
    const blockerInserted = new Promise<void>((r) => { blockerInsertedResolve = r; });

    const blocker = db.$transaction(async (tx) => {
      try {
        await tx.$executeRaw`
          INSERT INTO reservations (code, restaurant_id, table_id, party_size, slot_start, slot_end,
                                    status, source, merged_table_numbers, block_buffer_minutes)
          VALUES (${'BLK-' + RUN}, ${rid}::uuid, ${t.id}::uuid, 2,
                  ${start}::timestamp, ${end}::timestamp, 'confirmed', 'manual', ARRAY[]::smallint[], 0)`;
      } finally {
        blockerInsertedResolve();
      }
      // مهلت عمداً کمتر از timeoutِ ۱۰ ثانیه‌ایِ تراکنشِ خودِ محصول
      // (reservations.ts:396) است تا قبل از تسلیمِ محصول نمونه بگیریم.
      const deadline = Date.now() + 8_000;
      while (Date.now() < deadline) {
        pollCount++;
        const locks = await db.$queryRaw<{ c: number }[]>`
          SELECT count(*)::int AS c FROM pg_locks
          WHERE mode = 'SIReadLock'
            AND relation IN (
              SELECT 'reservations'::regclass::oid
              UNION SELECT indexrelid FROM pg_index WHERE indrelid = 'reservations'::regclass
            )`;
        if (locks[0].c > maxSIRead) maxSIRead = locks[0].c;
        if (maxSIRead > 0) break;
        await sleep(25);
      }
      if (maxSIRead === 0) {
        // تشخیصِ شکست: بگو *کجا* SIReadLock هست (اگر جایی هست)، تا دفعه‌ی
        // بعد به‌جای فرضیه، داده داشته باشیم.
        const dump = await db.$queryRaw<{ rel: string | null; c: number }[]>`
          SELECT COALESCE(relation::regclass::text, '(none)') AS rel, count(*)::int AS c
          FROM pg_locks WHERE mode = 'SIReadLock' GROUP BY 1 ORDER BY 2 DESC LIMIT 10`;
        lockDump = JSON.stringify(dump);
      }
      throw new Error('__rollback__');         // ردیفِ بلاک‌کننده هرگز commit نمی‌شود
    }, { timeout: 25_000 }).catch((e: Error) => {
      blockerInsertedResolve();                // حتی اگر خودِ INSERT شکست بخورد
      if (!String(e.message).includes('__rollback__')) throw e;
    });

    await blockerInserted;                     // گیت: ردیفِ بلاک‌کننده قطعاً نوشته شده
    const startedAt = Date.now();
    const product = await Promise.resolve(createReservation(
      {
        restaurantId: rid, date: DATE, time: '22:00', partySize: 2,
        guest: { name: `[DEMO] iso-${RUN}`, tableNumber: 811 }, source: 'manual', notifySms: false,
      },
      { acquireSlotLock: failOpenLock },
    ).catch((e: unknown) => e));
    const productMs = Date.now() - startedAt;

    await blocker;

    assert.ok(
      product && typeof product === 'object' && 'code' in (product as Record<string, unknown>),
      'محصول پس از rollbackِ ردیفِ بلاک‌کننده رزرو نساخت ⇒ چیدمانِ تست برقرار نشده '
      + `(نه اینکه محصول سالم باشد). نتیجه: ${JSON.stringify(product)?.slice(0, 200)}`,
    );
    assert.ok(pollCount > 0, 'حلقه‌ی نمونه‌برداری اصلاً اجرا نشد — تست موضوعی نداشته');
    assert.ok(
      maxSIRead > 0,
      'هیچ SIReadLockی روی reservations (یا ایندکس‌هایش) دیده نشد ⇒ تراکنشِ درجِ رزرو '
      + 'SERIALIZABLE نیست. محافظتِ میزهایِ ثانویه‌ی merge (که EXCLUDE اصلاً نمی‌بیندشان) '
      + `فقط از همین isolation می‌آید. نمونه‌ها: ${pollCount}، بیشینه: ${maxSIRead}، `
      + `مدتِ محصول: ${productMs}ms، SIReadLockهای موجود: ${lockDump || '(بدونِ dump)'}`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  لایه ۳ — رفتار: قفل کاملاً fail-open، DB به‌تنهایی
// ═══════════════════════════════════════════════════════════════════════
describe('لایه ۳ — با قفلِ fail-openِ واقعی، DB به‌تنهایی دقیقاً یک برنده می‌دهد', () => {
  test('۱۰ درخواستِ هم‌زمان روی یک میزِ مشخص: یک ردیف، صفر تداخلِ فیزیکی، و هر ۱۰ تا واقعاً از شاخه‌ی fail-open رد شدند', async () => {
    const N = 10;
    const rid = await freshRestaurant('direct', [{ number: 812, capacity: 2 }]);
    const beforeFallback = fallbackCount();
    const beforeSet = downSetCalls;

    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => createReservation(
        {
          restaurantId: rid, date: DATE, time: '20:00', partySize: 2,
          guest: { name: `[DEMO] d-${i}`, tableNumber: 812 }, source: 'manual', notifySms: false,
        },
        { acquireSlotLock: failOpenLock },
      )),
    );

    // ⚠️ اگر شاخه‌ی fail-open اجرا نشده باشد این تست هیچ‌چیز درباره‌ی «قطعیِ
    // Redis» نسنجیده. پس نبودش خطاست، نه عبور.
    //
    // ⚠️ چرا `>= 1` و نه `=== N` (خطایِ خودم در نسخه‌ی اول، با جهشِ M2 لو رفت):
    // پیش‌چکِ بیرونِ قفل (reservations.ts:191 — `occupiedNumbers.has(...)`
    // → tableConflict) **قبل از** گرفتنِ قفل اجرا می‌شود. اگر یک برنده زودتر
    // commit کند، درخواست‌های بعدی همان‌جا رد می‌شوند و اصلاً به قفل نمی‌رسند.
    // پس `=== N` یک ویژگیِ زمان‌بندی است نه یک ویژگیِ ایمنی، و تست را شکننده
    // می‌کند. ثابتِ واقعی این است: هر بار که به قفل رسیدیم، دقیقاً یک بار
    // set() صدا خورده و دقیقاً یک بار شمارنده بالا رفته.
    const setDelta = downSetCalls - beforeSet;
    const fbDelta = fallbackCount() - beforeFallback;
    assert.ok(setDelta >= 1,
      'هیچ درخواستی به شاخه‌ی fail-openِ redis.ts نرسید — این تست موضوعی نداشته');
    assert.equal(fbDelta, setDelta,
      'به‌ازای هر ورود به شاخه‌ی fail-open باید دقیقاً یک واحد به '
      + 'rezervno_slot_lock_fallback_total اضافه شود (شمارنده‌ی این حادثه تنها ردِ رصدیِ آن است)');

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    assert.equal(fulfilled.length, 1, `دقیقاً یک برنده انتظار می‌رود، ${fulfilled.length} تا شد`);

    // بازنده‌ها باید خطایِ ساختاریافته بگیرند، نه throwِ خامی که به ۵۰۰ ترجمه شود.
    const allowed = new Set(['TABLE_CONFLICT', 'SLOT_FULL', 'CONCURRENCY_RETRY', 'SLOT_LOCK_TIMEOUT']);
    for (const r of results) {
      if (r.status === 'fulfilled') continue;
      const code = (r.reason as { code?: string })?.code;
      assert.ok(code && allowed.has(code),
        `بازنده باید کدِ دامنه‌ای بگیرد نه خطایِ خام: ${code ?? (r.reason as Error)?.message}`);
    }

    const rows = await activeRows(rid);
    assert.equal(rows.length, 1, 'دقیقاً یک رزروِ فعال باید در DB مانده باشد');
    const overlaps = await physicalOverlaps(rid);
    assert.deepEqual(overlaps, [], 'هیچ تداخلِ فیزیکیِ میز نباید وجود داشته باشد');
  });

  test('merge و رزروِ مستقیم هم‌زمان روی یک میزِ *ثانویه* — جایی که EXCLUDE ساختاراً کور است', async () => {
    // ردیفِ الف: table_id=822. ردیفِ ب: table_id=821 با merged=[821,822].
    // این دو از نظرِ EXCLUDE هیچ تداخلی ندارند (table_idهایشان فرق دارد) —
    // تنها محافظ، بازچکِ اپلیکیشنیِ داخلِ تراکنشِ Serializable است.
    const rid = await freshRestaurant('mergerace', [
      { number: 821, capacity: 4, isMergeable: true, mergeableWith: [822] },
      { number: 822, capacity: 4, isMergeable: true, mergeableWith: [821] },
    ]);
    const beforeFallback = fallbackCount();
    const beforeSet = downSetCalls;

    const results = await Promise.allSettled([
      createReservation({
        restaurantId: rid, date: DATE, time: '20:00', partySize: 4,
        guest: { name: `[DEMO] direct-${RUN}`, tableNumber: 822 }, source: 'manual', notifySms: false,
      }, { acquireSlotLock: failOpenLock }),
      createReservation({
        restaurantId: rid, date: DATE, time: '20:00', partySize: 6,
        guest: { name: `[DEMO] merge-${RUN}` }, source: 'manual', notifySms: false,
      }, { acquireSlotLock: failOpenLock }),
    ]);

    const setDelta = downSetCalls - beforeSet;
    assert.ok(setDelta >= 1, 'هیچ درخواستی به شاخه‌ی fail-open نرسید — تست موضوعی نداشته');
    assert.equal(fallbackCount() - beforeFallback, setDelta,
      'شمارنده‌ی fallback باید دقیقاً به‌اندازه‌ی ورودهای واقعی به شاخه بالا رفته باشد');
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    assert.equal(fulfilled.length, 1, `دقیقاً یک برنده انتظار می‌رود، ${fulfilled.length} تا شد`);
    const overlaps = await physicalOverlaps(rid);
    assert.deepEqual(overlaps, [],
      'میزِ ۸۲۲ نباید هم‌زمان هم رزروِ مستقیم داشته باشد هم به‌عنوانِ میزِ ثانویه‌ی یک merge اشغال باشد');
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  لایه ۴ — write-skewِ قطعی + کنترلِ مثبت
//
//  Promise.allSettled ریس را «احتمالاً» می‌سازد. اینجا اینترلیو قطعی است:
//  هر دو تراکنش **می‌خوانند**، بعد هر دو **می‌نویسند**. این دقیقاً همان شکلی
//  است که EXCLUDE نمی‌بیندش و فقط SSI جلویش را می‌گیرد.
//
//  کنترلِ مثبت حیاتی است: اگر همین اینترلیو در READ COMMITTED هم فقط یک ردیف
//  بدهد، یعنی harness اصلاً ریس نساخته و سبزیِ نسخه‌ی SERIALIZABLE توخالی
//  است — پس آن حالت هم assert می‌شود و نبودش fail است.
// ═══════════════════════════════════════════════════════════════════════
async function writeSkew(tag: string, level: 'Serializable' | 'ReadCommitted') {
  const rid = await freshRestaurant(tag, [
    { number: 831, capacity: 4, isMergeable: true, mergeableWith: [832] },
    { number: 832, capacity: 4, isMergeable: true, mergeableWith: [831] },
  ]);
  const t831 = await db.table.findFirstOrThrow({ where: { restaurantId: rid, number: 831 } });
  const t832 = await db.table.findFirstOrThrow({ where: { restaurantId: rid, number: 832 } });
  const start = new Date(`${DATE}T16:00:00.000Z`);
  const end = new Date(start.getTime() + 90 * 60_000);
  const iso = level === 'Serializable'
    ? Prisma.TransactionIsolationLevel.Serializable
    : Prisma.TransactionIsolationLevel.ReadCommitted;

  // همان predicateی که getOccupiedTableNumbers می‌زند (هم اصلی هم ثانویه).
  const readOcc = (tx: PrismaTypes.TransactionClient) => tx.$queryRaw<{ num: number }[]>`
    SELECT t.number AS num FROM reservations r JOIN tables t ON t.id = r.table_id
    WHERE r.restaurant_id = ${rid}::uuid AND r.status::text = ANY(${ACTIVE}) AND r.table_id IS NOT NULL
      AND tsrange(r.slot_start, r.block_end) && tsrange(${start}::timestamp, ${end}::timestamp)
    UNION
    SELECT unnest(r.merged_table_numbers) FROM reservations r
    WHERE r.restaurant_id = ${rid}::uuid AND r.status::text = ANY(${ACTIVE})
      AND cardinality(r.merged_table_numbers) > 0
      AND tsrange(r.slot_start, r.block_end) && tsrange(${start}::timestamp, ${end}::timestamp)`;

  const ins = (tx: PrismaTypes.TransactionClient, tableId: string, merged: number[], code: string) => tx.$executeRaw`
    INSERT INTO reservations (code, restaurant_id, table_id, party_size, slot_start, slot_end,
                              status, source, merged_table_numbers, block_buffer_minutes)
    VALUES (${code}, ${rid}::uuid, ${tableId}::uuid, 4, ${start}::timestamp, ${end}::timestamp,
            'confirmed', 'manual', ${merged}::smallint[], 0)`;

  // اینترلیو با تأخیرِ ثابت — بدونِ gateِ متقابل، تا اگر یکی abort شد دیگری
  // برای همیشه معلق نماند. (نسخه‌ی اولِ این اینترلیو در یک probe معلق شد و من
  // اول همین gateِ متقابل را علتش نوشتم؛ شواهدِ خامِ بعدی نشان داد علتِ واقعی
  // `No space left on device` روی لولهٔ لاگ بود. طراحیِ بدونِ gate را نگه
  // داشته‌ام چون فی‌نفسه درست است، نه چون آن فرضیه ثابت شد.)
  const t1 = db.$transaction(async (tx) => {
    await readOcc(tx);
    await sleep(900);
    await ins(tx, t832.id, [], `WS1-${tag}-${RUN}`.slice(0, 24));
  }, { isolationLevel: iso, timeout: 20_000 }).then(() => 'ok').catch((e: Error) => `ERR ${e.message}`);

  const t2 = (async () => {
    await sleep(300);
    return db.$transaction(async (tx) => {
      await readOcc(tx);
      await sleep(900);
      await ins(tx, t831.id, [831, 832], `WS2-${tag}-${RUN}`.slice(0, 24));
    }, { isolationLevel: iso, timeout: 20_000 }).then(() => 'ok').catch((e: Error) => `ERR ${e.message}`);
  })();

  const [o1, o2] = await Promise.all([t1, t2]);
  return { rid, o1, o2, overlaps: await physicalOverlaps(rid), rows: await activeRows(rid) };
}

describe('لایه ۴ — write-skewِ قطعی روی میزِ ثانویه‌ی merge', () => {
  test('کنترلِ مثبت: همین اینترلیو در READ COMMITTED یک double-bookingِ واقعی می‌سازد', async () => {
    const r = await writeSkew('wsrc', 'ReadCommitted');
    assert.equal(r.rows.length, 2,
      `harness باید در READ COMMITTED هر دو ردیف را commit کند، وگرنه ریس ساخته نشده. o1=${r.o1} o2=${r.o2}`);
    assert.equal(r.overlaps.length, 1,
      'در READ COMMITTED باید دقیقاً یک تداخلِ فیزیکی روی میزِ ۸۳۲ دیده شود — '
      + 'اگر صفر شد یعنی این تست موضوعی ندارد و سبزیِ تستِ بعدی بی‌معناست');
    assert.equal(r.overlaps[0].num, 832);
  });

  test('SERIALIZABLE همان اینترلیو را رد می‌کند: یک ردیف، صفر تداخل، و بازنده ۴۰۰۰۱ می‌گیرد', async () => {
    const r = await writeSkew('wsser', 'Serializable');
    const outcomes = [r.o1, r.o2];
    const aborted = outcomes.filter((o) => o.startsWith('ERR'));
    assert.equal(aborted.length, 1, `دقیقاً یکی باید abort شود: o1=${r.o1} o2=${r.o2}`);
    assert.match(aborted[0], /could not serialize access|40001/,
      `abort باید خطایِ سریالایزیشن باشد نه چیزِ دیگر: ${aborted[0]}`);
    assert.equal(r.rows.length, 1, 'باید دقیقاً یک رزرو commit شده باشد');
    assert.deepEqual(r.overlaps, [], 'هیچ تداخلِ فیزیکی نباید بماند');
  });
});
