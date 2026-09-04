import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════
//  walk-in روی میزِ ثانویه‌یِ یک ترکیبِ فعال — دوقلویِ گمشده‌ی
//  table-merge-occupancy.test.mts
//
//  چرا این فایل لازم شد: کلاسِ باگِ «میزِ ثانویه‌یِ merge برایِ EXCLUDE
//  نامرئی است» یک‌بار در ۲۰۲۶-۰۸-۱۳ (commit 0113717) پیدا و **فقط رویِ
//  مسیرِ createReservation** بسته شد. همان commit در §۲.۴ سه مصرف‌کننده را
//  نام برد (availability.ts، tryMergeTables، گیتِ نهاییِ createReservation)
//  و `createWalkin` — نویسنده‌ی چهارمِ ردیفِ رزرو — در آن فهرست نبود، هرچند
//  §۲.۳ و §۲.۹ همان commit خودِ createWalkin را برایِ دو چکِ *دیگر* باز
//  کرده بودند. یعنی گارد از یک مرجع فهرست گرفت که ریسک در مرجعِ دیگری بود.
//
//  کانسترینتِ no_table_overlap رویِ **یک ستون** کلید خورده است
//  (`table_id WITH =`, prisma/sql/016-...:32-39). میزِ ثانویه‌ی یک ترکیب
//  هیچ ردیفِ رزروِ خودش را ندارد — فقط عددی در آرایه‌ی
//  merged_table_numbersِ ردیفِ اصلی است. پس ساختاراً برایِ EXCLUDE نامرئی
//  است و تنها محافظِ ممکن، چکِ لایه‌ی اپلیکیشن است.
//
//  این تست چهار ادعا دارد و هر چهار لازم‌اند:
//    ۱) موضوع واقعاً حاضر است (merge رخ داده و میزِ ۹۰۲ ردیفِ خودش را
//       ندارد) — نبودِ موضوع باید **خطا** باشد نه عبورِ بی‌صدا.
//    ۲) کنترلِ مثبت: walk-in رویِ میزِ *اصلی* رد می‌شود → یعنی هارنس سالم
//       است و شکستِ ادعای ۳ به معنیِ «گارد نیست» است، نه «تست خراب است».
//    ۳) ادعای اصلی: walk-in رویِ میزِ *ثانویه* هم باید رد شود.
//    ۴) کنترلِ منفی: walk-in رویِ میزِ واقعاً آزاد باید **موفق** شود —
//       وگرنه یک رگرسیونِ «همه را رد کن» از ادعای ۲ و ۳ سالم رد می‌شد.
//
//  ادعای ۳ علاوه بر کدِ خطا، «اشغالِ فیزیکیِ میزِ ۹۰۲» را هم می‌شمارد.
//  فقط چک‌کردنِ کدِ خطا با یک رگرسیونِ نیمه سبز می‌ماند (مثلاً خطایی از
//  جایِ دیگر پرتاب شود ولی ردیف قبلش درج شده باشد).
//
//  شبکه: هیچ فراخوانیِ بیرونی — SMS با notifySms:false خاموش است و
//  createWalkin اصلاً پیامک نمی‌فرستد.
//
//  فیکسچرها با پیشوندِ [DEMO] ساخته و در after() به‌ترتیبِ FK پاک می‌شوند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation, createWalkin } = await import('../src/lib/reservations.ts');

let tenantId: string;
let restaurantId: string;
let primaryTableId: string;    // میزِ ۹۰۱ — table_idِ واقعیِ رزروِ ترکیبی
let secondaryTableId: string;  // میزِ ۹۰۲ — فقط در merged_table_numbers
let freeTableId: string;       // میزِ ۹۰۳ — واقعاً آزاد (کنترلِ منفی)

const PRIMARY = 901;
const SECONDARY = 902;
const FREE = 903;

const createdPhones: string[] = [];

// walk-in همیشه از «همین الان» شروع می‌شود، پس رزروِ ترکیبی هم باید همین
// الان را بپوشاند. چند دقیقه جلوتر می‌رویم تا گاردِ pastTime
// (`+start < now - 60_000`، reservations.ts:139) رد نشود، و چون بازه‌ی
// بلاک ۹۰+۱۵ دقیقه است، هم‌پوشانی با walk-inِ لحظه‌ی اجرا قطعی است.
const MERGED_START_OFFSET_MIN = 3;

// پنجره‌ی کاوشِ اشغال باید **هر دو** طرف را بپوشاند: walk-in که از «الان»
// شروع می‌شود و رزروِ ترکیبی که از الان+۳ دقیقه. اولین نسخه‌ی این تست
// پنجره را [الان، الان+۱دقیقه] گرفته بود و رزروِ ترکیبی را اصلاً نمی‌دید —
// یعنی دو ادعا به‌خاطرِ خطایِ خودِ تست قرمز شدند، نه به‌خاطرِ محصول.
const PROBE_WINDOW_MIN = 120;

/** تاریخ/ساعتِ محلیِ تهران برای یک لحظه‌ی مشخص — ورودیِ computeRanges. */
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

/**
 * چند رزروِ فعال، میزِ شماره‌ی `num` را همین حالا **فیزیکی** اشغال کرده‌اند؟
 * هم مالکیتِ اصلی (table_id) و هم ثانویه (merged_table_numbers) شمرده
 * می‌شود — دقیقاً همان دو منبعی که getOccupiedTableNumbers UNION می‌کند.
 * بیش از ۱ یعنی دو گروهِ متفاوت سرِ یک میزِ فیزیکی.
 */
async function physicalOccupants(num: number): Promise<number> {
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
      AND tsrange(r.slot_start, r.block_end) && tsrange(
        ${new Date()}::timestamp, ${new Date(Date.now() + PROBE_WINDOW_MIN * 60_000)}::timestamp
      )
  `;
  // BigInt واقعی برمی‌گردد حتی وقتی جنریک number می‌گوید — هر دو لایه لازم است.
  return Number(rows[0]?.n ?? 0);
}

before(async () => {
  const tenant = await db.tenant.create({ data: { name: '[DEMO] walkin-merge-occupancy tenant' } });
  tenantId = tenant.id;

  const restaurant = await db.restaurant.create({
    data: {
      tenantId,
      slug: `demo-walkin-merge-${Date.now()}`,
      name: '[DEMO] رستورانِ تستِ walk-in رویِ میزِ ترکیبی',
      clubPrefix: 'DWM',
      isOpen: true,
      onlineGating: false,
      openingHours: undefined, // مسیرِ manual/walk-in اصلاً گاردِ ساعت ندارد
    },
  });
  restaurantId = restaurant.id;

  // دو میزِ قابلِ‌ترکیبِ متقابل: هیچ‌کدام به‌تنهایی جوابگویِ ۶ نفر نیست،
  // پس tryMergeTables واقعاً trigger می‌شود (نه مسیرِ تک‌میزی).
  const t901 = await db.table.create({
    data: { restaurantId, number: PRIMARY, capacity: 4, isActive: true, isMergeable: true, mergeableWith: [SECONDARY] },
  });
  primaryTableId = t901.id;
  const t902 = await db.table.create({
    data: { restaurantId, number: SECONDARY, capacity: 4, isActive: true, isMergeable: true, mergeableWith: [PRIMARY] },
  });
  secondaryTableId = t902.id;
  // میزِ کنترلِ منفی: ظرفیتش کمتر از ۶ است و ترکیب‌پذیر نیست، پس هرگز
  // واردِ ترکیبِ بالا نمی‌شود و واقعاً آزاد می‌ماند.
  const t903 = await db.table.create({
    data: { restaurantId, number: FREE, capacity: 2, isActive: true, isMergeable: false },
  });
  freeTableId = t903.id;
});

after(async () => {
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservationItem.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  if (createdPhones.length) {
    await db.user.deleteMany({ where: { phone: { in: createdPhones } } }).catch(() => {});
  }
});

/** شماره‌ی یکتا برای هر walk-in تا upsertِ کاربر تست‌ها را به هم گره نزند. */
function demoPhone(tag: string): string {
  const p = `+98913${String(Date.now()).slice(-5)}${tag}`;
  createdPhones.push(p);
  return p;
}

describe('walk-in رویِ میزِ ثانویه‌یِ merge — گاردِ گمشده‌ی createWalkin', () => {
  test('پیش‌شرط: رزروِ ۶نفره واقعاً merge می‌شود و میزِ ثانویه هیچ ردیفِ رزروِ خودش ندارد', async () => {
    const { date, time } = tehranDateTime(new Date(Date.now() + MERGED_START_OFFSET_MIN * 60_000));

    const resv = await createReservation({
      restaurantId, date, time, partySize: 6,
      guest: { name: '[DEMO] گروهِ ۶نفره‌ی ترکیبی' }, source: 'manual', notifySms: false,
    });

    // نبودِ موضوع = خطا، نه عبور. اگر merge trigger نشود این‌جا می‌شکند و
    // بقیه‌ی ادعاها بی‌معنا می‌شوند — دقیقاً همان چیزی که باید.
    assert.deepEqual(
      [...resv.merged_tables].sort((a, b) => a - b), [PRIMARY, SECONDARY],
      'merge رخ نداد — موضوعِ این تست غایب است، پس تست بی‌اعتبار است نه سبز',
    );

    // ساختارِ دقیقی که EXCLUDE را کور می‌کند: رزرو رویِ ۹۰۱ نوشته شده و
    // ۹۰۲ فقط یک عدد در آرایه است.
    const row = await db.reservation.findFirst({
      where: { restaurantId, mergedTableNumbers: { has: SECONDARY } },
      select: { tableId: true, mergedTableNumbers: true },
    });
    assert.ok(row, 'ردیفِ رزروِ ترکیبی پیدا نشد');
    assert.equal(row.tableId, primaryTableId, 'table_id باید میزِ اصلی باشد');

    const ownRow = await db.reservation.count({ where: { restaurantId, tableId: secondaryTableId } });
    assert.equal(ownRow, 0, 'میزِ ثانویه نباید ردیفِ رزروِ مستقل داشته باشد (پیش‌شرطِ کوریِ EXCLUDE)');

    assert.equal(await physicalOccupants(SECONDARY), 1, 'میزِ ۹۰۲ باید دقیقاً یک اشغال‌کننده داشته باشد');
  });

  test('کنترلِ مثبت: walk-in رویِ میزِ اصلیِ ۹۰۱ رد می‌شود (EXCLUDE شلیک می‌کند)', async () => {
    await assert.rejects(
      createWalkin({
        restaurantId, clubPrefix: 'DWM', phone: demoPhone('1'),
        partySize: 2, firstName: '[DEMO]', lastName: 'مزاحمِ اصلی',
        tableId: primaryTableId, birthDay: null, birthMonth: null,
      }),
      (err: any) => {
        assert.equal(err.code, 'TABLE_CONFLICT', `انتظار TABLE_CONFLICT، دریافت ${err?.code}: ${err?.message}`);
        return true;
      },
      'walk-in رویِ میزِ اصلیِ یک رزروِ فعال باید رد شود — اگر این بشکند هارنس خراب است، نه محصول',
    );
    assert.equal(await physicalOccupants(PRIMARY), 1, 'میزِ ۹۰۱ نباید دو اشغال‌کننده پیدا کند');
  });

  test('ادعای اصلی: walk-in رویِ میزِ ثانویه‌یِ ۹۰۲ هم باید رد شود', async () => {
    await assert.rejects(
      createWalkin({
        restaurantId, clubPrefix: 'DWM', phone: demoPhone('2'),
        partySize: 2, firstName: '[DEMO]', lastName: 'مزاحمِ ثانویه',
        tableId: secondaryTableId, birthDay: null, birthMonth: null,
      }),
      (err: any) => {
        assert.equal(err.code, 'TABLE_CONFLICT', `انتظار TABLE_CONFLICT، دریافت ${err?.code}: ${err?.message}`);
        return true;
      },
      'میزِ ۹۰۲ ثانویه‌یِ یک ترکیبِ فعال است — پذیرشِ walk-in یعنی دو گروه سرِ یک میزِ فیزیکی',
    );

    // ادعای فیزیکی، مستقل از کدِ خطا: حتی اگر خطایی از جایِ دیگر پرتاب شود،
    // درجِ ردیف نباید رخ داده باشد.
    assert.equal(
      await physicalOccupants(SECONDARY), 1,
      'میزِ ۹۰۲ بیش از یک اشغال‌کننده دارد — double-bookingِ فیزیکیِ واقعی',
    );
  });

  test('کنترلِ منفی: walk-in رویِ میزِ واقعاً آزادِ ۹۰۳ موفق می‌شود', async () => {
    const res = await createWalkin({
      restaurantId, clubPrefix: 'DWM', phone: demoPhone('3'),
      partySize: 2, firstName: '[DEMO]', lastName: 'مهمانِ عادی',
      tableId: freeTableId, birthDay: null, birthMonth: null,
    });
    assert.equal(res.reservation.status, 'seated');
    assert.equal(res.reservation.tableId, freeTableId);
    // بدونِ این ادعا، یک رگرسیونِ «هر walk-in را رد کن» از دو تستِ بالا سالم رد می‌شد.
    assert.equal(await physicalOccupants(FREE), 1);
  });
});
