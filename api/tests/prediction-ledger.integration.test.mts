import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  حلقه‌ی یادگیری: پیش‌بینی → نتیجه → سنجش — تستِ integration زنده
//
//  چرا integration و نه واحد: ادعایِ اصلیِ این لایه دقیقاً درباره‌ی رفتارِ
//  خودِ Postgres است و با mock همان چیزی که باید اثبات شود فرض گرفته می‌شود:
//   • ایندکس‌هایِ یکتایِ migration 055 واقعاً جلویِ ردیفِ تکراری را می‌گیرند
//     (و recordPrediction/recordOutcome آن خطا را بی‌صدا می‌بلعند، نه اینکه
//     مسیرِ اصلی را بشکنند).
//   • JOINِ دفترِ پیش‌بینی و دفترِ نتیجه در fetchNoShowPairs واقعاً جفت
//     می‌سازد — با همان کلیدِ سه‌تایی (type, subject_type, subject_id).
//   • پیش‌بینیِ بدونِ نتیجه در آمار *نمی‌آید* (INNER JOIN) — مهم‌ترین
//     خاصیتِ صداقت: «هنوز معلوم نشده» نباید به‌عنوانِ «مدل درست گفت»
//     شمرده شود.
//
//  ⚠️ این تست چیزی را که خودش نوشته می‌خواند؛ حلقه‌ی کامل (رزروِ واقعی →
//     ledger) در مسیرِ createReservation/transitionReservation وصل شده و
//     این‌جا مستقیماً همان توابعِ ثبت صدا زده می‌شوند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { recordPrediction, recordOutcome, NO_SHOW_FEATURE_VERSION } =
  await import('../src/lib/prediction-ledger');
const { fetchNoShowPairs, evaluatePairs } = await import('../src/lib/model-evaluation');

let tenantId: string;
let restaurantId: string;
/** موضوع‌هایِ ساختگی — uuidِ واقعی لازم است چون ستون uuid است. */
const subjects: string[] = [];

function uuid(): string {
  return crypto.randomUUID();
}

before(async () => {
  const s = Date.now().toString(36);
  const t = await db.tenant.create({ data: { name: `[DEMO] pl-${s}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: `zz-pl-${s}`, name: `[DEMO] دفترِ پیش‌بینی ${s}`, clubPrefix: 'PLA' },
    select: { id: true },
  });
  restaurantId = r.id;
});

after(async () => {
  // پاک‌سازی: دفترها append-only‌اند ولی دادهٔ تست نباید در DBِ مشترک بماند.
  await db.modelOutcome.deleteMany({ where: { restaurantId } });
  await db.modelPrediction.deleteMany({ where: { restaurantId } });
  await db.restaurant.deleteMany({ where: { id: restaurantId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
});

/** یک پیش‌بینیِ کامل با نسبِ واقعی ثبت می‌کند. */
async function predict(subjectId: string, probability: number, modelVersion = '2026-08-20T00:00:00.000Z') {
  await recordPrediction({
    restaurantId,
    predictionType: 'no_show',
    subjectType: 'reservation',
    subjectId,
    modelSource: 'learned',
    modelVersion,
    featureVersion: NO_SHOW_FEATURE_VERSION,
    features: { hasUserId: true, priorTotal: 3, priorNoShowRate: 0.33, leadMinutes: 120, partySize: 2, source: 'app' },
    probability,
    horizonAt: new Date(Date.now() + 3_600_000),
  });
}

describe('دفترِ پیش‌بینی — درج و idempotency', () => {
  test('پیش‌بینی واقعاً در DB می‌نشیند، با نسبِ کامل', async () => {
    const id = uuid(); subjects.push(id);
    await predict(id, 0.42);

    const row = await db.modelPrediction.findFirst({ where: { subjectId: id } });
    assert.ok(row, 'ردیفِ پیش‌بینی باید ساخته شده باشد');
    assert.equal(row.modelSource, 'learned');
    assert.equal(row.probability, 0.42);
    assert.equal(row.featureVersion, NO_SHOW_FEATURE_VERSION);
    // نسب باید واقعاً ذخیره شده باشد، نه یک jsonب خالی
    assert.equal((row.features as Record<string, unknown>).partySize, 2);
    assert.ok(row.horizonAt, 'افقِ دانستنِ نتیجه باید ثبت شود');
  });

  test('ثبتِ دوباره‌ی همان پیش‌بینی با همان نسخه، ردیفِ تکراری نمی‌سازد و throw نمی‌کند', async () => {
    const id = uuid(); subjects.push(id);
    await predict(id, 0.42);
    await predict(id, 0.99); // retry با مقدارِ متفاوت — نباید بازنویسی کند

    const rows = await db.modelPrediction.findMany({ where: { subjectId: id } });
    assert.equal(rows.length, 1, 'ایندکسِ یکتا باید جلویِ تکراری را بگیرد');
    assert.equal(rows[0].probability, 0.42, 'تاریخچه هرگز بازنویسی نمی‌شود — اولین ثبت می‌ماند');
  });

  test('نسخه‌ی جدیدِ مدل روی همان موضوع، ردیفِ *جدید* می‌سازد (نه بازنویسی)', async () => {
    const id = uuid(); subjects.push(id);
    await predict(id, 0.30, '2026-08-20T00:00:00.000Z');
    await predict(id, 0.55, '2026-08-21T00:00:00.000Z'); // مدلِ بازآموزی‌شده

    const rows = await db.modelPrediction.findMany({ where: { subjectId: id }, orderBy: { modelVersion: 'asc' } });
    assert.equal(rows.length, 2, 'امتیازدهیِ دوباره با نسخه‌ی جدید باید تاریخچه بسازد');
    assert.equal(rows[0].probability, 0.30);
    assert.equal(rows[1].probability, 0.55);
  });

  test('احتمالِ نامعتبر اصلاً ثبت نمی‌شود (دادهٔ سنجش مسموم نمی‌شود)', async () => {
    const id = uuid(); subjects.push(id);
    await recordPrediction({
      restaurantId, predictionType: 'no_show', subjectType: 'reservation', subjectId: id,
      modelSource: 'learned', modelVersion: 'v-bad', featureVersion: 1, features: {},
      probability: Number.NaN,
    });
    const rows = await db.modelPrediction.findMany({ where: { subjectId: id } });
    assert.equal(rows.length, 0, 'NaN نباید وارد دفتر شود');
  });
});

describe('دفترِ نتیجه — درج و idempotency', () => {
  test('نتیجه ثبت می‌شود و اولین ثبت برنده است', async () => {
    const id = uuid(); subjects.push(id);
    await recordOutcome({
      restaurantId, predictionType: 'no_show', subjectType: 'reservation', subjectId: id,
      outcomeLabel: 1, outcomeStatus: 'no_show',
    });
    // تلاشِ دوم با برچسبِ متفاوت — نباید واقعیتِ ثبت‌شده را عوض کند
    await recordOutcome({
      restaurantId, predictionType: 'no_show', subjectType: 'reservation', subjectId: id,
      outcomeLabel: 0, outcomeStatus: 'completed',
    });

    const rows = await db.modelOutcome.findMany({ where: { subjectId: id } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].outcomeLabel, 1, 'نتیجه بازنویسی نمی‌شود');
    assert.equal(rows[0].outcomeStatus, 'no_show');
  });
});

describe('حلقه‌ی کامل — JOIN و صداقتِ سنجش', () => {
  test('فقط جفت‌هایِ کامل شمرده می‌شوند؛ پیش‌بینیِ بی‌نتیجه در آمار نمی‌آید', async () => {
    const withOutcome = uuid();
    const withoutOutcome = uuid();
    subjects.push(withOutcome, withoutOutcome);

    await predict(withOutcome, 0.8, 'join-test-v1');
    await recordOutcome({
      restaurantId, predictionType: 'no_show', subjectType: 'reservation',
      subjectId: withOutcome, outcomeLabel: 1, outcomeStatus: 'no_show',
    });
    // این یکی عمداً بدونِ نتیجه می‌ماند — «هنوز معلوم نشده»
    await predict(withoutOutcome, 0.9, 'join-test-v1');

    const pairs = await fetchNoShowPairs({ restaurantId });
    const ids = pairs.map((p) => p.probability);
    assert.ok(ids.includes(0.8), 'جفتِ کامل باید بیاید');
    assert.ok(!ids.includes(0.9), 'پیش‌بینیِ بی‌نتیجه نباید شمرده شود — وگرنه آمار به نفعِ مدل تقلب می‌کند');
  });

  test('منبعِ مدل در جفت‌ها حفظ می‌شود (تفکیکِ یادگرفته از heuristic)', async () => {
    const id = uuid(); subjects.push(id);
    await recordPrediction({
      restaurantId, predictionType: 'no_show', subjectType: 'reservation', subjectId: id,
      modelSource: 'heuristic', modelVersion: 'heuristic-v1', featureVersion: 1,
      features: { partySize: 4 }, probability: 0.25,
    });
    await recordOutcome({
      restaurantId, predictionType: 'no_show', subjectType: 'reservation',
      subjectId: id, outcomeLabel: 0, outcomeStatus: 'completed',
    });

    const pairs = await fetchNoShowPairs({ restaurantId });
    const heuristics = pairs.filter((p) => p.modelSource === 'heuristic');
    assert.ok(heuristics.length >= 1, 'منبعِ heuristic باید قابلِ‌تفکیک باشد — همان چیزی که قبلاً دور ریخته می‌شد');
  });

  test('سنجش روی دادهٔ کم صادقانه insufficient_data می‌دهد، نه عددِ خوش‌ظاهر', async () => {
    const pairs = await fetchNoShowPairs({ restaurantId });
    const evaluation = evaluatePairs(pairs);
    // این رستوران فقط چند جفت دارد — عمداً زیرِ حدِ نصاب
    assert.equal(evaluation.status, 'insufficient_data');
    assert.equal(evaluation.productionBrier, null, 'عددِ بی‌پشتوانه گزارش نمی‌شود');
  });

  test('روی دادهٔ کافی، سنجشِ واقعی از همان جفت‌هایِ DB حساب می‌شود', async () => {
    // ۴۰ جفتِ کاملِ «مدلِ درست»: احتمالِ بالا → no_show، احتمالِ پایین → حضور
    for (let i = 0; i < 40; i++) {
      const id = uuid(); subjects.push(id);
      const isNoShow = i % 2 === 0;
      await predict(id, isNoShow ? 0.95 : 0.05, 'bulk-v1');
      await recordOutcome({
        restaurantId, predictionType: 'no_show', subjectType: 'reservation', subjectId: id,
        outcomeLabel: isNoShow ? 1 : 0, outcomeStatus: isNoShow ? 'no_show' : 'completed',
      });
    }

    const pairs = await fetchNoShowPairs({ restaurantId });
    const evaluation = evaluatePairs(pairs);
    assert.notEqual(evaluation.status, 'insufficient_data', 'حالا باید دادهٔ کافی باشد');
    assert.ok(evaluation.productionBrier !== null);
    assert.ok(evaluation.productionBrier! < 0.1, `مدلِ تقریباً کامل باید Brierِ پایین بگیرد، شد ${evaluation.productionBrier}`);
    assert.equal(evaluation.status, 'normal');
    assert.ok(evaluation.calibration.length > 0, 'منحنیِ کالیبراسیون باید ساخته شود');
  });

  test('فیلترِ رستوران واقعاً ایزوله می‌کند (نشتِ بین‌تنانتی نباشد)', async () => {
    const otherTenant = await db.tenant.create({ data: { name: `[DEMO] pl-other-${Date.now().toString(36)}` }, select: { id: true } });
    const other = await db.restaurant.create({
      data: {
        tenantId: otherTenant.id, slug: `zz-pl-other-${Date.now().toString(36)}`,
        name: '[DEMO] رستورانِ دیگر', clubPrefix: 'PLB',
      },
      select: { id: true },
    });
    try {
      const pairs = await fetchNoShowPairs({ restaurantId: other.id });
      assert.equal(pairs.length, 0, 'رستورانِ دیگر نباید هیچ‌کدام از جفت‌هایِ این رستوران را ببیند');
    } finally {
      await db.restaurant.deleteMany({ where: { id: other.id } });
      await db.tenant.deleteMany({ where: { id: otherTenant.id } });
    }
  });
});
