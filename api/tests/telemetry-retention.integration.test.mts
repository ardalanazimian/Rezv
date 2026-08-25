import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// آستانه‌ها را قبل از importِ ماژول قطعی می‌کنیم (retentionDays() هر بار
// process.env را می‌خواند، ولی صریح‌بودن این‌جا تست را از پیش‌فرض‌ها مستقل می‌کند).
process.env.TELEMETRY_RETENTION_ANON_DAYS = '30';
process.env.TELEMETRY_RETENTION_AUTH_DAYS = '60';
process.env.TELEMETRY_RETENTION_VERIFIED_DAYS = '365';

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ هرسِ نگه‌داریِ تله‌متری (فازِ ۲، پروتکل §۱۴)
//
//  یافته: platform_events تنها جدولِ پروژه بود که **هیچ سیاستِ retention**
//  نداشت — jobs، idempotency_keys و audit_logs همه داشتند. رشدِ بی‌مرز، رویِ
//  جدولی که هر رویدادِ رفتاریِ هر سه اپ در آن نوشته می‌شود.
//
//  دو ویژگیِ حیاتی که این‌جا پین می‌شوند:
//   ۱) هرس بر اساسِ **سطحِ اعتماد** تفکیک می‌شود — رویدادی که طبقِ §۱۵ هرگز
//      واجدِ شرایطِ آموزش نیست دلیلی ندارد به‌اندازه‌ی حقیقتِ سروری بماند.
//   ۲) مبنایِ هرس `ingested_at` (سروری) است، نه `occurred_at` (کلاینت).
//      وگرنه یک کلاینتِ بدخواه می‌توانست با backdate کردنِ رویداد، حذفِ
//      **زودهنگامِ** ردِ خودش را تحریک کند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { prunePlatformEvents } = await import('../src/lib/platform-events.ts');

const SFX = Date.now().toString(36);
const TYPE = `retention.probe_${SFX}`;
const DAY = 86_400_000;

function daysAgo(n: number) { return new Date(Date.now() - n * DAY); }

async function seed(id: string, trustLevel: string, ingestedDaysAgo: number, occurredDaysAgo = ingestedDaysAgo) {
  await db.platformEvent.create({
    data: {
      type: TYPE, source: 'customer', eventId: `${SFX}-${id}`,
      trustLevel, payload: {},
      ingestedAt: daysAgo(ingestedDaysAgo),
      occurredAt: daysAgo(occurredDaysAgo),
      serverReceivedAt: daysAgo(ingestedDaysAgo),
    },
  });
}

async function alive(id: string) {
  return (await db.platformEvent.count({ where: { eventId: `${SFX}-${id}` } })) > 0;
}

before(async () => {
  await db.platformEvent.deleteMany({ where: { type: TYPE } }).catch(() => {});
  await seed('anon-old', 'ANONYMOUS_CLIENT', 45);
  await seed('anon-fresh', 'ANONYMOUS_CLIENT', 5);
  await seed('auth-old', 'AUTHENTICATED_CLIENT', 45);
  await seed('verified-old', 'SERVER_VERIFIED', 45);
  await seed('synthetic-old', 'SYNTHETIC', 45);
  // درج شده همین حالا، ولی مدعیِ وقوع در ۴۰۰ روز پیش — نباید حذف شود.
  await seed('backdated', 'ANONYMOUS_CLIENT', 0, 400);
});

after(async () => {
  await db.platformEvent.deleteMany({ where: { type: TYPE } }).catch(() => {});
});

describe('هرسِ نگه‌داریِ platform_events (§۱۴)', () => {
  test('هرس بر اساسِ سطحِ اعتماد تفکیک می‌شود', async () => {
    await prunePlatformEvents();

    assert.equal(await alive('anon-old'), false, 'ناشناسِ ۴۵ روزه باید حذف شود (آستانه ۳۰)');
    assert.equal(await alive('synthetic-old'), false, 'ساختگیِ ۴۵ روزه باید حذف شود');
    assert.equal(await alive('anon-fresh'), true, 'ناشناسِ ۵ روزه باید بماند');
    assert.equal(await alive('auth-old'), true, 'احرازشده‌ی ۴۵ روزه باید بماند (آستانه ۶۰)');
    assert.equal(await alive('verified-old'), true, 'حقیقتِ سروری باید بماند (آستانه ۳۶۵)');
  });

  test('مبنایِ هرس زمانِ سروری است، نه ادعایِ کلاینت', async () => {
    // این ردیف occurred_at ای در ۴۰۰ روز پیش دارد ولی همین حالا درج شده.
    // اگر هرس رویِ occurred_at بود، کلاینت می‌توانست حذفِ خودش را تحریک کند.
    assert.equal(await alive('backdated'), true, 'رویدادِ backdate‌شده نباید زودهنگام حذف شود');
  });

  test('اجرایِ دوباره idempotent است و چیزی را که مانده نمی‌برد', async () => {
    const before = await db.platformEvent.count({ where: { type: TYPE } });
    await prunePlatformEvents();
    assert.equal(await db.platformEvent.count({ where: { type: TYPE } }), before, 'اجرایِ دوم نباید چیزی حذف کند');
  });
});
