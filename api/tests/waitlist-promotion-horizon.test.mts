import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { randomUUID } from 'node:crypto';

// ⚠️ ═══ این فایل را **به‌صورتِ زیرمجموعه اجرا نکن و از رویش نتیجه نگیر** ═══
//
// اجرای `waitlist*.test.mts` جدا از سوئیتِ کامل، **بدونِ هیچ تغییری در کد**،
// چند شکستِ نوسانی می‌دهد — هر بار تستِ دیگری، و هیچ شکستِ مشترکی بین
// اجراهای پیاپی. در `npm test` (سوئیتِ کامل) سبزند.
//
// اندازه‌گیری: سه اجرای پیاپیِ پایه روی کدِ دست‌نخورده، ۲۰۲۶-۰۹-۱۰ — شرحِ
// کامل در پیامِ کامیتِ `1b96997`.
//
// ⇒ اگر داری یک رگرسیون را bisect می‌کنی: **اول پایه را چند بار بزن.**
//   یک اجرای پایه اندازه‌گیری نیست، **نمونه** است — و روی تستِ همزمانی،
//   نمونه‌ی تکی هیچ چیزی نمی‌گوید. یک بار روی همین فایل‌ها یک «۱۱ در برابرِ ۱»
//   ساخت که کاملاً ساختگی بود و نزدیک بود یک طراحیِ درست بابتش دور ریخته شود.
// ═══════════════════════════════════════════════════════════════════════

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  افقِ تداخلِ ارتقایِ لیستِ انتظار — «چند دقیقه جلوتر را نگاه کن؟»
//
//  ── نقص (اندازه‌گیریِ زنده، ۲۰۲۶-۰۹-۰۵) ──
//  `promoteNextTx` افقِ چکِ تداخلش را با `AVG_DINING_MINUTES` (=۷۵) می‌ساخت.
//  ولی رزروی که `acceptOffer` واقعاً می‌سازد به‌اندازه‌ی
//  `slotMinutes + cleaningMinutes + bufferMinutes` میز را می‌بندد — با
//  پیش‌فرض‌هایِ اسکیما (۹۰ + ۱۵ + ۰) یعنی **۱۰۵** دقیقه. پس رزروی که
//  ۷۵ تا ۱۰۵ دقیقه‌ی دیگر شروع می‌شود برایِ چکِ آفر **نامرئی** بود ولی
//  در لحظه‌ی پذیرش تداخل می‌کرد: صف میزی را آفر می‌داد که پذیرشش از پیش
//  محکوم به شکست بود.
//
//  ── چرا «عددِ اشتباه» نبود، «ورودیِ اشتباه» بود ──
//  `AVG_DINING_MINUTES` به سؤالِ «مردم معمولاً چقدر می‌نشینند؟» جواب می‌دهد —
//  یک **آمار** برایِ تخمینِ زمانِ انتظار. `blockEnd` به سؤالِ «این رزروِ مشخص
//  تا کِی میز را می‌بندد؟» جواب می‌دهد — یک **قرارداد**. هارد‌کدکردنِ ۱۰۵ هم
//  همان خطا را با یک عددِ دیگر تکرار می‌کرد، چون `slotMinutes` پیکربندی‌پذیر
//  است: رستورانی با سانسِ ۱۸۰دقیقه‌ای پنجره‌ی کورِ **۱۲۵**دقیقه‌ای دارد و
//  پیش‌فرض آن را پشتِ عددِ ۳۰ پنهان می‌کند.
//
//  ── ساختارِ این فایل ──
//   الف) ریاضیِ خالص: افق باید به همان تولیدکننده‌ی `blockEnd` گره خورده باشد.
//   ب)  پیش‌فرض: رزروِ داخلِ پنجره‌ی کور باید میز را از آفر خارج کند.
//   ج)  🚨 پیکربندیِ غیرپیش‌فرض: افق باید **با** `slotMinutes` حرکت کند — هم
//       بالا و هم پایین. بدونِ (ج) یک هارد‌کدِ ۱۰۵ از بازبینی رد می‌شود و باگ
//       برایِ هر رستورانِ غیرپیش‌فرض زنده می‌ماند.
//
//  ⚠️ ضدِ سبزِ توخالی: هر ادعایِ منفی («آفر نشد») یک کنترلِ مثبتِ چسبیده به
//  خودش دارد که ثابت می‌کند همان میز در نبودِ رزرو واقعاً آفر می‌شود. بدونِ
//  آن، یک هارنسِ خراب یا یک فیلترِ بی‌ربط همه‌ی ادعاهایِ منفی را بی‌معنا
//  سبز نگه می‌داشت.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation } = await import('../src/lib/reservations.ts');
const { promoteNext } = await import('../src/lib/waitlist.ts');
const { holdHorizonMinutes, OFFER_TTL_MINUTES } = await import('../src/lib/table-occupancy.ts');
const { computeRanges } = await import('../src/lib/reservation-helpers.ts');
const { dateKeyInTz, timeKeyInTz } = await import('../src/lib/hours.ts');

const TZ = 'Asia/Tehran';
const TAG = `wlh-${randomUUID().slice(0, 8)}`;

/** افقِ **قدیمیِ** غلط. اینجا فقط به‌عنوانِ ثابتِ رگرسیون زندگی می‌کند: اگر
 *  کسی افق را به این برگرداند، تستِ (ب) باید قرمز شود. */
const OLD_WRONG_HORIZON = 75;

/** سه پیکربندیِ عمداً واگرا. اگر افق ثابت باشد (هر عددی)، دستِ‌کم یکی از
 *  این سه باید قرمز شود — این هدفِ کلِ فایل است. */
const CONFIGS = {
  /** پیش‌فرض‌هایِ اسکیما (schema.prisma:159-161) → بلاک ۱۰۵ · افق ۱۱۰ */
  standard: { slotMinutes: 90, cleaningMinutes: 15, bufferMinutes: 0 },
  /** فاین‌دایینینگ → بلاک ۱۹۵ · افق ۲۰۰ */
  long: { slotMinutes: 180, cleaningMinutes: 15, bufferMinutes: 0 },
  /** فست‌فود → بلاک ۳۵ · افق ۴۰ */
  short: { slotMinutes: 30, cleaningMinutes: 5, bufferMinutes: 0 },
} as const;

type CfgName = keyof typeof CONFIGS;

const TABLE_NUMBER = 41;
const PARTY = 2;

let tenantId = '';
const restaurantIds: Record<CfgName, string> = { standard: '', long: '', short: '' };
let userId = '';

async function makeRestaurant(name: CfgName): Promise<string> {
  const cfg = CONFIGS[name];
  const r = await db.restaurant.create({
    data: {
      tenantId,
      slug: `${TAG}-${name}`,
      name: `[DEMO] افقِ صف — ${name}`,
      clubPrefix: 'WLH',
      timezone: TZ,
      isOpen: true,
      onlineGating: false,
      slotMinutes: cfg.slotMinutes,
      cleaningMinutes: cfg.cleaningMinutes,
      bufferMinutes: cfg.bufferMinutes,
      tables: {
        create: [{ number: TABLE_NUMBER, capacity: 4, minPartySize: 1, isActive: true, state: 'free' }] as never,
      },
    },
    select: { id: true },
  });
  return r.id;
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  for (const name of Object.keys(CONFIGS) as CfgName[]) {
    restaurantIds[name] = await makeRestaurant(name);
  }
  const u = await db.user.create({
    data: { phone: `0913${Math.floor(1000000 + Math.random() * 8999999)}`, firstName: '[DEMO] مهمانِ صف' },
    select: { id: true },
  });
  userId = u.id;
});

after(async () => {
  const ids = Object.values(restaurantIds).filter(Boolean);
  await db.waitlistEntry.deleteMany({ where: { restaurantId: { in: ids } } }).catch(() => {});
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId: { in: ids } } } }).catch(() => {});
  await db.reservationItem.deleteMany({ where: { reservation: { restaurantId: { in: ids } } } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId: { in: ids } } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId: { in: ids } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId: { in: ids } } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId: { in: ids } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

/** همه‌ی رزروها/ورودی‌های این رستوران را پاک می‌کند و میز را free می‌گذارد. */
async function reset(restaurantId: string) {
  await db.waitlistEntry.deleteMany({ where: { restaurantId } });
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservationItem.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } });
  await db.table.updateMany({ where: { restaurantId }, data: { state: 'free' } });
}

async function seedWaiting(restaurantId: string): Promise<string> {
  const e = await db.waitlistEntry.create({
    data: {
      restaurantId, userId, partySize: PARTY, status: 'waiting', priority: 0,
      joinedAt: new Date(Date.now() - 5 * 60_000),
    },
    select: { id: true },
  });
  return e.id;
}

/** رزروی که دقیقاً `offsetMinutes` دقیقه‌ی دیگر رویِ همان تکـ‌میز شروع می‌شود.
 *  شکستِ ساخت **خطا** است، نه عبورِ بی‌صدا — وگرنه ادعایِ بعدی بی‌موضوع می‌شد. */
async function seedFutureReservation(restaurantId: string, offsetMinutes: number) {
  const at = new Date(Date.now() + offsetMinutes * 60_000);
  const resv = await createReservation({
    restaurantId,
    date: dateKeyInTz(at, TZ),
    time: timeKeyInTz(at, TZ),
    partySize: PARTY,
    guest: { name: '[DEMO] رزروِ داخلِ پنجره', tableNumber: TABLE_NUMBER },
    source: 'manual',
    notifySms: false,
  });
  // ⚠️ `block_end` یک ستونِ generatedِ سطحِ DB است و در مدلِ Prisma وجود ندارد
  // (به همین دلیل `prisma db push` رویِ DBِ migrateشده رویش می‌شکند). پس
  // slot_start را می‌خوانیم و طولِ بلاک را از پیکربندی می‌سازیم.
  const row = await db.reservation.findFirst({
    where: { restaurantId, code: resv.code },
    select: { slotStart: true, slotEnd: true, table: { select: { number: true } } },
  });
  assert.ok(row, 'رزروِ کاشته‌شده باید در دیتابیس باشد — وگرنه این تست موضوع ندارد');
  assert.equal(row.table?.number, TABLE_NUMBER,
    'رزرو باید دقیقاً رویِ همان تک‌میزِ کاندید نشسته باشد، وگرنه تداخلی در کار نیست');
  return row;
}

// ─────────────────────────────────────────────────────────────────────
//  الف) ریاضیِ خالص — افق باید از همان تولیدکننده‌ی blockEnd مشتق شود
// ─────────────────────────────────────────────────────────────────────
describe('افقِ آفر — اشتقاق از همان محاسبه‌ای که blockEnd را می‌سازد', () => {
  for (const [name, cfg] of Object.entries(CONFIGS)) {
    test(`«${name}»: افق = مهلتِ پذیرش + طولِ واقعیِ بلاکِ computeRanges`, () => {
      const full = { ...cfg, holdMinutes: 10 };
      const { start, blockEnd } = computeRanges('2027-05-19', '19:00', full, undefined, TZ);
      const realBlockMinutes = (+blockEnd - +start) / 60_000;

      // نبودِ موضوع = خطا: اگر computeRanges روزی بلاکِ صفر بدهد، ادعایِ زیر
      // بی‌معنا سبز می‌ماند.
      assert.ok(realBlockMinutes > 0, 'computeRanges باید بلاکِ مثبت بدهد');
      assert.equal(realBlockMinutes, cfg.slotMinutes + cfg.cleaningMinutes + cfg.bufferMinutes,
        'قراردادِ بلاک عوض شده — اگر عمدی است، افق هم باید با آن حرکت کند');

      assert.equal(holdHorizonMinutes(cfg), OFFER_TTL_MINUTES + realBlockMinutes,
        'افقِ آفر باید دقیقاً «مهلتِ پذیرش + بلاکِ واقعی» باشد؛ هر واگرایی یعنی ' +
        'چکِ آفر و رزروی که پذیرش می‌سازد دو بازه‌ی متفاوت را می‌سنجند');
    });
  }

  test('افق یک ثابت نیست — با پیکربندیِ رستوران هم بالا می‌رود هم پایین', () => {
    const h = {
      short: holdHorizonMinutes(CONFIGS.short),
      standard: holdHorizonMinutes(CONFIGS.standard),
      long: holdHorizonMinutes(CONFIGS.long),
    };
    assert.ok(h.short < h.standard && h.standard < h.long,
      `افق باید با slotMinutes مرتب باشد، ولی ${JSON.stringify(h)} این‌طور نیست — ` +
      'یک عددِ هارد‌کدشده دقیقاً همین‌جا قرمز می‌شود');
    assert.ok(h.standard > OLD_WRONG_HORIZON,
      `افقِ پیش‌فرض باید از افقِ قدیمیِ ${OLD_WRONG_HORIZON} بزرگ‌تر باشد — ` +
      'همان پنجره‌ی کوری که این فایل برایش نوشته شد');
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ب) پیش‌فرض — پنجره‌ی کورِ ۷۵ تا ۱۰۵
// ─────────────────────────────────────────────────────────────────────
describe('promoteNext — رستورانِ پیش‌فرض (سانسِ ۹۰، بلاکِ ۱۰۵)', () => {
  /** ۹۰ دقیقه: بیرونِ افقِ قدیمیِ ۷۵، داخلِ افقِ درستِ ۱۱۰. */
  const OFFSET = 90;

  test('پیش‌شرط: این آفست واقعاً داخلِ پنجره‌ی کور است', () => {
    assert.ok(OFFSET > OLD_WRONG_HORIZON,
      'آفست باید بیرونِ افقِ قدیمی باشد، وگرنه کدِ معیوب هم از این تست رد می‌شد');
    assert.ok(OFFSET < holdHorizonMinutes(CONFIGS.standard),
      'آفست باید داخلِ افقِ درست باشد، وگرنه ادعایِ زیر اصلاً تداخلی ندارد که ببیند');
  });

  test('کنترلِ مثبت: بدونِ هیچ رزروی، همان تک‌میز واقعاً آفر می‌شود', async () => {
    const restaurantId = restaurantIds.standard;
    await reset(restaurantId);
    const entryId = await seedWaiting(restaurantId);

    const res = await promoteNext(restaurantId);

    assert.equal(res.promoted, true,
      'میزِ آزاد هست ولی آفر نشد — هارنسِ این فایل خراب است و بقیه‌ی ادعاها بی‌اعتبارند');
    assert.equal(res.table, TABLE_NUMBER, 'باید همان تک‌میزِ کاندید آفر شود');
    assert.equal(res.entryId, entryId, 'آفر باید به همین ورودیِ صف رفته باشد');
  });

  test('🚨 رزروِ ۹۰دقیقه‌ی دیگر باید میز را از آفر خارج کند', async () => {
    const restaurantId = restaurantIds.standard;
    await reset(restaurantId);
    const seeded = await seedFutureReservation(restaurantId, OFFSET);

    // نبودِ موضوع = خطا: ثابت کن رزروی که کاشتیم واقعاً با بلاکِ یک پذیرشِ
    // «همین حالا» هم‌پوشانی دارد. اگر نداشت، ادعایِ اصلی چیزی نمی‌سنجید.
    const acceptBlockEnd = Date.now() + (CONFIGS.standard.slotMinutes
      + CONFIGS.standard.cleaningMinutes + CONFIGS.standard.bufferMinutes) * 60_000;
    assert.ok(+seeded.slotStart < acceptBlockEnd,
      'رزروِ کاشته‌شده با بلاکِ پذیرشِ «همین حالا» هم‌پوشانی ندارد — سناریو غلط چیده شده');

    const entryId = await seedWaiting(restaurantId);
    const res = await promoteNext(restaurantId);

    assert.equal(res.promoted, false,
      `صف میزِ ${res.table} را آفر داد در حالی که ${OFFSET} دقیقه‌ی دیگر رزرو دارد و ` +
      'بلاکِ پذیرش رویش می‌افتد — پذیرشِ مهمان از پیش محکوم به شکست است ' +
      '(افقِ چکِ تداخل باید از blockEnd مشتق شود، نه از AVG_DINING_MINUTES)');
    assert.notEqual(res.table, TABLE_NUMBER, 'همان میزِ رزروشده نباید آفر شود');

    const t = await db.table.findFirstOrThrow({
      where: { restaurantId, number: TABLE_NUMBER }, select: { state: true },
    });
    assert.equal(t.state, 'free', 'میز نباید در گذرِ reserved رها شده باشد');

    const e = await db.waitlistEntry.findUniqueOrThrow({
      where: { id: entryId }, select: { status: true, offeredTableNumber: true },
    });
    assert.equal(e.status, 'waiting', 'ورودیِ صف باید waiting بماند، نه offered');
    assert.equal(e.offeredTableNumber, null, 'هیچ شماره‌ی میزی نباید رویِ ورودی ثبت شده باشد');
  });
});

// ─────────────────────────────────────────────────────────────────────
//  ج) 🚨 پیکربندیِ غیرپیش‌فرض — گاردِ ضدِ هارد‌کد
// ─────────────────────────────────────────────────────────────────────
describe('promoteNext — افق باید با slotMinutes حرکت کند، نه با یک عدد', () => {
  /** ۱۳۰ دقیقه: بیرونِ افقِ پیش‌فرضِ ۱۱۰، داخلِ افقِ ۲۰۰ی رستورانِ سانس‌بلند. */
  const CROSS_OFFSET = 130;

  test('پیش‌شرط: این آفست دقیقاً بینِ دو افق می‌افتد', () => {
    assert.ok(CROSS_OFFSET > holdHorizonMinutes(CONFIGS.standard),
      'آفست باید بیرونِ افقِ رستورانِ پیش‌فرض باشد');
    assert.ok(CROSS_OFFSET < holdHorizonMinutes(CONFIGS.long),
      'آفست باید داخلِ افقِ رستورانِ سانس‌بلند باشد — همین جفت است که هارد‌کد را می‌کشد');
  });

  test('کنترلِ مثبت: رستورانِ سانس‌بلند بدونِ رزرو واقعاً آفر می‌دهد', async () => {
    const restaurantId = restaurantIds.long;
    await reset(restaurantId);
    await seedWaiting(restaurantId);
    const res = await promoteNext(restaurantId);
    assert.equal(res.promoted, true, 'پیش‌شرط: بدونِ رزرو باید آفر انجام شود');
    assert.equal(res.table, TABLE_NUMBER, 'باید همان تک‌میز آفر شود');
  });

  test('🚨 سانسِ ۱۸۰: رزروِ ۱۳۰دقیقه‌ی دیگر باید میز را از آفر خارج کند (هارد‌کدِ ۱۰۵ اینجا می‌میرد)', async () => {
    const restaurantId = restaurantIds.long;
    await reset(restaurantId);
    await seedFutureReservation(restaurantId, CROSS_OFFSET);
    const entryId = await seedWaiting(restaurantId);

    const res = await promoteNext(restaurantId);

    assert.equal(res.promoted, false,
      `رستورانی با سانسِ ${CONFIGS.long.slotMinutes} دقیقه پنجره‌ی کورِ بسیار بزرگ‌تری دارد؛ ` +
      'افقِ ثابت (۷۵ یا ۱۰۵ یا هر عددِ دیگر) این تداخل را نمی‌بیند');
    const e = await db.waitlistEntry.findUniqueOrThrow({
      where: { id: entryId }, select: { status: true },
    });
    assert.equal(e.status, 'waiting', 'ورودیِ صف باید waiting بماند');
  });

  test('🚨 همان ۱۳۰ دقیقه در رستورانِ پیش‌فرض باید همچنان آفر شود (هارد‌کدِ ۲۰۰ اینجا می‌میرد)', async () => {
    const restaurantId = restaurantIds.standard;
    await reset(restaurantId);
    await seedFutureReservation(restaurantId, CROSS_OFFSET);
    await seedWaiting(restaurantId);

    const res = await promoteNext(restaurantId);

    assert.equal(res.promoted, true,
      'رزروی که بیرونِ افقِ این رستوران است نباید آفر را مسدود کند — ' +
      'افقِ بیش‌ازحد بزرگ یعنی ظرفیتِ فروش‌نرفته‌ی بی‌صدا، همان نقص در جهتِ آینه');
    assert.equal(res.table, TABLE_NUMBER, 'باید همان تک‌میز آفر شود');
  });

  test('🚨 فست‌فود (سانسِ ۳۰): رزروِ ۶۰دقیقه‌ی دیگر نباید آفر را مسدود کند', async () => {
    const restaurantId = restaurantIds.short;
    const SHORT_OFFSET = 60;
    assert.ok(SHORT_OFFSET > holdHorizonMinutes(CONFIGS.short),
      'پیش‌شرط: آفست باید بیرونِ افقِ فست‌فود باشد، وگرنه این تست چیزی نمی‌سنجد');

    await reset(restaurantId);
    await seedFutureReservation(restaurantId, SHORT_OFFSET);
    await seedWaiting(restaurantId);

    const res = await promoteNext(restaurantId);

    assert.equal(res.promoted, true,
      'افقِ فست‌فود کوتاه است؛ رزروِ یک‌ساعتِ دیگر نباید میزِ همین حالا را حبس کند');
    assert.equal(res.table, TABLE_NUMBER, 'باید همان تک‌میز آفر شود');
  });
});
