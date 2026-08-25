import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import {
  recordOutreach, resolveOutreachConversions, getOutreachStatsBySource,
  ATTRIBUTION_WINDOW_DAYS, MIN_RESOLVED_FOR_RATE,
} from '../src/lib/outreach-ledger.ts';
import { runAutomation } from '../src/lib/automation.ts';

// ═══════════════════════════════════════════════════════════════════════
//  دفترِ ارتباط‌گیری — قفلِ رگرسیونِ باگِ «۰٪ تبدیلِ جعلی»
//
//  باگِ اصلی (ممیزیِ ۲۰۲۶-۰۸-۲۰): marketing_automations.converted_count در کلِ
//  ریپو هیچ‌جا افزایش نمی‌یافت، ولی پنلِ بیزنس نرخِ تبدیل را از رویش نشان
//  می‌داد → همیشه «۰٪ تبدیل». معیارِ عملکردی که هیچ کدی نمی‌توانست پرش کند.
//
//  مهم‌ترین ادعایِ این فایل (تستِ «صفر نیست، null است») مستقیماً همان باگ را
//  قفل می‌کند: زیرِ کفِ نمونه باید null برگردد، نه صفر. اگر روزی کسی
//  `?? 0` بگذارد، آن تست قرمز می‌شود.
//
//  هر ادعایِ منفی با کنترلِ مثبت جفت شده تا تست به‌طورِ توخالی سبز نشود.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `ol-${randomUUID().slice(0, 8)}`;
const DAY = 86_400_000;

let tenantId: string;
/** رستورانِ اصلیِ سناریوها. */
let rid: string;
/** رستورانِ دوم — کنترلِ ایزولاسیونِ تنانت. */
let otherRid: string;
let codeSeq = 0;
let userSeq = 0;
// پیشوندِ تصادفیِ هر اجرا: اگر اجرای قبلی نیمه‌کاره مانده باشد، شماره‌ها
// با ردیف‌های جامانده تداخل نکنند (قیدِ unique روی users.phone).
const PHONE_PREFIX = String(Math.floor(Math.random() * 9000) + 1000);
const createdUserIds: string[] = [];

async function makeRestaurant(suffix: string): Promise<string> {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${suffix}`, name: `[DEMO] رستورانِ تستِ دفتر ${suffix}`,
      timezone: 'Asia/Tehran', clubPrefix: 'OL', isOpen: true,
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

/**
 * رزروی با زمانِ ساختِ *کنترل‌شده*.
 *
 * ⚠️ createdAt با UPDATE خام ست می‌شود و نه در create: ستون `@default(now())`
 * دارد و Prisma اجازه‌ی نوشتنِ مستقیمش را نمی‌دهد. کلِ منطقِ انتساب روی همین
 * ستون سوار است، پس کنترلش اجباری است — بدونِ آن تست فقط «الان» را می‌آزماید.
 */
async function makeReservation(params: {
  restaurantId: string; userId: string | null; createdAt: Date;
}): Promise<string> {
  const slot = new Date(params.createdAt.getTime() + 2 * DAY);
  const r = await db.reservation.create({
    data: {
      code: `${TAG.toUpperCase()}${++codeSeq}`,
      restaurantId: params.restaurantId,
      userId: params.userId,
      partySize: 2,
      slotStart: slot,
      slotEnd: new Date(slot.getTime() + 90 * 60_000),
      status: 'confirmed',
    },
    select: { id: true },
  });
  await db.$executeRaw`UPDATE reservations SET created_at = ${params.createdAt} WHERE id = ${r.id}::uuid`;
  return r.id;
}

/** یک ردیفِ ارتباط‌گیری با sent_at کنترل‌شده (همان دلیلِ بالا). */
async function makeOutreach(params: {
  restaurantId: string; userId: string | null; sentAt: Date;
  source?: 'automation' | 'campaign' | 'crm_recommendation'; sourceId?: string | null;
}): Promise<string> {
  await recordOutreach([{
    restaurantId: params.restaurantId, userId: params.userId,
    channel: 'sms', source: params.source ?? 'automation',
    sourceId: params.sourceId ?? null, reason: 'تست',
  }]);
  const row = await db.outreachLog.findFirst({
    where: { restaurantId: params.restaurantId, userId: params.userId, resolvedAt: null },
    orderBy: { sentAt: 'desc' }, select: { id: true },
  });
  assert.ok(row, 'ردیفِ ارتباط‌گیری ساخته نشد');
  await db.$executeRaw`UPDATE outreach_log SET sent_at = ${params.sentAt} WHERE id = ${row.id}::uuid`;
  return row.id;
}

before(async () => {
  const t = await db.tenant.create({
    data: { name: `[DEMO] تنانتِ دفترِ ارتباط‌گیری ${TAG}` },
    select: { id: true },
  });
  tenantId = t.id;
  rid = await makeRestaurant('main');
  otherRid = await makeRestaurant('other');
});

after(async () => {
  // ⚠️ ترتیبِ حذف اجباری است: outreach_log به reservations و users اشاره دارد.
  // و دامنه از خودِ DB خوانده می‌شود نه از متغیرهای محلی — چند تست رستورانِ
  // اضافه می‌سازند و لیستِ دستی جا می‌انداختشان (ردیفِ یتیم در DBِ تست).
  const rests = await db.restaurant.findMany({ where: { tenantId }, select: { id: true } });
  const ids = rests.map(r => r.id);
  await db.outreachLog.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.reservation.deleteMany({ where: { restaurantId: { in: ids } } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  if (createdUserIds.length) await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe('دفترِ ارتباط‌گیری — انتسابِ تبدیل', () => {
  test('رزروِ *پس از* تماس و داخلِ پنجره → تبدیل ثبت می‌شود', async () => {
    const userId = await makeUser();
    const sentAt = new Date(Date.now() - 3 * DAY);
    const oid = await makeOutreach({ restaurantId: rid, userId, sentAt });
    const resId = await makeReservation({
      restaurantId: rid, userId, createdAt: new Date(sentAt.getTime() + 1 * DAY),
    });

    await resolveOutreachConversions();

    const row = await db.outreachLog.findUniqueOrThrow({ where: { id: oid } });
    assert.equal(row.convertedReservationId, resId, 'رزروِ بعد از تماس باید نسبت داده شود');
    assert.ok(row.resolvedAt, 'ردیفِ تبدیل‌شده باید حل‌شده علامت بخورد');
  });

  test('رزروی که *پیش از* تماس ساخته شده هرگز نسبت داده نمی‌شود (نقطه‌به‌زمان)', async () => {
    const userId = await makeUser();
    const sentAt = new Date(Date.now() - 3 * DAY);
    // رزرو یک روز *قبل* از تماس — تماس نمی‌تواند علتش باشد.
    await makeReservation({
      restaurantId: rid, userId, createdAt: new Date(sentAt.getTime() - 1 * DAY),
    });
    const oid = await makeOutreach({ restaurantId: rid, userId, sentAt });

    await resolveOutreachConversions();

    const row = await db.outreachLog.findUniqueOrThrow({ where: { id: oid } });
    assert.equal(row.convertedReservationId, null,
      'رزروِ پیش از تماس نباید به آن نسبت داده شود — وگرنه نرخ ساختگی می‌شود');

    // کنترلِ مثبت: همین کاربر با یک رزروِ *بعد از* تماس باید تبدیل بخورد.
    const later = await makeReservation({
      restaurantId: rid, userId, createdAt: new Date(sentAt.getTime() + 1 * DAY),
    });
    await resolveOutreachConversions();
    const after2 = await db.outreachLog.findUniqueOrThrow({ where: { id: oid } });
    assert.equal(after2.convertedReservationId, later,
      'کنترلِ مثبت: بدونِ این، تستِ بالا می‌توانست به‌دلیلِ خرابیِ کلیِ انتساب سبز شود');
  });

  test('رزروِ خارج از پنجره تبدیل نیست و ردیف منقضی می‌شود', async () => {
    const userId = await makeUser();
    const sentAt = new Date(Date.now() - (ATTRIBUTION_WINDOW_DAYS + 10) * DAY);
    const oid = await makeOutreach({ restaurantId: rid, userId, sentAt });
    await makeReservation({
      restaurantId: rid, userId,
      createdAt: new Date(sentAt.getTime() + (ATTRIBUTION_WINDOW_DAYS + 2) * DAY),
    });

    await resolveOutreachConversions();

    const row = await db.outreachLog.findUniqueOrThrow({ where: { id: oid } });
    assert.equal(row.convertedReservationId, null, 'رزروِ خارج از پنجره نباید نسبت داده شود');
    assert.ok(row.resolvedAt, 'ردیفِ منقضی باید حل‌شده علامت بخورد تا وارد مخرجِ نرخ شود');
  });

  test('سه تماس + یک رزرو = فقط یک تبدیل، و آن آخرین تماسِ پیش از رزرو است', async () => {
    // ⚠️ همان اشتباهی که این تست جلویش را می‌گیرد: اگر هر سه تماس ادعای تبدیل
    // کنند، نرخ سه‌برابر باد می‌کند. قیدِ UNIQUE روی converted_reservation_id
    // این را در سطحِ DB غیرممکن می‌کند.
    const userId = await makeUser();
    const base = Date.now() - 5 * DAY;
    const o1 = await makeOutreach({ restaurantId: rid, userId, sentAt: new Date(base) });
    const o2 = await makeOutreach({ restaurantId: rid, userId, sentAt: new Date(base + 1 * DAY) });
    const o3 = await makeOutreach({ restaurantId: rid, userId, sentAt: new Date(base + 2 * DAY) });
    const resId = await makeReservation({
      restaurantId: rid, userId, createdAt: new Date(base + 3 * DAY),
    });

    await resolveOutreachConversions();

    const rows = await db.outreachLog.findMany({ where: { id: { in: [o1, o2, o3] } } });
    const converted = rows.filter(r => r.convertedReservationId !== null);
    assert.equal(converted.length, 1, 'یک رزرو فقط یک تماس را تبدیل می‌کند');
    assert.equal(converted[0].id, o3, 'انتساب به «آخرین تماسِ پیش از رزرو» است');
    assert.equal(converted[0].convertedReservationId, resId);
  });

  test('یک تماس دو رزرو را ادعا نمی‌کند', async () => {
    const userId = await makeUser();
    const sentAt = new Date(Date.now() - 5 * DAY);
    const oid = await makeOutreach({ restaurantId: rid, userId, sentAt });
    const first = await makeReservation({
      restaurantId: rid, userId, createdAt: new Date(sentAt.getTime() + 1 * DAY),
    });
    await makeReservation({
      restaurantId: rid, userId, createdAt: new Date(sentAt.getTime() + 2 * DAY),
    });

    await resolveOutreachConversions();

    const claims = await db.outreachLog.count({ where: { id: oid, convertedReservationId: { not: null } } });
    assert.equal(claims, 1);
    const row = await db.outreachLog.findUniqueOrThrow({ where: { id: oid } });
    assert.equal(row.convertedReservationId, first, 'زودترین رزروِ واجدِ شرایط انتخاب می‌شود');
  });

  test('رزروِ رستورانِ دیگر هرگز به تماسِ این رستوران نسبت داده نمی‌شود', async () => {
    // ایزولاسیونِ تنانت غیرقابلِ‌مذاکره است — حتی در آمار.
    const userId = await makeUser();
    const sentAt = new Date(Date.now() - 3 * DAY);
    const oid = await makeOutreach({ restaurantId: rid, userId, sentAt });
    await makeReservation({
      restaurantId: otherRid, userId, createdAt: new Date(sentAt.getTime() + 1 * DAY),
    });

    await resolveOutreachConversions();

    const row = await db.outreachLog.findUniqueOrThrow({ where: { id: oid } });
    assert.equal(row.convertedReservationId, null,
      'رزرو در رستورانِ B نباید تبدیلِ کمپینِ رستورانِ A شمرده شود');
  });
});

describe('دفترِ ارتباط‌گیری — اتصالِ واقعیِ مسیرِ ارسال', () => {
  test('runAutomation واقعاً گیرنده‌ها را در دفتر ثبت می‌کند', async () => {
    // ⚠️ چرا این تست لازم است و تایپ‌چک کافی نیست: کلِ این فیچر روی این فرض
    // سوار است که نقطه‌ی نوشتن *واقعاً شلیک می‌شود*. تایپ‌چک فقط می‌گوید
    // امضاها جور است — نه اینکه خطِ recordOutreach اجرا می‌شود. اگر روزی کسی
    // آن را جابه‌جا یا حذف کند، فقط همین تست می‌فهمد.
    const wireRid = await makeRestaurant('wire');
    const userId = await makeUser();
    await db.customerInsight.create({
      data: {
        restaurantId: wireRid, userId, segment: 'at_risk',
        totalVisits: 2, churnRiskScore: 70,
      },
    });
    const automation = await db.marketingAutomation.create({
      data: {
        restaurantId: wireRid, name: '[DEMO] بازگرداندنِ مشتریِ غایب',
        trigger: 'winback', messageTemplate: 'سلام {نام}',
      },
    });

    const result = await runAutomation({
      id: automation.id, restaurantId: wireRid, trigger: 'winback',
      triggerConfig: {}, messageTemplate: automation.messageTemplate, couponId: null,
    });

    assert.equal(result.sent, 1, 'پیش‌شرط: automation باید دقیقاً یک گیرنده پیدا کند');
    const rows = await db.outreachLog.findMany({ where: { restaurantId: wireRid } });
    assert.equal(rows.length, 1, 'گیرنده باید در دفتر ثبت شده باشد — نه فقط در sentCount');
    assert.equal(rows[0].userId, userId);
    assert.equal(rows[0].source, 'automation');
    assert.equal(rows[0].sourceId, automation.id, 'ردیف باید به همان automation بسته باشد');
    assert.equal(rows[0].channel, 'sms');

    await db.outreachLog.deleteMany({ where: { restaurantId: wireRid } });
    await db.customerInsight.deleteMany({ where: { restaurantId: wireRid } });
    await db.marketingAutomation.deleteMany({ where: { restaurantId: wireRid } });
  });
});

describe('دفترِ ارتباط‌گیری — گزارشِ صادقانه‌ی نرخ', () => {
  test('زیرِ کفِ نمونه: ratePct برابرِ null است، نه صفر ← قفلِ باگِ اصلی', async () => {
    // ⚠️ این دقیقاً همان باگی است که کلِ این فیچر برای رفعش نوشته شد. اگر
    // کسی روزی `?? 0` بگذارد یا کف را بردارد، اینجا قرمز می‌شود.
    const statRid = await makeRestaurant('scarce');
    const sourceId = randomUUID();
    const sentAt = new Date(Date.now() - (ATTRIBUTION_WINDOW_DAYS + 5) * DAY);
    for (let i = 0; i < 3; i++) {
      await makeOutreach({
        restaurantId: statRid, userId: await makeUser(`g${i}`), sentAt, sourceId,
      });
    }
    await resolveOutreachConversions();

    const stats = await getOutreachStatsBySource({
      restaurantId: statRid, source: 'automation', sourceIds: [sourceId],
    });
    const s = stats.get(sourceId);
    assert.ok(s, 'آمار باید برگردد');
    assert.equal(s.resolvedCount, 3, 'هر سه باید حل‌شده باشند (پنجره تمام شده)');
    assert.ok(s.resolvedCount < MIN_RESOLVED_FOR_RATE, 'پیش‌شرطِ تست: زیرِ کف');
    assert.equal(s.ratePct, null, 'زیرِ کف باید null باشد — «نمی‌دانیم»، نه «صفر»');
    assert.equal(s.status, 'insufficient_data');
    assert.notEqual(s.ratePct, 0, 'صفر یعنی «اندازه گرفتیم و هیچ‌کس تبدیل نشد» — ادعایی که نداریم');

    await db.outreachLog.deleteMany({ where: { restaurantId: statRid } });
  });

  test('کنترلِ مثبت: بالای کف، نرخِ واقعی محاسبه می‌شود', async () => {
    const statRid = await makeRestaurant('enough');
    const sourceId = randomUUID();
    const sentAt = new Date(Date.now() - 5 * DAY);
    const total = MIN_RESOLVED_FOR_RATE;
    const shouldConvert = 5;

    for (let i = 0; i < total; i++) {
      const userId = await makeUser(`h${i}`);
      await makeOutreach({ restaurantId: statRid, userId, sentAt, sourceId });
      if (i < shouldConvert) {
        await makeReservation({
          restaurantId: statRid, userId, createdAt: new Date(sentAt.getTime() + 1 * DAY),
        });
      }
    }
    await resolveOutreachConversions();
    // ردیف‌های تبدیل‌نشده هنوز داخلِ پنجره‌اند؛ برای بستنِ مخرج، عقب می‌بریمشان.
    await db.$executeRaw`
      UPDATE outreach_log
         SET sent_at = now() - (${ATTRIBUTION_WINDOW_DAYS + 5}::text || ' days')::interval
       WHERE restaurant_id = ${statRid}::uuid AND resolved_at IS NULL`;
    await resolveOutreachConversions();

    const s = (await getOutreachStatsBySource({
      restaurantId: statRid, source: 'automation', sourceIds: [sourceId],
    })).get(sourceId);
    assert.ok(s);
    assert.equal(s.resolvedCount, total);
    assert.equal(s.convertedCount, shouldConvert);
    assert.equal(s.status, 'measured');
    assert.equal(s.ratePct, Math.round((shouldConvert / total) * 100),
      'بالای کف باید عددِ واقعی بدهد — بدونِ این، تستِ بالا با «همیشه null» هم سبز می‌شد');

    await db.outreachLog.deleteMany({ where: { restaurantId: statRid } });
  });

  test('گیرنده‌ی بدونِ حسابِ کاربری «قابلِ‌انتساب نیست»، نه «تبدیل‌نشده»', async () => {
    // شماره‌ی خام در کمپینِ دستی به هیچ کاربری وصل نیست؛ اگر در مخرج بیاید،
    // نرخ را مصنوعی پایین می‌آورد — همان جعل، فقط در جهتِ عکس.
    const statRid = await makeRestaurant('anon');
    const sentAt = new Date(Date.now() - (ATTRIBUTION_WINDOW_DAYS + 5) * DAY);
    for (let i = 0; i < 4; i++) {
      await makeOutreach({ restaurantId: statRid, userId: null, sentAt, source: 'campaign' });
    }
    await resolveOutreachConversions();

    const s = (await getOutreachStatsBySource({
      restaurantId: statRid, source: 'campaign',
    })).get(null);
    assert.ok(s);
    assert.equal(s.sentCount, 4, 'ارسال واقعاً انجام شده و باید شمرده شود');
    assert.equal(s.unattributableCount, 4);
    assert.equal(s.resolvedCount, 0, 'ردیفِ بدونِ کاربر نباید وارد مخرجِ نرخ شود');
    assert.equal(s.ratePct, null);

    await db.outreachLog.deleteMany({ where: { restaurantId: statRid } });
  });

  test('ردیفِ داخلِ پنجره هنوز در مخرج نیست (فرصتش تمام نشده)', async () => {
    const statRid = await makeRestaurant('pending');
    const sourceId = randomUUID();
    await makeOutreach({
      restaurantId: statRid, userId: await makeUser(),
      sentAt: new Date(Date.now() - 1 * DAY), sourceId,
    });
    await resolveOutreachConversions();

    const s = (await getOutreachStatsBySource({
      restaurantId: statRid, source: 'automation', sourceIds: [sourceId],
    })).get(sourceId);
    assert.ok(s);
    assert.equal(s.sentCount, 1);
    assert.equal(s.resolvedCount, 0,
      'ارسالِ دیروز هنوز فرصتِ تبدیل دارد — شمردنش به‌عنوانِ شکست، نرخ را ناعادلانه پایین می‌آورد');

    await db.outreachLog.deleteMany({ where: { restaurantId: statRid } });
  });
});
