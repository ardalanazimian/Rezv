import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  GET /events — رویداد باید slug و نامِ رستورانِ میزبان را بدهد
//
//  چرا: کارتِ رویداد در اپ مشتری فقط restaurantId داشت. فیدِ رستوران‌ها
//  صفحه‌بندی‌شده است، پس اگر میزبان در صفحه‌ی بارگذاری‌شده نبود، کلیک راهی به
//  صفحه‌اش نداشت (endpointِ جزئیات slug-محور است) — کلیکِ مرده. با
//  restaurant_slug اپ می‌تواند مستقیم صفحه‌ی رستوران را باز کند
//  (openRestBySlug)، و restaurant_name نامِ میزبان را صادقانه نشان می‌دهد
//  به‌جایِ رشته‌ی خالی.
//
//  همچنین قفل می‌کند: رویدادِ منتشرنشده و رویدادِ گذشته بیرون نمی‌آیند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { redis } = await import('../src/lib/redis');
const eventsRoute = await import('../src/app/api/v1/events/route');

let tenantId: string, restaurantId: string, slug: string, restName: string;

before(async () => {
  const s = Date.now().toString(36);
  slug = `zz-evt-${s}`;
  restName = `[DEMO] میزبانِ رویداد ${s}`;
  const t = await db.tenant.create({ data: { name: `[DEMO] evt-${s}` }, select: { id: true } });
  tenantId = t.id;
  const r = await db.restaurant.create({
    data: { tenantId: t.id, slug, name: restName, clubPrefix: 'EVT' },
    select: { id: true },
  });
  restaurantId = r.id;

  const soon = new Date(Date.now() + 3 * 86_400_000);
  const past = new Date(Date.now() - 3 * 86_400_000);
  await db.specialEvent.createMany({
    data: [
      { restaurantId, title: '[DEMO] رویدادِ منتشرشده', emoji: '🎷', startsAt: soon, isPublished: true },
      { restaurantId, title: '[DEMO] رویدادِ پیش‌نویس', emoji: '🚧', startsAt: soon, isPublished: false },
      { restaurantId, title: '[DEMO] رویدادِ گذشته', emoji: '⏮', startsAt: past, isPublished: true },
    ],
  });
  // کشِ ۱۲۰ ثانیه‌ای این endpoint نباید پاسخِ اجرای قبلی را برگرداند
  const stale = await redis.keys('*events*');
  if (stale.length) await redis.del(...stale);
});

after(async () => {
  await db.specialEvent.deleteMany({ where: { restaurantId } });
  await db.restaurant.deleteMany({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  const stale = await redis.keys('*events*');
  if (stale.length) await redis.del(...stale);
});

describe('GET /events — slug و نامِ رستوران', () => {
  test('رویدادِ منتشرشده restaurant_slug و restaurant_name واقعی دارد', async () => {
    const res = await eventsRoute.GET(new Request(`http://x/api/v1/events?restaurant_id=${restaurantId}`));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.events.length, 1, 'فقط رویدادِ منتشرشده‌ی پیش‌رو');
    const e = body.events[0];
    assert.equal(e.restaurant_slug, slug, 'slug باید همان رستورانِ میزبان باشد');
    assert.equal(e.restaurant_name, restName);
    assert.equal(e.restaurantId, restaurantId, 'قراردادِ قبلی (restaurantId) نباید بشکند');
    // relationِ خام نباید به بیرون درز کند (پاسخ تخت است)
    assert.equal(e.restaurant, undefined);
  });

  test('رویدادِ پیش‌نویس و رویدادِ گذشته بیرون نمی‌آیند', async () => {
    const res = await eventsRoute.GET(new Request(`http://x/api/v1/events?restaurant_id=${restaurantId}`));
    const body = await res.json();
    const titles = body.events.map((e: { title: string }) => e.title);
    assert.ok(!titles.some((t: string) => t.includes('پیش‌نویس')), 'منتشرنشده نباید بیاید');
    assert.ok(!titles.some((t: string) => t.includes('گذشته')), 'گذشته نباید بیاید');
  });
});
