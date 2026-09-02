import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { createReservation } from '../src/lib/reservations.ts';
import { transitionReservation } from '../src/lib/lifecycle.ts';
import {
  recordPrediction, recordOutcome, confidenceFor,
  getProductionAccuracy, getLedgerHealth, getPlatformCalibration, MIN_RESOLVED_FOR_ACCURACY,
  NO_SHOW_FEATURE_VERSION,
} from '../src/lib/prediction-ledger.ts';
import { NO_SHOW_FEATURE_NAMES } from '../src/lib/no-show-model.ts';
import { fixturePhone } from './_phone.helper.mts';

// ═══════════════════════════════════════════════════════════════════════
//  دفترِ پیش‌بینی و نتیجه (فازِ ۵) — تستِ حلقه‌ی بسته
//
//  آنچه اینجا اثبات می‌شود، ادعایِ مرکزیِ فازِ ۵ است: یک رزروِ واقعی از مسیرِ
//  واقعی ساخته می‌شود، پیش‌بینی خودبه‌خود ثبت می‌شود، رزرو به نتیجه‌ی واقعی
//  می‌رسد، نتیجه ثبت می‌شود، و بعد دقتِ *تولید* از روی همان‌ها محاسبه می‌شود.
//
//  ⚠️ چرا این با mock بی‌معنا بود: تا امروز model_training_runs می‌گفت مدل
//  روی هولدآوت خوب بوده. اگر اینجا هم پیش‌بینی و نتیجه را دستی می‌ساختیم،
//  دوباره چیزی جز خودمان را نمی‌سنجیدیم. پس مسیرِ واقعیِ createReservation و
//  transitionReservation صدا زده می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `pl-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string, userId: string, healthRestaurantId: string,
  calibRestaurantId: string;
const SLOT_DATE = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);

/**
 * انتظار تا وقتی شرط برقرار شود (یا مهلت تمام شود).
 *
 * ⚠️ چرا این تابع وجود دارد — یافته‌ی واقعیِ CI (۲۰۲۶-۰۸-۲۰، PR #37):
 * نسخه‌ی اولِ این تست‌ها بعد از هر عمل یک `setTimeout(400)` ثابت می‌گذاشت.
 * محلی (Node ۲۲) سه اجرای پیاپی ۵۱۱/۵۱۱ سبز بود، ولی CI (Node ۲۰) دقیقاً
 * ۴ تست را انداخت. با تزریقِ ۹۰۰ms تأخیرِ مصنوعی در recordPrediction عیناً
 * همان ۴ شکست بازتولید شد — پس علت قطعی شد: نوشتنِ دفتر عمداً
 * غیرمسدودکننده است (بندِ ۴۶)، و «۴۰۰ میلی‌ثانیه» فقط یک حدس بود، نه قرارداد.
 *
 * انتظارِ شرطی این کلاسِ خطا را کامل حذف می‌کند: روی ماشینِ سریع فوراً
 * برمی‌گردد، روی ماشینِ کند صبر می‌کند، و اگر واقعاً هرگز رخ ندهد با همان
 * assertionِ معنادارِ خودِ تست می‌افتد — نه با یک شکستِ زمان‌بندیِ گمراه‌کننده.
 */
async function waitFor<T>(
  probe: () => Promise<T | null | undefined>,
  timeoutMs = 10_000,
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await probe();
    if (v) return v;
    if (Date.now() >= deadline) return null;
    await new Promise(r => setTimeout(r, 25));
  }
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: TAG, name: '[DEMO] رستورانِ دفترِ پیش‌بینی', timezone: 'Asia/Tehran',
            clubPrefix: 'PL', isOpen: true, onlineGating: false },
    select: { id: true },
  });
  restaurantId = r.id;
  await db.table.create({ data: { restaurantId, number: 1, capacity: 4, isActive: true } });
  const u = await db.user.create({
    // ⚠️ پیشوندِ ۰۹۳۷ مالِ همین فایل است — عوضش نکن و در فایلِ دیگری تکرارش نکن.
    data: { phone: fixturePhone('0937'), firstName: '[DEMO]', lastName: 'دفتر' },
    select: { id: true },
  });
  userId = u.id;

  // رستورانِ دومِ ایزوله برای تست‌های تجمیعِ سلامتِ دفتر — عمداً جدا، تا
  // شمارش‌هایش با حلقه‌ی بسته‌ی بالا قاطی نشود و هر دو گروه قابلِ‌اثبات بمانند.
  const r2 = await db.restaurant.create({
    data: { tenantId, slug: `${TAG}-h`, name: '[DEMO] رستورانِ سلامتِ دفتر', timezone: 'Asia/Tehran',
            clubPrefix: 'PH', isOpen: true, onlineGating: false },
    select: { id: true },
  });
  healthRestaurantId = r2.id;

  // رستورانِ سومِ ایزوله برایِ تست‌هایِ کالیبراسیون — جدا از دو تایِ بالا،
  // وگرنه شمارشِ resolvedCount با دادهٔ آن‌ها قاطی می‌شد.
  const r3 = await db.restaurant.create({
    data: { tenantId, slug: `${TAG}-c`, name: '[DEMO] رستورانِ کالیبراسیون', timezone: 'Asia/Tehran',
            clubPrefix: 'PC', isOpen: true, onlineGating: false },
    select: { id: true },
  });
  calibRestaurantId = r3.id;
});

after(async () => {
  // model_predictions با ON DELETE CASCADE به رستوران بسته است و
  // model_outcomes به پیش‌بینی — پس حذفِ رستوران هردو دفتر را می‌برد.
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: { in: [restaurantId, healthRestaurantId, calibRestaurantId] } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

describe('نسخه‌ی قراردادِ ویژگی', () => {
  test('اگر بردارِ ویژگی عوض شود ولی نسخه بالا نرود، این تست می‌افتد', () => {
    // قفلِ عمدی: NO_SHOW_FEATURE_VERSION فقط وقتی معنا دارد که با ترکیبِ
    // واقعیِ ویژگی‌ها هم‌تراز بماند. اگر کسی ویژگی اضافه/کم کند و نسخه را
    // دست‌نخورده بگذارد، پیش‌بینی‌هایی با معنایِ متفاوت زیرِ یک نسخه قاطی
    // می‌شوند و مقایسه‌ی تاریخی بی‌معنا می‌شود.
    assert.deepEqual([...NO_SHOW_FEATURE_NAMES], [
      'bias', 'knownUser', 'shrunkNoShowRate', 'priorEvidence', 'leadLog',
      'lastMinute', 'largeParty', 'partySizeNorm', 'staffEntered',
      'hourSin', 'hourCos', 'isWeekend',
    ], 'ترکیبِ ویژگی عوض شده — NO_SHOW_FEATURE_VERSION را هم بالا ببر و این تست را به‌روز کن');
    // تاریخچه: v1 بردارِ ۷تاییِ اولیه · v2 همان ترکیب با معنیِ تازه‌ی
    // priorTotal (فازِ ۴) · v3 بردارِ ۱۲تایی (جمع‌شدگیِ نرخِ سابقه، فاصله‌ی
    // پیوسته، ویژگی‌های زمانیِ تهران) · v4 `phoneSource` → `staffEntered`
    // (ویژگی‌ای که هیچ نویسنده‌ای مقدارش را تولید نمی‌کرد و ساختاراً صفر بود).
    //
    // ⚠️ این تست همان کاری را کرد که برایش ساخته شده بود: با تغییرِ بردار
    // قرمز شد و نشان داد برچسبِ دفتر عقب مانده — چون دفتر یک ثابتِ **موازی**
    // داشت. حالا برچسب از همان یک منبع مشتق می‌شود، پس عقب‌ماندن ممکن نیست.
    assert.equal(NO_SHOW_FEATURE_VERSION, 'no_show/v4');
  });
});

describe('اطمینان (confidence) از روی شواهد ساخته می‌شود، نه از روی عدد', () => {
  test('heuristic بدونِ هیچ سابقه‌ای = insufficient_data', () => {
    // بندِ ۲۰ دستور: هرگز قطعیتِ ساختگی نساز.
    assert.equal(confidenceFor({ modelSource: 'heuristic', priorTotal: 0 }), 'insufficient_data');
  });
  test('heuristic با سابقه = low', () => {
    assert.equal(confidenceFor({ modelSource: 'heuristic', priorTotal: 5 }), 'low');
  });
  test('مدلِ یادگرفته بدونِ سابقه = medium، با سابقه = high', () => {
    assert.equal(confidenceFor({ modelSource: 'learned', priorTotal: 0 }), 'medium');
    assert.equal(confidenceFor({ modelSource: 'learned', priorTotal: 3 }), 'high');
  });
});

describe('حلقه‌ی بسته: رزروِ واقعی → پیش‌بینی → نتیجه → دقتِ تولید', () => {
  let reservationId: string;

  test('ساختِ رزروِ واقعی، پیش‌بینی را خودبه‌خود در دفتر ثبت می‌کند', async () => {
    await createReservation({
      restaurantId, date: SLOT_DATE, time: '20:00', partySize: 2,
      userId, source: 'app', notifySms: false,
    });
    const resv = await db.reservation.findFirst({ where: { restaurantId }, select: { id: true } });
    assert.ok(resv, 'رزرو باید ساخته شده باشد');
    reservationId = resv.id;

    // ثبتِ دفتر عمداً غیرمسدودکننده است (بندِ ۴۶)، پس تا وقوعش صبر می‌کنیم.
    const pred = await waitFor(() => db.modelPrediction.findFirst({
      where: { entityType: 'reservation', entityId: reservationId },
    }));
    assert.ok(pred, 'پیش‌بینی باید در دفتر ثبت شده باشد');
    assert.equal(pred.predictionType, 'no_show');
    assert.equal(pred.featureVersion, NO_SHOW_FEATURE_VERSION);
    assert.ok(pred.predictedValue >= 0 && pred.predictedValue <= 1, 'احتمال باید در بازه‌ی ۰..۱ باشد');
    assert.ok(['learned', 'heuristic'].includes(pred.modelSource));
    assert.ok(pred.features, 'ردِ ورودی (lineage) باید ذخیره شده باشد');
    assert.ok(pred.horizonAt, 'افق (لحظه‌ی معلوم‌شدنِ نتیجه) باید ثبت شده باشد');
  });

  test('تا پیش از رسیدنِ رزرو به وضعیتِ نهایی، هیچ نتیجه‌ای ثبت نمی‌شود', async () => {
    const n = await db.modelOutcome.count({ where: { prediction: { entityId: reservationId } } });
    assert.equal(n, 0, 'نتیجه نباید پیش از وقوع ثبت شود — وگرنه آمار از آینده تغذیه می‌شود');
  });

  test('رسیدنِ رزرو به no_show، نتیجه را ثبت می‌کند', async () => {
    await transitionReservation({ reservationId, to: 'confirmed', actor: 'system', isAutomatic: true }).catch(() => {});
    await transitionReservation({ reservationId, to: 'no_show', actor: 'staff', isAutomatic: false });

    const outcome = await waitFor(() =>
      db.modelOutcome.findFirst({ where: { prediction: { entityId: reservationId } } }));
    assert.ok(outcome, 'نتیجه باید ثبت شده باشد');
    assert.equal(outcome.observedValue, 1, 'no_show برچسبِ ۱ است');
    assert.equal(outcome.source, 'reservation_status');
    assert.ok(outcome.squaredError >= 0 && outcome.squaredError <= 1);
  });

  test('ثبتِ دوباره‌ی همان نتیجه بی‌اثر است (آمار دوبار شمرده نمی‌شود)', async () => {
    const again = await recordOutcome({
      entityType: 'reservation', entityId: reservationId,
      observedValue: 1, source: 'reservation_status',
    });
    assert.equal(again, 'duplicate');
    const n = await db.modelOutcome.count({ where: { prediction: { entityId: reservationId } } });
    assert.equal(n, 1, 'باید دقیقاً یک نتیجه بماند');
  });

  test('دقتِ تولید از روی نتایجِ واقعی محاسبه می‌شود', async () => {
    const acc = await getProductionAccuracy({ restaurantId, predictionType: 'no_show' });
    assert.equal(acc.length, 1, 'یک گروه (نوع × منبعِ مدل) باید باشد');
    assert.equal(acc[0].resolvedCount, 1);
    assert.ok(acc[0].brier !== null && acc[0].brier >= 0 && acc[0].brier <= 1,
      'Brier باید عددِ معتبرِ ۰..۱ باشد — این همان چیزی است که تا امروز قابلِ‌محاسبه نبود');
  });
});

describe('سلامتِ دفتر — همان چیزی که داشبوردِ شرکت نشان می‌دهد', () => {
  /** ثبتِ یک پیش‌بینی برای رستورانِ سلامت، با افق و نتیجه‌ی دلخواه. */
  async function seed(opts: {
    predicted: number; horizonAt: Date; observed?: number;
  }): Promise<void> {
    const entityId = randomUUID();
    const id = await recordPrediction({
      restaurantId: healthRestaurantId, predictionType: 'no_show',
      entityType: 'reservation', entityId, modelSource: 'heuristic',
      featureVersion: NO_SHOW_FEATURE_VERSION, predictedValue: opts.predicted,
      confidence: 'low', horizonAt: opts.horizonAt,
    });
    assert.ok(id, 'ثبتِ پیش‌بینیِ آزمایشی باید موفق باشد');
    if (opts.observed !== undefined) {
      const r = await recordOutcome({
        entityType: 'reservation', entityId,
        observedValue: opts.observed, source: 'reservation_status',
      });
      assert.equal(r, 'recorded');
    }
  }

  const past = () => new Date(Date.now() - 3 * 86_400_000);
  const future = () => new Date(Date.now() + 3 * 86_400_000);

  test('در انتظارِ وقوع با «بدونِ نتیجه» اشتباه گرفته نمی‌شود', async () => {
    // این تمایز کلِ ارزشِ overdueCount است: اگر افقِ آینده هم «بدونِ نتیجه»
    // شمرده می‌شد، داشبورد همیشه هشدارِ دروغ می‌داد و کسی جدی‌اش نمی‌گرفت.
    await seed({ predicted: 0.4, horizonAt: future() });                 // در انتظار
    await seed({ predicted: 0.4, horizonAt: past() });                   // افقش گذشته، بی‌نتیجه
    await seed({ predicted: 0.4, horizonAt: past(), observed: 0 });      // حل‌شده

    const rows = await getLedgerHealth({ restaurantId: healthRestaurantId });
    assert.equal(rows.length, 1, 'یک گروه (no_show × heuristic)');
    const g = rows[0];
    assert.equal(g.pendingCount, 1, 'فقط افقِ آینده در انتظار است');
    assert.equal(g.overdueCount, 1, 'فقط افقِ گذشته‌ی بی‌نتیجه سررسیدگذشته است');
    assert.equal(g.resolvedCount, 1);
  });

  test('زیرِ کفِ نمونه، عددِ دقت اصلاً گزارش نمی‌شود (نه صفر، نه عددِ کم‌شمار)', async () => {
    // بندِ ۲۰: قطعیتِ ساختگی ممنوع. با ۱ نتیجه، Brier یک عددِ واقعی ولی
    // ادعایی بی‌معناست. اینجا باید null باشد.
    const rows = await getLedgerHealth({ restaurantId: healthRestaurantId });
    assert.ok(rows[0].resolvedCount < MIN_RESOLVED_FOR_ACCURACY, 'پیش‌فرضِ این تست: هنوز زیرِ کف');
    assert.equal(rows[0].brier, null, 'زیرِ کف باید null باشد');
    assert.equal(rows[0].mae, null);
  });

  test('کنترلِ مثبت: با رسیدن به کف، همان عدد واقعاً محاسبه و برگردانده می‌شود', async () => {
    // بدونِ این کنترل، تستِ بالا با یک `return null`ِ همیشگی هم پاس می‌شد —
    // یعنی هیچ‌چیز را اثبات نمی‌کرد.
    const before = await getLedgerHealth({ restaurantId: healthRestaurantId });
    const need = MIN_RESOLVED_FOR_ACCURACY - before[0].resolvedCount;
    // پیش‌بینیِ کامل‌درست (۰ در برابرِ نتیجه‌ی ۰) → سهمِ Brier صفر است.
    for (let i = 0; i < need; i++) await seed({ predicted: 0, horizonAt: past(), observed: 0 });

    const rows = await getLedgerHealth({ restaurantId: healthRestaurantId });
    const g = rows[0];
    assert.equal(g.resolvedCount, MIN_RESOLVED_FOR_ACCURACY);
    assert.ok(g.brier !== null, 'در کف باید عدد بدهد، نه null');
    assert.ok(g.brier! >= 0 && g.brier! <= 1, 'Brier باید در بازه‌ی معتبر باشد');
    assert.ok(g.mae !== null);
  });

  test('فیلترِ رستوران واقعاً جدا می‌کند (نشتِ بین‌تنانتی ندارد)', async () => {
    // همان انضباطِ tenant-isolation، اینجا روی دفتر: داشبوردِ شرکت کلِ پلتفرم
    // را می‌بیند، ولی هر کوئریِ رستوران‌محور باید فقط همان رستوران را بدهد.
    const mine = await getLedgerHealth({ restaurantId: healthRestaurantId });
    const other = await getLedgerHealth({ restaurantId });
    assert.equal(mine[0].resolvedCount, MIN_RESOLVED_FOR_ACCURACY);
    // رستورانِ حلقه‌ی بسته دقیقاً یک نتیجه دارد — نه بیشتر، نه صفر.
    assert.equal(other.reduce((s, g) => s + g.resolvedCount, 0), 1);
  });
});

describe('کالیبراسیونِ تولیدی — getPlatformCalibration', () => {
  /** ثبتِ یک پیش‌بینیِ حل‌شده (افقش همیشه گذشته، چون فقط نتیجه‌ی معلوم اهمیت دارد). */
  async function seedResolved(opts: {
    restaurantId: string; predicted: number; observed: number; predictionType?: 'no_show' | 'demand';
  }): Promise<void> {
    const entityId = randomUUID();
    const id = await recordPrediction({
      restaurantId: opts.restaurantId, predictionType: opts.predictionType ?? 'no_show',
      entityType: 'reservation', entityId, modelSource: 'heuristic',
      featureVersion: NO_SHOW_FEATURE_VERSION, predictedValue: opts.predicted,
      confidence: 'low', horizonAt: new Date(Date.now() - 86_400_000),
    });
    assert.ok(id, 'seedِ کالیبراسیون باید موفق باشد');
    const r = await recordOutcome({
      entityType: 'reservation', entityId,
      observedValue: opts.observed, source: 'reservation_status',
    });
    assert.equal(r, 'recorded');
  }

  test('زیرِ کفِ نمونه: buckets خالی و ece برابرِ null — نه یک منحنیِ نصفه‌کاره', async () => {
    // ⚠️ عمداً predicted=observed=۱ (کاملاً کالیبره)، نه یک مقدارِ اختیاری:
    // این ردیف در همین رستوران می‌ماند و به‌عنوانِ پایه در تستِ بعدی («کنترلِ
    // مثبت») هم شمرده می‌شود — اگر اینجا مقدارِ نامیزان می‌گذاشتیم، آن تست
    // بدونِ اطلاع یک نمونه‌ی آلوده در محاسبه‌ی eceَ‌اش داشت.
    await seedResolved({ restaurantId: calibRestaurantId, predicted: 1, observed: 1 });
    const rows = await getPlatformCalibration({ restaurantId: calibRestaurantId });
    assert.equal(rows.length, 1);
    assert.ok(rows[0].resolvedCount < MIN_RESOLVED_FOR_ACCURACY, 'پیش‌فرضِ این تست: زیرِ کف');
    assert.deepEqual(rows[0].buckets, []);
    assert.equal(rows[0].ece, null);
  });

  test('کنترلِ مثبت: مدلِ کاملاً کالیبره روی کف، ece نزدیکِ صفر و بادرستی محاسبه می‌شود', async () => {
    // به کف می‌رسانیم؛ همه با predicted=observed=۱ (سهمِ خطایِ صفر).
    const before = await getPlatformCalibration({ restaurantId: calibRestaurantId });
    const need = MIN_RESOLVED_FOR_ACCURACY - before[0].resolvedCount;
    for (let i = 0; i < need; i++) {
      await seedResolved({ restaurantId: calibRestaurantId, predicted: 1, observed: 1 });
    }
    const rows = await getPlatformCalibration({ restaurantId: calibRestaurantId });
    assert.equal(rows[0].resolvedCount, MIN_RESOLVED_FOR_ACCURACY);
    assert.ok(rows[0].buckets.length > 0, 'در کف باید منحنی واقعاً ساخته شود');
    // همه‌ی ۲۰ نمونه (این تست + تستِ قبلی) predicted=observed=۱ هستند —
    // خطا باید دقیقاً صفر باشد، نه فقط «نزدیکِ» صفر.
    assert.equal(rows[0].ece, 0, `مدلِ کاملاً کالیبره باید eceِ دقیقاً صفر بدهد، شد ${rows[0].ece}`);
  });

  test('عدمِ‌کالیبراسیونِ واقعی کشف می‌شود — این تابع فقط عددِ ساختگی برنمی‌گرداند', async () => {
    // رستورانِ تازه: مدلی که همیشه ۹۰٪ می‌گوید ولی هیچ‌وقت رخ نمی‌دهد.
    const r = await db.restaurant.create({
      data: { tenantId, slug: `${TAG}-miscal`, name: '[DEMO] رستورانِ نامیزان', timezone: 'Asia/Tehran',
              clubPrefix: 'PM', isOpen: true, onlineGating: false },
      select: { id: true },
    });
    try {
      for (let i = 0; i < MIN_RESOLVED_FOR_ACCURACY; i++) {
        await seedResolved({ restaurantId: r.id, predicted: 0.9, observed: 0 });
      }
      const rows = await getPlatformCalibration({ restaurantId: r.id });
      assert.equal(rows[0].resolvedCount, MIN_RESOLVED_FOR_ACCURACY);
      assert.ok(rows[0].ece! > 0.8, `مدلِ به‌شدت نامیزان باید eceِ بالا بدهد، شد ${rows[0].ece}`);
      const bucket = rows[0].buckets.find(b => b.from <= 0.9 && 0.9 < b.to);
      assert.ok(bucket, 'سطلِ ۹۰٪ باید در منحنی باشد');
      assert.equal(bucket!.observed, 0, 'نرخِ واقعیِ همان سطل باید صفر باشد');
    } finally {
      await db.restaurant.deleteMany({ where: { id: r.id } }).catch(() => {});
    }
  });

  test('گاردِ ۰..۱: پیش‌بینیِ غیرِاحتمالاتی (مثلِ تعدادِ تقاضا) بی‌صدا کنار گذاشته می‌شود', async () => {
    // predictionType='demand' با predictedValue=۱۲ (تعدادِ کاور، نه احتمال) —
    // اگر گاردِ کوئری نبود، این عدد وارد سطل‌هایِ ۰..۱ می‌شد و منحنی را
    // بی‌معنا می‌کرد.
    await seedResolved({ restaurantId: calibRestaurantId, predicted: 12, observed: 9, predictionType: 'demand' });
    const rows = await getPlatformCalibration({ restaurantId: calibRestaurantId, predictionType: 'demand' });
    assert.equal(rows.length, 0, 'پیش‌بینیِ خارج از بازه‌ی ۰..۱ نباید هیچ گروهی بسازد');
  });

  test('فیلترِ رستوران واقعاً جدا می‌کند (نشتِ بین‌تنانتی ندارد)', async () => {
    // ⚠️ عمداً با یک رستورانِ کاملاً تازه مقایسه می‌شود، نه با healthRestaurantId:
    // آن رستوران در بلوکِ «سلامتِ دفتر» هم به‌طورِ مستقل دقیقاً به همان کفِ
    // MIN_RESOLVED_FOR_ACCURACY رسانده می‌شود (طراحیِ عامدِ آن تست)، پس
    // مقایسه‌ی شمارشِ خام با آن یک هم‌صدفاییِ ساختگی است، نه اثباتِ ایزولاسیون.
    const fresh = await db.restaurant.create({
      data: { tenantId, slug: `${TAG}-isolation`, name: '[DEMO] رستورانِ بدونِ داده', timezone: 'Asia/Tehran',
              clubPrefix: 'PI', isOpen: true, onlineGating: false },
      select: { id: true },
    });
    try {
      const mine = await getPlatformCalibration({ restaurantId: calibRestaurantId, predictionType: 'no_show' });
      const other = await getPlatformCalibration({ restaurantId: fresh.id, predictionType: 'no_show' });
      const mineCount = mine.reduce((s, g) => s + g.resolvedCount, 0);
      // دقیقاً MIN_RESOLVED_FOR_ACCURACY: پیش‌بینیِ demandِ تستِ گارد بالا با
      // predictionType:'no_show' فیلتر نمی‌شود، پس شمارشِ no_show را عوض نمی‌کند.
      assert.equal(mineCount, MIN_RESOLVED_FOR_ACCURACY, 'دقیقاً همان تعدادی که در این بلوک ساختیم');
      assert.equal(other.length, 0, 'رستورانِ بدونِ هیچ پیش‌بینی‌ای نباید هیچ گروهی از رستورانِ دیگر ببیند');
    } finally {
      await db.restaurant.deleteMany({ where: { id: fresh.id } }).catch(() => {});
    }
  });
});

describe('نتیجه‌ی بدونِ پیش‌بینی و رفتارِ fail-open', () => {
  test('ثبتِ نتیجه برای موجودیتی که پیش‌بینی ندارد، خطا نمی‌دهد', async () => {
    const r = await recordOutcome({
      entityType: 'reservation', entityId: randomUUID(),
      observedValue: 0, source: 'reservation_status',
    });
    assert.equal(r, 'no_prediction');
  });

  test('ثبتِ پیش‌بینی با رستورانِ ناموجود throw نمی‌کند (بندِ ۴۶)', async () => {
    // اگر این throw کند، یک خطای دفتر می‌تواند مسیرِ رزرو را بشکند.
    const id = await recordPrediction({
      restaurantId: randomUUID(), predictionType: 'no_show',
      entityType: 'reservation', entityId: randomUUID(),
      modelSource: 'heuristic', featureVersion: NO_SHOW_FEATURE_VERSION,
      predictedValue: 0.5, confidence: 'insufficient_data',
    });
    assert.equal(id, undefined, 'باید بی‌صدا شکست بخورد و undefined بدهد، نه throw');
  });
});
