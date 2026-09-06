import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  سلولِ خالیِ ۲×۲ — walk-in مستقیم روی میزِ *ثانویه* هم‌زمان با ساختنِ merge
//
//  چرا این فایل: table-merge-occupancy-concurrency.test.mts:94 قبلاً ثابت
//  کرده «رزروِ مستقیمِ میزِ ثانویه (createReservation) هم‌زمان با merge»
//  امن است — چون هر دو طرفِ آن مسابقه Serializable هستند. سلولِ دیگرِ همین
//  ۲×۲ — «createWalkin مستقیم روی میزِ ثانویه، هم‌زمان با merge» — تا امروز
//  هرگز آزموده نشده بود. createWalkinTx (`reservations.ts:785`) با
//  `db.$transaction(async (tx) => {...})` **بدونِ آپشنِ isolationLevel** باز
//  می‌شود — یعنی READ COMMITTED. طبقِ table-occupancy.ts:71-75، برایِ میزِ
//  *ثانویه*ی یک ترکیب هیچ محافظِ DB-levelی (EXCLUDE) وجود ندارد؛ تنها
//  محافظ چکِ اپلیکیشنیِ isTableNumberOccupied (اضافه‌شده به createWalkin در
//  ۲۰۲۶-۰۹-۰۴، reservations.ts:852) است.
//
//  ═══ نتیجه‌یِ زنده (نه فرض) ═══
//  فرضیه: چون merge در یک تراکنشِ Serializable با یک snapshotِ *ثابت* از
//  ابتدایِ تراکنش کار می‌کند، و SSIِ Postgres رسماً فقط بینِ تراکنش‌هایی که
//  *همه* Serializable باشند تضمین می‌دهد (SIREAD/predicate lock فقط رویِ
//  خواندنِ تراکنش‌هایِ Serializable گرفته می‌شود؛ خواندنِ یک تراکنشِ READ
//  COMMITTED هرگز SIREAD نمی‌گیرد)، چرخه‌یِ rw-antidependency‌ای که برایِ
//  abortِ SSI لازم است ممکن است کامل نشود.
//
//  این فرضیه با ۳۰ اجرایِ واقعیِ Promise.allSettled (بدونِ mock، بدونِ DI،
//  دقیقاً همون الگویِ :94، با withSlotLockِ *واقعی* رویِ Redisِ *واقعی*)
//  تأیید شد: در ۱۴ از ۱۵ تکرارِ اول (rezv-test-redis:56379 واقعی) و در
//  ۱۴ از ۱۵ تکرارِ دوم (شبیه‌سازیِ یک تأخیرِ ۸ میلی‌ثانیه‌ایِ واقع‌گرایانه —
//  معادلِ یک round-tripِ واقعیِ شبکه به Redis یا یک اسکنِ tryMergeTables
//  رویِ رستورانی با میزهایِ بیشتر)، **هر دو** طرف موفق شدند: merge روی
//  ۹۰۱+۹۰۲ commit شد *و* walk-in هم روی همون میزِ ۹۰۲ نشست — بدونِ هیچ
//  خطایی به هیچ‌کدام. کوئریِ فیزیکیِ مستقیم از DB هر دو بار ۲ اشغال‌کننده‌یِ
//  هم‌پوشان برایِ میزِ ۹۰۲ نشون داد: double-booking واقعی، نه یک کدِ خطایِ
//  نمایشی.
//
//  ⚠️ نکته‌یِ مهمِ روش‌شناسی: تنها حالتی که این تست *پاس* می‌شد (۰/۱۵ در
//  یک آزمایشِ سومِ کاملاً ایزوله‌شده)، وقتی بود که مسیرِ merge از withSlotLockِ
//  واقعی *bypass* می‌شد (بدونِ تأخیرِ Redis) — یعنی «امنیتِ» مشاهده‌شده در آن
//  حالت صرفاً یک شانسِ زمان‌بندیِ مصنوعی بود (merge بدونِ تأخیرِ Redis همیشه
//  سریع‌تر از پیش‌نیازهایِ walk-in به commit می‌رسید)، نه یک محافظِ واقعی.
//  بمحضِ برگرداندنِ Redisِ واقعی (که production همیشه دارد و هیچ‌وقت
//  bypass نمی‌شود)، آن «امنیت» ناپدید شد. این تست عمداً از withSlotLockِ
//  *پیش‌فرض* (واقعی) استفاده می‌کند تا این دامِ اندازه‌گیریِ خوش‌بینانه را
//  تکرار نکند.
//
//  ⚠️ تاریخچه — این بند تا ۲۰۲۶-۰۹-۰۴ می‌گفت «این تست امروز عمداً **قرمز**
//  است» و قرمزی‌اش را مدرکِ P0 معرفی می‌کرد: چکِ اپلیکیشنیِ
//  isTableNumberOccupied به‌تنهایی، زیرِ READ COMMITTED، محافظِ کافی نیست.
//  آن جمله دیگر HEAD را توصیف نمی‌کند: رفعِ موردِ نظرش در کامیتِ `bead689`
//  انجام شد — `createWalkinTx` حالا با
//  `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`
//  (reservations.ts:937) باز می‌شود و از مسیرِ `withSerializationRetry`
//  (reservations.ts:770) صدا زده می‌شود، هم‌سو با placeReservation
//  (reservations.ts:389). شماره‌خط‌هایِ متنِ قبلی هم جابه‌جا شده بودند
//  (`createWalkin` حالا ۷۳۶ است، نه ۷۸۵).
//
//  پس نقشِ این فایل عوض شده: از «مدرکِ زنده‌ی یک P0ِ باز» به «گاردِ
//  رگرسیونِ همان رفع». اگر دوباره قرمز شد، یعنی ایزولاسیون یا retry از
//  مسیرِ walk-in برداشته شده. ⚠️ سبزبودنش را از این کامنت نتیجه نگیر —
//  با اجرا و کدِ خروجِ ۰ تأییدش کن (قاعده‌ی ۱ مخزن).
//
//  الگو: دقیقاً مدلِ table-merge-occupancy-concurrency.test.mts:94 (دو
//  فراخوانیِ واقعی، Promise.allSettled، بدونِ mock، بدونِ DIِ سفارشی)، با
//  این تفاوت که طرفِ مستقیم اینجا createWalkin است. سبکِ ادعایِ «موضوع
//  واقعاً حاضر است» از walkin-merge-occupancy.test.mts گرفته شده: نبودِ
//  merge یا نبودِ ادعایِ میزِ ثانویه باید FAIL باشد، نه پاسِ خاموش.
//
//  برایِ مقاومت دربرابرِ نوسانِ زمانیِ یک اجرایِ تکی (مسابقه‌یِ واقعی همیشه
//  ۱۰۰٪ به یک سمت نمی‌افتد)، این مسابقه چند بار با رستوران/میزهایِ تازه
//  تکرار می‌شود؛ کافی است **یک** تکرار double-booking فیزیکی نشان دهد تا
//  نتیجه REPRODUCED باشد.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation, createWalkin } = await import('../src/lib/reservations.ts');

const PRIMARY = 901;
const SECONDARY = 902;
const ITERATIONS = 6;

const createdRestaurantIds: string[] = [];
const createdTenantIds: string[] = [];
const createdPhones: string[] = [];

after(async () => {
  if (createdRestaurantIds.length) {
    await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId: { in: createdRestaurantIds } } } }).catch(() => {});
    await db.reservationItem.deleteMany({ where: { reservation: { restaurantId: { in: createdRestaurantIds } } } }).catch(() => {});
    await db.clubMember.deleteMany({ where: { restaurantId: { in: createdRestaurantIds } } }).catch(() => {});
    await db.clubCodeCounter.deleteMany({ where: { restaurantId: { in: createdRestaurantIds } } }).catch(() => {});
    await db.reservation.deleteMany({ where: { restaurantId: { in: createdRestaurantIds } } }).catch(() => {});
    await db.table.deleteMany({ where: { restaurantId: { in: createdRestaurantIds } } }).catch(() => {});
    await db.restaurant.deleteMany({ where: { id: { in: createdRestaurantIds } } }).catch(() => {});
  }
  if (createdTenantIds.length) {
    await db.tenant.deleteMany({ where: { id: { in: createdTenantIds } } }).catch(() => {});
  }
  if (createdPhones.length) {
    await db.user.deleteMany({ where: { phone: { in: createdPhones } } }).catch(() => {});
  }
});

/** تاریخ/ساعتِ محلیِ تهران برای یک لحظه‌ی مشخص — ورودیِ computeRanges (کپیِ همان
 *  کمکی‌ای که walkin-merge-occupancy.test.mts استفاده می‌کند، چون createWalkin
 *  همیشه از «همین الان» شروع می‌شود و createReservation باید همان بازه را
 *  با date/time صریح پوشش دهد). */
function tehranDateTime(at: Date): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

/** چند رزروِ فعال، میزِ فیزیکیِ شماره‌ی `num` را در بازه‌ی [from, to) اشغال
 *  کرده‌اند — هم به‌عنوانِ اصلی (table_id) هم ثانویه (merged_table_numbers).
 *  بیش از ۱ یعنی دو گروهِ متفاوت سرِ یک میزِ فیزیکی: double-booking واقعی. */
async function physicalOccupants(restaurantId: string, num: number, from: Date, to: Date): Promise<number> {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n
    FROM reservations r
    LEFT JOIN tables t ON t.id = r.table_id
    WHERE r.restaurant_id = ${restaurantId}::uuid
      AND r.status::text = ANY(ARRAY[
        'pending','confirmed','auto_confirmed','preparing','checked_in',
        'running_late','arrived','seated','dining'
      ])
      AND (t.number = ${num} OR ${num} = ANY(r.merged_table_numbers))
      AND tsrange(r.slot_start, r.block_end) && tsrange(${from}::timestamp, ${to}::timestamp)
  `;
  return Number(rows[0]?.n ?? 0);
}

function demoPhone(seed: string): string {
  const p = `+98914${String(Date.now()).slice(-5)}${seed}`;
  createdPhones.push(p);
  return p;
}

interface Fixture {
  restaurantId: string;
  primaryTableId: string;
  secondaryTableId: string;
}

async function makeFixture(tag: string): Promise<Fixture> {
  const tenant = await db.tenant.create({ data: { name: `[DEMO] walkin-merge-concurrency tenant ${tag}` } });
  createdTenantIds.push(tenant.id);
  const restaurant = await db.restaurant.create({
    data: {
      tenantId: tenant.id,
      slug: `demo-walkin-merge-cnc-${tag}-${Date.now()}`,
      name: `[DEMO] رستورانِ تستِ همزمانیِ walk-in/merge ${tag}`,
      clubPrefix: 'WMC',
      isOpen: true,
      onlineGating: false,
      openingHours: undefined,
    },
  });
  createdRestaurantIds.push(restaurant.id);
  const t901 = await db.table.create({
    data: { restaurantId: restaurant.id, number: PRIMARY, capacity: 4, isActive: true, isMergeable: true, mergeableWith: [SECONDARY] },
  });
  const t902 = await db.table.create({
    data: { restaurantId: restaurant.id, number: SECONDARY, capacity: 4, isActive: true, isMergeable: true, mergeableWith: [PRIMARY] },
  });
  return { restaurantId: restaurant.id, primaryTableId: t901.id, secondaryTableId: t902.id };
}

/** یک تکرارِ مسابقه: createWalkin مستقیم رویِ میزِ ثانویه، واقعاً هم‌زمان
 *  (Promise.allSettled، بدونِ mock، بدونِ DI) با createReservation
 *  (partySize=6) که مجبور به merge رویِ ۹۰۱+۹۰۲ می‌شود. هر دو تابع با
 *  پیکربندیِ *پیش‌فرضِ production* اجرا می‌شوند — یعنی merge از
 *  withSlotLockِ واقعی (Redisِ واقعی) استفاده می‌کند، نه یک قفلِ جایگزینِ
 *  تستی؛ رجوع کن به یادداشتِ روش‌شناسیِ بالایِ فایل برایِ اینکه چرا این
 *  انتخاب حیاتی بود. */
async function raceOnce(tag: string): Promise<{
  fixture: Fixture;
  walkin: PromiseSettledResult<Awaited<ReturnType<typeof createWalkin>>>;
  merge: PromiseSettledResult<Awaited<ReturnType<typeof createReservation>>>;
  windowFrom: Date;
  windowTo: Date;
}> {
  const fixture = await makeFixture(tag);
  const now = new Date();
  const { date, time } = tehranDateTime(new Date(now.getTime() + 2 * 60_000)); // +۲ دقیقه: از گاردِ pastTime رد شود
  const windowFrom = now;
  const windowTo = new Date(now.getTime() + 130 * 60_000); // پوششِ هر دو بلاک (walk-in ~۱۰۵ دقیقه، merge ~۱۰۷ دقیقه)

  const walkinAttempt = createWalkin({
    restaurantId: fixture.restaurantId,
    clubPrefix: 'WMC',
    phone: demoPhone(tag),
    partySize: 2,
    firstName: '[DEMO]',
    lastName: `مزاحمِ هم‌زمانِ ثانویه ${tag}`,
    tableId: fixture.secondaryTableId,
    birthDay: null,
    birthMonth: null,
  });
  const mergeAttempt = createReservation({
    restaurantId: fixture.restaurantId, date, time, partySize: 6,
    guest: { name: `[DEMO] گروهِ ترکیبیِ هم‌زمان ${tag}` }, source: 'manual', notifySms: false,
  });

  const [walkin, merge] = await Promise.allSettled([walkinAttempt, mergeAttempt]);
  return { fixture, walkin, merge, windowFrom, windowTo };
}

describe('سلولِ خالیِ ۲×۲ — createWalkin مستقیم رویِ میزِ ثانویه، هم‌زمان با createReservation(merge)', () => {
  test('آیا این ترکیب double-booking فیزیکیِ واقعی می‌سازد؟ (بازچکِ ۲۰۲۶-۰۹-۰۴ زیرِ ایزولاسیونِ ناهمگون)', async () => {
    const reproductions: Array<{ tag: string; occupants: number }> = [];

    for (let i = 0; i < ITERATIONS; i++) {
      const tag = `it${i}`;
      const { fixture, walkin, merge, windowFrom, windowTo } = await raceOnce(tag);

      // ── پیش‌شرطِ صریح: موضوعِ تست واقعاً حاضر بوده — نبودش باید خطا باشد ──
      // اگر merge اصلاً موفق نشده (نه به‌عنوانِ برنده، نه با کدِ تداخلِ معتبر)
      // یا walk-in به دلیلی نامرتبط با اشغالِ ۹۰۲ رد شده، این تکرار چیزی
      // درباره‌ی سؤالِ اصلی ثابت نمی‌کند — باید بی‌صدا رد نشود.
      const mergeOk = merge.status === 'fulfilled';
      const mergeConflictCode = merge.status === 'rejected' ? (merge.reason as { code?: string })?.code : null;
      assert.ok(
        mergeOk || mergeConflictCode === 'SLOT_FULL' || mergeConflictCode === 'TABLE_CONFLICT' || mergeConflictCode === 'CONCURRENCY_RETRY',
        `[${tag}] merge نه موفق شد نه با کدِ تداخلِ معتبر رد شد — پیش‌شرطِ مسابقه نامعتبر است: ${JSON.stringify(merge.status === 'rejected' ? merge.reason : merge.value)}`,
      );
      if (mergeOk) {
        const mergedNumbers = [...(merge.value as any).merged_tables].sort((a: number, b: number) => a - b);
        assert.deepEqual(
          mergedNumbers, [PRIMARY, SECONDARY],
          `[${tag}] merge موفق شد ولی رویِ ترکیبِ موردِ انتظار (۹۰۱+۹۰۲) نبود — موضوعِ تست غایب است: ${JSON.stringify(mergedNumbers)}`,
        );
      }

      const walkinOk = walkin.status === 'fulfilled';
      const walkinCode = walkin.status === 'rejected' ? (walkin.reason as { code?: string })?.code : null;
      assert.ok(
        walkinOk || walkinCode === 'TABLE_CONFLICT',
        `[${tag}] walk-in نه موفق شد نه با TABLE_CONFLICT رد شد — پیش‌شرطِ مسابقه نامعتبر است: ${JSON.stringify(walkin.status === 'rejected' ? walkin.reason : walkin.value)}`,
      );
      if (walkinOk) {
        assert.equal(
          (walkin.value as any).reservation.tableId, fixture.secondaryTableId,
          `[${tag}] walk-in موفق شد ولی رویِ میزِ موردِ انتظار (ثانویه) ننشست — موضوعِ تست غایب است`,
        );
      }

      // نبودِ هر دو موفقیت (یعنی هیچ‌کدام واقعاً میزِ ۹۰۲ را ادعا نکردند) هم
      // یعنی موضوعِ تست غایب است — این تکرار چیزی نسنجیده.
      assert.ok(
        mergeOk || walkinOk,
        `[${tag}] نه merge نه walk-in موفق شدند — هیچ ادعایی رویِ میزِ ۹۰۲ ثبت نشد، این تکرار بی‌اعتبار است`,
      );

      // ── ادعایِ فیزیکی: منبعِ حقیقتِ نهایی، نه شمارشِ کدهایِ API ──
      const occupants = await physicalOccupants(fixture.restaurantId, SECONDARY, windowFrom, windowTo);
      if (occupants > 1) {
        reproductions.push({ tag, occupants });
      }

      // یک ۴۰۹ی صادق مانعِ فرضِ اشتباه از «موفقیتِ هر دو» نمی‌شود — اگر هر دو
      // fulfilled شدند این خودش از قبل یک double-booking بدونِ حتی نیازِ به
      // کوئریِ فیزیکی است؛ کوئریِ فیزیکی رگرسیونِ نیمه (مثلاً یکی fulfilled و
      // دیگری رد شده ولی insertش قبل از throw انجام شده) را هم می‌گیرد.
      if (mergeOk && walkinOk) {
        assert.ok(occupants >= 2, `[${tag}] هر دو موفق شدند ولی کوئریِ فیزیکی فقط ${occupants} اشغال‌کننده دید — ناسازگاریِ ادعا/DB`);
      }
    }

    assert.equal(
      reproductions.length, 0,
      `DOUBLE-BOOKING REPRODUCED در ${reproductions.length}/${ITERATIONS} تکرار: ${JSON.stringify(reproductions)} — ` +
      'walk-in با createWalkin و merge با createReservation هم‌زمان رویِ میزِ ثانویه‌یِ ۹۰۲ نشستند؛ ' +
      'isolationLevel: Serializable برایِ createWalkinTx (reservations.ts:785) بخشی از P0 است، نه فالوآپ.',
    );
  });
});
