import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  نقشِ RBAC از **دیتابیس** خوانده می‌شود، نه از توکن
//
//  ⚠️ چرا این فایل ساخته شد: `requirePermission` تا ۲۰۲۶-۰۸-۲۵ خطِ اولش
//  `if (auth.role === 'owner' || auth.role === 'manager') return` بود و
//  `auth.role` مستقیم از JWT می‌آمد. توکن عکسِ لحظه‌ی صدور است، ۱۵ دقیقه
//  عمر دارد و لیستِ ابطال ندارد — پس هر تنزلِ نقش تا ۱۵ دقیقه بی‌اثر بود،
//  روی **همه‌ی** روت‌هایِ `withRestaurantAuth` (که برخلافِ خواهرش
//  `withStaffAuth` نقش را تازه نمی‌کند).
//
//  ⚠️ صادقانه دربارهٔ شدت: امروز هیچ APIی نقش را عوض نمی‌کند
//  (`PATCH /restaurant/staff` فقط name/is_active/restaurant_id/permissions
//  می‌پذیرد)، پس این حفره‌ی زنده نبود — یک فرضِ نانوشته بود که با اولین
//  «تغییرِ نقش» (حتی دستی در DB) بی‌صدا به حفره تبدیل می‌شد.
//
//  ⚠️ و چرا این تست **لازم** بود: بعد از رفع، جهش‌آزمایی روی هر ۴۱ تستِ
//  موجودِ RBAC (`rbac-permission-coverage` + `permissions`) **صفر** قرمز
//  داد — یعنی آن‌ها فقط حالتی را می‌سنجند که نقشِ توکن و نقشِ DB یکی است.
//  هیچ‌کدام واگراییِ این دو را لمس نمی‌کردند.
//
//  ساختار: هر دو جهتِ واگرایی آزموده می‌شود تا گاردی که «همیشه رد کند»
//  هم این فایل را پاس نکند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { requirePermission } = await import('../src/lib/permissions');

const TAG = 'rbacdb';
let tenantId: string;
let staffId: string;
const phone = fixturePhone('0924');

/** payloadِ کارمند با نقشِ **ادعاییِ** توکن — عمداً ممکن است با DB فرق کند. */
const claim = (role: 'owner' | 'manager' | 'staff') =>
  ({ sub: staffId, kind: 'staff' as const, tenantId, role });

/** نقش/فعال‌بودنِ واقعیِ ردیفِ DB را عوض می‌کند. */
async function setDb(role: 'owner' | 'manager' | 'staff', isActive = true) {
  await db.staff.update({ where: { id: staffId }, data: { role, isActive } });
}

before(async () => {
  const s = Date.now().toString(36);
  const t = await db.tenant.create({ data: { name: `[DEMO] ${TAG}-${s}` }, select: { id: true } });
  tenantId = t.id;
  const st = await db.staff.create({
    data: { tenantId, phone, name: `[DEMO] ${TAG}`, role: 'staff', isActive: true },
    select: { id: true },
  });
  staffId = st.id;
  // هر ۹ مجوز صریحاً false — پیش‌فرضِ بعضی ستون‌ها true است.
  await db.staffPermission.create({
    data: {
      staffId,
      canManageReservations: false, canManageTables: false, canManageWaitlist: false,
      canViewAnalytics: false, canViewRevenue: false, canManageCampaigns: false,
      canManageCoupons: false, canManageStaff: false, canManageSettings: false,
    },
  });
});

after(async () => {
  await db.staffPermission.deleteMany({ where: { staffId } }).catch(() => {});
  await db.staff.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('نقش از DB خوانده می‌شود، نه از توکن', () => {
  test('🔴 توکنی که «manager» ادعا می‌کند ولی در DB «staff» است، رد می‌شود', async () => {
    // ادعایِ مرکزی: تنزلِ نقش باید **بلافاصله** اثر کند، نه بعد از ۱۵ دقیقه.
    await setDb('staff');
    await assert.rejects(
      () => requirePermission(claim('manager'), 'canViewRevenue'),
      /دسترسی|forbidden|FORBIDDEN/i,
      'نقشِ کهنه‌ی داخلِ توکن نباید دسترسیِ کامل بدهد',
    );
  });

  test('🔴 همان برایِ ادعای «owner»', async () => {
    await setDb('staff');
    await assert.rejects(() => requirePermission(claim('owner'), 'canManageSettings'));
  });

  test('✓ کنترلِ منفی — DB می‌گوید manager، پس عبور می‌کند حتی اگر توکن «staff» بگوید', async () => {
    // ⚠️ این تست جلوی «رفعِ» تقلبی را می‌گیرد: گاردی که همیشه رد کند، اینجا
    // می‌افتد. یعنی DB واقعاً منبعِ حقیقت است، نه اینکه صرفاً سخت‌گیرتر شده.
    await setDb('manager');
    await requirePermission(claim('staff'), 'canViewRevenue');
  });

  test('✓ کارمندِ عادی با مجوزِ صریح، همچنان عبور می‌کند (قابلیت نشکسته)', async () => {
    await setDb('staff');
    await db.staffPermission.update({ where: { staffId }, data: { canManageWaitlist: true } });
    await requirePermission(claim('staff'), 'canManageWaitlist');
    await db.staffPermission.update({ where: { staffId }, data: { canManageWaitlist: false } });
  });

  test('🔴 کارمندِ غیرفعال با نقشِ manager در DB هم رد می‌شود', async () => {
    // `withRestaurantAuth` این را یک لایه بالاتر هم می‌گیرد؛ اینجا تکرار
    // می‌شود تا خودِ این تابع به‌تنهایی هم درست باشد.
    await setDb('manager', false);
    await assert.rejects(() => requirePermission(claim('manager'), 'canViewRevenue'));
    await setDb('staff', true);
  });

  test('🔴 کارمندِ تنانتِ دیگر — نقشِ درست هم نجاتش نمی‌دهد', async () => {
    await setDb('manager');
    await assert.rejects(
      () => requirePermission({ ...claim('manager'), tenantId: '00000000-0000-0000-0000-000000000000' }, 'canViewRevenue'),
      undefined,
      'tenantIdِ توکن باید با ردیفِ واقعی تطبیق داده شود',
    );
    await setDb('staff');
  });

  test('🔴 مشتری (kind=customer) اصلاً به این مسیر راه ندارد', async () => {
    await assert.rejects(() =>
      requirePermission({ sub: 'x', kind: 'customer' } as never, 'canViewRevenue'));
  });
});
