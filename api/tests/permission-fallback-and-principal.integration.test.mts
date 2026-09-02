import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  دو سوراخِ پوششیِ `requirePermission` (نمونه‌گیریِ جهش، ۲۰۲۶-۰۸-۲۸)
//
//  ⚠️ چرا این فایل ساخته شد: نمونه‌گیریِ جهش نشان داد دو تغییرِ واقعاً خطرناک
//  در `lib/permissions.ts` از **هر ۳ فایلِ تستِ موجودِ RBAC** سالم رد می‌شوند:
//
//    P3 — `const allowed = perm ? perm[key] : SAFE_DEFAULTS[key];`
//         →  `const allowed = perm ? perm[key] : true;`
//         یعنی کارکنی که هیچ رکوردِ `StaffPermission` ندارد، به‌جای
//         پیش‌فرضِ امن، **دسترسیِ کامل** می‌گیرد. این دقیقاً ضدِ چیزی است
//         که `docs/SECURITY.md:35` وعده می‌دهد («safe defaults»).
//
//    P5 — `if (auth.kind !== 'staff') throw Err.forbidden();`
//         →  `if (auth.kind === 'admin') throw Err.forbidden();`
//         یعنی گاردِ نوعِ principal برداشته می‌شود. خطرش نظری نیست: کوئریِ
//         بعدی `{ id: auth.sub, tenantId: auth.tenantId }` است و توکنِ مشتری
//         اصلاً `tenantId` ندارد، پس شرط عملاً به «فقط id» فرو می‌ریزد —
//         و هر principalی که `sub`ش با یک staffِ فعال یکی باشد، نقشِ او را
//         به ارث می‌برد.
//
//  ⚠️ چرا تست‌های موجود نمی‌گرفتندشان: `permissions.test.mts` فقط تابعِ
//  **خالصِ** `effectivePermissionsFrom` را می‌سنجد (بدونِ DB)، و دو فایلِ
//  دیگر همیشه با یک رکوردِ `StaffPermission`ِ موجود کار می‌کنند. هیچ‌کدام
//  نه حالتِ «رکورد وجود ندارد» را لمس می‌کردند، نه principalِ غیرstaff را.
//
//  هر دو تستِ زیر با تزریقِ دوباره‌ی همان جهش راستی‌آزمایی شده‌اند.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { requirePermission } = await import('../src/lib/permissions.ts');

const SFX = Math.random().toString(36).slice(2, 8);
const made = { tenantIds: [] as string[], userIds: [] as string[] };

/** کارکنِ فعالِ `role='staff'` **بدونِ** هیچ رکوردِ StaffPermission. */
async function staffWithoutPermissionRow() {
  const t = await db.tenant.create({ data: { name: `[DEMO] perm-fallback ${SFX}` } });
  made.tenantIds.push(t.id);
  const s = await db.staff.create({
    data: { tenantId: t.id, phone: fixturePhone('0961'), role: 'staff', isActive: true },
    select: { id: true },
  });
  const rows = await db.staffPermission.count({ where: { staffId: s.id } });
  assert.equal(rows, 0, 'پیش‌شرط: این کارکن نباید رکوردِ مجوز داشته باشد');
  return { staffId: s.id, tenantId: t.id };
}

describe('P3 — نبودِ رکوردِ مجوز باید به SAFE_DEFAULTS برگردد، نه دسترسیِ کامل', () => {
  test('کلیدِ حساس (canViewRevenue) بدونِ رکوردِ مجوز رد می‌شود', async () => {
    const { staffId, tenantId } = await staffWithoutPermissionRow();
    await assert.rejects(
      () => requirePermission({ sub: staffId, kind: 'staff', tenantId, role: 'staff' } as never,
                              'canViewRevenue'),
      /FORBIDDEN|دسترسی/i,
      'پیش‌فرضِ canViewRevenue در SAFE_DEFAULTS برابرِ false است — '
      + 'نبودِ رکورد نباید به fail-open تبدیل شود',
    );
  });

  test('کلیدِ عملیاتی (canManageReservations) بدونِ رکورد عبور می‌کند — کنترلِ مثبت', async () => {
    const { staffId, tenantId } = await staffWithoutPermissionRow();
    await requirePermission(
      { sub: staffId, kind: 'staff', tenantId, role: 'staff' } as never,
      'canManageReservations',
    );
    // ⚠️ این کنترلِ مثبت عمدی است: بدونِ آن، گاردی که **همه چیز** را رد کند
    // هم تستِ بالا را پاس می‌کرد و ما متوجه نمی‌شدیم.
  });
});

describe('P5 — principalِ غیرstaff نباید هرگز به ارزیابیِ مجوز برسد', () => {
  test('توکنِ مشتری با subِ برابرِ یک ownerِ فعال هم رد می‌شود', async () => {
    const t = await db.tenant.create({ data: { name: `[DEMO] perm-principal ${SFX}` } });
    made.tenantIds.push(t.id);
    const owner = await db.staff.create({
      data: { tenantId: t.id, phone: fixturePhone('0962'), role: 'owner', isActive: true },
      select: { id: true },
    });

    // کنترلِ مثبت: همان sub به‌عنوانِ staff عبور می‌کند (پس ردِ زیر واقعاً
    // به‌خاطرِ `kind` است، نه چون رکورد پیدا نمی‌شود).
    await requirePermission(
      { sub: owner.id, kind: 'staff', tenantId: t.id, role: 'owner' } as never,
      'canManageSettings',
    );

    await assert.rejects(
      () => requirePermission({ sub: owner.id, kind: 'customer' } as never, 'canManageSettings'),
      /FORBIDDEN|دسترسی/i,
      'principalِ مشتری نباید نقشِ staff را به ارث ببرد — گاردِ kind تنها چیزی '
      + 'است که جلویش را می‌گیرد، چون کوئریِ بعدی با tenantId=undefined به '
      + '«فقط id» فرو می‌ریزد',
    );
  });
});

after(async () => {
  await db.staffPermission.deleteMany({ where: { staff: { tenantId: { in: made.tenantIds } } } });
  await db.staff.deleteMany({ where: { tenantId: { in: made.tenantIds } } });
  await db.user.deleteMany({ where: { id: { in: made.userIds } } });
  await db.tenant.deleteMany({ where: { id: { in: made.tenantIds } } });
  await db.$disconnect();
});
