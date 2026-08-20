import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { createReservation } from '../src/lib/reservations.ts';
import { transitionReservation } from '../src/lib/lifecycle.ts';
import {
  recordPrediction, recordOutcome, confidenceFor,
  getProductionAccuracy, NO_SHOW_FEATURE_VERSION,
} from '../src/lib/prediction-ledger.ts';
import { NO_SHOW_FEATURE_NAMES } from '../src/lib/no-show-model.ts';

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
let tenantId: string, restaurantId: string, userId: string;
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
    data: { phone: `0937${String(Date.now()).slice(-7)}`.slice(0, 11), firstName: '[DEMO]', lastName: 'دفتر' },
    select: { id: true },
  });
  userId = u.id;
});

after(async () => {
  // model_predictions با ON DELETE CASCADE به رستوران بسته است و
  // model_outcomes به پیش‌بینی — پس حذفِ رستوران هردو دفتر را می‌برد.
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
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
      'bias', 'knownUser', 'priorNoShowRate', 'lastMinute',
      'veryEarlyBooking', 'largeParty', 'phoneSource',
    ], 'ترکیبِ ویژگی عوض شده — NO_SHOW_FEATURE_VERSION را هم بالا ببر و این تست را به‌روز کن');
    assert.equal(NO_SHOW_FEATURE_VERSION, 'no_show/v1');
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
