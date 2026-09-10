import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  ورودیِ یتیمِ `accepted` — تستِ بازتولیدِ BE-005 §۴ / دستورِ ۰۴۸
//
//  ⚠️ این فایل **رفع نمی‌کند**، عمداً. حکمِ CEO (۲۰۲۶-۰۹-۱۰): تستِ بازتولید
//  حالا، رفع پس از بازبین. پس تستِ (الف) امروز **قرمز** است و قرمزی‌اش خودِ
//  یافته است، نه خرابی.
//
//  ── ادعا ─────────────────────────────────────────────────────────────
//  `acceptOffer` ورودی را اتمیک `accepted` می‌کند (`:670`)، بعد رزرو می‌سازد،
//  و **تازه بعدش** `reservationCode` را می‌نویسد (`:722`). اگر ساختِ رزرو
//  throw کند، یک نوشتنِ جبرانی ورودی را به `offered` برمی‌گرداند — و آن نوشتن
//  بلعیده می‌شود (`:715`, `.catch(() => {})`).
//
//  کامنتِ همان‌جا (`:712-714`) می‌گوید «cron خودش تمیزش می‌کند». جارو فقط
//  `status: 'offered'` را برمی‌دارد (`:840`)، و جبران دقیقاً همان چیزی است که
//  `accepted` را به `offered` تبدیل می‌کند. **پس تنها راهِ نجاتِ ورودی، همان
//  نوشتنی است که بلعیده شده.**
//
//  ── ⚠️ قیدِ بازبین، و چرا این فایل شکلِ فعلی‌اش را دارد ───────────────
//  نسخه‌ی اولِ همین تست حالتِ یتیم را با `offerExpiresAt`ِ گذشته می‌ساخت، و
//  رفعِ پیشنهادی هم روی همان کلید می‌خورد. **بازبین جلویش را گرفت و درست هم
//  گفت:** `accepted` + `reservationCode` خالی، حالتِ گیرکرده **نیست** — حالتِ
//  **گذرای هر پذیرشِ موفق** است، در پنجره‌ای که یک `createReservation` در آن
//  می‌نشیند. جاروی کلیدخورده به `offerExpiresAt` این را مچ می‌کرد:
//
//      مهمان یک ثانیه پیش از TTL می‌پذیرد · رزرو سه ثانیه طول می‌کشد ·
//      cron در ثانیه‌ی دوم شلیک می‌کند  ⇒  میز آزاد می‌شود در حالی که رزروِ
//      همان میز در حالِ ساخته‌شدن است  ⇒  **رزروِ دوگانه.**
//
//  و پذیرفتنِ نزدیک به TTL دقیقاً کاری است که یک مهمانِ مردد می‌کند.
//
//  پس معیارِ درست **مدتِ ماندگاری** است، نه انقضای آفر:
//      status='accepted'  AND  reservationCode IS NULL  AND  respondedAt < now − T
//  با `T` بر حسبِ دقیقه، راحت بلندتر از حداکثر عمرِ تراکنشِ رزرو.
//  `respondedAt` از قبل در همان claimِ `:670` ست می‌شود.
//
//  تستِ (ج) همین قید را **پیش از وجودِ رفع** می‌بندد: پنجره‌ی گذرا نباید
//  جارو شود. امروز بی‌اهمیت سبز است (هیچ‌چیز `accepted` را جارو نمی‌کند)، و
//  دقیقاً برای همین باید حالا نوشته شود — تا رفعِ فردا نتواند بی‌صدا از
//  رویش رد شود.
//
//  ── آسیبِ واقعی، تصحیح‌شده ───────────────────────────────────────────
//  «میز تا ابد بلوکه می‌ماند» **غلط بود** (تصحیحِ بازبین): کارمند از نقشه‌ی
//  سالن آزادش می‌کند (`restaurant/tables/[id]/state/route.ts`). آنچه واقعاً
//  بازیابی‌ناپذیر است ساکت‌تر است — `:1047` :
//      const seated = countOf('accepted', 'seated');
//  **یک ردیفِ گیرکرده تا ابد «نشسته» شمرده می‌شود، در عددی که به رستوران
//  نشان داده می‌شود.** فوریتِ کمتر، نیمه‌عمرِ خیلی بلندتر.
//
//  ── ⚠️ ضدِ سبزِ توخالی ───────────────────────────────────────────────
//  هر ادعای منفی («جارو ندیدش») یک کنترلِ مثبتِ چسبیده دارد: ورودیِ خواهری
//  در همان رستوران، با همان زمان‌ها، ولی `offered`. اگر جارو اصلاً ندود، آن
//  کنترل هم نمی‌چرخد و تست به‌جای «یافته» می‌گوید «ابزار خراب است».
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { expireOffers, acceptOffer, hashGuestToken } = await import('../src/lib/waitlist.ts');

const TAG = `wloa-${randomUUID().slice(0, 8)}`;
const TZ = 'Asia/Tehran';

/** مدتِ ماندگاری‌ای که رفعِ آینده باید از آن بلندتر باشد تا پنجره‌ی گذرا امن بماند. */
const DWELL_MINUTES = 10;

/** توکنِ مهمان برایِ تستِ (ب) — بدونش acceptOffer پیش از مسیرِ خطا رد می‌شود. */
const GUEST_TOKEN = `tok-${randomUUID()}`;

let tenantId = '';
let restaurantId = '';
let orphanTableId = '';
let controlTableId = '';
let freshTableId = '';

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;

  const r = await db.restaurant.create({
    data: {
      tenantId,
      slug: `${TAG}-r`,
      name: '[DEMO] ورودیِ یتیمِ صف',
      clubPrefix: 'WLO',
      timezone: TZ,
      isOpen: true,
      onlineGating: false,
      tables: {
        create: [
          { number: 71, capacity: 4, minPartySize: 1, isActive: true, state: 'reserved' },
          { number: 72, capacity: 4, minPartySize: 1, isActive: true, state: 'reserved' },
          { number: 73, capacity: 4, minPartySize: 1, isActive: true, state: 'reserved' },
        ] as never,
      },
    },
    select: { id: true },
  });
  restaurantId = r.id;

  const tables = await db.table.findMany({
    where: { restaurantId }, orderBy: { number: 'asc' }, select: { id: true, number: true },
  });
  orphanTableId = tables.find((x) => x.number === 71)!.id;
  controlTableId = tables.find((x) => x.number === 72)!.id;
  freshTableId = tables.find((x) => x.number === 73)!.id;
});

after(async () => {
  await db.waitlistEntry.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservationItem.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

async function makeEntry(opts: {
  status: 'offered' | 'accepted';
  tableId: string;
  tableNumber: number;
  respondedMinutesAgo?: number;
  offerExpiresAt: Date;
}) {
  const e = await db.waitlistEntry.create({
    data: {
      restaurantId,
      guestName: '[DEMO] مهمانِ صف',
      guestPhone: `0913${Math.floor(1000000 + Math.random() * 8999999)}`,
      partySize: 2,
      status: opts.status,
      offeredAt: minutesAgo(30),
      offerExpiresAt: opts.offerExpiresAt,
      offeredTableId: opts.tableId,
      offeredTableNumber: opts.tableNumber,
      respondedAt: opts.respondedMinutesAgo === undefined ? null : minutesAgo(opts.respondedMinutesAgo),
      seatedAt: opts.respondedMinutesAgo === undefined ? null : minutesAgo(opts.respondedMinutesAgo),
    },
    select: { id: true },
  });
  return e.id;
}

describe('BE-005 §۴ / دستورِ ۰۴۸ — ورودیِ یتیمِ accepted', () => {
  test('(الف) ورودیِ acceptedِ بدونِ رزرو که مدت‌هاست نشسته، از هیچ جارویی رد نمی‌شود', async () => {
    const orphanId = await makeEntry({
      status: 'accepted', tableId: orphanTableId, tableNumber: 71,
      respondedMinutesAgo: DWELL_MINUTES * 3,     // خیلی بیش از هر تراکنشِ رزرو
      offerExpiresAt: minutesAgo(20),
    });
    const controlId = await makeEntry({
      status: 'offered', tableId: controlTableId, tableNumber: 72,
      offerExpiresAt: minutesAgo(20),
    });

    await expireOffers();

    const control = await db.waitlistEntry.findUnique({ where: { id: controlId }, select: { status: true } });
    const controlTable = await db.table.findUnique({ where: { id: controlTableId }, select: { state: true } });

    // ⚠️ کنترلِ مثبت **اول**. اگر جارو نچرخیده باشد، ادعای منفیِ پایین بی‌معنا
    // است و باید همین‌جا بمیریم، نه اینکه یک «یافته»ی ساختگی گزارش کنیم.
    assert.equal(
      control?.status, 'no_response',
      'کنترلِ مثبت نچرخید: جارو ورودیِ offeredِ منقضی را هم برنداشت ⇒ ابزار خراب است، نه یافته',
    );
    assert.equal(controlTable?.state, 'free', 'کنترلِ مثبت: میزِ ورودیِ جاروشده باید آزاد شده باشد');

    // ── ادعای اصلی ──
    const orphan = await db.waitlistEntry.findUnique({
      where: { id: orphanId }, select: { status: true, reservationCode: true },
    });
    assert.equal(orphan?.reservationCode, null, 'پیش‌شرط: ورودیِ یتیم نباید کدِ رزرو داشته باشد');
    assert.notEqual(
      orphan?.status, 'accepted',
      'ورودیِ acceptedِ بدونِ رزرو که ' + DWELL_MINUTES * 3 + ' دقیقه نشسته، هنوز accepted است — ' +
      'هیچ اجرای بعدی نمی‌بیندش. کامنتِ waitlist.ts:712-714 می‌گوید «cron خودش تمیزش ' +
      'می‌کند»؛ expireOffers:840 فقط status:offered را برمی‌دارد. ' +
      'و تا وقتی این ردیف هست، analytics:1047 آن را برای همیشه «نشسته» می‌شمارد.',
    );
  });

  test('(ب) حالتِ یتیم از مسیرِ واقعی ساخته می‌شود: رزرو شکست می‌خورد و جبران هم شکست می‌خورد', async () => {
    const e = await db.waitlistEntry.create({
      data: {
        restaurantId,
        guestName: '[DEMO] مهمانِ مسیرِ واقعی',
        guestPhone: `0913${Math.floor(1000000 + Math.random() * 8999999)}`,
        partySize: 2,
        status: 'offered',
        offeredAt: new Date(),
        offerExpiresAt: new Date(Date.now() + 30 * 60_000),
        offeredTableNumber: 9999,          // میزی که وجود ندارد ⇒ createReservation باید throw کند
        // ⚠️ بدونِ این، assertCanActOnEntry پیش از رسیدن به مسیرِ خطا throw
        // می‌کند و تست هرگز چیزی را که ادعا می‌کند نمی‌سنجد. نسخه‌ی اول
        // همین را جا انداخته بود و **کنترلِ خودِ تست گرفتش**، نه من.
        guestAccessTokenHash: hashGuestToken(GUEST_TOKEN),
      },
      select: { id: true },
    });

    // ⚠️ تزریق: **فقط** نوشتنِ جبرانی می‌شکند. ادعای اتمیکِ اولِ acceptOffer باید
    // دست‌نخورده بماند، وگرنه اصلاً به مسیرِ خطا نمی‌رسیم و تست چیزِ دیگری می‌سنجد.
    const realUpdateMany = db.waitlistEntry.updateMany.bind(db.waitlistEntry);
    let compensationAttempted = false;
    (db.waitlistEntry as unknown as { updateMany: unknown }).updateMany = (async (args: {
      where?: { status?: string }; data?: { status?: string };
    }) => {
      if (args?.where?.status === 'accepted' && args?.data?.status === 'offered') {
        compensationAttempted = true;
        throw new Error('[DEMO] شکستِ شبیه‌سازی‌شده‌ی نوشتنِ جبرانی');
      }
      return realUpdateMany(args as never);
    }) as unknown as typeof db.waitlistEntry.updateMany;

    let threw = false;
    try {
      await acceptOffer(e.id, 'customer', { guestToken: GUEST_TOKEN });
    } catch {
      threw = true;
    } finally {
      (db.waitlistEntry as unknown as { updateMany: unknown }).updateMany = realUpdateMany;
    }

    // کنترل‌ها: اگر مسیرِ موردِ ادعا پیموده نشده، تست باید بمیرد نه سبز بماند.
    assert.ok(threw, 'acceptOffer باید throw می‌کرد (میزِ ۹۹۹۹ وجود ندارد) — مسیرِ خطا اجرا نشد');
    assert.ok(compensationAttempted, 'نوشتنِ جبرانی صدا زده نشد ⇒ این تست مسیرِ موردِ ادعا را نپیموده');

    const after = await db.waitlistEntry.findUnique({
      where: { id: e.id }, select: { status: true, reservationCode: true },
    });
    assert.equal(after?.reservationCode, null, 'کنترل: رزرو نباید ساخته شده باشد');
    assert.notEqual(
      after?.status, 'accepted',
      'ورودی روی accepted گیر کرد و کدِ رزرو ندارد — همان حالتی که (الف) نشان داد ' +
      'هیچ جارویی برنمی‌داردش. شکستِ جبران بلعیده شد و هیچ‌جا ثبت نشد.',
    );
  });

  test('(ج) 🚨 قیدِ ضدِ رزروِ دوگانه: پنجره‌ی گذرای یک پذیرشِ موفق **نباید** جارو شود', async () => {
    // این همان حالتی است که هر پذیرشِ موفق چند ثانیه در آن می‌نشیند: ورودی
    // `accepted` است، `reservationCode` هنوز نوشته نشده، و آفر همین حالا
    // منقضی شده چون مهمان یک ثانیه پیش از TTL پذیرفت.
    //
    // ⚠️ امروز این تست بی‌اهمیت سبز است، چون هیچ‌چیز `accepted` را جارو
    // نمی‌کند. **دقیقاً برای همین حالا نوشته می‌شود:** اگر رفعِ فردا روی
    // `offerExpiresAt` کلید بخورد، همین‌جا قرمز می‌شود — پیش از آنکه در تولید
    // یک میز را زیرِ پای رزروی که در حالِ ساخته‌شدن است آزاد کند.
    const freshId = await makeEntry({
      status: 'accepted', tableId: freshTableId, tableNumber: 73,
      respondedMinutesAgo: 0,                 // همین الان پذیرفت
      offerExpiresAt: minutesAgo(1),          // و آفر همین الان منقضی شد
    });

    await expireOffers();

    const fresh = await db.waitlistEntry.findUnique({ where: { id: freshId }, select: { status: true } });
    assert.equal(
      fresh?.status, 'accepted',
      '🚨 پنجره‌ی گذرای پذیرش جارو شد. هر جاروی `accepted` باید روی **مدتِ ماندگاری** ' +
      '(respondedAt < now − T) کلید بخورد، نه روی offerExpiresAt — وگرنه میزی آزاد ' +
      'می‌شود که رزروش در همین لحظه در حالِ ساخته‌شدن است. رزروِ دوگانه.',
    );
    const freshTable = await db.table.findUnique({ where: { id: freshTableId }, select: { state: true } });
    assert.equal(
      freshTable?.state, 'reserved',
      '🚨 میزِ پنجره‌ی گذرا آزاد شد — همان نیمه‌ی دومِ رزروِ دوگانه.',
    );
  });
});
