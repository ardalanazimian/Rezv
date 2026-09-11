import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  دو جفتِ حالتِ لیستِ انتظار — BE-005 §۴ و BE-006 §۳ / دستورِ ۰۴۸
//
//  هر دو یک ریشه دارند: **یک حالتِ گذرا که از یک حالتِ گیرکرده قابلِ تشخیص
//  نیست**، و کدی که نامعلوم را به‌عنوان یک مقدارِ معلوم مصرف می‌کند.
//
//  ── جفتِ ۱: `accepted` بدونِ کدِ رزرو ────────────────────────────────
//  `acceptOffer` ورودی را اتمیک `accepted` می‌کند و **بعد** رزرو می‌سازد. اگر
//  آن شکست بخورد، یک نوشتنِ جبرانی باید به `offered` برش گرداند — و آن نوشتن
//  بلعیده می‌شود. کامنتش می‌گفت «cron خودش تمیزش می‌کند»، ولی جارو فقط
//  `offered` را برمی‌داشت، و جبران دقیقاً همان چیزی است که `accepted` را به
//  `offered` تبدیل می‌کند. **تنها راهِ نجاتِ ورودی همان نوشتنی بود که بلعیده
//  می‌شد.**
//
//  ⚠️ ولی این حالت **حالتِ گذرای هر پذیرشِ موفق هم هست** — قیدِ بازبین، و
//  جلوی یک رزروِ دوگانه را گرفت. پس جارو روی **مدتِ ماندگاری** کلید می‌خورد
//  (`respondedAt < now − T`)، نه روی `offerExpiresAt`. تستِ (ج) همین را
//  قفل می‌کند.
//
//  ── جفتِ ۲: `offered` که هیچ کانالی برایش نرفت ──────────────────────
//  `notifyEntry` هر سه کانال را **شرطی** می‌فرستد. یک مهمانِ بدونِ حساب که
//  تلفن نداده — یا رضایتِ `availability` را خاموش کرده — هیچ کانالی ندارد.
//  تا امروز هیچ ستونی این را ثبت نمی‌کرد، و `expireOffers` او را
//  `no_response` می‌کرد: **«بی‌پاسخ» برای پیامی که هرگز فرستاده نشد.**
//
//  ⚠️ و آنچه این تست **ادعا نمی‌کند**: اینکه ارسال شکست خورده. سه ترنسپورت
//  به‌طورِ طراحی‌شده هرگز reject نمی‌کنند و شکستِ واقعیِ ارسال در لایه‌ی خودش
//  متریک دارد. موضوع اینجا **dispatch نشدن** است، نه **تحویل نشدن**.
//
//  ── ⚠️ ضدِ سبزِ توخالی ───────────────────────────────────────────────
//  هر ادعای این فایل یک کنترلِ چسبیده دارد که در همان اجرا باید جهتِ مخالف
//  را نشان دهد. یک هارنسِ مرده یا جارویی که اصلاً ندود، کنترل را هم
//  می‌کشد و تست به‌جای «یافته» می‌گوید «ابزار خراب است».
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { expireOffers, acceptOffer, hashGuestToken } = await import('../src/lib/waitlist.ts');

const TAG = `wloa-${randomUUID().slice(0, 8)}`;
const TZ = 'Asia/Tehran';

/** باید با `ORPHANED_ACCEPT_DWELL_MINUTES` در waitlist.ts هم‌راستا بماند. */
const DWELL_MINUTES = 5;

/** توکنِ مهمان برایِ تستِ (ب) — بدونش acceptOffer پیش از مسیرِ خطا رد می‌شود. */
const GUEST_TOKEN = `tok-${randomUUID()}`;

let tenantId = '';
let restaurantId = '';
const tableIds: Record<number, string> = {};

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;

  const r = await db.restaurant.create({
    data: {
      tenantId,
      slug: `${TAG}-r`,
      name: '[DEMO] جفت‌های حالتِ صف',
      clubPrefix: 'WLO',
      timezone: TZ,
      isOpen: true,
      onlineGating: false,
      tables: {
        create: [71, 72, 73, 74, 75].map((number) => (
          { number, capacity: 4, minPartySize: 1, isActive: true, state: 'reserved' }
        )) as never,
      },
    },
    select: { id: true },
  });
  restaurantId = r.id;

  for (const t2 of await db.table.findMany({ where: { restaurantId }, select: { id: true, number: true } })) {
    tableIds[t2.number] = t2.id;
  }
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
  tableNumber: number;
  respondedMinutesAgo?: number;
  offerExpiresAt: Date;
  offerNotifiedAt?: Date | null;
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
      offerNotifiedAt: opts.offerNotifiedAt ?? null,
      offeredTableId: tableIds[opts.tableNumber],
      offeredTableNumber: opts.tableNumber,
      respondedAt: opts.respondedMinutesAgo === undefined ? null : minutesAgo(opts.respondedMinutesAgo),
      seatedAt: opts.respondedMinutesAgo === undefined ? null : minutesAgo(opts.respondedMinutesAgo),
    },
    select: { id: true },
  });
  return e.id;
}

const statusOf = async (id: string) =>
  (await db.waitlistEntry.findUnique({ where: { id }, select: { status: true } }))?.status;
const tableStateOf = async (n: number) =>
  (await db.table.findUnique({ where: { id: tableIds[n] }, select: { state: true } }))?.state;

describe('جفت‌های حالتِ لیستِ انتظار — BE-005 §۴ و BE-006 §۳', () => {
  test('(الف) ورودیِ acceptedِ بدونِ رزرو که مدت‌هاست نشسته، رها می‌شود و میزش آزاد', async () => {
    const orphanId = await makeEntry({
      status: 'accepted', tableNumber: 71,
      respondedMinutesAgo: DWELL_MINUTES * 6,
      offerExpiresAt: minutesAgo(20),
    });
    // کنترلِ مثبت: مسیرِ عادیِ انقضا. اگر این نچرخد، ادعای بالا بی‌معناست.
    const controlId = await makeEntry({
      status: 'offered', tableNumber: 72,
      offerExpiresAt: minutesAgo(20),
      offerNotifiedAt: minutesAgo(29),
    });

    const res = await expireOffers();

    assert.equal(await statusOf(controlId), 'no_response',
      'کنترلِ مثبت نچرخید ⇒ جارو اصلاً ندوید، پس هیچ ادعای دیگری در این تست معنا ندارد');
    assert.equal(await tableStateOf(72), 'free', 'کنترلِ مثبت: میزِ ورودیِ جاروشده باید آزاد شود');

    assert.equal(await statusOf(orphanId), 'expired',
      'ورودیِ یتیم باید رها می‌شد. `expired` عمداً انتخاب شده: در هیچ‌کدام از دو ' +
      'سطلِ getWaitlistAnalytics نیست، پس نه در seated می‌ماند و نه به مهمان نسبت داده می‌شود.');
    assert.equal(await tableStateOf(71), 'free', 'میزِ ورودیِ یتیم باید آزاد شود');
    assert.ok(res.orphansReleased >= 1, 'جارو باید رهاسازی را بشمارد — عددِ صفر یعنی بی‌صدا اتفاق افتاد');
  });

  test('(ب) حالتِ یتیم از مسیرِ واقعی ساخته می‌شود، و بعد جارو تمیزش می‌کند', async () => {
    const e = await db.waitlistEntry.create({
      data: {
        restaurantId,
        guestName: '[DEMO] مهمانِ مسیرِ واقعی',
        guestPhone: `0913${Math.floor(1000000 + Math.random() * 8999999)}`,
        partySize: 2,
        status: 'offered',
        offeredAt: new Date(),
        offerExpiresAt: new Date(Date.now() + 30 * 60_000),
        offeredTableNumber: 9999,          // میزی که وجود ندارد ⇒ createReservation throw می‌کند
        // بدونِ این، assertCanActOnEntry پیش از رسیدن به مسیرِ خطا throw می‌کند
        // و تست هرگز چیزی را که ادعا می‌کند نمی‌سنجد. نسخه‌ی اول همین را جا
        // انداخته بود و **کنترلِ خودِ تست گرفتش**، نه من.
        guestAccessTokenHash: hashGuestToken(GUEST_TOKEN),
      },
      select: { id: true },
    });

    // ⚠️ تزریق: **فقط** نوشتنِ جبرانی می‌شکند. ادعای اتمیکِ اولِ acceptOffer
    // باید دست‌نخورده بماند، وگرنه اصلاً به مسیرِ خطا نمی‌رسیم.
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

    assert.ok(threw, 'acceptOffer باید throw می‌کرد (میزِ ۹۹۹۹ وجود ندارد) — مسیرِ خطا اجرا نشد');
    assert.ok(compensationAttempted, 'نوشتنِ جبرانی صدا زده نشد ⇒ این تست مسیرِ موردِ ادعا را نپیموده');

    const stuck = await db.waitlistEntry.findUnique({
      where: { id: e.id }, select: { status: true, reservationCode: true },
    });
    // این **ادعای دست‌یافتنی‌بودن** است، نه یک نقص: حالتِ یتیم واقعاً از مسیرِ
    // معمولی ساخته می‌شود. تا اینجا هیچ زمانی نگذشته، پس جارو حق ندارد لمسش کند.
    assert.equal(stuck?.status, 'accepted', 'حالتِ یتیم باید از مسیرِ واقعی ساخته شده باشد');
    assert.equal(stuck?.reservationCode, null, 'کنترل: رزرو نباید ساخته شده باشد');

    await expireOffers();
    assert.equal(await statusOf(e.id), 'accepted',
      '🚨 جارو ورودیِ تازه‌پذیرفته را برداشت — همان پنجره‌ای که (ج) قفلش می‌کند');

    // حالا زمان را جلو می‌بریم: همان ردیف، فقط قدیمی‌تر.
    await db.waitlistEntry.update({
      where: { id: e.id }, data: { respondedAt: minutesAgo(DWELL_MINUTES * 6) },
    });
    await expireOffers();
    assert.equal(await statusOf(e.id), 'expired',
      'پس از گذشتِ مدتِ ماندگاری، همان ردیف باید رها شده باشد');
  });

  test('(ج) 🚨 قیدِ ضدِ رزروِ دوگانه: پنجره‌ی گذرای یک پذیرشِ موفق نباید جارو شود', async () => {
    // حالتی که هر پذیرشِ موفق چند ثانیه در آن می‌نشیند: `accepted`، بدونِ کدِ
    // رزرو، و آفری که همین حالا منقضی شده چون مهمان یک ثانیه پیش از TTL پذیرفت.
    // اگر جارو به `offerExpiresAt` کلید بخورد، اینجا قرمز می‌شود — پیش از آنکه
    // در تولید میزی را زیرِ پای رزروی که در حالِ ساخته‌شدن است آزاد کند.
    const freshId = await makeEntry({
      status: 'accepted', tableNumber: 73,
      respondedMinutesAgo: 0,
      offerExpiresAt: minutesAgo(1),
    });

    await expireOffers();

    assert.equal(await statusOf(freshId), 'accepted',
      '🚨 پنجره‌ی گذرای پذیرش جارو شد. جاروی `accepted` باید روی مدتِ ماندگاری ' +
      '(respondedAt < now − T) کلید بخورد، نه offerExpiresAt — وگرنه میزی آزاد ' +
      'می‌شود که رزروش در همین لحظه در حالِ ساخته‌شدن است. رزروِ دوگانه.');
    assert.equal(await tableStateOf(73), 'reserved',
      '🚨 میزِ پنجره‌ی گذرا آزاد شد — نیمه‌ی دومِ همان رزروِ دوگانه.');
  });

  test('(د) مهمانی که هیچ اعلانی برایش نرفت، «بی‌پاسخ» ثبت نمی‌شود', async () => {
    const unnotifiedId = await makeEntry({
      status: 'offered', tableNumber: 74,
      offerExpiresAt: minutesAgo(20),
      offerNotifiedAt: null,              // هیچ کانالی dispatch نشد
    });
    // کنترلِ چسبیده و جهتِ مخالف: همان شرایط، ولی اعلان رفته بود.
    const notifiedId = await makeEntry({
      status: 'offered', tableNumber: 75,
      offerExpiresAt: minutesAgo(20),
      offerNotifiedAt: minutesAgo(29),
    });

    await expireOffers();

    assert.equal(await statusOf(notifiedId), 'no_response',
      'کنترل: مهمانی که واقعاً خبردار شد و جواب نداد، باید همچنان no_response باشد — ' +
      'وگرنه این تغییر یک تمایز نساخته، فقط یک برچسب را عوض کرده');
    assert.equal(await statusOf(unnotifiedId), 'expired',
      'مهمانی که هیچ کانالی برایش نرفت به‌عنوان «بی‌پاسخ» ثبت شد — اتهام برای ' +
      'پیامی که هرگز فرستاده نشد. باید `expired` باشد: همان واقعیت، بدونِ نسبت‌دادن.');
    // هر دو میز باید آزاد شده باشند؛ تمایز درباره‌ی **نسبت‌دادن** است نه رفتار.
    assert.equal(await tableStateOf(74), 'free', 'میزِ ورودیِ بی‌اعلان هم باید آزاد شود');
    assert.equal(await tableStateOf(75), 'free', 'میزِ کنترل هم باید آزاد شود');
  });
});
