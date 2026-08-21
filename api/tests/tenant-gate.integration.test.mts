import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db.ts';
import { resolveStaffRestaurant, defaultRestaurantForTenant } from '../src/lib/staff-helpers.ts';
import type { AccessPayload } from '../src/lib/jwt.ts';

// ═══════════════════════════════════════════════════════════════════════
//  دروازه‌ی جداسازیِ تنانت — تستِ زنده رویِ Postgresِ واقعی
//
//  ⚠️ گپی که این فایل از آن زاده شد: `tests/tenant-isolation.integration.test.mts`
//  فقط کوئری‌هایِ **خامِ Prisma** را می‌سنجد — یعنی «اگر درست با restaurantId
//  مقید کنی، چیزی نشت نمی‌کند». ولی خودِ تصمیمِ «کدام restaurantId به تو
//  تعلق دارد» — `resolveStaffRestaurant` — هیچ تستی نداشت.
//
//  این تفکیک مهم است: اگر این تابع به کارمندِ تنانتِ A رستورانِ تنانتِ B را
//  بدهد، **همه‌ی** کوئری‌هایِ کاملاً درستِ زیرش هم نشت می‌کنند — و آن تستِ
//  موجود همچنان سبز می‌ماند، چون خودش restaurantId را دستی می‌دهد.
//
//  این تابع دروازه‌ی هر endpointِ رستوران است (`withRestaurantAuth` مستقیم
//  صدایش می‌زند و `ctx.restaurant.id` را از آن می‌گیرد). طبقِ CLAUDE.md
//  جداسازیِ تنانت غیرقابلِ‌مذاکره است — پس اینجا جای قفل‌کردنش است.
//
//  سه ادعای صریحِ کامنت‌هایِ خودِ فایل که تا امروز قفل نشده بودند:
//   ۱) کارمندِ قفل‌شده به یک شعبه «صرف‌نظر از هدرِ X-Restaurant-Id» همان
//      شعبه را می‌گیرد (نمی‌تواند شعبه عوض کند).
//   ۲) هدرِ متعلق به تنانتِ دیگر رد می‌شود («جلوگیری از IDOR»).
//   ۳) شعبه‌ی پیش‌فرض `orderBy` ثابت دارد — باگِ قبلی این بود که دو مسیرِ
//      مختلف بدونِ orderBy، دو شعبه‌ی متفاوت برمی‌گرداندند و صاحبِ
//      چندشعبه‌ای بی‌صدا دیتای شعبه‌ی اشتباه را می‌دید.
// ═══════════════════════════════════════════════════════════════════════

const TAG = `ti-${randomUUID().slice(0, 8)}`;

// دو تنانتِ کاملاً مجزا، هرکدام چندشعبه‌ای
let tenantA: string, tenantB: string;
let a1: string, a2: string;          // شعبه‌های A (a1 قدیمی‌تر)
let b1: string;                      // شعبه‌ی B
let ownerA: string, lockedA2: string, ownerB: string;

const staffAuth = (sub: string, tenantId: string, role: 'owner' | 'manager' | 'staff' = 'owner'): AccessPayload =>
  ({ sub, kind: 'staff', tenantId, role });

const reqWith = (restaurantId?: string): Request =>
  new Request('https://example.invalid/api/v1/restaurant/x', {
    headers: restaurantId ? { 'x-restaurant-id': restaurantId } : {},
  });

async function mkRestaurant(tenantId: string, suffix: string, createdAt: Date): Promise<string> {
  const r = await db.restaurant.create({
    data: {
      tenantId, slug: `${TAG}-${suffix}`, name: `[DEMO] شعبه ${suffix}`,
      clubPrefix: 'TI', timezone: 'Asia/Tehran', createdAt,
    },
    select: { id: true },
  });
  return r.id;
}

async function mkStaff(tenantId: string, restaurantId: string | null, role: 'owner' | 'manager' | 'staff'): Promise<string> {
  const s = await db.staff.create({
    data: {
      tenantId, restaurantId, role,
      phone: `0931${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`,
      name: '[DEMO] کارمند', isActive: true,
    },
    select: { id: true },
  });
  return s.id;
}

before(async () => {
  const ta = await db.tenant.create({ data: { name: `[DEMO] تنانتِ A ${TAG}` }, select: { id: true } });
  const tb = await db.tenant.create({ data: { name: `[DEMO] تنانتِ B ${TAG}` }, select: { id: true } });
  tenantA = ta.id; tenantB = tb.id;

  // a1 عمداً قدیمی‌تر است تا «شعبه‌ی پیش‌فرض» قابلِ‌پیش‌بینی باشد
  a1 = await mkRestaurant(tenantA, 'a1', new Date('2020-01-01T00:00:00Z'));
  a2 = await mkRestaurant(tenantA, 'a2', new Date('2024-01-01T00:00:00Z'));
  b1 = await mkRestaurant(tenantB, 'b1', new Date('2020-01-01T00:00:00Z'));

  ownerA = await mkStaff(tenantA, null, 'owner');       // دسترسی به همه‌ی شعبه‌های A
  lockedA2 = await mkStaff(tenantA, a2, 'staff');       // قفل به شعبه‌ی a2
  ownerB = await mkStaff(tenantB, null, 'owner');
});

after(async () => {
  await db.staff.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } }).catch(() => {});
});

describe('دروازه‌ی تنانت — عبورِ متقاطع مسدود است', () => {
  test('⚠️ صاحبِ A با هدرِ رستورانِ B، رستورانِ B را نمی‌گیرد', async () => {
    // ⚠️ هسته‌ی کلِ جداسازی. اگر این بشکند، هر endpointِ رستوران دیتای تنانتِ
    // دیگر را سرو می‌کند — و تستِ موجودِ ایزولاسیون (که restaurantId را دستی
    // می‌دهد) هیچ‌وقت متوجه نمی‌شود.
    const got = await resolveStaffRestaurant(staffAuth(ownerA, tenantA), reqWith(b1));
    assert.notEqual(got.id, b1, 'رستورانِ تنانتِ دیگر هرگز نباید برگردد');
    assert.equal(got.id, a1, 'باید بی‌صدا به شعبه‌ی پیش‌فرضِ خودش برگردد');
  });

  test('صاحبِ B هم نمی‌تواند شعبه‌ی A را بگیرد (تقارن)', async () => {
    const got = await resolveStaffRestaurant(staffAuth(ownerB, tenantB), reqWith(a2));
    assert.equal(got.id, b1);
  });

  test('کنترلِ مثبت: هدرِ شعبه‌ی خودی *واقعاً* کار می‌کند', async () => {
    // بدونِ این، تابعی که همیشه هدر را نادیده بگیرد هم تست‌های بالا را پاس
    // می‌کرد — یعنی چندشعبه‌ای اصلاً کار نکند و ما متوجه نشویم.
    const got = await resolveStaffRestaurant(staffAuth(ownerA, tenantA), reqWith(a2));
    assert.equal(got.id, a2, 'صاحب باید بتواند بینِ شعبه‌های خودش جابه‌جا شود');
  });

  test('هدرِ شناسه‌ی ناموجود به شعبه‌ی پیش‌فرض برمی‌گردد، نه خطا', async () => {
    // رفتارِ عمدیِ مستند (شعبه‌ی حذف‌شده یا انتخابِ کهنه‌ی کلاینت).
    const got = await resolveStaffRestaurant(staffAuth(ownerA, tenantA), reqWith(randomUUID()));
    assert.equal(got.id, a1);
  });

  test('هدرِ بی‌معنا (نه‌UUID) تابع را نمی‌شکند', async () => {
    const got = await resolveStaffRestaurant(staffAuth(ownerA, tenantA), reqWith('not-a-uuid'));
    assert.equal(got.id, a1, 'ورودیِ خراب باید به fallback برود، نه ۵۰۰');
  });
});

describe('دروازه‌ی تنانت — کارمندِ قفل‌شده به شعبه', () => {
  test('⚠️ کارمندِ قفل‌شده با هدر هم نمی‌تواند شعبه عوض کند', async () => {
    // ⚠️ ادعای صریحِ کامنتِ کد: «کارمندِ محدود نمی‌تواند شعبه عوض کند».
    const got = await resolveStaffRestaurant(staffAuth(lockedA2, tenantA, 'staff'), reqWith(a1));
    assert.equal(got.id, a2, 'هدر باید کاملاً نادیده گرفته شود');
  });

  test('کارمندِ قفل‌شده بدونِ هدر هم همان شعبه را می‌گیرد، نه پیش‌فرضِ تنانت', async () => {
    const got = await resolveStaffRestaurant(staffAuth(lockedA2, tenantA, 'staff'), reqWith());
    assert.equal(got.id, a2, 'نباید به شعبه‌ی پیش‌فرض (a1) بیفتد');
  });

  test('⚠️ کارمندِ قفل‌شده به شعبه‌ای از تنانتِ دیگر، هیچ چیزی نمی‌گیرد', async () => {
    // ⚠️ دیتای ناسازگار (staff.tenantId=A ولی restaurantId مالِ B). چکِ
    // tenantId داخلِ همان کوئری است، پس باید خطا بدهد نه اینکه شعبه‌ی B را
    // برگرداند و نه اینکه بی‌صدا به شعبه‌ی A بیفتد.
    const cross = await mkStaff(tenantA, b1, 'staff');
    try {
      await assert.rejects(
        () => resolveStaffRestaurant(staffAuth(cross, tenantA, 'staff'), reqWith()),
        'باید صریح رد شود، نه نشتِ شعبه‌ی تنانتِ دیگر',
      );
    } finally {
      await db.staff.delete({ where: { id: cross } }).catch(() => {});
    }
  });
});

describe('دروازه‌ی تنانت — هویتِ نامعتبر', () => {
  test('مشتری (نه کارمند) اصلاً رد می‌شود', async () => {
    await assert.rejects(
      () => resolveStaffRestaurant({ sub: randomUUID(), kind: 'customer' }, reqWith()),
      'کاربرِ مشتری نباید به دروازه‌ی رستوران راه پیدا کند',
    );
  });

  test('کارمندِ حذف‌شده رد می‌شود', async () => {
    await assert.rejects(
      () => resolveStaffRestaurant(staffAuth(randomUUID(), tenantA), reqWith()),
      'شناسه‌ی کارمندی که وجود ندارد نباید عبور کند',
    );
  });

  test('⚠️ توکنِ customer با subِ یک کارمندِ واقعی هم رد می‌شود', async () => {
    // ⚠️ این تست را جهش‌آزمایی لازم کرد: جهشِ «حذفِ گاردِ auth.kind !== staff»
    // اول **زنده ماند**، چون تستِ بالاییِ «مشتری رد می‌شود» یک subِ تصادفی
    // می‌داد — بدونِ گارد هم `staff.findUnique` چیزی پیدا نمی‌کرد و باز
    // forbidden می‌گرفت. یعنی تست به دلیلِ اشتباه سبز بود.
    //
    // اینجا subِ یک کارمندِ واقعی داده می‌شود ولی kind='customer' (که
    // tenantId ندارد). بدونِ گارد، جریان به شاخه‌ی پیش‌فرض می‌رسد و
    // `defaultRestaurantForTenant(undefined)` یک رستورانِ دلخواه برمی‌گرداند —
    // یعنی یک مشتری دیتای پنلِ رستوران را می‌گیرد. گارد باید *قبل* از هر
    // کوئری جلویش را بگیرد.
    await assert.rejects(
      () => resolveStaffRestaurant({ sub: ownerA, kind: 'customer' }, reqWith()),
      'kind باید قبل از هر کوئری چک شود',
    );
  });

  test('⚠️ tenantIdِ جعلی در توکن، رستورانِ تنانتِ دیگر را نمی‌دهد', async () => {
    // ⚠️ سناریوی «اگر مهاجم tenantId را در توکن دست‌کاری کند» — امضایِ JWT
    // جلویش را می‌گیرد، ولی این لایه هم نباید تنها خطِ دفاع باشد. اینجا
    // ownerA با tenantIdِ B ادعا می‌کند: چون staff.restaurantId او NULL است،
    // به شاخه‌ی پیش‌فرضِ تنانتِ B می‌رود. این را *ثبت* می‌کنیم چون رفتارِ
    // واقعیِ کد است و باید آگاهانه باشد: تنها چیزی که مانع می‌شود، امضایِ
    // توکن است — نه یک چکِ دوم که staff واقعاً عضوِ آن تنانت باشد.
    const got = await resolveStaffRestaurant(staffAuth(ownerA, tenantB), reqWith());
    assert.equal(got.id, b1,
      'رفتارِ فعلی: tenantIdِ توکن بدونِ چکِ عضویت اعتماد می‌شود — امنیتش کاملاً به امضایِ JWT وابسته است');
  });
});

describe('دروازه‌ی تنانت — شعبه‌ی پیش‌فرضِ قطعی', () => {
  test('⚠️ پیش‌فرض همیشه قدیمی‌ترین شعبه است، نه ردیفِ دلخواهِ دیتابیس', async () => {
    // ⚠️ قفلِ باگی که کامنتِ خودِ فایل شرحش را می‌دهد: دو مسیرِ مختلف بدونِ
    // orderBy صریح، دو شعبه‌ی متفاوت برمی‌گرداندند — لاگین یک شعبه را نشان
    // می‌داد و بقیه‌ی APIها شعبه‌ی دیگری، بدونِ هیچ خطا یا نشانه‌ای.
    for (let i = 0; i < 5; i++) {
      assert.equal((await defaultRestaurantForTenant(tenantA))!.id, a1,
        'باید در هر فراخوانی همان یک شعبه باشد');
    }
  });

  test('پیش‌فرضِ resolveStaffRestaurant با defaultRestaurantForTenant یکی است', async () => {
    // ⚠️ همان باگ از زاویه‌ی دوم: اگر این دو مسیر واگرا شوند، صاحبِ
    // چندشعبه‌ای دوباره دیتای شعبه‌ی اشتباه را می‌بیند.
    const viaGate = await resolveStaffRestaurant(staffAuth(ownerA, tenantA), reqWith());
    const viaDefault = await defaultRestaurantForTenant(tenantA);
    assert.equal(viaGate.id, viaDefault!.id);
  });

  test('⚠️ وقتی ترتیبِ درج با ترتیبِ createdAt مخالف است هم درست کار می‌کند', async () => {
    // ⚠️ این تست را هم جهش‌آزمایی لازم کرد: جهشِ «حذفِ orderBy» اول زنده ماند،
    // چون در تنانتِ A ترتیبِ درج و ترتیبِ createdAt یکی بود و Postgres اتفاقی
    // همان ردیفِ درست را برمی‌گرداند. یعنی تستِ «۵ بار یک نتیجه» نمی‌توانست
    // نبودِ orderBy را ببیند.
    //
    // اینجا عمداً شعبه‌ی *قدیمی‌تر* را **آخر** درج می‌کنیم. بدونِ orderBy،
    // اسکنِ ترتیبیِ Postgres شعبه‌ی اولِ درج‌شده (که createdAtِ جدیدتری دارد)
    // را می‌دهد — یعنی همان باگی که کامنتِ staff-helpers شرحش را می‌دهد.
    const t = await db.tenant.create({ data: { name: `[DEMO] معکوس ${TAG}` }, select: { id: true } });
    try {
      const newer = await mkRestaurant(t.id, 'rev-newer', new Date('2025-06-01T00:00:00Z'));
      const older = await mkRestaurant(t.id, 'rev-older', new Date('2019-01-01T00:00:00Z'));

      const got = await defaultRestaurantForTenant(t.id);
      assert.equal(got!.id, older, 'باید قدیمی‌ترین باشد، نه اولین ردیفی که دیتابیس دمِ دست دارد');
      assert.notEqual(got!.id, newer);
    } finally {
      await db.restaurant.deleteMany({ where: { tenantId: t.id } }).catch(() => {});
      await db.tenant.delete({ where: { id: t.id } }).catch(() => {});
    }
  });

  test('تنانتِ بدونِ رستوران خطا می‌دهد، نه شیِ خالی', async () => {
    const empty = await db.tenant.create({ data: { name: `[DEMO] خالی ${TAG}` }, select: { id: true } });
    const s = await mkStaff(empty.id, null, 'owner');
    try {
      assert.equal(await defaultRestaurantForTenant(empty.id), null);
      await assert.rejects(() => resolveStaffRestaurant(staffAuth(s, empty.id), reqWith()));
    } finally {
      await db.staff.delete({ where: { id: s } }).catch(() => {});
      await db.tenant.delete({ where: { id: empty.id } }).catch(() => {});
    }
  });
});
