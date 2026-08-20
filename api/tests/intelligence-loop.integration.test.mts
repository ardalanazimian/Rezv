import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  حلقه‌ی هوش، از رزروِ واقعی تا سنجش — تستِ integration زنده
//
//  فرقِ این فایل با prediction-ledger.integration.test.mts: آن‌جا توابعِ
//  ثبت مستقیماً صدا زده می‌شوند (اثباتِ خودِ دفتر). این‌جا هیچ تابعِ ثبتی
//  مستقیماً صدا زده نمی‌شود — فقط createReservation و transitionReservation،
//  یعنی دقیقاً همان دو مسیری که در تولید اجرا می‌شوند. اگر سیم‌کشی قطع
//  باشد، این تست می‌شکند حتی اگر همه‌ی تست‌های واحد سبز بمانند.
//
//  این همان تفاوتِ «کد نوشته شده» و «جریانِ زمانِ اجرا کار می‌کند» است که
//  §۰ نقشه‌راه رویش تأکید دارد: قابلیت فقط وقتی IMPLEMENTED است که زنجیره‌ی
//  کامل کار کند، نه وقتی فایل‌هایش وجود داشته باشند.
//
//  ⚠️ ثبتِ دفتر عمداً بدونِ await است (نباید مسیرِ رزرو را کند/شکننده کند)،
//  پس این تست برایِ نتیجه poll می‌کند نه اینکه فوراً انتظارِ ردیف داشته
//  باشد — همان رفتارِ واقعیِ تولید.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { createReservation } = await import('../src/lib/reservations.ts');
const { transitionReservation } = await import('../src/lib/lifecycle.ts');

let tenantId: string;
let restaurantId: string;
const SLOT_DATE = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);

/** منتظرِ ردیفی می‌ماند که async نوشته می‌شود. null اگر تا مهلت نیامد. */
async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs = 5000): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, 50));
  }
}

before(async () => {
  const s = Date.now().toString(36);
  const tenant = await db.tenant.create({ data: { name: `[DEMO] loop-${s}` } });
  tenantId = tenant.id;
  const restaurant = await db.restaurant.create({
    data: {
      tenantId, slug: `zz-loop-${s}`, name: `[DEMO] رستورانِ حلقه‌ی هوش ${s}`,
      clubPrefix: 'LOP', isOpen: true, onlineGating: false,
    },
  });
  restaurantId = restaurant.id;
  for (const n of [801, 802, 803]) {
    await db.table.create({ data: { restaurantId, number: n, capacity: 4, isActive: true } });
  }
});

after(async () => {
  await db.modelOutcome.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.modelPrediction.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.reservationEvent.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.reservationItem.deleteMany({ where: { reservation: { restaurantId } } }).catch(() => {});
  await db.clubMember.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.clubCodeCounter.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.reservation.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.table.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('رزروِ واقعی → دفترِ پیش‌بینی', () => {
  test('ثبتِ یک رزرو، خودبه‌خود یک پیش‌بینیِ دارایِ نسب در دفتر می‌گذارد', async () => {
    const res = await createReservation({
      restaurantId, date: SLOT_DATE, time: '19:00', partySize: 2,
      guest: { name: '[DEMO] مهمانِ حلقه' }, source: 'manual', notifySms: false,
    });
    assert.ok(res.code, 'رزرو باید ساخته شود');

    const resv = await db.reservation.findFirst({ where: { restaurantId, code: res.code } });
    assert.ok(resv, 'ردیفِ رزرو باید وجود داشته باشد');

    const pred = await waitFor(() => db.modelPrediction.findFirst({ where: { subjectId: resv.id } }));
    assert.ok(pred, 'ثبتِ رزرو باید یک پیش‌بینی در دفتر بگذارد — اگر اینجا null است یعنی سیم‌کشی قطع شده');

    // نسب باید واقعی باشد، نه placeholder
    assert.equal(pred.predictionType, 'no_show');
    assert.equal(pred.subjectType, 'reservation');
    assert.equal(pred.restaurantId, restaurantId);
    assert.ok(['learned', 'heuristic'].includes(pred.modelSource), `منبعِ مدل باید مشخص باشد، شد ${pred.modelSource}`);
    assert.ok(pred.modelVersion.length > 0, 'نسخه‌ی مدل نباید خالی باشد');
    assert.ok(pred.probability >= 0 && pred.probability <= 1, 'احتمال باید در بازه‌ی ۰..۱ باشد');
    assert.ok(pred.horizonAt, 'افقِ دانستنِ نتیجه (شروعِ اسلات) باید ثبت شود');

    // ویژگی‌ها باید همان ورودیِ واقعیِ مدل باشند
    const f = pred.features as Record<string, unknown>;
    assert.equal(f.partySize, 2, 'بردارِ ویژگی باید اندازه‌ی گروهِ واقعی را داشته باشد');
    assert.equal(f.source, 'manual');
    assert.equal(typeof f.leadMinutes, 'number');
  });

  test('احتمالِ ثبت‌شده با امتیازِ ذخیره‌شده روی خودِ رزرو هم‌خوان است', async () => {
    const res = await createReservation({
      restaurantId, date: SLOT_DATE, time: '19:30', partySize: 3,
      guest: { name: '[DEMO] مهمانِ دو' }, source: 'manual', notifySms: false,
    });
    const resv = await db.reservation.findFirst({ where: { restaurantId, code: res.code } });
    const pred = await waitFor(() => db.modelPrediction.findFirst({ where: { subjectId: resv!.id } }));
    assert.ok(pred);
    // no_show_risk_score همان احتمالِ گِردشده به درصد است — اگر این دو از هم
    // جدا بیفتند یعنی UI یک عدد نشان می‌دهد و سنجش عددِ دیگری را می‌سنجد.
    assert.equal(Math.round(pred.probability * 100), resv!.noShowRiskScore,
      'امتیازِ رویِ رزرو باید همان احتمالِ ثبت‌شده در دفتر باشد');
  });
});

describe('تغییرِ وضعیتِ واقعی → دفترِ نتیجه', () => {
  test('رسیدنِ مهمان تا completed، نتیجه‌ی ۰ ثبت می‌کند', async () => {
    const res = await createReservation({
      restaurantId, date: SLOT_DATE, time: '20:00', partySize: 2,
      guest: { name: '[DEMO] مهمانِ حاضر' }, source: 'manual', notifySms: false,
    });
    const resv = await db.reservation.findFirst({ where: { restaurantId, code: res.code } });
    assert.ok(resv);

    // مسیرِ واقعیِ چرخه‌ی حیات: confirmed → checked_in → seated → completed
    await transitionReservation({ reservationId: resv.id, to: 'checked_in', actor: 'staff:test', notify: false });
    await transitionReservation({ reservationId: resv.id, to: 'seated', actor: 'staff:test', notify: false });
    await transitionReservation({ reservationId: resv.id, to: 'completed', actor: 'staff:test', notify: false });

    const outcome = await waitFor(() => db.modelOutcome.findFirst({ where: { subjectId: resv.id } }));
    assert.ok(outcome, 'وضعیتِ پایانی باید نتیجه ثبت کند — اگر null است یعنی قلابِ lifecycle قطع است');
    assert.equal(outcome.outcomeLabel, 0, 'مهمانی که آمد یعنی برچسبِ ۰');
    assert.equal(outcome.restaurantId, restaurantId);
  });

  test('no_show نتیجه‌ی ۱ ثبت می‌کند و جفتِ کاملِ سنجش می‌سازد', async () => {
    const res = await createReservation({
      restaurantId, date: SLOT_DATE, time: '20:30', partySize: 4,
      guest: { name: '[DEMO] مهمانِ غایب' }, source: 'manual', notifySms: false,
    });
    const resv = await db.reservation.findFirst({ where: { restaurantId, code: res.code } });
    assert.ok(resv);

    await transitionReservation({ reservationId: resv.id, to: 'no_show', actor: 'cron', isAutomatic: true, notify: false });

    const outcome = await waitFor(() => db.modelOutcome.findFirst({ where: { subjectId: resv.id } }));
    assert.ok(outcome, 'no_show باید نتیجه ثبت کند');
    assert.equal(outcome.outcomeLabel, 1);
    assert.equal(outcome.outcomeStatus, 'no_show');

    // و مهم‌ترین ادعا: حالا جفتِ کامل از طریقِ JOIN دیده می‌شود
    const { fetchNoShowPairs } = await import('../src/lib/model-evaluation.ts');
    const pairs = await fetchNoShowPairs({ restaurantId });
    assert.ok(pairs.length >= 2, `باید حداقل دو جفتِ کامل باشد، شد ${pairs.length}`);
    assert.ok(pairs.some((p) => p.label === 1), 'جفتِ no-show باید در سنجش دیده شود');
    assert.ok(pairs.some((p) => p.label === 0), 'جفتِ حضور هم باید دیده شود');
  });

  test('لغوِ رزرو هیچ نتیجه‌ای ثبت نمی‌کند (مدل درباره‌اش ادعایی نکرده بود)', async () => {
    const res = await createReservation({
      restaurantId, date: SLOT_DATE, time: '21:00', partySize: 2,
      guest: { name: '[DEMO] مهمانِ لغوکننده' }, source: 'manual', notifySms: false,
    });
    const resv = await db.reservation.findFirst({ where: { restaurantId, code: res.code } });
    assert.ok(resv);

    await transitionReservation({ reservationId: resv.id, to: 'cancelled', actor: 'customer', notify: false });

    // فرصتِ کافی می‌دهیم تا اگر قرار بود چیزی نوشته شود، نوشته شده باشد
    await new Promise((r) => setTimeout(r, 300));
    const outcome = await db.modelOutcome.findFirst({ where: { subjectId: resv.id } });
    assert.equal(outcome, null,
      'لغو نه no-show است نه حضور — ثبتش به‌عنوانِ ۰ دقتِ تولیدی را ساختگی بالا می‌برد');
  });
});
