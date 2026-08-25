import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixturePhone } from './_phone.helper.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  خلاصه‌ی ماهانه‌ی DNA — وعده‌ای که تا امروز پشتوانه نداشت
//
//  دسته‌ی `dna` از روزِ اول در تنظیماتِ اپِ مشتری بود و کاربر خاموش/روشنش
//  می‌کرد، ولی **صفر** نقطه‌ی صدور داشت. این فایل هم خودِ خلاصه را می‌سنجد
//  و هم اینکه انصراف واقعاً اثر دارد.
//
//  تمرکزِ تست‌ها روی چیزهایی است که اگر غلط باشند **قابلِ‌باور** به نظر
//  می‌رسند و کسی متوجه نمی‌شود: مرزِ ماهِ شمسی، «رستورانِ تازه»، و تفکیکِ
//  «صفر» از «نامعلوم».
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const {
  buildDnaMonthlySummary, lastCompletedJalaliMonth, previousMonthOf,
  startOfJalaliMonth, jalaliPartsTehran,
} = await import('../src/lib/dna-summary');
const { signAccess } = await import('../src/lib/jwt.ts');
const dnaRoute = await import('../src/app/api/v1/me/dna-summary/route.ts');

const TAG = `dna-${randomUUID().slice(0, 8)}`;
let tenantId: string;
let userId: string;
let token: string;
const restaurantIds: string[] = [];

/** «الان»ِ ثابت برای همه‌ی تست‌ها: ۳ شهریورِ ۱۴۰۵ ⇒ ماهِ کامل‌شده = مرداد ۱۴۰۵. */
const NOW = new Date('2026-08-25T12:00:00Z');

async function makeRestaurant(suffix: string, cuisine: string | null) {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${suffix}`, name: `[DEMO] رستورانِ ${suffix}`,
      clubPrefix: 'DN', timezone: 'Asia/Tehran', ...(cuisine ? { cuisine } : {}),
    },
    select: { id: true },
  });
  restaurantIds.push(r.id);
  return r.id;
}

let codeSeq = 0;
/** یک رزرو با وضعیت و زمانِ دلخواه. `slotStart` به وقتِ UTC داده می‌شود. */
async function visit(restaurantId: string, slotStart: Date, status = 'completed') {
  return db.reservation.create({
    data: {
      restaurantId, userId, code: `${TAG}-${++codeSeq}`.toUpperCase().slice(0, 20),
      partySize: 2, slotStart, slotEnd: new Date(slotStart.getTime() + 90 * 60_000),
      status: status as never,
    },
    select: { id: true },
  });
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] تنانتِ DNA ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const u = await db.user.create({
    // ⚠️ پیشوندِ ۰۹۲۱ مالِ همین فایل است — به tests/_phone.helper.mts رجوع کن.
    data: { phone: fixturePhone('0921'), firstName: '[DEMO] کاربرِ DNA' },
    select: { id: true },
  });
  userId = u.id;
  token = signAccess({ sub: userId, kind: 'customer' });
});

beforeEach(async () => {
  await db.pointsLedger.deleteMany({ where: { userId } });
  await db.reservation.deleteMany({ where: { userId } });
  await db.user.update({ where: { id: userId }, data: { notificationPrefs: {} } });
});

after(async () => {
  await db.pointsLedger.deleteMany({ where: { userId } });
  await db.reservation.deleteMany({ where: { userId } });
  await db.menuItem.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
  await db.user.delete({ where: { id: userId } });
  for (const id of restaurantIds) await db.restaurant.delete({ where: { id } });
  await db.tenant.delete({ where: { id: tenantId } });
});

// ───────────────────────────────────────────────────────────────────────
describe('مرزِ ماهِ شمسی — منطقِ خالص', () => {

  test('ماهِ کامل‌شده‌ی ۳ شهریور ۱۴۰۵ برابرِ مرداد ۱۴۰۵ است، نه شهریور', async () => {
    // ⚠️ چرا این تست: اگر «ماهِ جاری» گزارش شود، خلاصه‌ی ماهانه هر روز عوض
    // می‌شود و کاربر هر بار عددِ متفاوتی برای «ماهِ گذشته» می‌بیند.
    const m = lastCompletedJalaliMonth(NOW);
    assert.equal(m.jy, 1405);
    assert.equal(m.jm, 5, 'مرداد');
    assert.equal(m.key, '1405-05');
    // ارقامِ لاتین عمدی است: مرزِ API داده می‌دهد، نمایش کارِ کلاینت است و
    // اپِ مشتری `faNum()` را روی همین رشته اجرا می‌کند (auth.js:186).
    assert.equal(m.label, 'مرداد 1405');
  });

  test('🔴 آغازِ ماه واقعاً روزِ اولِ شمسی است و پایان، آغازِ ماهِ بعد', async () => {
    const m = lastCompletedJalaliMonth(NOW);
    assert.equal(jalaliPartsTehran(m.start).jd, 1, 'start باید روزِ ۱ باشد');
    assert.equal(jalaliPartsTehran(m.start).jm, 5);
    // یک میلی‌ثانیه قبل از end باید هنوز داخلِ همان ماه باشد
    const lastMs = new Date(m.end.getTime() - 1);
    assert.equal(jalaliPartsTehran(lastMs).jm, 5, 'لحظه‌ی قبل از end هنوز مرداد است');
    assert.equal(jalaliPartsTehran(m.end).jd, 1, 'end باید روزِ ۱ِ ماهِ بعد باشد');
    assert.equal(jalaliPartsTehran(m.end).jm, 6, 'شهریور');
  });

  test('🔴 طولِ ماه‌های شمسی ثابت فرض نشده (۳۱ و ۳۰ و اسفند)', async () => {
    // اگر با «۳۰ روز» یا آفستِ ثابت حساب شده بود، این‌ها می‌شکستند.
    const days = (r: { start: Date; end: Date }) =>
      Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000);
    const mordad = lastCompletedJalaliMonth(NOW);                    // مرداد = ۳۱
    const tir = previousMonthOf(mordad);                             // تیر   = ۳۱
    assert.equal(days(mordad), 31, 'مرداد ۳۱ روز است');
    assert.equal(days(tir), 31, 'تیر ۳۱ روز است');
    // آبان ۱۴۰۴ = ۳۰ روز
    const aban = startOfJalaliMonth(new Date('2025-11-10T12:00:00Z'));
    assert.equal(jalaliPartsTehran(aban).jm, 8);
    const azar = startOfJalaliMonth(new Date('2025-12-10T12:00:00Z'));
    assert.equal(Math.round((azar.getTime() - aban.getTime()) / 86_400_000), 30, 'آبان ۳۰ روز است');
  });

  test('⚠️ ساعتِ تابستانیِ حذف‌شده‌ی ایران هم درست حساب می‌شود', async () => {
    // ایران تا ۱۴۰۱ ساعتِ تابستانی داشت (+۴:۳۰). با آفستِ هاردکدِ +۳:۳۰،
    // مرزِ ماه یک ساعت جابه‌جا می‌شد و رزروِ نزدیکِ نیمه‌شب در ماهِ اشتباه
    // شمرده می‌شد.
    const m = startOfJalaliMonth(new Date('2021-09-21T12:00:00Z')); // شهریور ۱۴۰۰
    assert.equal(jalaliPartsTehran(m).jd, 1);
    assert.equal(jalaliPartsTehran(m).jm, 6);
    // نیمه‌شبِ تهران در آن تاریخ = ۱۹:۳۰ UTCِ روزِ قبل (آفستِ ۴:۳۰)
    assert.equal(m.toISOString(), '2021-08-22T19:30:00.000Z');
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('محتوایِ خلاصه — فقط از دادهٔ واقعی', () => {

  test('🔴 ماهِ بدونِ بازدید هیچ خلاصه‌ای نمی‌گیرد (نه یک خلاصه‌ی پر از صفر)', async () => {
    // مهم‌ترین قاعده‌ی ML_CONTRACT اینجا: «۰ بار بیرون رفتی!» به‌عنوانِ
    // خلاصه‌ی جشن‌گونه، عددش درست و پیامش دروغ است.
    const out = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(out.available, false);
    assert.equal(out.available === false && out.reason, 'no_visits_this_month');
  });

  test('شمارشِ بازدید و رستوران از رزروهای واقعیِ همان ماه', async () => {
    const a = await makeRestaurant('a', 'ایرانی');
    const b = await makeRestaurant('b', 'ایتالیایی');
    const m = lastCompletedJalaliMonth(NOW);
    const inMonth = (dayOffset: number) => new Date(m.start.getTime() + dayOffset * 86_400_000);
    await visit(a, inMonth(2));
    await visit(a, inMonth(9));
    await visit(b, inMonth(15));

    const out = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(out.available, true);
    if (!out.available) return;
    assert.equal(out.visits, 3);
    assert.equal(out.restaurantsVisited, 2);
    assert.equal(out.topRestaurant?.visits, 2);
    assert.equal(out.topCuisine, 'ایرانی', 'دو بازدید ایرانی در برابرِ یکی ایتالیایی');
  });

  test('🔴 رزروِ خارج از بازه‌ی ماه شمرده نمی‌شود (هیچ‌کدام از دو طرف)', async () => {
    // بدونِ این، «ماهانه» فقط یک برچسب روی آمارِ کل بود.
    const a = await makeRestaurant('edge', null);
    const m = lastCompletedJalaliMonth(NOW);
    await visit(a, new Date(m.start.getTime() - 1));      // یک میلی‌ثانیه قبل
    await visit(a, m.end);                                // دقیقاً آغازِ ماهِ بعد
    await visit(a, new Date(m.start.getTime() + 1000));   // داخل

    const out = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(out.available && out.visits, 1, 'فقط رزروِ داخلِ بازه');
  });

  test('🔴 «رستورانِ تازه» یعنی پیش از این ماه هرگز نرفته بود', async () => {
    // ⚠️ باگِ کلاسیکِ این محاسبه: اگر شرطِ «قبل از آغازِ ماه» نباشد،
    // بازدیدهای خودِ همین ماه هم «سابقه» حساب می‌شوند و عدد همیشه صفر
    // می‌ماند — عددی که کاملاً قابلِ‌باور است و کسی شکش نمی‌برد.
    const old = await makeRestaurant('old', null);
    const fresh = await makeRestaurant('fresh', null);
    const m = lastCompletedJalaliMonth(NOW);
    await visit(old, new Date(m.start.getTime() - 40 * 86_400_000));  // ماه‌ها قبل
    await visit(old, new Date(m.start.getTime() + 3 * 86_400_000));
    await visit(fresh, new Date(m.start.getTime() + 5 * 86_400_000));
    await visit(fresh, new Date(m.start.getTime() + 6 * 86_400_000)); // دو بار در همین ماه

    const out = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(out.available && out.restaurantsVisited, 2);
    assert.equal(out.available && out.newRestaurants, 1, 'فقط رستورانی که سابقه نداشت');
  });

  test('🔴 وضعیتِ no_show/cancelled بازدید نیست', async () => {
    const a = await makeRestaurant('status', null);
    const m = lastCompletedJalaliMonth(NOW);
    const at = (d: number) => new Date(m.start.getTime() + d * 86_400_000);
    await visit(a, at(1), 'completed');
    await visit(a, at(2), 'no_show');
    await visit(a, at(3), 'cancelled');
    await visit(a, at(4), 'confirmed');   // رزروِ تأییدشده‌ای که نرفت هم بازدید نیست

    const out = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(out.available && out.visits, 1);
  });

  test('⚠️ هزینه وقتی اندازه‌گیری‌ناپذیر است null می‌شود، نه صفر', async () => {
    // رزرونو فاکتور را نمی‌بیند؛ تنها منبع پیش‌سفارش از منوست. رستورانِ
    // بدونِ منویِ قیمت‌دار ⇒ «۰ تومان» یک آرتیفکت است نه اندازه‌گیری.
    const a = await makeRestaurant('nomenu', null);
    const m = lastCompletedJalaliMonth(NOW);
    await visit(a, new Date(m.start.getTime() + 86_400_000));

    const out = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(out.available && out.spendToman, null, 'نامعلوم، نه صفر');
  });

  test('⚠️ ولی با منویِ قیمت‌دار، «۰» یک واقعیتِ تأییدشده است', async () => {
    // کنترلِ مثبت برای تستِ بالا: بدونِ این، «همیشه null بده» هم سبز می‌شد.
    const a = await makeRestaurant('withmenu', null);
    await db.menuItem.create({
      data: { restaurantId: a, name: '[DEMO] چلوکباب', priceToman: 250_000, isActive: true },
    });
    const m = lastCompletedJalaliMonth(NOW);
    await visit(a, new Date(m.start.getTime() + 86_400_000));

    const out = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(out.available && out.spendToman, 0, 'منو هست ولی پیش‌سفارشی نبود ⇒ صفرِ واقعی');
  });

  test('🔴 مقایسه با ماهِ قبل: «کاربرِ تازه» با «صفر بازدید» یکی نیست', async () => {
    // اگر هر دو صفر برگردانده شود، به کاربرِ تازه گفته می‌شود «نسبت به ماهِ
    // قبل تغییری نکردی» — مقایسه‌ای با ماهی که اصلاً وجود نداشته.
    const a = await makeRestaurant('prev', null);
    const m = lastCompletedJalaliMonth(NOW);
    await visit(a, new Date(m.start.getTime() + 2 * 86_400_000));

    const asNew = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(asNew.available && asNew.previousVisits, null, 'هیچ ردی پیش از ماهِ قبل نبود');

    // حالا یک بازدید در ماهِ قبل اضافه کن
    const prev = previousMonthOf(m);
    await visit(a, new Date(prev.start.getTime() + 3 * 86_400_000));
    const withPrev = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(withPrev.available && withPrev.previousVisits, 1);
  });

  test('امتیازِ ماه فقط کسب‌شده‌هاست، نه خرج‌شده‌ها', async () => {
    const a = await makeRestaurant('points', null);
    const m = lastCompletedJalaliMonth(NOW);
    await visit(a, new Date(m.start.getTime() + 86_400_000));
    await db.pointsLedger.createMany({
      data: [
        { userId, delta: 100, reason: 'reservation', createdAt: new Date(m.start.getTime() + 86_400_000) },
        { userId, delta: -70, reason: 'redemption', createdAt: new Date(m.start.getTime() + 2 * 86_400_000) },
        { userId, delta: 500, reason: 'reservation', createdAt: new Date(m.end.getTime() + 86_400_000) }, // ماهِ بعد
      ] as never,
    });

    const out = await buildDnaMonthlySummary(userId, NOW);
    assert.equal(out.available && out.pointsEarned, 100, 'خرج و ماهِ دیگر نباید بیایند');
  });
});

// ───────────────────────────────────────────────────────────────────────
describe('endpoint و اعمالِ واقعیِ رضایت', () => {

  const call = () => dnaRoute.GET(
    new Request('http://x/api/v1/me/dna-summary', { headers: { authorization: `Bearer ${token}` } }),
    // ctxِ Next — این route پارامترِ مسیر ندارد
    { params: Promise.resolve({}) } as never,
  );

  async function seedOneVisit() {
    const a = await makeRestaurant(`consent-${randomUUID().slice(0, 6)}`, null);
    const m = lastCompletedJalaliMonth(NOW);
    await visit(a, new Date(m.start.getTime() + 86_400_000));
  }

  test('کاربرِ بدونِ انصراف، خلاصه‌اش را می‌گیرد', async () => {
    await seedOneVisit();
    const res = await call();
    assert.equal(res.status, 200);
    const body = await res.json();
    // ⚠️ اینجا از NOWِ ثابت استفاده نمی‌شود چون route زمانِ واقعی را می‌خواند.
    // پس فقط شکلِ پاسخ و مسیرِ رضایت سنجیده می‌شود، نه عددِ ماه — عددها در
    // بلاکِ بالا با زمانِ تزریق‌شده دقیق سنجیده شده‌اند.
    assert.equal(typeof body.available, 'boolean');
    assert.notEqual(body.reason, 'opted_out');
    assert.ok(body.period_key, 'کلیدِ ماه همیشه برمی‌گردد');
  });

  test('🔴 انصرافِ صریح از دسته‌ی dna واقعاً جلوی خلاصه را می‌گیرد', async () => {
    // ⚠️ این تستِ مرکزیِ کلِ فیچر است: کلیدِ `dna` از روزِ اول در تنظیماتِ
    // اپ بود و کاربر خاموشش می‌کرد، ولی هیچ مصرف‌کننده‌ای نداشت — یعنی
    // خاموش‌کردنش هیچ اثری نداشت. بدونِ این تست، همان وضع می‌توانست
    // برگردد و کاملاً بی‌صدا باشد.
    await seedOneVisit();
    await db.user.update({ where: { id: userId }, data: { notificationPrefs: { dna: false } } });

    const res = await call();
    assert.equal(res.status, 200, 'انصراف خطا نیست، یک تنظیمِ عادیِ کاربر است');
    const body = await res.json();
    assert.equal(body.available, false);
    assert.equal(body.reason, 'opted_out');
    assert.equal(body.visits, undefined, 'هیچ دادهٔ خلاصه‌ای نباید نشت کند');
  });

  test('⚠️ انصراف از دسته‌ی **دیگر** به dna سرایت نمی‌کند', async () => {
    // کنترلِ منفی: بدونِ این، «هر کلیدِ false ⇒ همه را ببند» هم سبز می‌شد.
    await seedOneVisit();
    await db.user.update({ where: { id: userId }, data: { notificationPrefs: { offers: false } } });
    const body = await (await call()).json();
    assert.notEqual(body.reason, 'opted_out');
  });

  test('کلیدِ غایب یعنی «نظری نداده»، نه انصراف', async () => {
    // قاعده‌ی مستندِ notification-prefs.ts: فقط `false`ِ صریح مانع می‌شود.
    await seedOneVisit();
    await db.user.update({ where: { id: userId }, data: { notificationPrefs: {} } });
    const body = await (await call()).json();
    assert.notEqual(body.reason, 'opted_out');
  });

  test('بدونِ توکنِ مشتری بسته است', async () => {
    const res = await dnaRoute.GET(
      new Request('http://x/api/v1/me/dna-summary'),
      { params: Promise.resolve({}) } as never,
    );
    assert.equal(res.status >= 400, true, `باید رد شود، شد: ${res.status}`);
  });
});
