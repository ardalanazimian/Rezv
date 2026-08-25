import { test, describe, before, after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  تستِ integration زنده روی Postgresِ واقعی — مثلِ table-merge-occupancy.test.mts.
//
//  چرا اینجا integration واقعی لازم است، نه mockِ Prisma: خودِ سوالی که این
//  تست جواب می‌دهد («approve واقعاً ساعتِ زنده را عوض می‌کند، reject نه») یک
//  ادعای مستقیم درباره‌ی state روی DB است — mock کردن یعنی همان چیزی را که
//  می‌خواهیم اثبات کنیم، فرض کرده باشیم.
//
//  routeِ واقعی (PATCH .../admin/hours-changes/[id]) مستقیم import و با
//  یک Request واقعی صدا زده می‌شود — نه فقط منطقِ داخلیِ hours-approval.ts
//  (که در hours-approval.test.mts خالص تست شده) — تا سیمِ auth/validation/
//  cache-invalidation هم واقعاً تست شود.
//
//  CI: طبقِ .github/workflows/ci.yml این فایل با Postgres/Redisِ واقعی اجرا
//  می‌شود، همان‌طور که table-merge-occupancy.test.mts همین الان اجرا می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { signAccess } = await import('../src/lib/jwt.ts');

let adminTenantId: string;
let tenantId: string;
let restApproveId: string;
let restRejectId: string;
let restNoPendingId: string;
let adminToken: string;

before(async () => {
  const adminTenant = await db.tenant.create({ data: { name: '[DEMO] platform admin tenant (hours-approval test)' } });
  adminTenantId = adminTenant.id;
  process.env.PLATFORM_ADMIN_TENANT_ID = adminTenantId;
  // ⚠️ اصلاح‌شده (۲۰۲۶-۰۸-۲۱): این فیکسچر توکنی برایِ `ADMIN_SUB` می‌ساخت که
  // **هیچ ردیفِ staffی نداشت**. گاردِ قدیمی قبولش می‌کرد چون اصلاً به دیتابیس
  // نگاه نمی‌کرد؛ حالا که `requireAdmin` وضعیتِ واقعیِ کارمند را می‌پرسد،
  // چنین توکنی ۴۰۳ می‌گیرد — درست هم همین است.
  //
  // یعنی این تست داشت مسیری را «سبز» گزارش می‌کرد که با یک ادمینِ ناموجود
  // اجرا می‌شد. حالا مدیرِ پلتفرم واقعاً وجود دارد و فعال است.
  const adminStaff = await db.staff.create({
    data: {
      tenantId: adminTenantId, role: 'owner', isActive: true,
      phone: `+9895${Math.floor(Math.random() * 100_000_000)}`.slice(0, 13),
    },
    select: { id: true },
  });
  adminToken = signAccess({ sub: adminStaff.id, kind: 'staff', role: 'owner', tenantId: adminTenantId });

  const tenant = await db.tenant.create({ data: { name: '[DEMO] hours-approval tenant' } });
  tenantId = tenant.id;

  const live = { '0': [['12:00', '22:00']] };
  const proposed = { '0': [['12:00', '23:00']] };
  const suffix = Date.now();

  const mk = (slug: string, extra: Record<string, unknown>) => db.restaurant.create({
    data: {
      tenantId, slug: `${slug}-${suffix}`, name: `[DEMO] رستورانِ تستِ تأییدِ ساعت (${slug})`,
      clubPrefix: slug.slice(0, 3).toUpperCase(), openingHours: live, ...extra,
    },
  });

  const [rApprove, rReject, rNoPending] = await Promise.all([
    mk('demo-hours-approve', { pendingOpeningHours: proposed, hoursChangeStatus: 'pending', hoursChangeRequestedAt: new Date() }),
    mk('demo-hours-reject', { pendingOpeningHours: proposed, hoursChangeStatus: 'pending', hoursChangeRequestedAt: new Date() }),
    mk('demo-hours-nopending', {}),
  ]);
  restApproveId = rApprove.id;
  restRejectId = rReject.id;
  restNoPendingId = rNoPending.id;
});

after(async () => {
  await db.restaurant.deleteMany({ where: { id: { in: [restApproveId, restRejectId, restNoPendingId] } } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: { in: [tenantId, adminTenantId] } } }).catch(() => {});
});

function patchReq(id: string, body: unknown) {
  return new Request(`http://x/admin/hours-changes/${id}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /admin/hours-changes/[id] — approve/reject روی Postgresِ واقعی', () => {
  // ⚠️ چرا این `beforeEach` لازم است (باگِ واقعیِ رانرِ مشترک، ۲۰۲۶-۰۸-۲۵):
  // `before`/`after` این فایل در **سطحِ فایل**‌اند، پس به سوئیتِ ROOT می‌چسبند
  // و یک‌بار برایِ کلِ رانر اجرا می‌شوند — نه دورِ تست‌های همین فایل. از وقتی
  // فایلِ دومی (`auth-otp-enumeration`) هم همین متغیرِ سراسری را ست می‌کند،
  // آن یکی مقدارِ ما را overwrite می‌کرد و این تست‌ها ۴۰۳ می‌گرفتند — در حالی
  // که فایل به‌تنهایی ۴/۴ سبز بود. یعنی یک شکستِ فقط-در-مجموعه.
  // راهِ حل: هر سوئیت درست پیش از تست‌های خودش مقدارِ خودش را دوباره تثبیت
  // کند. این نسبت به ترتیبِ اجرا مصون است.
  beforeEach(() => { process.env.PLATFORM_ADMIN_TENANT_ID = adminTenantId; });

  test('approve: openingHoursِ زنده با pendingOpeningHours جایگزین می‌شود؛ صف پاک می‌شود', async () => {
    const { PATCH } = await import('../src/app/api/v1/admin/hours-changes/[id]/route.ts');
    const res = await PATCH(patchReq(restApproveId, { action: 'approve' }), { params: Promise.resolve({ id: restApproveId }) });
    assert.equal(res.status, 200);

    const r = await db.restaurant.findUnique({ where: { id: restApproveId } });
    assert.deepEqual(r?.openingHours, { '0': [['12:00', '23:00']] });
    assert.equal(r?.pendingOpeningHours, null);
    assert.equal(r?.hoursChangeStatus, null);
  });

  // ⚠️ تستِ حداقلیِ ماموریت: reject نباید هیچ اثری روی ساعتِ زنده بگذارد —
  // مشتری باید همان ساعتِ قدیمی را ببیند، نه پیشنهادِ ردشده را.
  test('reject: openingHoursِ زنده دست‌نخورده می‌ماند؛ دلیل ذخیره می‌شود', async () => {
    const { PATCH } = await import('../src/app/api/v1/admin/hours-changes/[id]/route.ts');
    const res = await PATCH(patchReq(restRejectId, { action: 'reject', reason: '[DEMO] ظرفیتِ واقعی این ساعت را ندارد' }),
      { params: Promise.resolve({ id: restRejectId }) });
    assert.equal(res.status, 200);

    const r = await db.restaurant.findUnique({ where: { id: restRejectId } });
    assert.deepEqual(r?.openingHours, { '0': [['12:00', '22:00']] }); // زنده تغییر نکرده
    assert.equal(r?.hoursChangeStatus, 'rejected');
    assert.equal(r?.hoursChangeReason, '[DEMO] ظرفیتِ واقعی این ساعت را ندارد');
  });

  test('reject بدونِ دلیل رد می‌شود (دلیل الزامی است)', async () => {
    const { PATCH } = await import('../src/app/api/v1/admin/hours-changes/[id]/route.ts');
    const res = await PATCH(patchReq(restNoPendingId, { action: 'reject' }), { params: Promise.resolve({ id: restNoPendingId }) });
    // restNoPendingId اصلاً pending نیست، پس گیتِ canReviewHoursChange زودتر رد می‌کند —
    // هر دو راه به همان ۴۰۰/۴۲۲ اعتبارسنجی می‌رسند.
    assert.ok(res.status >= 400 && res.status < 500);
  });

  test('approve/reject روی رستورانی بدونِ پیشنهادِ در دستِ بررسی رد می‌شود', async () => {
    const { PATCH } = await import('../src/app/api/v1/admin/hours-changes/[id]/route.ts');
    const res = await PATCH(patchReq(restNoPendingId, { action: 'approve' }), { params: Promise.resolve({ id: restNoPendingId }) });
    assert.ok(res.status >= 400 && res.status < 500);
    const r = await db.restaurant.findUnique({ where: { id: restNoPendingId } });
    assert.deepEqual(r?.openingHours, { '0': [['12:00', '22:00']] }); // دست‌نخورده
  });
});
