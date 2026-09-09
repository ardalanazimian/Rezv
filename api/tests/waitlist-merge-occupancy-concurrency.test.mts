import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════════
//  مسابقه‌ی واقعیِ `promoteNext` × `createReservation(merge)` رویِ میزِ ثانویه
//
//  ── چرا این فایل ساخته شد ──────────────────────────────────────────
//  عددِ «۱۲/۱۲» ماه‌ها در زنجیره‌ی ممیزی نقل می‌شد ولی **هیچ تستِ commitشده‌ای
//  آن را بازتولید نمی‌کرد**. تنها فایلِ مرتبط،
//  `waitlist-merge-occupancy.test.mts`، صریحاً فقط حالتِ **ترتیبی** را
//  می‌سنجد و در کامنتِ خودش (`:24-31`) می‌گوید حالتِ هم‌زمان «اینجا آزموده
//  نمی‌شود». یعنی بدترین نقصِ شناخته‌شده‌ی شاخه، عددی بود که هیچ شخصِ سومی
//  نمی‌توانست دوباره اندازه بگیرد. این فایل آن را به یک اندازه‌گیریِ
//  تکرارپذیر تبدیل می‌کند.
//
//  ── چیدمانِ مسابقه (چرا این ظرفیت‌ها، نه اعدادِ دلخواه) ────────────
//  میزِ ۹۰۱ ظرفیت ۲ · میزِ ۹۰۲ ظرفیت ۴ · هر دو با هم mergeable.
//    • گروهِ ۶ نفره → `tryMergeTables` **مجبور** است ۹۰۱+۹۰۲ را ترکیب کند.
//    • مهمانِ صف ۳ نفره → فیلترِ کاندیدهایِ promoteNext
//      (`capacity >= partySize`) میزِ ۹۰۱ را حذف می‌کند، پس تنها کاندید
//      ۹۰۲ است. هیچ انتخابِ تصادفی‌ای باقی نمی‌ماند — مسابقه قطعاً روی
//      همان یک میزِ فیزیکی است.
//
//  ── ادعا فیزیکی است، نه کدِ پاسخِ API ──────────────────────────────
//  «دو مدعیِ هم‌زمانِ میزِ ۹۰۲» یعنی: یک رزروِ فعال ۹۰۲ را در
//  `merged_table_numbers` دارد **و** یک ورودیِ صف با `offered` رویِ همان
//  شماره. توجه: میزِ ثانویه ردیفِ رزروِ خودش را ندارد و آفرِ صف اصلاً رزرو
//  نیست — پس هیچ‌کدام از این دو در `EXCLUDE constraint` دیده نمی‌شوند. به
//  همین دلیل ادعا مستقیم از DB خوانده می‌شود، نه از خروجیِ توابع.
//
//  ⚠️ بدونِ mock و بدونِ DI: هر دو طرف با پیکربندیِ پیش‌فرضِ production اجرا
//  می‌شوند، یعنی `createReservation` از `withSlotLock`ِ *واقعی* رویِ Redisِ
//  *واقعی* رد می‌شود. درسِ ثبت‌شده‌ی
//  `walkin-merge-occupancy-concurrency.test.mts`: bypass کردنِ قفلِ واقعی
//  برای «قطعیتِ زمان‌بندی» یک ۰/۱۵ِ «امن» تولید کرد که کاملاً مصنوعی بود؛
//  با قفلِ واقعی همان مسابقه ۱۴/۱۵ شد.
//
//  ⚠️ ضدِ سبزِ توخالی: اگر merge اصلاً رخ ندهد یا صف اصلاً میزِ ۹۰۲ را
//  کاندید نکند، این تست باید **بشکند**، نه اینکه بی‌صدا رد شود. هر تکرار
//  پیش‌شرط‌هایش را صریح assert می‌کند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { createReservation } = await import('../src/lib/reservations.ts');
const { promoteNext } = await import('../src/lib/waitlist.ts');
const metricsRoute = await import('../src/app/api/metrics/route.ts');

const RETRY_METRIC = 'rezervno_serialization_retries_total';

/** شمارنده‌ی retry برایِ `op=waitlist`، از مسیرِ رندرِ واقعیِ Prometheus. */
async function waitlistRetryCount(): Promise<number> {
  const res = await metricsRoute.GET(new Request('http://localhost/api/metrics'));
  assert.equal(res.status, 200, `GET /api/metrics باید ۲۰۰ بدهد (گرفت ${res.status})`);
  const text = await res.text();
  assert.ok(
    text.includes(`# TYPE ${RETRY_METRIC} counter`),
    `خانواده‌ی ${RETRY_METRIC} در خروجی نیست — حذف/rename شده؟ نبودِ موضوع باید FAIL باشد نه صفر.`,
  );
  const needle = `${RETRY_METRIC}{op="waitlist"} `;
  for (const line of text.split('\n')) {
    if (line.startsWith(needle)) return Number(line.slice(needle.length).trim());
  }
  return 0;
}

const PRIMARY = 901;
const SECONDARY = 902;
const MERGE_PARTY = 6;   // > ظرفیتِ هر میزِ تکی → merge اجباری
const QUEUE_PARTY = 3;   // > ظرفیتِ ۹۰۱، ≤ ظرفیتِ ۹۰۲ → تنها کاندید ۹۰۲ است
const ITERATIONS = 12;

const tenantIds: string[] = [];
const restaurantIds: string[] = [];

after(async () => {
  if (restaurantIds.length) {
    await db.waitlistEntry.deleteMany({ where: { restaurantId: { in: restaurantIds } } }).catch(() => {});
    await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId: { in: restaurantIds } } } }).catch(() => {});
    await db.reservationItem.deleteMany({ where: { reservation: { restaurantId: { in: restaurantIds } } } }).catch(() => {});
    await db.clubMember.deleteMany({ where: { restaurantId: { in: restaurantIds } } }).catch(() => {});
    await db.clubCodeCounter.deleteMany({ where: { restaurantId: { in: restaurantIds } } }).catch(() => {});
    await db.reservation.deleteMany({ where: { restaurantId: { in: restaurantIds } } }).catch(() => {});
    await db.table.deleteMany({ where: { restaurantId: { in: restaurantIds } } }).catch(() => {});
    await db.restaurant.deleteMany({ where: { id: { in: restaurantIds } } }).catch(() => {});
  }
  if (tenantIds.length) await db.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => {});
});

function tehranDateTime(at: Date): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

interface Fixture { restaurantId: string; entryId: string }

async function makeFixture(tag: string): Promise<Fixture> {
  const t = await db.tenant.create({ data: { name: `[DEMO] wl-merge-cnc ${tag}` }, select: { id: true } });
  tenantIds.push(t.id);
  const r = await db.restaurant.create({
    data: {
      tenantId: t.id, slug: `demo-wl-merge-cnc-${tag}-${randomUUID().slice(0, 8)}`,
      name: `[DEMO] رستورانِ مسابقه‌ی صف/ترکیب ${tag}`, clubPrefix: 'WMQ',
      timezone: 'Asia/Tehran', isOpen: true, onlineGating: false, openingHours: undefined,
    },
    select: { id: true },
  });
  restaurantIds.push(r.id);
  await db.table.create({
    data: {
      restaurantId: r.id, number: PRIMARY, capacity: 2, minPartySize: 1,
      isActive: true, state: 'free', isMergeable: true, mergeableWith: [SECONDARY],
    },
  });
  await db.table.create({
    data: {
      restaurantId: r.id, number: SECONDARY, capacity: 4, minPartySize: 1,
      isActive: true, state: 'free', isMergeable: true, mergeableWith: [PRIMARY],
    },
  });
  const e = await db.waitlistEntry.create({
    data: {
      restaurantId: r.id, partySize: QUEUE_PARTY, status: 'waiting', priority: 0,
      guestName: '[DEMO] مهمانِ صف', joinedAt: new Date(Date.now() - 5 * 60_000),
    },
    select: { id: true },
  });
  return { restaurantId: r.id, entryId: e.id };
}

/** چند رزروِ فعال میزِ فیزیکیِ ۹۰۲ را در بر گرفته‌اند (اصلی یا ثانویه)؟ */
async function reservationsCovering(restaurantId: string): Promise<number> {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n
    FROM reservations r
    LEFT JOIN tables t ON t.id = r.table_id
    WHERE r.restaurant_id = ${restaurantId}::uuid
      AND r.status::text = ANY(ARRAY[
        'pending','confirmed','auto_confirmed','preparing','checked_in',
        'running_late','arrived','seated','dining'
      ])
      AND (t.number = ${SECONDARY} OR ${SECONDARY} = ANY(r.merged_table_numbers))
  `;
  return Number(rows[0]?.n ?? 0);
}

/** چند ورودیِ صف همین حالا آفرِ زنده رویِ میزِ ۹۰۲ دارند؟ */
async function liveOffersOnSecondary(restaurantId: string): Promise<number> {
  return db.waitlistEntry.count({
    where: { restaurantId, status: 'offered', offeredTableNumber: SECONDARY },
  });
}

describe('کنترل‌هایِ مثبت — هر دو مسیر واقعاً به میزِ ۹۰۲ می‌رسند', () => {
  // ⚠️ چرا این دو تست پیش از مسابقه می‌آیند: پس از رفع، مسابقه تقریباً همیشه
  // به نفعِ صف تمام می‌شود و merge با SLOT_FULL رد می‌شود. یعنی «merge هرگز
  // ننشست» دیگر نمی‌تواند پیش‌شرطِ مسابقه باشد — وگرنه گاردِ خودِ رفع را
  // قرمز می‌کرد. پس در عوض، *هر مسیر جداگانه* اثبات می‌شود که در نبودِ
  // رقیب واقعاً میزِ ۹۰۲ را می‌گیرد. بدونِ این دو، مسابقه می‌توانست به‌خاطرِ
  // یک چیدمانِ خرابِ ظرفیت (که هیچ‌کدام از دو مسیر اصلاً ۹۰۲ را نبیند)
  // بی‌صدا سبز بماند.

  test('بدونِ صف، گروهِ ۶نفره واقعاً رویِ ۹۰۱+۹۰۲ ترکیب می‌شود', async () => {
    const fx = await makeFixture('ctrl-merge');
    await db.waitlistEntry.deleteMany({ where: { restaurantId: fx.restaurantId } });
    const { date, time } = tehranDateTime(new Date(Date.now() + 2 * 60_000));

    const resv = await createReservation({
      restaurantId: fx.restaurantId, date, time, partySize: MERGE_PARTY,
      guest: { name: '[DEMO] کنترلِ ترکیب' }, source: 'manual', notifySms: false,
    });

    const nums = [...((resv as { merged_tables?: number[] }).merged_tables ?? [])].sort((a, b) => a - b);
    assert.deepEqual(
      nums, [PRIMARY, SECONDARY],
      'merge رويِ ۹۰۱+۹۰۲ ننشست — چیدمانِ ظرفیت‌هایِ این فایل خراب است و ' +
      'مسابقه‌ی پایین هرگز واقعاً رویِ یک میزِ مشترک نخواهد بود',
    );
    assert.equal(await reservationsCovering(fx.restaurantId), 1, 'باید دقیقاً یک رزرو میزِ ۹۰۲ را پوشش دهد');
  });

  test('بدونِ merge، صف واقعاً میزِ ۹۰۲ را آفر می‌دهد', async () => {
    const fx = await makeFixture('ctrl-queue');
    const res = await promoteNext(fx.restaurantId);
    assert.equal(res.promoted, true, 'صف هیچ میزی آفر نداد — مسیرِ ارتقا در این چیدمان اصلاً اجرا نمی‌شود');
    assert.equal(
      res.table, SECONDARY,
      `صف باید میزِ ۹۰۲ را آفر بدهد (تنها کاندیدِ گروهِ ${QUEUE_PARTY}نفره)، نه ${res.table}`,
    );
    assert.equal(res.entryId, fx.entryId);
  });

  test('ترتیبی و معکوس: وقتی صف میز را نگه داشته، merge نباید همان میز را بردارد', async () => {
    // ⚠️ این حالت **هیچ همزمانی‌ای ندارد** و ریشه‌ی واقعیِ باگ است: آفرِ زنده‌ی
    // صف نه ردیفِ رزرو دارد (پس `getOccupiedTableNumbers` نمی‌بیندش) و تا پیش
    // از رفع، فیلترِ کاندیدهایِ merge هم فقط `state != 'maintenance'` بود.
    // اندازه‌گیریِ پیش از رفع: ۶ از ۶. بالابردنِ isolation این را **نمی‌بست**.
    const fx = await makeFixture('seq-reverse');
    const promo = await promoteNext(fx.restaurantId);
    assert.equal(promo.promoted, true, 'پیش‌شرط: صف باید ابتدا میز را گرفته باشد');
    assert.equal(promo.table, SECONDARY);

    const { date, time } = tehranDateTime(new Date(Date.now() + 2 * 60_000));
    let mergeLanded = false;
    try {
      await createReservation({
        restaurantId: fx.restaurantId, date, time, partySize: MERGE_PARTY,
        guest: { name: '[DEMO] گروهِ ۶ بعد از آفر' }, source: 'manual', notifySms: false,
      });
      mergeLanded = true;
    } catch { /* رد شدنِ merge دقیقاً رفتارِ درست است */ }

    const reservations = await reservationsCovering(fx.restaurantId);
    const offers = await liveOffersOnSecondary(fx.restaurantId);
    assert.equal(offers, 1, 'آفرِ صف باید هنوز زنده باشد');
    assert.equal(
      reservations, 0,
      `merge میزِ ۹۰۲ را برداشت در حالی که صف آن را به مهمانِ دیگری آفر داده بود ` +
      `(mergeLanded=${mergeLanded}) — همان مهمان پیامکِ «میزِ ۹۰۲ آماده است» گرفته. ` +
      'ریشه: فیلترِ کاندیدهایِ tryMergeTables باید `state: \'free\'` باشد.',
    );
  });
});

describe('promoteNext هم‌زمان با merge — میزِ ثانویه نباید دو مدعی داشته باشد', () => {
  test(`مسابقه‌ی واقعی، ${ITERATIONS} تکرار: صف نباید میزی را آفر بدهد که merge دارد می‌گیرد`, async () => {
    const reproductions: Array<{ tag: string; reservations: number; offers: number }> = [];
    const claimless: string[] = [];
    let mergesLanded = 0;
    let offersMade = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const tag = `it${i}`;
      const fx = await makeFixture(tag);
      const { date, time } = tehranDateTime(new Date(Date.now() + 2 * 60_000));

      const [merge, promo] = await Promise.allSettled([
        createReservation({
          restaurantId: fx.restaurantId, date, time, partySize: MERGE_PARTY,
          guest: { name: `[DEMO] گروهِ ترکیبیِ هم‌زمان ${tag}` }, source: 'manual', notifySms: false,
        }),
        promoteNext(fx.restaurantId),
      ]);

      // ── پیش‌شرط‌ها: هر طرف یا موفق شد یا با یک کدِ تداخلِ معتبر رد شد ──
      const mergeCode = merge.status === 'rejected' ? (merge.reason as { code?: string })?.code : null;
      assert.ok(
        merge.status === 'fulfilled'
          || mergeCode === 'SLOT_FULL' || mergeCode === 'TABLE_CONFLICT' || mergeCode === 'CONCURRENCY_RETRY',
        `[${tag}] merge نه موفق شد نه با کدِ تداخلِ معتبر رد شد — پیش‌شرطِ مسابقه نامعتبر: ` +
        `${JSON.stringify(merge.status === 'rejected' ? String(merge.reason) : merge.value)}`,
      );
      if (merge.status === 'fulfilled') {
        mergesLanded++;
        const nums = [...((merge.value as { merged_tables?: number[] }).merged_tables ?? [])]
          .sort((a, b) => a - b);
        assert.deepEqual(
          nums, [PRIMARY, SECONDARY],
          `[${tag}] merge رویِ ترکیبِ موردِ انتظار (۹۰۱+۹۰۲) نبود — موضوعِ تست غایب است: ${JSON.stringify(nums)}`,
        );
      }

      const promoCode = promo.status === 'rejected' ? (promo.reason as { code?: string })?.code : null;
      assert.ok(
        promo.status === 'fulfilled'
          || promoCode === 'CONCURRENCY_RETRY' || promoCode === 'TABLE_CONFLICT',
        `[${tag}] promoteNext با خطایِ غیرمنتظره رد شد: ${String(promo.status === 'rejected' ? promo.reason : '')}`,
      );
      if (promo.status === 'fulfilled' && promo.value.promoted) {
        offersMade++;
        assert.equal(
          promo.value.table, SECONDARY,
          `[${tag}] صف میزی غیر از ۹۰۲ آفر داد — چیدمانِ ظرفیت‌ها خراب است و مسابقه واقعی نیست`,
        );
      }

      const reservations = await reservationsCovering(fx.restaurantId);
      const offers = await liveOffersOnSecondary(fx.restaurantId);
      if (reservations > 0 && offers > 0) reproductions.push({ tag, reservations, offers });
      // هیچ مدعی‌ای = هر دو طرف رد شدند؛ این تکرار چیزی نسنجیده و نباید
      // بی‌صدا به‌عنوانِ «امن» شمرده شود.
      if (reservations === 0 && offers === 0) claimless.push(tag);
    }

    // ── نبودِ موضوع = خطا، نه عبور ──
    // ⚠️ عمداً «merge حتماً باید نشسته باشد» **ادعا نمی‌شود**: پس از رفع،
    // صف تقریباً همیشه زودتر میز را می‌گیرد و merge صادقانه SLOT_FULL
    // می‌دهد. اثباتِ «هر دو مسیر واقعاً به ۹۰۲ می‌رسند» کارِ دو کنترلِ مثبتِ
    // بالاست، نه این حلقه. چیزی که این‌جا باید صادق باشد ضعیف‌تر و درست‌تر
    // است: در هر تکرار **دقیقاً یکی** از دو طرف میز را گرفته باشد.
    assert.deepEqual(
      claimless, [],
      `در این تکرارها هیچ‌کدام از دو طرف میزِ ۹۰۲ را نگرفت: ${JSON.stringify(claimless)} — ` +
      'یعنی مسابقه اصلاً رخ نداده و سبزیِ این تست چیزی ثابت نمی‌کند',
    );
    assert.ok(
      mergesLanded + offersMade > 0,
      `در هیچ‌کدام از ${ITERATIONS} تکرار نه merge نشست نه آفری داده شد — ` +
      'این تست فقط ظاهرِ پوشش دارد',
    );

    assert.equal(
      reproductions.length, 0,
      `DOUBLE-BOOKING فیزیکی در ${reproductions.length}/${ITERATIONS} تکرار: ` +
      `${JSON.stringify(reproductions)} — یک رزروِ ترکیبیِ فعال میزِ ۹۰۲ را گرفته و ` +
      'هم‌زمان صف همان میز را به مهمانِ دیگری آفر داده است. مهمان پیامکِ «میزِ ۹۰۲ ' +
      'آماده است» می‌گیرد برایِ میزی که گروهِ دیگری سرش نشسته. ' +
      'ریشه: تراکنشِ promoteNext باید Serializable باشد تا خواندنِ ' +
      'isTableNumberOccupied برایِ SSI مرئی شود (رجوع کن به table-occupancy.ts).',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  تفکیکِ دو علتِ `upd === 0` — نیمه‌ی باربَرِ ارتقا به Serializable
//
//  پیش از ارتقا، `upd === 0` یک معنا داشت: «رقیب میز را گرفت → کاندیدِ
//  بعدی». نگرانیِ درستِ ثبت‌شده این بود که زیرِ Serializable بخشی از همان
//  حالت‌ها به خطایِ سریال‌سازی تبدیل شود که باید **retry** شود نه skip —
//  و قاطی‌کردنشان یا مهمانی را که باید ارتقا می‌گرفت می‌اندازد، یا میزی را
//  که واقعاً رفته دوباره امتحان می‌کند.
//
//  این دو تست ثابت می‌کنند که دو علت **دو مسیرِ فیزیکیِ جدا** هستند و
//  هرکدام رفتارِ درستِ خودش را دارد. بدونِ این‌ها، هیچ گیتی این را نمی‌گرفت.
// ═══════════════════════════════════════════════════════════════════════
describe('`upd === 0` در برابرِ خطایِ سریال‌سازی — دو علت، دو رفتار', () => {
  const SKIP_A = 801;   // اولین کاندید (priority بالاتر) — عمداً «کهنه» می‌شود
  const SKIP_B = 802;   // کاندیدِ دوم — باید نهایتاً همین آفر شود

  async function twoTableFixture(tag: string) {
    const t = await db.tenant.create({ data: { name: `[DEMO] upd0 ${tag}` }, select: { id: true } });
    tenantIds.push(t.id);
    const r = await db.restaurant.create({
      data: {
        tenantId: t.id, slug: `demo-upd0-${tag}-${randomUUID().slice(0, 8)}`,
        name: `[DEMO] تفکیکِ upd0 ${tag}`, clubPrefix: 'UPD',
        timezone: 'Asia/Tehran', isOpen: true, onlineGating: false, openingHours: undefined,
      },
      select: { id: true },
    });
    restaurantIds.push(r.id);
    const a = await db.table.create({
      data: {
        restaurantId: r.id, number: SKIP_A, capacity: 4, minPartySize: 1,
        isActive: true, state: 'free', priority: 10, isMergeable: false,
      },
      select: { id: true },
    });
    const b = await db.table.create({
      data: {
        restaurantId: r.id, number: SKIP_B, capacity: 4, minPartySize: 1,
        isActive: true, state: 'free', priority: 1, isMergeable: false,
      },
      select: { id: true },
    });
    const e = await db.waitlistEntry.create({
      data: {
        restaurantId: r.id, partySize: 3, status: 'waiting', priority: 0,
        guestName: '[DEMO] مهمانِ تفکیک', joinedAt: new Date(Date.now() - 5 * 60_000),
      },
      select: { id: true },
    });
    return { restaurantId: r.id, entryId: e.id, tableAId: a.id, tableBId: b.id };
  }

  test('علتِ ۱ — رقیبِ commitشده: باید به کاندیدِ بعدی **skip** کند، نه retry، نه انداختنِ مهمان', async () => {
    const fx = await twoTableFixture('skip');

    // فهرستِ کاندیدها را عمداً «کهنه» می‌کنیم: promoteNext هر دو میز را
    // آزاد می‌بیند، در حالی که میزِ اول همین حالا توسطِ رقیبی گرفته شده.
    // این دقیقاً همان چیزی است که در تولید رخ می‌دهد — فاصله‌ی بینِ خواندنِ
    // کاندیدها و UPDATEِ شرطی.
    const realFindMany = db.table.findMany.bind(db.table);
    const stale = [
      { id: fx.tableAId, number: SKIP_A },
      { id: fx.tableBId, number: SKIP_B },
    ];
    await db.table.update({ where: { id: fx.tableAId }, data: { state: 'occupied' } });

    const retriesBefore = await waitlistRetryCount();
    let res;
    // @ts-expect-error تزریقِ عمدیِ فهرستِ کهنه‌ی کاندیدها
    db.table.findMany = async (args: { where?: { state?: string } }) => (
      args?.where?.state === 'free' ? stale : realFindMany(args as never)
    );
    try {
      res = await promoteNext(fx.restaurantId);
    } finally {
      db.table.findMany = realFindMany;
    }
    const retriesAfter = await waitlistRetryCount();

    assert.equal(
      res.promoted, true,
      'مهمان ارتقا نگرفت — یعنی `upd === 0` باعثِ *انداختنِ* مهمان شد به‌جایِ ' +
      'رفتن به کاندیدِ بعدی. این همان حالتی است که نباید هرگز رخ دهد.',
    );
    assert.equal(
      res.table, SKIP_B,
      `باید میزِ دوم (${SKIP_B}) آفر می‌شد چون اولی را رقیب گرفته بود، نه ${res.table}`,
    );
    assert.equal(
      retriesAfter, retriesBefore,
      'هیچ retryای نباید شمرده شود: «رقیبِ commitشده» یک skipِ عادی است، نه ' +
      'خطایِ سریال‌سازی. اگر این عدد بالا رفت یعنی دو علت قاطی شده‌اند.',
    );

    const stA = await db.table.findUniqueOrThrow({ where: { id: fx.tableAId }, select: { state: true } });
    assert.equal(stA.state, 'occupied', 'میزِ رقیب نباید دست‌کاری شده باشد');
  });

  test('علتِ ۲ — خطایِ سریال‌سازی: باید **retry** شود، همان مهمان ارتقا بگیرد، و شمارنده بالا برود', async () => {
    const fx = await twoTableFixture('retry');

    // یک ۴۰۰۰۱ با دقیقاً همان شکلی که `isSerializationError` رویش شاخه
    // می‌زند (`code` رویِ خودِ خطا). تزریق فقط برایِ **اولین** تراکنش؛
    // بقیه به مسیرِ واقعی می‌روند، پس تلاشِ دوم یک تراکنشِ کاملاً واقعی است.
    const realTx = db.$transaction.bind(db);
    let thrown = 0;
    const retriesBefore = await waitlistRetryCount();
    db.$transaction = (...args: unknown[]) => {
      if (thrown === 0) {
        thrown++;
        return Promise.reject(Object.assign(
          new Error('[DEMO] could not serialize access due to read/write dependencies'),
          { code: '40001' },
        ));
      }
      // @ts-expect-error عبور به تراکنشِ واقعی
      return realTx(...args);
    };
    let res;
    try {
      res = await promoteNext(fx.restaurantId);
    } finally {
      db.$transaction = realTx;
    }
    const retriesAfter = await waitlistRetryCount();

    assert.equal(thrown, 1, 'تزریق باید دقیقاً یک بار شلیک کرده باشد — وگرنه این تست چیزی نسنجیده');
    assert.equal(
      res.promoted, true,
      'مهمان پس از یک خطایِ سریال‌سازی ارتقا نگرفت — یعنی خطا مثلِ «میز رفته» ' +
      'تفسیر و skip شده. این همان conflationی است که باید بسته می‌شد.',
    );
    assert.equal(
      res.entryId, fx.entryId,
      'باید **همان** مهمانِ اولِ صف ارتقا بگیرد، نه نفرِ دیگری',
    );
    assert.equal(
      retriesAfter, retriesBefore + 1,
      `شمارنده‌ی ${RETRY_METRIC}{op="waitlist"} باید دقیقاً ۱ واحد بالا رفته باشد ` +
      `(${retriesBefore} → ${retriesAfter}). اگر بالا نرفت، یعنی مسیرِ waitlist از ` +
      '`withSerializationRetry` رد نمی‌شود و ارتقا به Serializable بدونِ retry مانده — ' +
      'یعنی هر ابطالِ عادیِ SSI به یک شکستِ واقعیِ کاربر تبدیل می‌شود.',
    );
  });
});
