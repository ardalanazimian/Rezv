import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { invalidate, cacheKey } from '../src/lib/cache.ts';
import { createReservation } from '../src/lib/reservations.ts';
import { computeNoShowRisk } from '../src/lib/customer-insights.ts';
import { getLearnedNoShowModelWithRun } from '../src/lib/no-show-model.ts';
import { getAccuracyByModelRun, recordOutcome } from '../src/lib/prediction-ledger.ts';

// ═══════════════════════════════════════════════════════════════════════
//  فازِ ۶ — رجیستریِ مدل: پیش‌بینی به نسخه‌ی مدلی که ساختش بسته می‌شود
//
//  ادعایی که این‌جا اثبات می‌شود: وقتی مدلِ یادگرفته‌ی یک رستوران فعال است،
//  هر پیش‌بینیِ تولید که با آن ساخته می‌شود شناسه‌ی همان اجرایِ آموزش را در
//  دفتر ثبت می‌کند — پس دقتِ تولید قابلِ نسبت‌دادن به یک نسخه‌ی مشخص است.
//
//  ⚠️ چرا آموزشِ واقعی را اجرا نمی‌کنیم: فعال‌شدنِ مدل به گیتِ ایمنی وابسته
//  است (باید روی هولدآوت ۵٪ از heuristic بهتر باشد و از تستِ بایاس رد شود).
//  ساختنِ داده‌ای که *تضمیناً* آن گیت را رد کند یعنی داده را طوری بچینیم که
//  نتیجه‌ی دلخواه بدهد — و آن‌وقت تست به‌جای مسیرِ نسبت‌دادن، شانسِ آموزش را
//  می‌سنجید و ذاتاً flaky می‌شد. پس وضعیتِ «مدلِ فعال با نسب‌نامه‌ی معلوم»
//  مستقیماً ساخته می‌شود و *مسیرِ خواندن تا ثبت* — همان چیزی که فازِ ۶ اضافه
//  کرد — end-to-end آزموده می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `mr-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string, runId: string;
const SLOT_DATE = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);

/** وزن‌هایی که تستِ بایاسِ کانالی را رد نمی‌کنند و احتمالِ میانه می‌دهند. */
const NEUTRAL_WEIGHTS = [-1, 0, 1.5, 0.5, 0, 0.3, 0];

async function waitFor<T>(probe: () => Promise<T | null | undefined>, timeoutMs = 10_000): Promise<T | null> {
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
    data: { tenantId, slug: TAG, name: '[DEMO] رستورانِ رجیستریِ مدل', timezone: 'Asia/Tehran',
            clubPrefix: 'MR', isOpen: true, onlineGating: false },
    select: { id: true },
  });
  restaurantId = r.id;
  await db.table.create({ data: { restaurantId, number: 1, capacity: 4, isActive: true } });

  // یک اجرایِ آموزشِ واقعی در تاریخچه‌ی append-only
  const run = await db.modelTrainingRun.create({
    data: {
      restaurantId, kind: 'no_show', sampleSize: 120,
      metrics: { learnedBrier: 0.14, staticBrier: 0.21 },
      isActive: true, reason: '[DEMO] اجرایِ آزمایشیِ رجیستری',
    },
    select: { id: true },
  });
  runId = run.id;

  await db.restaurantNoShowModel.create({
    data: {
      restaurantId, weights: NEUTRAL_WEIGHTS, sampleSize: 120, positiveCount: 20,
      learnedBrier: 0.14, staticBrier: 0.21, isActive: true, activeRunId: runId,
    },
  });
  // مدل کش می‌شود؛ بدونِ این، خواندنِ بعدی می‌تواند به کشِ خالیِ قبلی بخورد.
  await invalidate(cacheKey('noshow-model-v2', restaurantId)).catch(() => {});
});

after(async () => {
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurantNoShowModel.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('فازِ ۶ — نسب‌نامه‌ی مدل از خواندن تا ثبت', () => {
  test('بارگذارِ مدل، شناسه‌ی اجرایِ آموزش را هم برمی‌گرداند', async () => {
    const m = await getLearnedNoShowModelWithRun(restaurantId);
    assert.ok(m, 'مدلِ فعال باید خوانده شود');
    assert.equal(m.runId, runId, 'شناسه‌ی اجرا باید همان چیزی باشد که ذخیره شد');
    assert.deepEqual(m.weights, NEUTRAL_WEIGHTS);
  });

  test('computeNoShowRisk شناسه‌ی نسخه را در ردِ ورودی می‌گذارد', async () => {
    const res = await computeNoShowRisk({
      userId: null, restaurantId, partySize: 2,
      slotStart: new Date(Date.now() + 45 * 86_400_000),
      createdAt: new Date(), source: 'app',
    });
    assert.equal(res.source, 'learned', 'باید از مدلِ یادگرفته استفاده کند');
    assert.ok(res.lineage, 'ردِ ورودی باید باشد');
    assert.equal(res.lineage.modelRunId, runId);
  });

  test('رزروِ واقعی، پیش‌بینی را با همان شناسه‌ی نسخه ثبت می‌کند', async () => {
    await createReservation({
      restaurantId, date: SLOT_DATE, time: '19:00', partySize: 2,
      guestName: '[DEMO] مهمان', guestPhone: '09370000000',
      source: 'app', notifySms: false,
    });
    const resv = await db.reservation.findFirst({ where: { restaurantId }, select: { id: true } });
    assert.ok(resv);

    const pred = await waitFor(() => db.modelPrediction.findFirst({
      where: { entityType: 'reservation', entityId: resv.id },
      select: { id: true, modelRunId: true, modelSource: true },
    }));
    assert.ok(pred, 'پیش‌بینی باید ثبت شده باشد');
    assert.equal(pred.modelSource, 'learned');
    assert.equal(pred.modelRunId, runId,
      'این همان حلقه‌ی گمشده‌ی فازِ ۶ است: بدونش دقتِ تولید به هیچ نسخه‌ای قابلِ نسبت‌دادن نبود');

    // و حالا نتیجه‌ی واقعی، تا گروه‌بندی بر اساسِ نسخه معنا پیدا کند
    const rec = await recordOutcome({
      entityType: 'reservation', entityId: resv.id,
      observedValue: 1, source: 'reservation_status',
    });
    assert.equal(rec, 'recorded');
  });

  test('دقتِ تولید بر اساسِ نسخه گروه‌بندی می‌شود، نه یک عددِ درهم', async () => {
    const rows = await getAccuracyByModelRun({ restaurantId, predictionType: 'no_show' });
    assert.equal(rows.length, 1, 'یک نسخه در کار است، پس یک گروه');
    assert.equal(rows[0].modelRunId, runId);
    assert.equal(rows[0].modelSource, 'learned');
    assert.equal(rows[0].resolvedCount, 1);
    // زیرِ کفِ نمونه، عدد گزارش نمی‌شود — همان انضباطِ بندِ ۲۰.
    assert.equal(rows[0].brier, null, 'با یک نتیجه نباید عددِ دقت بدهد');
  });
});
