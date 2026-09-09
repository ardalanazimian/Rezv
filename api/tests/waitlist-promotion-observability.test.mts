import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// ═══════════════════════════════════════════════════════════════════════
//  گاردِ رصدپذیریِ ارتقایِ لیستِ انتظار — «شکست باید دیده شود»
//
//  ── چه چیزی را قفل می‌کند ──────────────────────────────────────────
//  تا ۲۰۲۶-۰۹-۰۵ هر چهار فراخوانِ `promoteNext` خطا را می‌بلعیدند یا
//  (در sweep) کلِ دسته را می‌انداختند:
//     waitlist.ts:553  declineOffer   → .catch(() => {})
//     waitlist.ts:596  leaveWaitlist  → .catch(() => {})
//     waitlist.ts:644  expireOffers   → .catch(() => {})
//     maintenance/waitlist/route.ts:37 sweep → بدونِ هیچ گاردی
//
//  خطرش تأخیر نبود (cron هر ۲ دقیقه دوباره تلاش می‌کند، cron/crontab:17) —
//  خطرش این بود که یک `promoteNext`ِ **سیستماتیکاً شکست‌خورده** از یکی که
//  هرگز شکست نمی‌خورد **قابلِ تفکیک نبود**. و ترکیبِ چهارلایه بدتر از هر
//  لایه‌اش بود: promoteNext می‌بلعید → expireOffers دوباره می‌بلعید →
//  endpoint ۲xx می‌داد → `cron/run.sh:10` یک `✓ waitlist` چاپ می‌کرد.
//  هیچ خطی به‌تنهایی غلط نبود؛ ترکیبشان برایِ یک شکست «موفقیت» گزارش می‌کرد.
//
//  ── چرا شمارنده از مسیرِ رندرِ *واقعی* خوانده می‌شود ────────────────
//  ادعا از `GET /api/metrics` (خودِ route handler) خوانده می‌شود، نه از
//  `metrics.waitlistPromotionFailed` مستقیم. خواندنِ مستقیمِ آبجکت فقط ثابت
//  می‌کرد «یک عدد در حافظه زیاد شد»؛ چیزی که واقعاً اهمیت دارد این است که
//  همان عدد از مسیری که Prometheus scrape می‌کند **بیرون بیاید**. یک
//  رگرسیونِ واقعی (حذفِ متریک از رجیستریِ خروجی، خرابیِ render، توکنی که
//  endpoint را ببندد) فقط از این سمت دیده می‌شود.
//
//  ── چطور شکست تزریق می‌شود، و چرا این نقطه ────────────────────────
//  `db.table.findMany` تنها کوئری‌ای است که در این مسیرها **فقط**
//  `promoteNext` می‌زند (declineOffer/leaveWaitlist از `tx.table.update`
//  داخلِ تراکنش استفاده می‌کنند و expireOffers از `db.waitlistEntry.*`).
//  پس patchِ آن دقیقاً و تنها ارتقا را می‌شکند — یک خطایِ واقعیِ خواندنِ DB،
//  نه یک استثنایِ ساختگی در جایی که هرگز خطا نمی‌دهد. patch آگاه به آرگومان
//  است تا بتوان «فقط این رستوران خراب باشد» را هم ساخت (لازمِ سناریوی
//  شکستِ جزئی در تستِ endpoint).
//
//  ⚠️ ضدِ سبزِ توخالی (قاعده‌ی ۵ مخزن): `promoteNext` اگر هیچ ورودیِ
//  `waiting`ی نباشد **پیش از** رسیدن به `db.table.findMany` برمی‌گردد —
//  یعنی بدونِ نفرِ دومِ صف، تزریق هرگز شلیک نمی‌کرد و همه‌ی این تست‌ها
//  می‌توانستند به دلیلِ بی‌ربط سبز بمانند. برایِ همین هر سناریو یک
//  **کنترلِ مثبت** دارد: بدونِ تزریق، همان چیدمان واقعاً نفرِ بعدی را ارتقا
//  می‌دهد. اگر آن کنترل بشکند، یعنی هارنس خراب است و بقیه‌ی ادعاها بی‌اعتبار.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { declineOffer, leaveWaitlist, expireOffers, promoteNext } = await import('../src/lib/waitlist.ts');
const metricsRoute = await import('../src/app/api/metrics/route.ts');
const maintenanceRoute = await import('../src/app/api/v1/maintenance/waitlist/route.ts');

const METRIC = 'rezervno_waitlist_promotion_failed_total';
const TAG = `wlobs-${randomUUID().slice(0, 8)}`;
const MAINT_KEY = `demo-maint-${randomUUID()}`;

let tenantId: string;
let restaurantId: string;
let restaurantId2: string;
let userId: string;

// ── خواندنِ شمارنده از مسیرِ رندرِ واقعیِ Prometheus ──────────────────
async function scrapeMetrics(): Promise<string> {
  const res = await metricsRoute.GET(new Request('http://localhost/api/metrics'));
  assert.equal(
    res.status, 200,
    `GET /api/metrics باید ۲۰۰ بدهد وگرنه هیچ ادعایِ متریکی در این فایل معنا ندارد (گرفت: ${res.status})`,
  );
  return await res.text();
}

/**
 * مقدارِ شمارنده برایِ یک `site`. نبودِ **خانواده‌ی متریک** خطاست، نه صفر —
 * وگرنه یک rename در metrics.ts همه‌ی این تست‌ها را با «۰ = ۰» سبز نگه
 * می‌داشت، دقیقاً همان گاردِ توخالی که این فایل برایِ نبودنش نوشته شده.
 */
function counterFor(scrape: string, site: string): number {
  assert.ok(
    scrape.includes(`# TYPE ${METRIC} counter`),
    `خانواده‌ی متریکِ ${METRIC} در خروجیِ /api/metrics نیست — یا حذف/rename شده ` +
    'یا از رجیستریِ رندر افتاده. این «نبودِ موضوع» است و باید FAIL باشد، نه صفر.',
  );
  const needle = `${METRIC}{site="${site}"} `;
  for (const line of scrape.split('\n')) {
    if (line.startsWith(needle)) return Number(line.slice(needle.length).trim());
  }
  return 0; // خانواده هست ولی این برچسب هنوز هیچ‌وقت inc نشده
}

async function counters(): Promise<Record<string, number>> {
  const s = await scrapeMetrics();
  return {
    decline: counterFor(s, 'decline'),
    cancel: counterFor(s, 'cancel'),
    expire: counterFor(s, 'expire'),
    sweep: counterFor(s, 'sweep'),
  };
}

// ── تزریقِ شکستِ واقعی در تنها کوئریِ اختصاصیِ promoteNext ─────────────
type FindManyArgs = { where?: { restaurantId?: string } };
const realFindMany = db.table.findMany.bind(db.table);

const INJECTED = '[DEMO] خطایِ تزریق‌شده‌ی خواندنِ میزها (شبیه‌سازیِ قطعیِ DB)';

/**
 * `mode`:
 *   • `{ failOnly: rid }`   — فقط این رستوران خطا می‌دهد.
 *   • `{ failAll: true }`   — همه خطا می‌دهند.
 *   • `{ failExcept: rid }` — همه جز این رستوران خطا می‌دهند.
 *
 * ⚠️ چرا `failExcept` وجود دارد و چرا تست‌هایِ endpoint **باید** از آن
 * استفاده کنند: کوئریِ جاروب سراسری است (`where: { status: 'waiting' }`
 * بدونِ فیلترِ رستوران، route.ts:50-52). پس یک جاروبِ سالم در این تست،
 * مهمان‌هایِ در صفِ **فایل‌هایِ تستِ دیگر** را هم واقعاً ارتقا می‌دهد و
 * میزشان را می‌گیرد. این دقیقاً یک‌بار رخ داد و
 * `waitlist-flow.integration.test.mts:214` را انداخت (انتظار ۱ آفر، گرفت ۰)
 * — یک شکستِ واقعی که **تستِ من** ساخته بود، نه کدِ محصول.
 *
 * چون شکست دقیقاً در `db.table.findMany` تزریق می‌شود — یعنی *پیش از* هر
 * نوشتنی در `promoteNext` — یک رستورانِ «خراب» هیچ ردیفی را تغییر نمی‌دهد.
 * پس `failExcept` داده‌ی بیگانه را کاملاً بی‌اثر می‌کند و در عوض ادعاها فقط
 * درباره‌ی رستوران‌هایِ خودِ این فایل‌اند.
 */
type FailMode = { failOnly: string } | { failAll: true } | { failExcept: string };

function shouldFail(mode: FailMode, rid: string | undefined): boolean {
  if ('failAll' in mode) return true;
  if ('failOnly' in mode) return rid === mode.failOnly;
  return rid !== mode.failExcept;
}

async function withFailingPromotion<T>(mode: FailMode, fn: () => Promise<T>): Promise<T> {
  const patched = async (args: FindManyArgs) => {
    if (shouldFail(mode, args?.where?.restaurantId)) throw new Error(INJECTED);
    return realFindMany(args as never);
  };
  // @ts-expect-error patchِ عمدیِ delegate برایِ تزریقِ شکست (در finally برمی‌گردد)
  db.table.findMany = patched;
  try {
    return await fn();
  } finally {
    db.table.findMany = realFindMany;
  }
}

// ── گرفتنِ لاگِ ساختاریافته ──────────────────────────────────────────
interface CapturedLog { line: string; meta: Record<string, unknown> }

async function captureErrorLogs<T>(fn: () => Promise<T>): Promise<{ result: T; logs: CapturedLog[] }> {
  const logs: CapturedLog[] = [];
  const realError = console.error;
  console.error = (...args: unknown[]) => {
    logs.push({ line: String(args[0] ?? ''), meta: (args[1] ?? {}) as Record<string, unknown> });
  };
  try {
    const result = await fn();
    return { result, logs };
  } finally {
    console.error = realError;
  }
}

// ── چیدمانِ صف: یک ورودیِ offered رویِ میز + یک ورودیِ waiting پشتِ آن ──
async function mkTable(number: number, rid = restaurantId) {
  return db.table.create({
    data: { restaurantId: rid, number, capacity: 4, minPartySize: 1, isActive: true, state: 'free' },
    select: { id: true, number: true },
  });
}

async function seedOfferedPlusWaiting(expiresAt: Date, rid = restaurantId) {
  const t = await mkTable(100 + Math.floor(Math.random() * 800), rid);
  await db.table.update({ where: { id: t.id }, data: { state: 'reserved' } });
  const offered = await db.waitlistEntry.create({
    data: {
      restaurantId: rid, partySize: 2, status: 'offered', priority: 0,
      guestName: '[DEMO] صاحبِ آفر', joinedAt: new Date(Date.now() - 20 * 60_000),
      offeredAt: new Date(Date.now() - 6 * 60_000), offerExpiresAt: expiresAt,
      offeredTableId: t.id, offeredTableNumber: t.number, userId,
    },
    select: { id: true },
  });
  const waiting = await db.waitlistEntry.create({
    data: {
      restaurantId: rid, partySize: 2, status: 'waiting', priority: 0,
      guestName: '[DEMO] نفرِ بعدیِ صف', joinedAt: new Date(Date.now() - 10 * 60_000),
    },
    select: { id: true },
  });
  return { tableId: t.id, offeredId: offered.id, waitingId: waiting.id };
}

async function statusOf(id: string): Promise<string> {
  const e = await db.waitlistEntry.findUniqueOrThrow({ where: { id }, select: { status: true } });
  return e.status;
}

async function clearQueues() {
  await db.waitlistEntry.deleteMany({ where: { restaurantId: { in: [restaurantId, restaurantId2] } } });
  await db.table.deleteMany({ where: { restaurantId: { in: [restaurantId, restaurantId2] } } });
}

before(async () => {
  process.env.MAINTENANCE_KEY = MAINT_KEY;
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const mk = async (suffix: string) => (await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${suffix}`, name: `[DEMO] رصدپذیریِ صف ${suffix}`,
      clubPrefix: 'WOB', timezone: 'Asia/Tehran', isOpen: true, onlineGating: false,
      openingHours: undefined, lastSeenAt: new Date(),
    },
    select: { id: true },
  })).id;
  restaurantId = await mk('a');
  restaurantId2 = await mk('b');
  const u = await db.user.create({
    data: { phone: `+98937${String(Date.now()).slice(-7)}`, firstName: '[DEMO]', lastName: 'رصدِ صف' },
    select: { id: true },
  });
  userId = u.id;
});

after(async () => {
  const rids = [restaurantId, restaurantId2].filter(Boolean);
  if (rids.length) {
    await db.waitlistEntry.deleteMany({ where: { restaurantId: { in: rids } } }).catch(() => {});
    await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId: { in: rids } } } }).catch(() => {});
    await db.reservationItem.deleteMany({ where: { reservation: { restaurantId: { in: rids } } } }).catch(() => {});
    await db.clubMember.deleteMany({ where: { restaurantId: { in: rids } } }).catch(() => {});
    await db.clubCodeCounter.deleteMany({ where: { restaurantId: { in: rids } } }).catch(() => {});
    await db.reservation.deleteMany({ where: { restaurantId: { in: rids } } }).catch(() => {});
    await db.table.deleteMany({ where: { restaurantId: { in: rids } } }).catch(() => {});
    await db.restaurant.deleteMany({ where: { id: { in: rids } } }).catch(() => {});
  }
  if (tenantId) await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  if (userId) await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

describe('رصدپذیریِ شکستِ ارتقا — سه نقطه‌ی تماس، سه برچسبِ جدا', () => {
  test('کنترلِ مثبت: بدونِ تزریق، همین چیدمان واقعاً نفرِ بعدی را ارتقا می‌دهد', async () => {
    await clearQueues();
    const { offeredId, waitingId } = await seedOfferedPlusWaiting(new Date(Date.now() + 5 * 60_000));
    const before = await counters();

    const out = await declineOffer(offeredId, 'customer', { callerUserId: userId });

    assert.equal(out.status, 'declined');
    assert.equal(
      await statusOf(waitingId), 'offered',
      'نفرِ بعدیِ صف ارتقا نگرفت — یعنی موضوعِ این فایل (یک ارتقایِ واقعی) اصلاً ' +
      'رخ نمی‌دهد و همه‌ی تست‌هایِ بعدی می‌توانند به دلیلِ بی‌ربط سبز بمانند',
    );
    const after = await counters();
    assert.deepEqual(after, before, 'در مسیرِ موفق هیچ برچسبی نباید زیاد شود');
  });

  test('decline: ارتقا شکست می‌خورد، پاسخِ کاربر همچنان موفق است، برچسبِ decline زیاد می‌شود', async () => {
    await clearQueues();
    const { tableId, offeredId, waitingId } = await seedOfferedPlusWaiting(new Date(Date.now() + 5 * 60_000));
    const before = await counters();

    const { result, logs } = await captureErrorLogs(() =>
      withFailingPromotion({ failOnly: restaurantId }, () => declineOffer(offeredId, 'customer', { callerUserId: userId })));

    // ۱) کنشِ کاربر **موفق** است — شکستِ ارتقا نباید شکستِ جعلی گزارش کند
    assert.equal(result.status, 'declined', 'رد کردنِ آفر باید موفق بماند حتی وقتی ارتقا شکست می‌خورد');
    assert.equal(await statusOf(offeredId), 'declined', 'وضعیتِ ورودی باید واقعاً commit شده باشد');
    const tbl = await db.table.findUniqueOrThrow({ where: { id: tableId }, select: { state: true } });
    assert.equal(tbl.state, 'free', 'میز باید آزاد شده باشد — کنشِ اصلی کامل انجام شده');

    // ۲) و ارتقا واقعاً انجام **نشده** (وگرنه تزریق شلیک نکرده و تست بی‌معناست)
    assert.equal(
      await statusOf(waitingId), 'waiting',
      'نفرِ بعدی ارتقا گرفت — یعنی تزریقِ شکست شلیک نکرده و ادعایِ متریکِ زیر بی‌اعتبار است',
    );

    // ۳) شمارنده، از مسیرِ رندرِ واقعی، دقیقاً روی برچسبِ خودش
    const after = await counters();
    assert.equal(after.decline, before.decline + 1, 'برچسبِ decline باید دقیقاً ۱ واحد زیاد شود');
    assert.equal(after.cancel, before.cancel, 'برچسبِ cancel نباید دست بخورد');
    assert.equal(after.expire, before.expire, 'برچسبِ expire نباید دست بخورد');
    assert.equal(after.sweep, before.sweep, 'برچسبِ sweep نباید دست بخورد');

    // ۴) لاگِ ساختاریافته
    const hit = logs.find(l => l.meta?.event === 'waitlist.promotion_failed');
    assert.ok(hit, `لاگِ ساختاریافته‌ی waitlist.promotion_failed صادر نشد. لاگ‌های دیده‌شده: ${JSON.stringify(logs.map(l => l.line))}`);
    assert.equal(hit.meta.site, 'decline', 'لاگ باید همان نقطه‌ی صدور را حمل کند');
    assert.equal(hit.meta.restaurantId, restaurantId);
    assert.ok(String(hit.line).includes('[waitlist]'), 'لاگ باید از scopeِ waitlist باشد');
  });

  test('cancel: همان قرارداد، برچسبِ جدا', async () => {
    await clearQueues();
    const { offeredId, waitingId } = await seedOfferedPlusWaiting(new Date(Date.now() + 5 * 60_000));
    const before = await counters();

    const { result, logs } = await captureErrorLogs(() =>
      withFailingPromotion({ failOnly: restaurantId }, () => leaveWaitlist(offeredId, { staffRestaurantId: restaurantId })));

    assert.equal(result.status, 'cancelled', 'لغو باید موفق بماند');
    assert.equal(await statusOf(offeredId), 'cancelled');
    assert.equal(await statusOf(waitingId), 'waiting', 'تزریق شلیک نکرده — ادعایِ متریک بی‌اعتبار می‌شد');

    const after = await counters();
    assert.equal(after.cancel, before.cancel + 1, 'برچسبِ cancel باید ۱ واحد زیاد شود');
    assert.equal(after.decline, before.decline, 'شکستِ مسیرِ cancel نباید زیرِ برچسبِ decline شمرده شود');
    assert.equal(after.expire, before.expire);

    const hit = logs.find(l => l.meta?.event === 'waitlist.promotion_failed');
    assert.ok(hit, 'لاگِ ساختاریافته صادر نشد');
    assert.equal(hit.meta.site, 'cancel');
  });

  test('expire: برچسبِ جدا + شمارشِ صریح در خروجیِ expireOffers', async () => {
    await clearQueues();
    const { offeredId, waitingId } = await seedOfferedPlusWaiting(new Date(Date.now() - 60_000));
    const before = await counters();

    const { result, logs } = await captureErrorLogs(() =>
      withFailingPromotion({ failOnly: restaurantId }, () => expireOffers()));

    // انقضا **انجام شده** — یعنی throw نکردیم و کارِ مفید از دست نرفت
    assert.equal(await statusOf(offeredId), 'no_response', 'آفرِ منقضی باید واقعاً منقضی شده باشد');
    assert.ok(result.expired >= 1, `expired باید ≥۱ باشد، گرفت: ${result.expired}`);

    // و شکستِ ارتقا در خودِ خروجی شمرده شده — این چیزی است که endpoint را
    // قادر می‌کند صادق باشد (به‌جایِ ۲xxِ همیشگی و `✓ waitlist`ِ جعلی).
    assert.ok(result.promotionAttempts >= 1, 'حداقل یک تلاشِ ارتقا باید ثبت شده باشد');
    assert.equal(
      result.promotionFailures, result.promotionAttempts,
      'همه‌ی تلاش‌ها تزریق‌شده بودند، پس همه باید شکست‌خورده شمرده شوند',
    );
    assert.equal(await statusOf(waitingId), 'waiting', 'تزریق شلیک نکرده — ادعا بی‌اعتبار');

    const after = await counters();
    assert.equal(after.expire, before.expire + 1, 'برچسبِ expire باید ۱ واحد زیاد شود');
    assert.equal(after.decline, before.decline);
    assert.equal(after.cancel, before.cancel);

    const hit = logs.find(l => l.meta?.event === 'waitlist.promotion_failed');
    assert.ok(hit, 'لاگِ ساختاریافته صادر نشد');
    assert.equal(hit.meta.site, 'expire');
  });
});

describe('قراردادِ endpointِ نگهداری — سبزِ جعلی در لاگِ عملیات بسته شد', () => {
  async function callSweep(): Promise<{ status: number; body: Record<string, unknown> }> {
    // ⚠️ کلید **درست پیش از هر فراخوان** ست می‌شود، نه یک‌بار در before():
    // در اجرایِ کاملِ سوئیت، فایل‌هایِ دیگر (assistant-vocab-poisoning:254،
    // auth-guards:95) همین متغیر را عوض می‌کنند و بعد به مقدارِ اصلی‌اش
    // برمی‌گردانند. یک‌بار ست‌کردن در before یعنی این تست‌ها به ترتیبِ اجرا
    // وابسته می‌شوند — و دقیقاً همین اتفاق افتاد: ۴۰۱ به‌جایِ ۲۰۰ در
    // اجرایِ کامل، در حالی که اجرایِ تکیِ همین فایل سبز بود.
    process.env.MAINTENANCE_KEY = MAINT_KEY;
    const res = await maintenanceRoute.POST(new Request('http://localhost/api/v1/maintenance/waitlist', {
      method: 'POST', headers: { 'x-maintenance-key': MAINT_KEY },
    }));
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  }

  test('کنترلِ مثبت: جاروب واقعاً از طریقِ endpoint ارتقا می‌دهد و ۲۰۰ برمی‌گرداند', async () => {
    await clearQueues();
    const { waitingId } = await seedOfferedPlusWaiting(new Date(Date.now() - 60_000));

    // فقط رستورانِ من واقعاً اجرا می‌شود؛ بقیه بی‌اثر رد می‌شوند (رجوع کن به
    // توضیحِ `failExcept` — جاروب سراسری است و بدونِ این، صفِ فایل‌هایِ دیگر
    // را هم واقعاً مصرف می‌کند).
    const { status, body } = await withFailingPromotion({ failExcept: restaurantId }, callSweep);

    assert.equal(status, 200, 'جاروبی که حداقل یک ارتقایِ موفق دارد باید ۲۰۰ بدهد وگرنه `curl -f` بی‌دلیل ✗ می‌زند');
    assert.ok(Number(body.promoted) >= 1, `جاروب باید حداقل یک ارتقا انجام داده باشد: ${JSON.stringify(body)}`);
    assert.equal(
      await statusOf(waitingId), 'offered',
      'نفرِ بعدیِ صف از مسیرِ واقعیِ endpoint ارتقا نگرفت — یعنی موضوعِ این ' +
      'describe (یک جاروبِ کارآمد) غایب است و ادعاهایِ ۵۰۳/۲۰۰ی بعدی بی‌اعتبارند',
    );
  });

  test('شکستِ کامل → ۵۰۳، تا `curl -f` در cron/run.sh واقعاً ✗ چاپ کند', async () => {
    await clearQueues();
    // یک آفرِ منقضی هم می‌سازیم تا ثابت شود کارِ مفید (انقضا) در پاسخِ ۵۰۳
    // هم گزارش می‌شود — یک ✗ نباید «هیچ کاری نشد» خوانده شود.
    await seedOfferedPlusWaiting(new Date(Date.now() - 60_000));

    const { status, body } = await withFailingPromotion({ failAll: true }, callSweep);

    assert.equal(
      status, 503,
      'وقتی همه‌ی تلاش‌هایِ ارتقا شکست می‌خورند، endpoint باید غیر-۲xx بدهد؛ ' +
      'وگرنه `curl -sf` موفق می‌شود و cron/run.sh:10 یک `✓ waitlist`ِ دروغ چاپ می‌کند',
    );
    assert.equal(body.ok, false);
    assert.ok(
      Number(body.promotion_failures) > 0 && body.promotion_failures === body.promotion_attempts,
      `همه باید شکست خورده باشند: ${JSON.stringify(body)}`,
    );
    assert.ok(
      Number(body.expired_offers) >= 1,
      'انقضاهایِ واقعاً انجام‌شده باید در بدنه‌ی ۵۰۳ هم گزارش شوند — ' +
      'وگرنه اپراتور ✗ را «هیچ کاری نشد» می‌خواند',
    );
  });

  test('شکستِ جزئی → ۲۰۰ (یک مستأجرِ خراب نباید کلِ jobِ ناوگان را قرمز کند)', async () => {
    await clearQueues();
    const a = await seedOfferedPlusWaiting(new Date(Date.now() - 60_000), restaurantId);
    const b = await seedOfferedPlusWaiting(new Date(Date.now() - 60_000), restaurantId2);

    // فقط رستورانِ دوم سالم است: اولی خراب، بقیه‌ی دنیا هم بی‌اثر.
    const { status, body } = await withFailingPromotion({ failExcept: restaurantId2 }, callSweep);

    assert.equal(
      status, 200,
      'شکستِ یک رستوران نباید کلِ جاروب را ✗ کند — این همان دامی است که ظرفِ یک ' +
      'هفته اپراتور را به نادیده‌گرفتنِ ✗ عادت می‌دهد',
    );
    assert.ok(Number(body.promotion_failures) >= 1, 'شکستِ جزئی باید در بدنه گزارش شود، نه پنهان');
    assert.ok(
      Number(body.promotion_attempts) > Number(body.promotion_failures),
      `باید حداقل یک تلاشِ موفق هم بوده باشد: ${JSON.stringify(body)}`,
    );
    assert.equal(body.ok, false, '`ok` باید صادق باشد حتی وقتی وضعیتِ HTTP ۲۰۰ است');

    // و «جزئی» واقعاً جزئی بوده — یکی ارتقا گرفت، دیگری نه.
    assert.equal(await statusOf(b.waitingId), 'offered', 'رستورانِ سالم باید ارتقا داده باشد');
    assert.equal(await statusOf(a.waitingId), 'waiting', 'رستورانِ خراب نباید ارتقا داده باشد');
  });

  test('پایه‌ی تصمیمِ concurrency=8: کوئریِ جاروب هر رستوران را دقیقاً یک بار می‌دهد', async () => {
    // ⚠️ این تست پایه‌ی یک *تصمیم* است، نه یک ناوردایِ تزئینی. ادعا این بود
    // که «cron هم شبکه‌ی ایمنی است و هم مولدِ همزمانیِ باگِ ۱۲/۱۲». اگر
    // `distinct` واقعاً هر رستوران را یک بار بدهد، هیچ دو workerی هرگز رویِ
    // میزهایِ یک رستوران رقابت نمی‌کنند و آن ادعا در بخشِ «مولد» غلط است.
    await clearQueues();
    for (let i = 0; i < 4; i++) {
      await db.waitlistEntry.create({
        data: {
          restaurantId, partySize: 2, status: 'waiting', priority: 0,
          guestName: `[DEMO] هم‌رستوران ${i}`, joinedAt: new Date(Date.now() - (10 - i) * 60_000),
        },
      });
    }
    await db.waitlistEntry.create({
      data: {
        restaurantId: restaurantId2, partySize: 2, status: 'waiting', priority: 0,
        guestName: '[DEMO] رستورانِ دوم', joinedAt: new Date(),
      },
    });

    const rows = await db.waitlistEntry.findMany({
      where: { status: 'waiting' }, distinct: ['restaurantId'], select: { restaurantId: true },
    });
    const mine = rows.filter(r => r.restaurantId === restaurantId || r.restaurantId === restaurantId2);
    assert.equal(
      mine.length, 2,
      `۵ ورودی رویِ ۲ رستوران ساخته شد ولی کوئریِ جاروب ${mine.length} ردیف داد — ` +
      'اگر >۲ باشد یعنی distinct کار نمی‌کند و جاروب واقعاً می‌تواند دو worker را ' +
      'رویِ میزهایِ یک رستوران بیندازد، که پایه‌ی تصمیمِ concurrency=8 را باطل می‌کند',
    );
    assert.equal(new Set(mine.map(r => r.restaurantId)).size, 2, 'هر دو رستوران باید حاضر باشند');
  });
});

describe('ضدِ رگرسیون: promoteNext هنوز خطا را بالا می‌دهد (بلعیدن به داخلش برنگردد)', () => {
  test('خودِ promoteNext باید throw کند — بلع فقط در tryPromoteNext مجاز است', async () => {
    await clearQueues();
    await db.waitlistEntry.create({
      data: {
        restaurantId, partySize: 2, status: 'waiting', priority: 0,
        guestName: '[DEMO] برایِ throwِ خام', joinedAt: new Date(),
      },
    });
    await assert.rejects(
      () => withFailingPromotion({ failOnly: restaurantId }, () => promoteNext(restaurantId)),
      /تزریق‌شده/,
      'اگر promoteNext خودش خطا را ببلعد، سیاستِ واحدِ tryPromoteNext دور زده می‌شود ' +
      'و شمارنده دیگر هیچ‌وقت شلیک نمی‌کند — یعنی همان سکوتی که این تغییر بست، برمی‌گردد',
    );
  });
});
