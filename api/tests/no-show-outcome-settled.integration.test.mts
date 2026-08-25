import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from '../src/lib/db.ts';
import { fetchTrainingRows, type TrainingRow } from '../src/lib/no-show-model.ts';
import { fixturePhone } from './_phone.helper.mts';

// ═══════════════════════════════════════════════════════════════════════
//  نشتِ باقی‌مانده در ویژگیِ «سابقه‌ی مشتری» (رفعِ ۲۰۲۶-۰۸-۲۵)
//
//  کوئریِ آموزش شرطِ `h.slot_start < r.created_at` داشت و کامنتش ادعا می‌کرد
//  «فقط سابقه‌ای که نتیجه‌اش پیش از ثبتِ رزروِ هدف قطعی شده بود». کوئری این
//  را **اثبات نمی‌کرد**: slot_start فقط می‌گوید اسلات *شروع* شده، نه اینکه
//  نتیجه ثبت شده. در این کدبیس:
//    • `no_show`   را cron حوالیِ slot_start + lateGraceMinutes می‌نویسد
//                  (autoMarkNoShow در lib/lifecycle.ts)
//    • `completed` را autoComplete وقتی slot_end گذشته باشد می‌نویسد
//  یعنی پنجره‌ای به اندازه‌ی یک سرویس (~۱٫۵ تا ۳ ساعت) بود که در آن، رزروِ
//  سابقه «حل‌شده» شمرده می‌شد در حالی که در لحظه‌ی تصمیم هنوز نتیجه‌اش معلوم
//  نبود. جهتِ خطا همیشه خوش‌بینانه بود، و مسیرِ سرو چنین چیزی ندارد — یعنی
//  یک اختلافِ آموزش/سرو، از همان خانواده‌ی فازِ ۴.
//
//  ⚠️ سناریو عمداً چهار حالت دارد تا هم رفع و هم **کنترلِ مثبت** را بسنجد:
//  اگر گاردِ تازه صرفاً همه‌چیز را صفر می‌کرد، تست‌های ۲ و ۴ قرمز می‌شدند.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `stl-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string, userId: string;
let rows: TrainingRow[];

const DAY = 86_400_000;
const daysAgo = (d: number, hour = 18, min = 0) =>
  new Date(Date.now() - d * DAY - (new Date().getUTCHours() - hour) * 3600_000 - (new Date().getUTCMinutes() - min) * 60_000);

/** رزرو با کنترلِ کاملِ زمان‌ها و وضعیت. `partySize` نقشِ برچسبِ یکتا را دارد. */
async function makeReservation(opts: {
  partySize: number; slotStart: Date; slotEnd: Date; createdAt: Date; status: string;
}): Promise<string> {
  const id = randomUUID();
  await db.$executeRaw`
    INSERT INTO reservations
      (id, code, restaurant_id, user_id, party_size, slot_start, slot_end, status, source, created_at)
    VALUES
      (${id}::uuid, ${'RZ' + randomUUID().slice(0, 7).toUpperCase()},
       ${restaurantId}::uuid, ${userId}::uuid, ${opts.partySize},
       ${opts.slotStart}, ${opts.slotEnd},
       CAST(${opts.status}::text AS "public"."reservation_status"), 'app', ${opts.createdAt})
  `;
  return id;
}

/** رویدادِ «رسیدن به وضعیتِ نهایی» — همان چیزی که transitionReservation می‌نویسد. */
async function makeEvent(reservationId: string, toStatus: string, at: Date): Promise<void> {
  await db.$executeRaw`
    INSERT INTO reservation_events (id, reservation_id, to_status, actor, is_automatic, created_at)
    VALUES (${randomUUID()}::uuid, ${reservationId}::uuid,
            CAST(${toStatus}::text AS "public"."reservation_status"), 'cron', true, ${at})
  `;
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: TAG, name: '[DEMO] نتیجه‌ی ثبت‌شده', timezone: 'Asia/Tehran', clubPrefix: 'STL', isOpen: true },
    select: { id: true },
  });
  restaurantId = r.id;
  // پیشوندِ ۰۹۲۲ مالِ همین فایل است — رجوع کن به tests/_phone.helper.mts.
  const u = await db.user.create({
    data: { phone: fixturePhone('0922'), firstName: '[DEMO]', lastName: 'نشت' },
    select: { id: true },
  });
  userId = u.id;

  // ── سابقه‌ی الف: no_show با رویدادِ ثبتِ نتیجه در slot_start + ۲۰ دقیقه ──
  const hNoShow = await makeReservation({
    partySize: 2,
    slotStart: daysAgo(10, 18, 0), slotEnd: daysAgo(10, 19, 30),
    createdAt: daysAgo(12), status: 'no_show',
  });
  await makeEvent(hNoShow, 'no_show', daysAgo(10, 18, 20));

  // ── سابقه‌ی ب: completed **بدونِ هیچ رویدادی** (مسیرِ fallback) ──
  await makeReservation({
    partySize: 3,
    slotStart: daysAgo(20, 18, 0), slotEnd: daysAgo(20, 19, 30),
    createdAt: daysAgo(22), status: 'completed',
  });

  // ── هدف ۱: ثبت‌شده *بعد* از شروعِ سابقه‌ی الف ولی *قبل* از ثبتِ نتیجه‌اش ──
  await makeReservation({
    partySize: 7,
    slotStart: daysAgo(5), slotEnd: daysAgo(5, 19, 30),
    createdAt: daysAgo(10, 18, 10), status: 'completed',
  });

  // ── هدف ۲ (کنترلِ مثبت): ثبت‌شده یک روز بعد از ثبتِ نتیجه‌ی الف ──
  await makeReservation({
    partySize: 8,
    slotStart: daysAgo(4), slotEnd: daysAgo(4, 19, 30),
    createdAt: daysAgo(9), status: 'completed',
  });

  // ── هدف ۳: ثبت‌شده وسطِ سرویسِ سابقه‌ی ب (که رویداد ندارد) ──
  await makeReservation({
    partySize: 9,
    slotStart: daysAgo(3), slotEnd: daysAgo(3, 19, 30),
    createdAt: daysAgo(20, 18, 45), status: 'completed',
  });

  // ── هدف ۴ (کنترلِ مثبت برای fallback): ثبت‌شده یک روز بعد از پایانِ سابقه‌ی ب ──
  await makeReservation({
    partySize: 10,
    slotStart: daysAgo(2), slotEnd: daysAgo(2, 19, 30),
    createdAt: daysAgo(19), status: 'completed',
  });

  rows = await fetchTrainingRows(restaurantId);
});

after(async () => {
  await db.$executeRaw`
    DELETE FROM reservation_events WHERE reservation_id IN
      (SELECT id FROM reservations WHERE restaurant_id = ${restaurantId}::uuid)
  `.catch(() => 0);
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ${restaurantId}::uuid`.catch(() => 0);
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: userId } }).catch(() => {});
});

const probe = (partySize: number): TrainingRow => {
  const r = rows.find((x) => Number(x.party_size) === partySize);
  assert.ok(r, `ردیفِ آزمونِ ${partySize} باید در خروجیِ آموزش باشد`);
  return r!;
};

describe('سابقه فقط وقتی شمرده می‌شود که نتیجه‌اش **ثبت** شده باشد', () => {
  test('نتیجه‌ی هنوز ثبت‌نشده وارد ویژگی نمی‌شود (باگِ اصلی)', () => {
    // هدف ۱ در لحظه‌ی ثبتش فقط ۱۰ دقیقه از شروعِ اسلاتِ سابقه‌ی الف گذشته بود؛
    // no_show ده دقیقه *بعد* ثبت شد. با گاردِ قدیمی این ۱ می‌شد.
    const p = probe(7);
    assert.equal(Number(p.prior_no_shows), 0, 'no-showی که هنوز ثبت نشده بود نباید شمرده شود');
  });

  test('کنترلِ مثبت: نتیجه‌ی ثبت‌شده همچنان شمرده می‌شود', () => {
    // بدونِ این، «همیشه صفر برگردان» هم سبز می‌شد و ویژگی می‌مرد.
    const p = probe(8);
    assert.equal(Number(p.prior_no_shows), 1, 'no-showِ ثبت‌شده باید در سابقه بیاید');
  });

  test('ردیفِ بدونِ رویداد: کرانِ محافظه‌کارانه‌ی slot_end اعمال می‌شود', () => {
    // هدف ۳ وسطِ سرویسِ سابقه‌ی ب ثبت شده؛ سابقه‌ی ب رویداد ندارد، پس تنها
    // کرانِ قابلِ‌اثبات پایانِ سرویس است — و آن هنوز نگذشته بود.
    const p = probe(9);
    assert.equal(Number(p.prior_completions), 0);
  });

  test('کنترلِ مثبت برای fallback: بعد از پایانِ سرویس شمرده می‌شود', () => {
    const p = probe(10);
    assert.equal(Number(p.prior_completions), 1);
  });

  test('ترکیبِ کامل: هدفِ ۱ سابقه‌ی حل‌شده‌ی قدیمی‌تر را از دست نمی‌دهد', () => {
    // سابقه‌ی ب (۲۰ روز پیش، تمام‌شده) باید برای هدف ۱ شمرده شود — یعنی
    // گارد فقط پنجره‌ی «هنوز معلوم نیست» را می‌بندد، نه کلِ تاریخچه را.
    const p = probe(7);
    assert.equal(Number(p.prior_completions), 1);
  });
});

describe('کوئریِ سراسری همان گارد را دارد', () => {
  test('fetchPlatformTrainingRows هم شرطِ settled را دارد', () => {
    // ⚠️ چرا ساختاری و نه رفتاری: کوئریِ سراسری قیدِ رستوران ندارد، پس
    // تستِ رفتاری‌اش به کلِ محتوایِ DBِ تست وابسته می‌شد. ولی واگراییِ این دو
    // کوئری دقیقاً همان چیزی است که کامنتِ خودشان هشدار می‌دهد، پس حداقل
    // وجودِ بندِ یکسان قفل می‌شود.
    const src = readFileSync(
      join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src/lib/no-show-model.ts'), 'utf8');
    const guard = /AND COALESCE\(s\.settled_at, h\.slot_end\) < r\.created_at/g;
    assert.equal((src.match(guard) ?? []).length, 2,
      'هر دو کوئریِ آموزش (per-restaurant و سراسری) باید همین گارد را داشته باشند');
    const lateral = /FROM reservation_events e\s*\n\s*WHERE e\.reservation_id = h\.id AND e\.to_status = h\.status/g;
    assert.equal((src.match(lateral) ?? []).length, 2);
  });
});
