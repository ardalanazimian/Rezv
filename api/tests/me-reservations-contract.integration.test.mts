// ═══════════════════════════════════════════════════════════════════════
//  قراردادِ GET /me/reservations — گاردِ دائمیِ «شکلِ واقعی» در برابرِ mock
//
//  چرا این فایل وجود دارد (ممیزیِ پیش از لانچ، ۲۰۲۶-۰۸-۲۸):
//  سوئیتِ E2E کاملاً mock است (`e2e/tests/helpers/mock-api.ts`)، پس یک تستِ
//  سبزِ Playwright فقط ثابت می‌کند کلاینت با **ماکِ ما** کار می‌کند — نه با
//  routeِ واقعی. این دقیقاً یک بار در همین مخزن اتفاق افتاده: ماک
//  `{reservations:[…]}` برمی‌گرداند در حالی که route یک **آرایه‌ی خام** می‌دهد،
//  و چون کلاینت `Array.isArray` را رد می‌کرد به دادهٔ seed برمی‌گشت — یک تستِ
//  کاملِ «صداقتِ لغو» بی‌صدا بی‌اثر شده بود (کامنتِ mock-api.ts:209-213).
//
//  این تست همان شکاف را می‌بندد: شکلِ **خروجیِ واقعیِ route** را در برابرِ
//  فهرستِ فیلدهایی می‌سنجد که فرانت‌ها واقعاً می‌خوانند. اگر روزی کسی
//  `select` را عوض کند یا فیلدی را مسطح‌سازی کند، این‌جا قرمز می‌شود — نه
//  ماه‌ها بعد در تولید.
//
//  ⚠️ عمداً «همه‌ی ۳۵ کلید» را پین نمی‌کند: افزودنِ فیلدِ تازه به یک ردیفِ
//  Prisma شکستنِ قرارداد نیست. فقط دو چیز پین می‌شود که واقعاً شکستنی‌اند:
//  (۱) شکلِ پاسخ یک آرایه‌ی خام است، (۲) هر فیلدی که کلاینت می‌خواند موجود
//  است و نوعش همان است.
// ═══════════════════════════════════════════════════════════════════════
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';

import './helpers/test-env.mts';
process.env.JWT_SECRET ??= 'a'.repeat(32);
const { db } = await import('../src/lib/db');
const { signAccess } = await import('../src/lib/jwt');
const { GET: meReservations } = await import('../src/app/api/v1/me/reservations/route.ts');
const { fixturePhone } = await import('./_phone.helper.mts');

const SFX = Math.random().toString(36).slice(2, 8);
const made = { tenantIds: [] as string[], userIds: [] as string[] };

/**
 * فیلدهایی که فرانت‌ها **واقعاً** از این endpoint می‌خوانند.
 * منبع (grepِ ۲۰۲۶-۰۸-۲۸):
 *   apps/customer/js/reservation.js  → mapApiTrip (id، code، status، partySize،
 *     slotStart، restaurantId، restaurant.name، restaurant.freeCancelHours)
 *   apps/customer/js/features/notifications.js → slotStart، code
 *   apps/customer/js/features/food-dna.js      → طولِ آرایه
 * افزودنِ مصرف‌کننده‌ی تازه = افزودنِ ردیف به این جدول.
 */
const CONSUMED: Array<[path: string, type: string]> = [
  ['id', 'string'],
  ['code', 'string'],
  ['status', 'string'],
  ['partySize', 'number'],
  ['slotStart', 'string'],
  ['restaurantId', 'string'],
  ['restaurant.name', 'string'],
  ['restaurant.slug', 'string'],
  ['restaurant.freeCancelHours', 'number'],
];

function pick(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
    o,
  );
}

/**
 * یک کاربر با یک رزروِ پیش‌رو در رستورانی که سیاستِ لغوِ صریح دارد.
 *
 * ⚠️ `_seq`: دو فراخوانی با یک `freeCancelHours` نباید slug/کدِ یکسان بسازند —
 * همان درسی که `admin-branches.integration.test.mts` هم ثبتش کرده.
 */
let _seq = 0;
async function seed(freeCancelHours: number | null) {
  const seq = ++_seq;
  const t = await db.tenant.create({ data: { name: `[DEMO] contract ${SFX}-${seq}` } });
  made.tenantIds.push(t.id);
  const u = await db.user.create({ data: { phone: fixturePhone('0951') } });
  made.userIds.push(u.id);
  const r = await db.restaurant.create({
    data: {
      tenantId: t.id, slug: `contract-${SFX}-${seq}`,
      name: '[DEMO] کافه قرارداد', clubPrefix: 'CTR',
    },
    select: { id: true },
  });
  if (freeCancelHours !== null) {
    await db.cancellationPolicy.create({ data: { restaurantId: r.id, freeCancelHours } });
  }
  const start = new Date(Date.now() + 3 * 3600_000);
  await db.reservation.create({
    data: {
      restaurantId: r.id, userId: u.id, code: `CT${SFX}${seq}`.slice(0, 12),
      status: 'confirmed', partySize: 2,
      slotStart: start, slotEnd: new Date(start.getTime() + 90 * 60_000),
      guestName: 'مهمانِ قرارداد', guestPhone: fixturePhone('0952'),
    },
  });
  return signAccess({ sub: u.id, kind: 'customer' });
}

async function fetchRows(token: string): Promise<unknown> {
  const res = await meReservations(new Request('http://t/api/v1/me/reservations', {
    headers: { authorization: `Bearer ${token}` },
  }));
  assert.equal(res.status, 200, 'routeِ زنده باید ۲۰۰ بدهد');
  return res.json();
}

describe('قراردادِ GET /me/reservations (شکلِ واقعی، نه mock)', () => {
  test('پاسخ یک آرایه‌ی خام است — نه {items} و نه {reservations}', async () => {
    const token = await seed(12);
    const body = await fetchRows(token);
    assert.ok(Array.isArray(body),
      'شکلِ پاسخ آرایه‌ی خام است؛ عوض‌کردنش کلاینت را بی‌صدا به دادهٔ seed برمی‌گرداند '
      + '(همان باگی که mock-api.ts:209-213 مستند کرده)');
    assert.ok((body as unknown[]).length >= 1);
  });

  test('هر فیلدی که فرانت می‌خواند موجود است و نوعش درست است', async () => {
    const token = await seed(12);
    const rows = await fetchRows(token) as unknown[];
    const row = rows[0];
    for (const [path, type] of CONSUMED) {
      const v = pick(row, path);
      assert.notEqual(v, undefined, `فیلدِ مصرف‌شده‌ی «${path}» در پاسخِ واقعی نیست`);
      assert.equal(typeof v, type, `نوعِ «${path}» باید ${type} باشد، ${typeof v} است`);
    }
  });

  test('freeCancelHours از سیاستِ واقعیِ رستوران می‌آید، نه پیش‌فرض', async () => {
    const token = await seed(12);
    const rows = await fetchRows(token) as Array<{ restaurant: { freeCancelHours: number } }>;
    assert.equal(rows[0].restaurant.freeCancelHours, 12,
      'اگر این ۲۴ شد یعنی سیاستِ رستوران خوانده نمی‌شود و به پیش‌فرض افتاده');
  });

  test('رستورانِ بدونِ سیاست: پیش‌فرضِ ۲۴ — همان عددی که economy.ts اجرا می‌کند', async () => {
    const token = await seed(null);
    const rows = await fetchRows(token) as Array<{ restaurant: { freeCancelHours: number } }>;
    assert.equal(rows[0].restaurant.freeCancelHours, 24,
      'پیش‌فرض باید با economy.ts:154 و @default(24)ِ اسکیما یکی بماند — '
      + 'واگراییِ این عدد یعنی به مهمان پنجره‌ای نشان می‌دهیم که سرور اجرا نمی‌کند');
  });
});

after(async () => {
  await db.reservation.deleteMany({ where: { userId: { in: made.userIds } } });
  await db.user.deleteMany({ where: { id: { in: made.userIds } } });
  await db.restaurant.deleteMany({ where: { tenantId: { in: made.tenantIds } } });
  await db.tenant.deleteMany({ where: { id: { in: made.tenantIds } } });
  await db.$disconnect();
});
