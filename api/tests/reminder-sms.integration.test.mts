import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  یادآوریِ پیامکیِ رزرو — وعده‌ای که اپ می‌داد و کد نمی‌داد
//
//  ⚠️ شکافی که این فایل از آن زاده شد: اپِ مشتری در سه جا وعده می‌دهد
//  (apps/customer/js/user-profile.js:17,87,104) و قالبِ `rezervno-reminder`
//  هم در TEMPLATE_MAP بود، ولی `grep -rn "template: 'reminder'"` روی کلِ
//  api/src **صفر** نتیجه می‌داد و هیچ jobی در crontab نبود.
//
//  خطرِ اصلیِ این قابلیت **ارسالِ تکراری** است: پیامک پول دارد و آزار هم
//  دارد. برای همین تستِ همزمانی اینجا مرکزی است، نه فرعی.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
// ⚠️ پیشوندِ اختصاصیِ این فایل. تولیدِ دستیِ شماره ممنوع است — رجوع کن به
// tests/_phone.helper.mts: سه فایل قبلاً همین اشتباه را کردند و یک برخوردِ
// `users_phone_key` کلِ سوئیت را cancel کرد. (خودم هم همین‌جا در آن افتادم.)
const { fixturePhone } = await import('./_phone.helper.mts');
const { sendDueReminders, REMINDER_LEAD_MS } = await import('../src/lib/reminders');

const TAG = `rem-${randomUUID().slice(0, 8)}`;
let tenantId: string;
let restaurantId: string;
let codeSeq = 0;

/** رزروی که سانسش داخلِ پنجره‌ی یادآوری است و به‌اندازه‌ی کافی زود ثبت شده. */
async function makeReservation(opts: {
  minutesAhead?: number;
  createdMinutesAgo?: number;
  status?: string;
  phone?: string | null;
  userId?: string | null;
} = {}) {
  const minutesAhead = opts.minutesAhead ?? 60;                 // داخلِ پنجره‌ی ۳ ساعته
  const createdMinutesAgo = opts.createdMinutesAgo ?? 24 * 60;  // دیروز ثبت شده
  const slotStart = new Date(Date.now() + minutesAhead * 60_000);
  return db.reservation.create({
    data: {
      code: `${TAG.toUpperCase().replace(/-/g, '')}${++codeSeq}`,
      restaurantId,
      partySize: 2,
      slotStart,
      slotEnd: new Date(+slotStart + 90 * 60_000),
      status: (opts.status ?? 'confirmed') as never,
      guestPhone: opts.phone === undefined ? fixturePhone('0931') : opts.phone,
      guestName: '[DEMO] مهمانِ تستِ یادآوری',
      createdAt: new Date(Date.now() - createdMinutesAgo * 60_000),
      ...(opts.userId ? { userId: opts.userId } : {}),
    },
    select: { id: true, code: true, reminderSentAt: true },
  });
}

async function makeUserWithPrefs(prefs: unknown) {
  return db.user.create({
    data: { phone: fixturePhone('0931'), notificationPrefs: prefs as never },
    select: { id: true },
  });
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] تنانتِ یادآوری ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: TAG, name: `[DEMO] رستورانِ تستِ یادآوری`, clubPrefix: 'RM', timezone: 'Asia/Tehran' },
    select: { id: true },
  });
  restaurantId = r.id;
});

beforeEach(async () => { await db.reservation.deleteMany({ where: { restaurantId } }); });

/** ⚠️ شمارنده‌های sendDueReminders **سراسری**اند (همه‌ی رستوران‌های DB).
 *  دیتابیسِ تستِ مشترک رزروهای دیگری هم دارد، پس ادعا روی عددِ مطلق شکننده
 *  است. این کمکی وضعیتِ **همان رزرو** را می‌سنجد که تنها چیزِ قطعی است. */
async function wasReminded(id: string): Promise<boolean> {
  const r = await db.reservation.findUnique({ where: { id }, select: { reminderSentAt: true } });
  return r?.reminderSentAt != null;
}

after(async () => {
  await db.reservation.deleteMany({ where: { restaurantId } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
});

describe('یادآوریِ رزرو — تحققِ وعده', () => {

  test('⚠️ رزروِ نزدیک یادآوری می‌گیرد و علامت می‌خورد', async () => {
    const r = await makeReservation();
    await sendDueReminders();
    assert.equal(await wasReminded(r.id), true,
      'reminderSentAt باید پر شود — وگرنه اجرای بعدی دوباره می‌فرستد');
  });

  test('🔴 اگر مدعیِ دیگری زودتر برداشته باشد، این اجرا نمی‌فرستد', async () => {
    // ⚠️ این تست دو نسخه‌ی قبلی داشت که هر دو در جهش‌آزمایی **قرمز نشدند**:
    //   ۱. دو `sendDueReminders()` با Promise.all — درهم نمی‌روند (اندازه‌گیری
    //      شد: scanned شد ۳ و ۴، یعنی سریال).
    //   ۲. صدا زدنِ مستقیمِ updateMany در خودِ تست — سازوکارِ DB را می‌سنجید،
    //      نه استفاده‌ی reminders.ts از آن.
    // هر دو «سبزِ توخالی» بودند. نسخه‌ی سوم از قلابِ تزریقی استفاده می‌کند تا
    // دقیقاً لحظه‌ی حساس را شبیه‌سازی کند: مدعیِ دیگری بینِ findMany و update
    // ردیف را برمی‌دارد. اگر گاردِ `reminderSentAt: null` نباشد، این اجرا هم
    // می‌فرستد و تست می‌شکند.
    const r = await makeReservation();
    const out = await sendDueReminders(new Date(), async (id) => {
      if (id !== r.id) return;
      // شبیه‌سازیِ cronِ دوم که همین الان برش داشت
      await db.reservation.updateMany({
        where: { id, reminderSentAt: null },
        data: { reminderSentAt: new Date() },
      });
    });
    assert.equal(out.sent, 0,
      'ردیف را مدعیِ دیگری برداشته بود؛ این اجرا نباید پیامکِ دوم بفرستد');
  });

  test('🔴 اجرای دوباره‌ی کامل هیچ پیامکِ تکراری نمی‌فرستد', async () => {
    // لایه‌ی end-to-end روی همان گارد.
    const r = await makeReservation();
    await sendDueReminders();
    const stamp1 = (await db.reservation.findUniqueOrThrow({
      where: { id: r.id }, select: { reminderSentAt: true } })).reminderSentAt;
    const second = await sendDueReminders();
    const stamp2 = (await db.reservation.findUniqueOrThrow({
      where: { id: r.id }, select: { reminderSentAt: true } })).reminderSentAt;
    assert.ok(stamp1, 'اجرای اول باید بفرستد');
    assert.deepEqual(stamp2, stamp1, 'مهرِ زمانی نباید عوض شود');
    assert.equal(second.sent, 0, 'و اجرای دوم نباید چیزی بفرستد');
  });

  test('رزروی که تازه ثبت شده یادآوری نمی‌گیرد', async () => {
    // مهمان همین الان خودش رزرو کرده؛ «یادآوری» بی‌معنا و آزاردهنده است.
    const r = await makeReservation({ minutesAhead: 60, createdMinutesAgo: 5 });
    const before = (await sendDueReminders()).skipped_late_booking;
    assert.equal(await wasReminded(r.id), false, 'رزروِ دیرهنگام نباید یادآوری بگیرد');
    assert.ok(before >= 1, 'باید صریحاً به‌عنوانِ «رزروِ دیرهنگام» شمرده شود، نه بی‌صدا رد شود');
  });

  test('رزروِ دور از پنجره یادآوری نمی‌گیرد', async () => {
    const r = await makeReservation({ minutesAhead: Math.round(REMINDER_LEAD_MS / 60_000) + 120 });
    await sendDueReminders();
    assert.equal(await wasReminded(r.id), false, 'رزروِ خارج از پنجره نباید یادآوری بگیرد');
  });

  test('رزروِ گذشته یادآوری نمی‌گیرد', async () => {
    const r = await makeReservation({ minutesAhead: -30 });
    await sendDueReminders();
    assert.equal(await wasReminded(r.id), false, 'رزروِ گذشته نباید یادآوری بگیرد');
  });

  for (const status of ['pending', 'cancelled', 'no_show']) {
    test(`رزروِ ${status} یادآوری نمی‌گیرد`, async () => {
      // یادآوری برای رزروی که تأیید نشده یا لغو شده، یک دروغ است.
      const r = await makeReservation({ status });
      await sendDueReminders();
      assert.equal(await wasReminded(r.id), false, `وضعیتِ ${status} نباید یادآوری بگیرد`);
    });
  }

  test('🔴 انصرافِ صریح از دسته‌ی reminder احترام می‌شود', async () => {
    const u = await makeUserWithPrefs({ reminder: false });
    const r = await makeReservation({ userId: u.id });
    const out = await sendDueReminders();
    assert.equal(await wasReminded(r.id), false, 'انصرافِ صریح باید احترام شود');
    assert.ok(out.skipped_no_consent >= 1, 'باید صریحاً شمرده شود، نه سکوت');
    await db.user.delete({ where: { id: u.id } }).catch(() => {});
  });

  test('کنترلِ منفی: کاربرِ بدونِ prefs یادآوری می‌گیرد', async () => {
    // قاعده‌ی مستندِ notification-prefs.ts: فقط انصرافِ صریح مانع می‌شود.
    // بدونِ این تست، «همیشه رد کن» هم سبز می‌شد و قابلیت کاملاً می‌مرد.
    const u = await makeUserWithPrefs({});
    const r = await makeReservation({ userId: u.id });
    await sendDueReminders();
    assert.equal(await wasReminded(r.id), true, 'کلیدِ غایب یعنی «نظری نداده»، نه «انصراف داده»');
    await db.user.delete({ where: { id: u.id } }).catch(() => {});
  });

  test('کنترلِ منفی: کاربری که صریحاً reminder=true داده هم می‌گیرد', async () => {
    const u = await makeUserWithPrefs({ reminder: true, offers: false });
    const r = await makeReservation({ userId: u.id });
    await sendDueReminders();
    assert.equal(await wasReminded(r.id), true, 'انصراف از offers نباید یادآوریِ تراکنشی را قطع کند');
    await db.user.delete({ where: { id: u.id } }).catch(() => {});
  });

  test('رزروِ بدونِ شماره صریحاً شمرده می‌شود، بی‌صدا رد نمی‌شود', async () => {
    const r = await makeReservation({ phone: null });
    const out = await sendDueReminders();
    assert.equal(await wasReminded(r.id), false);
    assert.ok(out.skipped_no_phone >= 1, 'باید صریحاً شمرده شود، نه بی‌صدا رد شود');
  });
});
