import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  تاریخِ «روزِ خلوت» در موتورِ تشویق — نگاشتِ گام → تاریخ
//
//  ⚠️ باگی که این فایل از آن زاده شد: `findLowDemandDay` تاریخ را خودش
//  می‌ساخت — `forecastHoltWinters(state.model, 7)` و برچسبِ `today + h + 1`.
//  ولی پیش‌بینی به `lastObservedDay` گره خورده، نه به «امروز». سری تا
//  **دیروز** ساخته می‌شود، پس اندیسِ ۰ در واقع «امروز» است و نه «فردا»
//  ⇒ هر تاریخِ پیشنهادی یک روز جلوتر گزارش می‌شد؛ و اگر cron یک شب را از
//  دست می‌داد، خطا به همان تعدادِ روز بزرگ‌تر می‌شد.
//
//  پیامدِ کاربری: تخفیفِ «روزِ خلوت» روی تاریخی پیشنهاد می‌شد که پیش‌بینیِ
//  خلوتی مالِ روزِ قبلش بود — یک وعده‌ی مالی روی تاریخِ اشتباه.
//
//  ⚠️ چرا هیچ تستی نگرفته بود: تنها مسیرِ عمومی (`getIncentivesForUser`)
//  تاریخ را داخلِ یک پیشنهادِ متنی پنهان می‌کند، پس هیچ ادعایی مستقیماً
//  روی نگاشت نبود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { findLowDemandDay } = await import('../src/lib/incentive-engine');
const { buildForecastSeries, tehranTodayIso, DEMAND_STATE_VERSION } =
  await import('../src/lib/demand-forecast');

const TAG = 'lowdemand';
let tenantId: string;
let restaurantId: string;

/** ISOِ روزِ تهران با جابه‌جاییِ n روز. */
const shiftIso = (iso: string, n: number) =>
  new Date(Date.parse(iso + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

/**
 * حالتی با یک گودالِ آشکار: تقاضا صافِ ۱۰۰ است جز یک روز که ۱۰ است.
 *
 * ⚠️ نگاشت را از خودِ `forecastHoltWinters` برداشتم، نه از حدس:
 *   `phase = (phaseOffset + h - 1) % period` و آرایه از h=1 پر می‌شود،
 *   پس برایِ اندیسِ آرایه‌ی `i` داریم `phase = (phaseOffset + i) % period`.
 * با `phaseOffset = 0` یعنی گودالِ اندیسِ `i` = `seasonal[i % 7]`.
 * (نسخه‌ی اولِ همین helper `i+1` نوشته بود و تستِ اول را **اتفاقی** سبز
 *  می‌کرد، چون خطایش با `skip` خنثی می‌شد — تستِ حالتِ کهنه لوش داد.)
 */
function stateWithDipAt(arrayIndex: number, lastObservedDay: string) {
  const seasonal = new Array(7).fill(0);
  seasonal[arrayIndex % 7] = -90;
  return {
    model: { level: 100, trend: 0, seasonal, period: 7, phaseOffset: 0 },
    mae: 5, baselineMae: 20, isActive: true, reason: 'ok',
    lastValues: [100, 100, 100, 100, 100, 100, 100],
    lastObservedDay,
    version: DEMAND_STATE_VERSION,
  };
}

before(async () => {
  const s = Date.now().toString(36);
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-${s}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: `zz-${TAG}-${s}`, name: `[DEMO] ${TAG}`, clubPrefix: 'LDM' },
    select: { id: true },
  });
  restaurantId = r.id;
});

after(async () => {
  await db.restaurantDemandForecast.deleteMany({ where: { restaurantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

async function putState(state: unknown) {
  await db.restaurantDemandForecast.upsert({
    where: { restaurantId },
    // historyDays/countModel هم الزامی‌اند؛ countModel برایِ این تست بی‌اثر
    // است ولی ستون NOT NULL است.
    create: { restaurantId, historyDays: 180, countModel: state as never, coversModel: state as never, trainedAt: new Date() },
    update: { coversModel: state as never, trainedAt: new Date() },
  });
}

describe('تاریخِ روزِ خلوت با نگاشتِ پیش‌بینی یکی است', () => {
  test('🔴 اولین گامِ پیش‌بینی «فردا»ست — با سریِ دو روز عقب', async () => {
    // ⚠️ چرا `-2` و نه `-1` (کشفِ حینِ جهش‌آزمایی، ثبت می‌شود چون خودش
    // توضیح می‌دهد چرا این باگ دیده نشده بود):
    //
    // نسخه‌ی باگ‌دار مبدأ را `new Date()`ِ **محلیِ سرور** می‌گرفت. سرورهای
    // ما UTCاند و «امروزِ تهران» بینِ ۲۰:۳۰ تا ۲۴:۰۰ UTC یک روز **جلوتر**
    // از امروزِ UTC است. در آن پنجره، خطای «+۱ روزِ» کد با خطای «−۱ روزِ»
    // منطقه‌ی زمانی **دقیقاً خنثی می‌شد** و تاریخ اتفاقاً درست درمی‌آمد.
    //
    // یعنی این باگ وابسته به ساعتِ شبانه‌روز بود: بخشی از روز غلط، بخشی
    // درست. تستی که با `lastObservedDay = دیروز` نوشته شود، در همان پنجره
    // روی کدِ باگ‌دار هم سبز می‌شود — یعنی هیچ‌چیزی قفل نمی‌کند. با فاصله‌ی
    // دو روز، جابه‌جاییِ یک‌روزه‌ی منطقه‌ی زمانی دیگر نمی‌تواند بپوشاندش.
    const today = tehranTodayIso();
    const state = stateWithDipAt(2, shiftIso(today, -2));   // skip=2 ⇒ points[0] = اندیسِ ۲
    await putState(state);

    const got = await findLowDemandDay(restaurantId);
    assert.ok(got, 'گودال باید پیدا شود');
    assert.equal(got.date, shiftIso(today, 1),
      'points[0] همیشه فرداست — مستقل از سنِ مدل');
  });

  test('🔴 مدلِ کهنه (cron دو شب را از دست داده) تاریخ را جابه‌جا نمی‌کند', async () => {
    // این حالت همان چیزی است که نسخه‌ی قبلی را از «یک روز خطا» به
    // «N روز خطا» می‌برد، چون مبدأ را `new Date()` می‌گرفت.
    const today = tehranTodayIso();
    // گودال در روزِ تقویمیِ فردا: با lastObservedDay = امروز−۳، فردا گامِ ۴ است.
    const state = stateWithDipAt(3, shiftIso(today, -3));   // skip=3 ⇒ points[0] = اندیسِ ۳
    await putState(state);

    const got = await findLowDemandDay(restaurantId);
    assert.ok(got, 'گودال باید پیدا شود');
    assert.equal(got.date, shiftIso(today, 1),
      'مبدأ باید lastObservedDay باشد، نه «امروز»');
  });

  test('✓ تاریخ دقیقاً با همان سری‌ای می‌خواند که داشبورد نشان می‌دهد', async () => {
    // کنترلِ مثبتِ واقعی: به‌جایِ تکرارِ فرمول، خروجی را با **منبعِ حقیقتِ
    // مشترک** مقایسه می‌کنیم. اگر کسی روزی یکی از دو مسیر را عوض کند، این
    // تست می‌افتد — همان چیزی که قبلاً وجود نداشت.
    const today = tehranTodayIso();
    // offset = ۴ به همان دلیلِ تستِ اول: جابه‌جاییِ یک‌روزه نتواند بپوشاند.
    const state = stateWithDipAt(5, shiftIso(today, -4));
    await putState(state);

    const series = buildForecastSeries(state as never, 7, today);
    const lowest = series.points.reduce((a, b) => (b.predicted < a.predicted ? b : a));

    const got = await findLowDemandDay(restaurantId);
    assert.ok(got);
    assert.equal(got.date, lowest.date, 'هر دو مسیر باید یک تاریخ بدهند');
  });

  test('✓ وقتی هیچ روزی به‌اندازه‌ی کافی خلوت نیست، null می‌دهد (نه تاریخِ ساختگی)', async () => {
    const today = tehranTodayIso();
    const flat = stateWithDipAt(1, shiftIso(today, -1));
    flat.model.seasonal = new Array(7).fill(0);   // بدونِ گودال
    await putState(flat);
    assert.equal(await findLowDemandDay(restaurantId), null);
  });
});
