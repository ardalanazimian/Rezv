import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  گزارش‌های رستوران به وقتِ **تهران** — نه UTC
//
//  ⚠️ باگی که این فایل قفلش می‌کند (۲۰۲۶-۰۸-۲۵، تأییدشده با کوئریِ واقعی):
//  `slot_start` از نوعِ `timestamp WITHOUT time zone` است و Postgres روی UTC
//  اجرا می‌شود، پس `EXTRACT(DOW/HOUR FROM slot_start)` روزِ هفته و ساعتِ
//  **UTC** می‌داد. تهران UTC+3:30 است، یعنی:
//    • «ساعتِ اوج» ۳:۳۰ جابه‌جا گزارش می‌شد (شامِ ۲۱:۰۰ ⇒ ۱۷ نمایش داده می‌شد)
//    • شامِ بعدِ نیمه‌شبِ تهران به روزِ هفته‌ی قبل منتقل می‌شد
//  و همین اعداد ورودیِ تصمیمِ **قیمت‌گذاری** و «کوپنِ روزِ کم‌تردد» بودند.
//
//  تست‌ها عمداً روی روتِ واقعی (با Requestِ واقعی و سیمِ auth) اجرا می‌شوند،
//  نه روی کوئریِ بازنویسی‌شده در تست.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { invalidatePattern } = await import('../src/lib/cache');
const { getWeekdayRanking } = await import('../src/lib/restaurant-manager');
const analyticsRoute = await import('../src/app/api/v1/restaurant/analytics/route');

const TAG = `atz-${randomUUID().slice(0, 8)}`;
let tenantId: string, restaurantId: string, token: string;

const ctxArg = () => ({ params: Promise.resolve({}) });
const authedGet = () =>
  new Request('http://x/api/v1/restaurant/analytics', {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  });

/**
 * ۲۱:۰۰ به وقتِ تهران در `daysAgo` روزِ پیش (به تقویمِ تهران) = ۱۷:۳۰ UTC.
 * عددها عمداً دستی حساب شده‌اند تا تست به همان تابعی که می‌سنجد وابسته نباشد.
 */
async function dinnerAtTehran(daysAgo: number, tehranHour: number, tehranMinute = 0): Promise<Date> {
  const rows = await db.$queryRaw<{ ts: Date }[]>`
    SELECT ((((now() AT TIME ZONE 'Asia/Tehran')::date - ${daysAgo}::int)::timestamp
             + make_interval(hours => ${tehranHour}::int, mins => ${tehranMinute}::int)
            ) AT TIME ZONE 'Asia/Tehran') AT TIME ZONE 'UTC' AS ts
  `;
  return rows[0].ts;
}

async function insertAt(slot: Date): Promise<void> {
  await db.$executeRaw`
    INSERT INTO reservations
      (id, code, restaurant_id, party_size, slot_start, slot_end, status, source, created_at)
    VALUES
      (${randomUUID()}::uuid, ${'RZ' + randomUUID().slice(0, 7).toUpperCase()},
       ${restaurantId}::uuid, 2, ${slot}, ${new Date(slot.getTime() + 90 * 60_000)},
       CAST('completed'::text AS "public"."reservation_status"), 'app', ${slot})
  `;
}

before(async () => {
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId, slug: TAG, name: '[DEMO] تقویمِ تهران', timezone: 'Asia/Tehran', clubPrefix: 'ATZ', isOpen: true },
    select: { id: true },
  });
  restaurantId = r.id;
  const staff = await db.staff.create({
    data: { tenantId, phone: `+9891${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13), role: 'owner', isActive: true },
    select: { id: true },
  });
  token = signAccess({ sub: staff.id, kind: 'staff', tenantId, role: 'owner' });

  // ── ۲۵ شامِ ساعتِ ۱۹:۰۰ تهران (= ۱۵:۳۰ UTC) در ۲۵ روزِ متوالی ──
  // ساعتِ ۱۹ عمداً انتخاب شده تا سطلِ UTCاش (۱۵) با هیچ سطلِ دیگری برخورد نکند.
  for (let d = 1; d <= 25; d++) await insertAt(await dinnerAtTehran(d, 19));

  // ── ۶ شامِ ۰۰:۳۰ بامدادِ تهران ──
  // در UTC اینها ساعتِ ۲۱:۰۰ روزِ *قبل* هستند، یعنی هم ساعت هم روزِ هفته فرق می‌کند.
  for (let d = 2; d <= 7; d++) await insertAt(await dinnerAtTehran(d, 0, 30));

  await invalidatePattern('analytics:*').catch(() => {});
});

after(async () => {
  await db.$executeRaw`DELETE FROM reservations WHERE restaurant_id = ${restaurantId}::uuid`.catch(() => 0);
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { id: restaurantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  await invalidatePattern('analytics:*').catch(() => {});
});

describe('GET /restaurant/analytics — ساعت و روزِ هفته به وقتِ تهران', () => {
  test('ساعتِ اوج ۱۹ گزارش می‌شود، نه ۱۵ (همان لحظه به وقتِ UTC)', async () => {
    const res = await analyticsRoute.GET(authedGet() as never, ctxArg() as never);
    assert.equal(res.status, 200, await res.clone().text());
    const body = await res.json() as { peak_hours: { hour: number; count: number }[] };

    const hours = body.peak_hours.map((h) => h.hour);
    assert.ok(hours.includes(19), `ساعتِ اوج باید ۱۹ (تهران) باشد؛ گرفتیم ${JSON.stringify(hours)}`);
    // کنترلِ مثبت: ۱۵ همان لحظه به وقتِ UTC است — اگر برگردد یعنی رفع باطل شده.
    assert.ok(!hours.includes(15), 'ساعتِ UTC (۱۵) نباید در خروجی باشد');
  });

  test('نقشه‌ی حرارتی: شامِ ۰۰:۳۰ بامداد به ساعت/روزِ هفته‌ی خودش می‌رود، نه روزِ قبل', async () => {
    const res = await analyticsRoute.GET(authedGet() as never, ctxArg() as never);
    const body = await res.json() as { heatmap: { dow: number; hour: number; count: number }[] };

    const at = (hour: number) => body.heatmap.filter((c) => c.hour === hour).reduce((s, c) => s + c.count, 0);
    assert.equal(at(0), 6, 'هر ۶ رزروِ ۰۰:۳۰ باید در ساعتِ ۰ باشند');
    assert.equal(at(19), 25, 'هر ۲۵ شام باید در ساعتِ ۱۹ باشند');
    // به وقتِ UTC، ۰۰:۳۰ تهران ساعتِ ۲۱ روزِ قبل است و ۱۹:۰۰ تهران ساعتِ ۱۵.
    // اگر بازگشت به UTC رخ دهد، این دو سطلِ خالی پر می‌شوند.
    assert.equal(at(21), 0, 'هیچ رزروی نباید در ساعتِ ۲۱ (تفسیرِ UTCِ ۰۰:۳۰ تهران) بیفتد');
    assert.equal(at(15), 0, 'هیچ رزروی نباید در ساعتِ ۱۵ (تفسیرِ UTCِ ۱۹:۰۰ تهران) بیفتد');

    // روزِ هفته هم باید تهرانی باشد: رزروِ ۰۰:۳۰ در UTC به روزِ *قبل* می‌افتد.
    const midnightDows = body.heatmap.filter((c) => c.hour === 0).map((c) => c.dow).sort();
    const expected = await db.$queryRaw<{ dow: number }[]>`
      SELECT DISTINCT EXTRACT(DOW FROM (slot_start AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tehran'))::int AS dow
      FROM reservations
      WHERE restaurant_id = ${restaurantId}::uuid
        AND EXTRACT(HOUR FROM (slot_start AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tehran')) = 0
      ORDER BY 1
    `;
    assert.deepEqual(midnightDows, expected.map((e) => e.dow).sort());
  });
});

describe('getWeekdayRanking — روزِ هفته‌ی تهران', () => {
  test('رزروِ ۰۰:۳۰ بامداد به روزِ هفته‌ی تهرانی‌اش نسبت داده می‌شود', async () => {
    const ranking = await getWeekdayRanking(restaurantId);
    assert.ok(ranking, 'با ۳۱ رزرو در ۶۰ روزِ اخیر باید رتبه‌بندی برگردد');

    // مجموعِ رتبه‌بندی باید همه‌ی ۳۱ رزرو را بشمارد (هیچ‌کدام از پنجره نیفتاده).
    const total = ranking!.reduce((s, r) => s + r.count, 0);
    assert.equal(total, 31, `همه‌ی رزروها باید شمرده شوند، شد ${total}`);

    // شمارشِ مستقلِ «روزِ هفته‌ی تهران» مستقیماً از DB — اگر کد به UTC
    // برگردد، این دو توزیع از هم جدا می‌شوند.
    const expected = await db.$queryRaw<{ dow: number; cnt: bigint }[]>`
      SELECT EXTRACT(DOW FROM (slot_start AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tehran'))::int AS dow,
             COUNT(*)::bigint AS cnt
      FROM reservations WHERE restaurant_id = ${restaurantId}::uuid
      GROUP BY 1 ORDER BY 1
    `;
    const got = new Map(ranking!.map((r) => [r.dow, r.count]));
    for (const e of expected) {
      assert.equal(got.get(e.dow) ?? 0, Number(e.cnt), `روزِ هفته‌ی ${e.dow} نمی‌خواند`);
    }

    // کنترلِ مثبت: توزیعِ UTC واقعاً فرق دارد، وگرنه تستِ بالا بی‌اثر بود.
    const utc = await db.$queryRaw<{ dow: number; cnt: bigint }[]>`
      SELECT EXTRACT(DOW FROM slot_start)::int AS dow, COUNT(*)::bigint AS cnt
      FROM reservations WHERE restaurant_id = ${restaurantId}::uuid
      GROUP BY 1 ORDER BY 1
    `;
    const sameShape = utc.length === expected.length
      && utc.every((u, i) => u.dow === expected[i].dow && Number(u.cnt) === Number(expected[i].cnt));
    assert.ok(!sameShape, 'سناریو باید توزیعِ UTC و تهران را واقعاً از هم جدا کند');
  });
});

// ───────────────────────────────────────────────────────────────────────
//  قفلِ ساختاری: هیچ‌کدام از این فایل‌ها حق ندارند دوباره تعریفِ خودشان از
//  «روز/ساعت» بسازند. تستِ رفتاریِ بالا فقط دو مصرف‌کننده را می‌پوشاند؛
//  این یکی جلوی واگراییِ بقیه را می‌گیرد — همان چیزی که اجازه داد ۵ فایل
//  از تعریفِ درستِ no-show-model.ts جدا بیفتند.
// ───────────────────────────────────────────────────────────────────────
describe('قفلِ ساختاری: تعریفِ «روز» یکتاست', () => {
  const apiRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const FILES = [
    'src/lib/demand-forecast.ts',
    'src/lib/restaurant-manager.ts',
    'src/app/api/v1/restaurant/ai/route.ts',
    'src/app/api/v1/restaurant/pricing/route.ts',
    'src/app/api/v1/restaurant/analytics/route.ts',
  ];
  /** الگوهایی که «روزِ UTC» می‌سازند. `TEHRAN_*` از این‌ها استفاده می‌کند ولی
   *  همیشه با `AT TIME ZONE` می‌پیچدشان، پس مقایسه روی متنِ بدونِ آن است. */
  const BANNED = [/EXTRACT\(\s*DOW\s+FROM\s+r?\.?slot_start\s*\)/i,
                  /EXTRACT\(\s*HOUR\s+FROM\s+r?\.?slot_start\s*\)/i,
                  /\bslot_start::date\b/,
                  /\bCURRENT_DATE\b/];

  for (const rel of FILES) {
    test(`${rel} تعریفِ UTCیِ روز/ساعت ندارد`, () => {
      const src = readFileSync(join(apiRoot, rel), 'utf8');
      const lines = src.split('\n')
        // خطوطِ خودِ ثابت‌های TEHRAN_* استثنا هستند: آن‌ها *تعریفِ* درست‌اند.
        .filter((l) => !l.includes("AT TIME ZONE 'Asia/Tehran'"))
        // کامنت‌ها (که عمداً همین الگوهای ممنوع را *نقل* می‌کنند) کد نیستند.
        .filter((l) => !/^\s*(\/\/|\*|\/\*|--)/.test(l));
      for (const re of BANNED) {
        const hit = lines.find((l) => re.test(l));
        assert.equal(hit, undefined, `الگویِ UTCیِ ${re} در ${rel}: ${hit}`);
      }
    });
  }
});
