import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
// ⚠️ importِ پویا عمدی است، نه سلیقه: با `--experimental-test-coverage` زیرِ
// tsx، ماژولی که فقط با importِ *ایستا* کشیده شود اصلاً در گزارشِ پوشش ظاهر
// نمی‌شود (اندازه‌گیریِ A/B، ۲۰۲۶-۰۸-۲۵ — شرح در KNOWN_LIMITATIONS §۷).
const { runAutomation, runAllDueAutomations } = await import('../src/lib/automation.ts');

// ═══════════════════════════════════════════════════════════════════════
//  Marketing Automation — قفلِ رگرسیونِ باگِ «کمپینی که هرگز نمی‌فرستد»
//
//  ⚠️ چرا این فایل نوشته شد: `lib/automation.ts` **صفر درصد** پوشش داشت
//  (هیچ تستی حتی import‌ش نمی‌کرد) در حالی که مستقیماً به مشتریِ واقعی
//  پیامک می‌فرستد و از موجودیِ پیامکِ رستوران کم می‌کند.
//
//  باگِ واقعی که همین بی‌پوششی پنهانش کرده بود (پیدا شده با اجرای زنده‌ی
//  runAutomation روی Postgresِ واقعی، نه از رویِ خواندنِ کد):
//
//   ۱) `post_visit` پنجره‌ی ثابتِ «۱ ساعت» داشت
//      (slotEnd ∈ [now-(h+1)h, now-h)) و
//   ۲) `no_show_followup` فیلترِ `reservations.created_at >= now-6h`.
//
//  هر دو فرض می‌کردند cron هر چند دقیقه اجرا می‌شود — همان چیزی که کامنتِ
//  خودِ runAllDueAutomations ادعا می‌کرد. واقعیتِ api/vercel.json و
//  cron/crontab: تنها فراخوانِ آن (`/v1/maintenance/customer-insights`)
//  **روزی یک‌بار** ساعتِ ۰۳:۰۰ اجرا می‌شود. نتیجه:
//   • post_visit فقط مهمانانی را می‌دید که پایانِ حضورشان دقیقاً در یک
//     پنجره‌ی یک‌ساعته افتاده بود → ~۲۳ ساعت از هر شبانه‌روز کور بود.
//   • no_show_followup روی زمانِ *ثبتِ رزرو* فیلتر می‌کرد نه زمانِ ثبتِ
//     عدم‌حضور؛ رزرو معمولاً روزها زودتر ثبت می‌شود، پس عملاً هیچ‌وقت
//     کسی را نمی‌گرفت.
//
//  اندازه‌گیریِ زنده‌ی پیش از رفع (اسکریپتِ probe روی همین سناریوها):
//      post_visit → sent = 0   ·   no_show_followup → sent = 0
//  پس از رفع: هر دو sent = 1. رستوران‌دار کمپین را «فعال» می‌دید و
//  هیچ پیامی نمی‌رفت — یعنی قابلیتی که شیپ شده بود ولی کار نمی‌کرد.
//
//  هر ادعایِ مثبت اینجا با یک کنترلِ منفی جفت شده (و برعکس) تا تست
//  به‌طورِ توخالی سبز نشود.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `au-${randomUUID().slice(0, 8)}`;
const H = 3600_000;
const DAY = 24 * H;

let tenantId: string;
/** رستورانِ اصلیِ سناریوها. */
let rid: string;
/** رستورانِ دوم — کنترلِ ایزولاسیونِ تنانت. */
let otherRid: string;

let codeSeq = 0;
let userSeq = 0;
// پیشوندِ تصادفیِ هر اجرا: اگر اجرای قبلی نیمه‌کاره مانده باشد، شماره‌ها با
// ردیف‌های جامانده تداخل نکنند (قیدِ unique روی users.phone).
const PHONE_PREFIX = String(Math.floor(Math.random() * 9000) + 1000);
const createdUserIds: string[] = [];

async function makeRestaurant(suffix: string): Promise<string> {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${suffix}`, name: `[DEMO] رستورانِ تستِ automation ${suffix}`,
      timezone: 'Asia/Tehran', clubPrefix: 'AU', isOpen: true,
    },
    select: { id: true },
  });
  return r.id;
}

async function makeUser(): Promise<string> {
  // شماره‌ی ساختگیِ یکتا (پیش‌شماره‌ی ۰۹۰۰ در ایران تخصیص داده نشده) — فقط
  // برای رد شدن از قیدِ unique، هیچ شماره‌ی واقعی‌ای اینجا نیست.
  const u = await db.user.create({
    data: {
      phone: `09${PHONE_PREFIX}${String(++userSeq).padStart(5, '0')}`,
      firstName: '[DEMO] مهمان',
    },
    select: { id: true },
  });
  createdUserIds.push(u.id);
  return u.id;
}

/** مهمانی که حضورش در زمانِ مشخصی تمام شده (رزروِ completed). */
async function makeCompletedVisit(params: {
  restaurantId: string; userId: string; endedAt: Date;
}): Promise<string> {
  const r = await db.reservation.create({
    data: {
      code: `${TAG.toUpperCase()}C${++codeSeq}`,
      restaurantId: params.restaurantId, userId: params.userId, partySize: 2,
      slotStart: new Date(params.endedAt.getTime() - 90 * 60_000),
      slotEnd: params.endedAt,
      status: 'completed',
    },
    select: { id: true },
  });
  return r.id;
}

/**
 * رزروی که در `bookedAt` ثبت شده و در `markedAt` عدم‌حضور خورده.
 *
 * ⚠️ فاصله‌ی عمدیِ این دو زمان قلبِ این تست است: باگِ رفع‌شده دقیقاً از
 * یکی‌گرفتنِ همین دو می‌آمد. `created_at` هر دو جدول با UPDATE خام ست
 * می‌شود چون `@default(now())` دارند و Prisma اجازه‌ی نوشتنِ مستقیم نمی‌دهد.
 */
async function makeNoShow(params: {
  restaurantId: string; userId: string; bookedAt: Date; markedAt: Date;
}): Promise<string> {
  const slot = new Date(params.markedAt.getTime() - H);
  const r = await db.reservation.create({
    data: {
      code: `${TAG.toUpperCase()}N${++codeSeq}`,
      restaurantId: params.restaurantId, userId: params.userId, partySize: 2,
      slotStart: slot, slotEnd: new Date(slot.getTime() + 90 * 60_000),
      status: 'no_show',
    },
    select: { id: true },
  });
  await db.$executeRaw`UPDATE reservations SET created_at = ${params.bookedAt} WHERE id = ${r.id}::uuid`;
  const ev = await db.reservationEvent.create({
    data: { reservationId: r.id, fromStatus: 'confirmed', toStatus: 'no_show', actor: 'system', isAutomatic: true },
    select: { id: true },
  });
  await db.$executeRaw`UPDATE reservation_events SET created_at = ${params.markedAt} WHERE id = ${ev.id}::uuid`;
  return r.id;
}

async function makeAutomation(params: {
  restaurantId: string; trigger: 'post_visit' | 'no_show_followup' | 'winback' | 'birthday' | 'vip_milestone';
  triggerConfig?: Record<string, unknown>; lastRunAt?: Date | null; isActive?: boolean;
}) {
  const a = await db.marketingAutomation.create({
    data: {
      restaurantId: params.restaurantId,
      name: `[DEMO] کمپینِ ${params.trigger}`,
      trigger: params.trigger,
      triggerConfig: (params.triggerConfig ?? {}) as object,
      messageTemplate: 'سلام {نام}',
      lastRunAt: params.lastRunAt ?? null,
      isActive: params.isActive ?? true,
    },
  });
  return a;
}

/** گیرنده‌هایی که این automation در دفترِ ارتباط‌گیری ثبت کرده. */
async function outreachUserIds(automationId: string): Promise<string[]> {
  const rows = await db.outreachLog.findMany({
    where: { source: 'automation', sourceId: automationId },
    select: { userId: true },
    orderBy: { sentAt: 'asc' },
  });
  return rows.map(r => r.userId).filter((u): u is string => u !== null);
}

before(async () => {
  const t = await db.tenant.create({
    data: { name: `[DEMO] تنانتِ automation ${TAG}` },
    select: { id: true },
  });
  tenantId = t.id;
  rid = await makeRestaurant('main');
  otherRid = await makeRestaurant('other');
});

beforeEach(async () => {
  // هر سناریو باید رویِ حالتِ تمیز قضاوت شود — وگرنه رزروِ سناریوی قبلی
  // در پنجره‌ی سناریوی بعدی می‌افتد و ادعاها به هم می‌ریزند.
  const rests = await db.restaurant.findMany({ where: { tenantId }, select: { id: true } });
  const ids = rests.map(r => r.id);
  await db.outreachLog.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.marketingAutomation.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.reservation.deleteMany({ where: { restaurantId: { in: ids } } });
});

after(async () => {
  // ⚠️ ترتیبِ حذف اجباری است (FK): دفتر → automation → رزرو → رستوران → تنانت.
  // دامنه از خودِ DB خوانده می‌شود نه از متغیرهای محلی.
  const rests = await db.restaurant.findMany({ where: { tenantId }, select: { id: true } });
  const ids = rests.map(r => r.id);
  await db.outreachLog.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.marketingAutomation.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.reservation.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  if (createdUserIds.length) await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('automation · post_visit — پنجره باید به آهنگِ cron وابسته نباشد', () => {
  test('مهمانی که ۶ ساعت پیش رفته با cronِ روزانه هم پیگیری می‌شود (باگِ اصلی)', async () => {
    // این دقیقاً سناریویی است که پیش از رفع sent=0 می‌داد: پایانِ حضور
    // ۶ ساعت پیش، ولی پنجره‌ی ثابتِ قدیمی فقط [۳ساعت، ۲ساعت) پیش را می‌دید.
    const userId = await makeUser();
    await makeCompletedVisit({ restaurantId: rid, userId, endedAt: new Date(Date.now() - 6 * H) });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'post_visit', triggerConfig: { hoursAfter: 2 },
      lastRunAt: new Date(Date.now() - DAY), // اجرای قبلی: دیروز همین ساعت
    });

    const result = await runAutomation(automation);

    assert.equal(result.sent, 1, 'مهمانِ دیشب باید پیگیری شود — با پنجره‌ی ثابتِ قدیمی صفر می‌شد');
    assert.deepEqual(await outreachUserIds(automation.id), [userId], 'گیرنده باید همان مهمان باشد');
  });

  test('مهمانی که تازه رفته (کمتر از hoursAfter) هنوز پیگیری نمی‌شود', async () => {
    // کنترلِ منفی: اگر پنجره را صرفاً «هر چیزی در ۲۵ ساعتِ اخیر» می‌کردیم،
    // این هم می‌افتاد داخلش و مهمان وسطِ شام پیامکِ «ممنون که آمدید» می‌گرفت.
    const tooFresh = await makeUser();
    await makeCompletedVisit({ restaurantId: rid, userId: tooFresh, endedAt: new Date(Date.now() - 30 * 60_000) });
    const eligible = await makeUser();
    await makeCompletedVisit({ restaurantId: rid, userId: eligible, endedAt: new Date(Date.now() - 5 * H) });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'post_visit', triggerConfig: { hoursAfter: 2 },
      lastRunAt: new Date(Date.now() - DAY),
    });

    const result = await runAutomation(automation);

    assert.equal(result.sent, 1, 'فقط مهمانِ واجدِ شرط باید پیام بگیرد');
    assert.deepEqual(await outreachUserIds(automation.id), [eligible],
      'کنترلِ مثبت/منفی: مهمانِ نیم‌ساعتِ پیش نه، مهمانِ ۵ ساعتِ پیش آری');
  });

  test('همان مهمان در اجرای بعدی دوباره پیام نمی‌گیرد', async () => {
    // پنجره از lastRunAt مشتق می‌شود، پس هر رزرو دقیقاً در یک اجرا واجد است.
    // بدونِ این خاصیت، هر اجرای cron همان مهمان را دوباره پیامک می‌کرد —
    // هم هزینه‌ی پیامک، هم آزارِ مشتری.
    const userId = await makeUser();
    await makeCompletedVisit({ restaurantId: rid, userId, endedAt: new Date(Date.now() - 6 * H) });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'post_visit', triggerConfig: { hoursAfter: 2 },
      lastRunAt: new Date(Date.now() - DAY),
    });

    const first = await runAutomation(automation);
    assert.equal(first.sent, 1, 'اجرای اول باید بفرستد');

    // اجرای دوم با lastRunAtِ به‌روزشده — همان چیزی که runAllDueAutomations می‌خواند.
    const refreshed = await db.marketingAutomation.findUniqueOrThrow({ where: { id: automation.id } });
    assert.ok(refreshed.lastRunAt, 'lastRunAt باید پس از ارسال ثبت شده باشد');
    const second = await runAutomation(refreshed);

    assert.equal(second.sent, 0, 'اجرای دوم نباید همان مهمان را دوباره بگیرد');
    assert.deepEqual(await outreachUserIds(automation.id), [userId], 'دفتر هم باید فقط یک ردیف داشته باشد');
  });

  test('اولین اجرا (lastRunAt=null) کلِ تاریخچه را پیامباران نمی‌کند', async () => {
    // جهتِ خطای امن: فعال‌کردنِ یک کمپینِ تازه نباید به مهمانِ هفته‌ی پیش
    // پیام بدهد. سقفِ عقب‌گرد (۲۵ ساعت) دقیقاً برای همین است.
    const old = await makeUser();
    await makeCompletedVisit({ restaurantId: rid, userId: old, endedAt: new Date(Date.now() - 5 * DAY) });
    const recent = await makeUser();
    await makeCompletedVisit({ restaurantId: rid, userId: recent, endedAt: new Date(Date.now() - 4 * H) });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'post_visit', triggerConfig: { hoursAfter: 2 }, lastRunAt: null,
    });

    const result = await runAutomation(automation);

    assert.equal(result.sent, 1, 'فقط مهمانِ داخلِ سقفِ عقب‌گرد باید پیام بگیرد');
    assert.deepEqual(await outreachUserIds(automation.id), [recent],
      'مهمانِ ۵ روزِ پیش نباید با فعال‌شدنِ کمپین پیامِ «ممنون که آمدید» بگیرد');
  });

  test('کمپینِ رستورانِ A هرگز مهمانِ رستورانِ B را نمی‌گیرد', async () => {
    // ایزولاسیونِ تنانت غیرقابلِ‌مذاکره است — حتی در کمپینِ بازاریابی.
    const mine = await makeUser();
    await makeCompletedVisit({ restaurantId: rid, userId: mine, endedAt: new Date(Date.now() - 5 * H) });
    const theirs = await makeUser();
    await makeCompletedVisit({ restaurantId: otherRid, userId: theirs, endedAt: new Date(Date.now() - 5 * H) });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'post_visit', triggerConfig: { hoursAfter: 2 },
      lastRunAt: new Date(Date.now() - DAY),
    });

    const result = await runAutomation(automation);

    assert.equal(result.sent, 1, 'فقط مهمانِ همین رستوران');
    assert.deepEqual(await outreachUserIds(automation.id), [mine], 'مهمانِ رستورانِ دیگر نباید هدف شود');
  });
});

describe('automation · no_show_followup — مبنا زمانِ ثبتِ عدم‌حضور است، نه زمانِ رزرو', () => {
  test('رزروِ ۳ روز پیش که دیشب no_show خورد پیگیری می‌شود (باگِ اصلی)', async () => {
    // پیش از رفع، فیلترِ `created_at >= now-6h` این را نمی‌دید: رزرو ۳ روز
    // پیش ثبت شده بود. یعنی این trigger عملاً هیچ‌وقت شلیک نمی‌کرد، چون
    // مردم رزرو را ساعت‌ها/روزها زودتر می‌گیرند.
    const userId = await makeUser();
    await makeNoShow({
      restaurantId: rid, userId,
      bookedAt: new Date(Date.now() - 3 * DAY),
      markedAt: new Date(Date.now() - 4 * H),
    });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'no_show_followup', lastRunAt: new Date(Date.now() - DAY),
    });

    const result = await runAutomation(automation);

    assert.equal(result.sent, 1, 'عدم‌حضورِ دیشب باید پیگیری شود، مستقل از اینکه کِی رزرو شده');
    assert.deepEqual(await outreachUserIds(automation.id), [userId], 'گیرنده باید همان مهمان باشد');
  });

  test('عدم‌حضوری که در اجرای قبلی پیگیری شده دوباره پیام نمی‌گیرد', async () => {
    const alreadyHandled = await makeUser();
    await makeNoShow({
      restaurantId: rid, userId: alreadyHandled,
      bookedAt: new Date(Date.now() - 4 * DAY),
      markedAt: new Date(Date.now() - 30 * H), // پیش از پنجره‌ی این اجرا
    });
    const fresh = await makeUser();
    await makeNoShow({
      restaurantId: rid, userId: fresh,
      bookedAt: new Date(Date.now() - 4 * DAY),
      markedAt: new Date(Date.now() - 3 * H),
    });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'no_show_followup', lastRunAt: new Date(Date.now() - DAY),
    });

    const result = await runAutomation(automation);

    assert.equal(result.sent, 1, 'فقط عدم‌حضورِ تازه');
    assert.deepEqual(await outreachUserIds(automation.id), [fresh],
      'کنترلِ مثبت/منفی: قدیمی نه، تازه آری — بدونِ این جفت، تست می‌توانست توخالی سبز شود');
  });

  test('رزروی که هنوز no_show نخورده هدف نمی‌شود', async () => {
    // کنترلِ منفی رویِ خودِ وضعیت: فقط رویدادِ عدم‌حضور کافی نیست، وضعیتِ
    // فعلی هم باید no_show باشد (رزروی که کارکنان بعداً به completed برگردانده‌اند
    // نباید پیامِ «چرا نیامدید» بگیرد).
    const userId = await makeUser();
    const resId = await makeNoShow({
      restaurantId: rid, userId,
      bookedAt: new Date(Date.now() - 2 * DAY),
      markedAt: new Date(Date.now() - 3 * H),
    });
    await db.reservation.update({ where: { id: resId }, data: { status: 'completed' } });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'no_show_followup', lastRunAt: new Date(Date.now() - DAY),
    });

    const result = await runAutomation(automation);

    assert.equal(result.sent, 0, 'رزروی که دیگر no_show نیست نباید پیگیریِ عدم‌حضور بگیرد');
  });
});

describe('automation · runAllDueAutomations', () => {
  test('کمپینِ غیرفعال اجرا نمی‌شود', async () => {
    const userId = await makeUser();
    await makeCompletedVisit({ restaurantId: rid, userId, endedAt: new Date(Date.now() - 5 * H) });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'post_visit', triggerConfig: { hoursAfter: 2 },
      lastRunAt: new Date(Date.now() - DAY), isActive: false,
    });

    await runAllDueAutomations();

    assert.deepEqual(await outreachUserIds(automation.id), [], 'کمپینِ خاموش نباید چیزی بفرستد');
  });

  test('کمپینِ روزانه‌ای که همین حالا اجرا شده دوباره اجرا نمی‌شود', async () => {
    // winback جزوِ dailyOnly است: با lastRunAtِ یک‌ساعت پیش باید رد شود.
    // بدونِ این گارد، هر tickِ cron یک پیامکِ دیگر به همان مشتری می‌رفت.
    const userId = await makeUser();
    await db.customerInsight.create({
      data: { restaurantId: rid, userId, segment: 'at_risk', totalVisits: 2, churnRiskScore: 70 },
    });
    const automation = await makeAutomation({
      restaurantId: rid, trigger: 'winback', lastRunAt: new Date(Date.now() - H),
    });

    await runAllDueAutomations();
    assert.deepEqual(await outreachUserIds(automation.id), [], 'کمپینِ روزانه‌ی تازه‌اجراشده باید رد شود');

    // کنترلِ مثبت: با lastRunAtِ دیروز همان کمپین واقعاً می‌فرستد — یعنی
    // تستِ بالا به‌خاطرِ خرابیِ کلیِ winback سبز نشده.
    await db.marketingAutomation.update({
      where: { id: automation.id }, data: { lastRunAt: new Date(Date.now() - 2 * DAY) },
    });
    await runAllDueAutomations();
    assert.deepEqual(await outreachUserIds(automation.id), [userId], 'کنترلِ مثبت: پس از ۲۴ ساعت باید بفرستد');

    await db.customerInsight.deleteMany({ where: { restaurantId: rid } });
  });
});
