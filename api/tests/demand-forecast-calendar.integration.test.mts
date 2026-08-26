import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { invalidate, cacheKey } from '../src/lib/cache.ts';
import {
  fetchDailySeries, getDemandForecast, trainAndCalibrateDemandForecast,
  fitHoltWinters, forecastHoltWinters, seasonalNaiveForecast, tehranTodayIso,
  DEMAND_STATE_VERSION, type SeriesModelState,
} from '../src/lib/demand-forecast.ts';
import { meanAbsoluteError } from '../src/lib/ml-core.ts';

// ═══════════════════════════════════════════════════════════════════════
//  تقویمِ پیش‌بینیِ تقاضا — «روزِ کدام منطقه؟» و «کدام روز پیش‌بینی شد؟»
//
//  این فایل چهار نقصِ تأییدشده‌ی ۲۰۲۶-۰۸-۲۵ را قفل می‌کند. هر چهار از یک
//  خانواده‌اند: **عددی به یک روزِ تقویمی نسبت داده می‌شد که مالِ آن نبود.**
//
//   ۱) سطل‌بندیِ روز با `slot_start::date` روی سرورِ UTC ⇒ هر اسلاتِ ۰۰:۰۰
//      تا ۰۳:۲۹ به وقتِ تهران در روزِ *قبل* شمرده می‌شد. (تهران UTC+3:30)
//   ۲) مدلِ سرو روی ۸۰٪ اولِ سری fit می‌شد ولی خروجی‌اش «۱۴ روزِ آینده»
//      برچسب می‌خورد ⇒ ۳۷ روز خطای تاریخ، و چون ۳۷ mod ۷ = ۲، الگویِ
//      هفتگی هم دو روز جابه‌جا. مسیرِ naive هم دقیقاً یک روز جلو بود.
//   ۳) baselineِ سنجش از **داخلِ هولدآوت** مقدارِ واقعی می‌خواند ⇒ دو افقِ
//      نابرابر مقایسه می‌شدند و حکمِ «مدل بهتر نشد» بی‌اعتبار بود.
//   ۴) هیچ گاردی روی سنِ مدل نبود ⇒ cronِ ازکارافتاده بی‌صدا عددِ کهنه را
//      به‌عنوانِ پیش‌بینیِ فردا نشان می‌داد.
//
//  ⚠️ همه‌ی تست‌ها روی کوئری/تابعِ **واقعی** اجرا می‌شوند (نه بازنویسیِ
//  منطق در تست) — همان دلیلی که fetchDailySeries عمداً export شده است.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `dfc-${randomUUID().slice(0, 8)}`;
let tenantId: string;
/** رستورانِ سناریوی «مرزِ نیمه‌شبِ تهران». */
let rTz: string;
/** رستورانِ سناریوی «سریِ کاملِ ۱۸۰ روزه». */
let rSeries: string;
/** رستورانِ سناریوی «حالتِ دست‌ساز در DB». */
let rState: string;

const DAY_MS = 86_400_000;
const isoPlus = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

async function makeRestaurant(suffix: string, prefix: string): Promise<string> {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${suffix}`, name: `[DEMO] رستورانِ ${suffix}`,
      timezone: 'Asia/Tehran', clubPrefix: prefix, isOpen: true,
    },
    select: { id: true },
  });
  return r.id;
}

/** یک رزروِ «تقاضای واقعی» در لحظه‌ی دقیقِ UTCِ داده‌شده. */
async function reservationAtUtc(restaurantId: string, utcIso: string, partySize = 2): Promise<void> {
  const slot = new Date(utcIso);
  await db.$executeRaw`
    INSERT INTO reservations
      (id, code, restaurant_id, party_size, slot_start, slot_end, status, source, created_at)
    VALUES
      (${randomUUID()}::uuid, ${'RZ' + randomUUID().slice(0, 7).toUpperCase()},
       ${restaurantId}::uuid, ${partySize},
       ${slot}, ${new Date(slot.getTime() + 90 * 60_000)},
       CAST('completed'::text AS "public"."reservation_status"), 'app', ${slot})
  `;
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  rTz = await makeRestaurant('tz', 'DA');
  rSeries = await makeRestaurant('series', 'DB');
  rState = await makeRestaurant('state', 'DC');

  // ── سناریوی ۱: دو رزرو در **یک روزِ تهران** ولی دو روزِ متفاوتِ UTC ──
  // مرجع: روزِ تهرانِ D = دیروز (چون سری امروز را کنار می‌گذارد).
  // ۰۰:۳۰ تهرانِ D  =  ۲۱:۰۰ UTCِ D-1   ← اینجاست که UTC روز را غلط می‌بُرد
  // ۱۹:۰۰ تهرانِ D  =  ۱۵:۳۰ UTCِ D
  const yesterdayTehran = isoPlus(tehranTodayIso(), -1);
  await reservationAtUtc(rTz, `${isoPlus(yesterdayTehran, -1)}T21:00:00.000Z`, 4); // ۰۰:۳۰ بامدادِ D
  await reservationAtUtc(rTz, `${yesterdayTehran}T15:30:00.000Z`, 3);              // ۱۹:۰۰ عصرِ D

  // ── سناریوی ۲: سریِ کاملِ ۱۸۰ روزه با الگویِ هفتگی + جهشِ سطح در ۲۰٪ آخر ──
  // جهشِ سطح عمدی است: baselineِ نشتی (که از داخلِ هولدآوت می‌خواند) بعد از
  // ۷ روز جهش را می‌گیرد، ولی baselineِ صادقانه (منجمد در پایانِ آموزش)
  // نمی‌گیرد. پس دو فرمول عددِ آشکارا متفاوت می‌دهند و تست می‌تواند ثابت کند
  // کدام‌یک واقعاً اجرا شده است.
  await db.$executeRaw`
    INSERT INTO reservations
      (id, code, restaurant_id, party_size, slot_start, slot_end, status, source, created_at)
    SELECT gen_random_uuid(),
           -- کد باید سراسری یکتا باشد؛ از خودِ uuid ساخته می‌شود نه شمارنده.
           'RZ' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
           ${rSeries}::uuid,
           2,
           ts, ts + interval '90 minutes',
           'completed'::reservation_status, 'app', ts
    FROM (
      SELECT d.day, gs.i,
             -- ۱۲:۰۰ ظهرِ تهران — وسطِ روز، تا هیچ ابهامِ مرزی نسازد
             ((d.day::timestamp AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'UTC') + interval '12 hours' AS ts
      FROM (
        SELECT s::date AS day
        FROM generate_series(
               (now() AT TIME ZONE 'Asia/Tehran')::date - 180,
               (now() AT TIME ZONE 'Asia/Tehran')::date - 1,
               interval '1 day') AS s
      ) d
      CROSS JOIN LATERAL generate_series(
        1,
        -- الگویِ پایه: پنجشنبه/جمعه شلوغ‌تر · + جهشِ سطح در ۳۶ روزِ آخر
        (CASE WHEN EXTRACT(DOW FROM d.day) IN (4, 5) THEN 6 ELSE 2 END)
        + (CASE WHEN d.day > (now() AT TIME ZONE 'Asia/Tehran')::date - 36 THEN 9 ELSE 0 END)
      ) AS gs(i)
    ) g
  `;
});

after(async () => {
  const ids = [rTz, rSeries, rState];
  await db.$executeRaw`DELETE FROM restaurant_demand_forecasts WHERE restaurant_id = ANY(${ids}::uuid[])`.catch(() => 0);
  await db.$executeRaw`DELETE FROM model_training_runs WHERE restaurant_id = ANY(${ids}::uuid[])`.catch(() => 0);
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ANY(${ids}::uuid[])`.catch(() => 0);
  await db.restaurant.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  for (const id of ids) await invalidate(cacheKey('demand-forecast', id)).catch(() => {});
});

// ───────────────────────────────────────────────────────────────────────
describe('«روز» یعنی روزِ تهران، نه روزِ UTC', () => {
  test('اسلاتِ ۰۰:۳۰ بامدادِ تهران در سطلِ همان روز می‌افتد، نه روزِ قبل', async () => {
    const { days, counts, covers } = await fetchDailySeries(rTz);
    const yesterday = isoPlus(tehranTodayIso(), -1);
    const i = days.indexOf(yesterday);
    assert.ok(i >= 0, `روزِ ${yesterday} باید در سری باشد (طول=${days.length})`);

    // ⚠️ کنترلِ مثبت: با `slot_start::date` (روزِ UTC) این عدد ۱ می‌شد و
    // ردیفِ دیگر به روزِ قبل می‌رفت. یعنی اگر رفع برگردد، همین‌جا قرمز می‌شود.
    assert.equal(counts[i], 2, 'هر دو رزرو باید در روزِ تهرانِ یکسان شمرده شوند');
    assert.equal(covers[i], 7, 'مجموعِ نفرات هم باید در همان یک روز جمع شود');
    assert.equal(counts[i - 1], 0, 'روزِ قبل باید خالی بماند — چیزی به آن نشت نکرده باشد');
  });

  test('سری بدونِ شکاف است و دقیقاً به «دیروزِ تهران» ختم می‌شود', async () => {
    const { days, counts } = await fetchDailySeries(rTz);
    assert.equal(days.length, counts.length);
    assert.equal(days[days.length - 1], isoPlus(tehranTodayIso(), -1), 'آخرین نقطه = دیروزِ تهران');
    for (let i = 1; i < days.length; i++) {
      assert.equal(days[i], isoPlus(days[i - 1], 1), `شکاف در تقویم بینِ ${days[i - 1]} و ${days[i]}`);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('آموزش: مبدأِ مدلِ سرو و baselineِ منصفانه', () => {
  let state: SeriesModelState;
  let series: { days: string[]; counts: number[] };

  before(async () => {
    const r = await trainAndCalibrateDemandForecast(rSeries);
    assert.equal(r.trained, true, `آموزش باید انجام شود، شد: ${r.reason}`);
    const row = await db.restaurantDemandForecast.findUnique({ where: { restaurantId: rSeries } });
    assert.ok(row, 'ردیفِ پیش‌بینی باید ذخیره شده باشد');
    state = row!.countModel as unknown as SeriesModelState;
    const s = await fetchDailySeries(rSeries);
    series = { days: s.days, counts: s.counts };
  });

  test('مدلِ ذخیره‌شده روی **کلِ** سری fit شده، نه روی ۸۰٪ اول', () => {
    const full = fitHoltWinters(series.counts, 7);
    const splitAt = Math.floor(series.counts.length * 0.8);
    const trainOnly = fitHoltWinters(series.counts.slice(0, splitAt), 7);

    assert.ok(Math.abs(state.model.level - full.level) < 1e-9,
      `level باید مالِ کلِ سری باشد (${state.model.level} در برابرِ ${full.level})`);
    assert.equal(state.model.phaseOffset, full.phaseOffset);
    // کنترلِ مثبت: اگر مدل روی ۸۰٪ fit شده بود، این دو برابر می‌شدند.
    assert.ok(Math.abs(full.level - trainOnly.level) > 1e-6,
      'سناریو باید طوری باشد که مدلِ کامل و مدلِ ۸۰٪ واقعاً فرق کنند');
  });

  test('lastObservedDay دقیقاً آخرین روزِ سری است (نگاشتِ تاریخ دیگر ضمنی نیست)', () => {
    assert.equal(state.lastObservedDay, series.days[series.days.length - 1]);
    assert.equal(state.version, DEMAND_STATE_VERSION);
  });

  test('baseline از داخلِ هولدآوت مقدارِ واقعی نمی‌خواند (افقِ برابر)', () => {
    const n = series.counts.length;
    const splitAt = Math.floor(n * 0.8);
    const holdout = series.counts.slice(splitAt);

    const honest = meanAbsoluteError(
      seasonalNaiveForecast(series.counts.slice(splitAt - 7, splitAt), holdout.length),
      holdout,
    );
    // فرمولِ نشتیِ قبلی — برای i>=7 مقدارِ واقعیِ داخلِ هولدآوت را می‌خواند.
    const leaky = meanAbsoluteError(
      holdout.map((_, i) => series.counts[splitAt + i - 7]),
      holdout,
    );

    assert.ok(Math.abs(honest - leaky) > 0.5,
      `سناریو باید دو فرمول را جدا کند (صادقانه=${honest.toFixed(2)}، نشتی=${leaky.toFixed(2)})`);
    assert.ok(Math.abs(state.baselineMae - honest) < 1e-9,
      `baselineMae باید برابرِ فرمولِ صادقانه باشد (ذخیره‌شده=${state.baselineMae}، صادقانه=${honest}، نشتی=${leaky})`);
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('خواندن: تاریخِ نقطه‌ها، کهنگی، و گاردِ نسخه', () => {
  /** یک حالتِ دست‌ساز با اعدادِ کاملاً معلوم می‌نویسد تا نگاشتِ اندیس→تاریخ
   *  بدونِ هیچ نویزِ آماری قابلِ اثبات باشد. */
  async function writeState(opts: {
    isActive: boolean; lastObservedDay: string; trainedAt: Date; version?: number;
  }) {
    const state: SeriesModelState = {
      // level=100، trend=0، فصلیِ کاملاً مشخص: هر فاز عددِ خودش
      model: { level: 100, trend: 0, seasonal: [0, 1, 2, 3, 4, 5, 6], period: 7, phaseOffset: 0 },
      mae: 1, baselineMae: 2, isActive: opts.isActive, reason: 'تست',
      lastValues: [10, 11, 12, 13, 14, 15, 16],
      lastObservedDay: opts.lastObservedDay,
      version: opts.version ?? DEMAND_STATE_VERSION,
    };
    const json = JSON.stringify(state);
    await db.$executeRaw`
      INSERT INTO restaurant_demand_forecasts (restaurant_id, history_days, count_model, covers_model, trained_at)
      VALUES (${rState}::uuid, 180, ${json}::jsonb, ${json}::jsonb, ${opts.trainedAt})
      ON CONFLICT (restaurant_id) DO UPDATE
        SET count_model = EXCLUDED.count_model, covers_model = EXCLUDED.covers_model,
            trained_at = EXCLUDED.trained_at
    `;
    await invalidate(cacheKey('demand-forecast', rState));
  }

  test('مدلِ یادگرفته: نقطه‌ی اول **فردا**ست و مقدارش گامِ h=2 است، نه h=1', async () => {
    const today = tehranTodayIso();
    await writeState({ isActive: true, lastObservedDay: isoPlus(today, -1), trainedAt: new Date() });

    const f = await getDemandForecast(rState, 3);
    assert.ok(f, 'پیش‌بینی باید برگردد');
    assert.equal(f!.reservations.source, 'learned');
    assert.equal(f!.reservations.points.length, 3);
    assert.equal(f!.reservations.points[0].date, isoPlus(today, 1), 'نقطه‌ی اول باید فردا باشد');
    assert.equal(f!.reservations.points[2].date, isoPlus(today, 3));

    // مبدأ = دیروز، پس فردا گامِ h=2 است. با باگِ قبلی مقدارِ h=1 نمایش
    // داده می‌شد (یعنی *امروز* به‌نامِ فردا) — این assert دقیقاً همان را می‌گیرد.
    const raw = forecastHoltWinters(
      { level: 100, trend: 0, seasonal: [0, 1, 2, 3, 4, 5, 6], period: 7, phaseOffset: 0 }, 4,
    );
    assert.equal(f!.reservations.points[0].predicted, Math.round(raw[1] * 10) / 10);
    assert.notEqual(raw[0], raw[1]); // کنترلِ مثبت: دو گام واقعاً فرق دارند
  });

  test('مسیرِ naive هم یک روز جلو نمی‌افتد (هم‌روزِ هفته‌ی فردا)', async () => {
    const today = tehranTodayIso();
    await writeState({ isActive: false, lastObservedDay: isoPlus(today, -1), trainedAt: new Date() });

    const f = await getDemandForecast(rState, 3);
    assert.equal(f!.reservations.source, 'naive');
    assert.equal(f!.reservations.points[0].date, isoPlus(today, 1));
    // lastValues[i] ↔ روزِ (lastObservedDay − 6 + i). فردا = lastObservedDay+1
    // که هم‌روزِ هفته‌ی lastValues[1] است، نه lastValues[0].
    assert.equal(f!.reservations.points[0].predicted, 11, 'باید lastValues[1] باشد، نه lastValues[0]=۱۰');
    assert.equal(f!.reservations.points[1].predicted, 12);
  });

  test('مدلِ عقب‌مانده: تاریخ‌ها همچنان درست‌اند چون مبدأ ذخیره شده', async () => {
    const today = tehranTodayIso();
    // cron سه شب اجرا نشده ⇒ آخرین روزِ مشاهده‌شده ۴ روز پیش است.
    await writeState({
      isActive: true, lastObservedDay: isoPlus(today, -4),
      trainedAt: new Date(Date.now() - 3 * DAY_MS),
    });
    const f = await getDemandForecast(rState, 2);
    assert.ok(f);
    assert.equal(f!.reservations.points[0].date, isoPlus(today, 1), 'باز هم باید از فردا شروع شود');
    assert.equal(f!.stale, true, 'کهنگی باید صریحاً گزارش شود، نه پنهان');
    // فردا = lastObservedDay + 5 ⇒ گامِ h=5
    const raw = forecastHoltWinters(
      { level: 100, trend: 0, seasonal: [0, 1, 2, 3, 4, 5, 6], period: 7, phaseOffset: 0 }, 6,
    );
    assert.equal(f!.reservations.points[0].predicted, Math.round(raw[4] * 10) / 10);
  });

  test('مدلِ تازه هرگز stale علامت نمی‌خورد', async () => {
    const today = tehranTodayIso();
    await writeState({
      isActive: true, lastObservedDay: isoPlus(today, -1),
      trainedAt: new Date(Date.now() - 20 * 3600_000),
    });
    const f = await getDemandForecast(rState, 1);
    assert.equal(f!.stale, false);
    assert.ok(f!.age_hours >= 19 && f!.age_hours <= 21, `age_hours=${f!.age_hours}`);
  });

  test('مدلِ خیلی کهنه اصلاً سرو نمی‌شود (null، نه عددِ بی‌پشتوانه)', async () => {
    const today = tehranTodayIso();
    await writeState({
      isActive: true, lastObservedDay: isoPlus(today, -9),
      trainedAt: new Date(Date.now() - 8 * DAY_MS),
    });
    assert.equal(await getDemandForecast(rState, 3), null);
  });

  test('حالتِ ذخیره‌شده‌ی نسخه‌ی قدیمی سرو نمی‌شود (تاریخ جعل نمی‌کند)', async () => {
    const today = tehranTodayIso();
    await writeState({
      isActive: true, lastObservedDay: isoPlus(today, -1), trainedAt: new Date(), version: 1,
    });
    assert.equal(await getDemandForecast(rState, 3), null);
  });

  test('ردیفِ خراب (lastValues خالی) عدد نمی‌دهد — NaN به UI نمی‌رسد', async () => {
    // بدونِ گاردِ شکل، مسیرِ naive روی آرایه‌ی خالی `[h % 0]` می‌زند و
    // `predicted: NaN` تولید می‌کند که در JSON به `null` تبدیل می‌شود و در
    // پنل به‌شکلِ یک عددِ خالی/صفر دیده می‌شود — یعنی شکستِ خاموش.
    const today = tehranTodayIso();
    const broken = {
      model: { level: 100, trend: 0, seasonal: [0, 1, 2, 3, 4, 5, 6], period: 7, phaseOffset: 0 },
      mae: 1, baselineMae: 2, isActive: false, reason: 'تست',
      lastValues: [] as number[],
      lastObservedDay: isoPlus(today, -1),
      version: DEMAND_STATE_VERSION,
    };
    const json = JSON.stringify(broken);
    await db.$executeRaw`
      INSERT INTO restaurant_demand_forecasts (restaurant_id, history_days, count_model, covers_model, trained_at)
      VALUES (${rState}::uuid, 180, ${json}::jsonb, ${json}::jsonb, ${new Date()})
      ON CONFLICT (restaurant_id) DO UPDATE
        SET count_model = EXCLUDED.count_model, covers_model = EXCLUDED.covers_model,
            trained_at = EXCLUDED.trained_at
    `;
    await invalidate(cacheKey('demand-forecast', rState));
    assert.equal(await getDemandForecast(rState, 3), null);
  });
});
