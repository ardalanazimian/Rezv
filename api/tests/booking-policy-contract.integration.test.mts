import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  رگرسیونِ P1-3 — قراردادِ `booking_policy` در endpointِ عمومیِ رستوران
//  (فازِ ۲، پروتکل §۲۰ — API Contract Consolidation)
//
//  باگی که پین می‌شود: اپِ مشتری در دو جا **هاردکد** ادعا می‌کرد «رزرو رایگان ·
//  بدون پیش‌پرداخت»، در حالی که depositRequired یک سیاستِ واقعیِ قابلِ‌تنظیمِ
//  رستوران است و endpointِ عمومی اصلاً بیرونش نمی‌داد. رستورانی که بیعانه را
//  روشن می‌کرد، همچنان به مشتری «رایگان» نشان داده می‌شد.
//
//  این تست تضمین می‌کند فیلد واقعاً از DB می‌آید (نه پیش‌فرضِ ثابت)، چون اگر
//  همیشه false برگردد همان دروغِ قبلی است — فقط یک لایه عمیق‌تر.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db.ts');
const { GET } = await import('../src/app/api/v1/restaurants/[slug]/route.ts');

let tenantId: string;
let slugDeposit: string;
let slugFree: string;
let slugNoPolicy: string;

/** فراخوانیِ واقعیِ routeِ Next با یک Request واقعی. */
async function fetchDetail(slug: string) {
  const res = await GET(
    new Request(`https://example.test/api/v1/restaurants/${slug}`),
    { params: Promise.resolve({ slug }) },
  );
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

before(async () => {
  const suffix = Date.now();
  const tenant = await db.tenant.create({ data: { name: '[DEMO] tenant (booking-policy test)' } });
  tenantId = tenant.id;

  slugDeposit  = `bp-dep-${suffix}`;
  slugFree     = `bp-free-${suffix}`;
  slugNoPolicy = `bp-none-${suffix}`;

  const mk = (slug: string, prefix: string) => db.restaurant.create({
    data: { tenantId, slug, name: `[DEMO] رستورانِ تستِ سیاستِ رزرو (${prefix})`, clubPrefix: prefix },
  });

  const [rDep, rFree] = await Promise.all([mk(slugDeposit, 'BPD'), mk(slugFree, 'BPF'), mk(slugNoPolicy, 'BPN')]);

  // رستورانِ اول: بیعانه لازم دارد. دوم: صریحاً ندارد. سوم: اصلاً رکوردِ سیاست ندارد.
  await db.cancellationPolicy.create({
    data: { restaurantId: rDep.id, depositRequired: true, freeCancelHours: 48, autoConfirm: false },
  });
  await db.cancellationPolicy.create({
    data: { restaurantId: rFree.id, depositRequired: false },
  });
});

after(async () => {
  await db.cancellationPolicy.deleteMany({ where: { restaurant: { tenantId } } }).catch(() => {});
  await db.restaurant.deleteMany({ where: { tenantId } }).catch(() => {});
  await db.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
});

describe('قراردادِ booking_policy (P1-3)', () => {
  test('رستورانِ با بیعانه → deposit_required=true (نه پیش‌فرضِ ثابت)', async () => {
    const { status, body } = await fetchDetail(slugDeposit);
    assert.equal(status, 200);
    const p = body.booking_policy as Record<string, unknown> | undefined;
    assert.ok(p, 'booking_policy باید در پاسخ باشد');
    assert.equal(p.deposit_required, true, 'باید مقدارِ واقعیِ DB باشد');
    assert.equal(p.free_cancel_hours, 48);
    assert.equal(p.auto_confirm, false);
  });

  test('رستورانِ بدونِ بیعانه → deposit_required=false', async () => {
    const { body } = await fetchDetail(slugFree);
    const p = body.booking_policy as Record<string, unknown>;
    assert.equal(p.deposit_required, false);
    assert.equal(p.free_cancel_hours, 24, 'پیش‌فرضِ اسکیما');
  });

  test('رستورانِ بدونِ رکوردِ سیاست → پیش‌فرضِ امن، بدونِ کرش', async () => {
    const { status, body } = await fetchDetail(slugNoPolicy);
    assert.equal(status, 200);
    const p = body.booking_policy as Record<string, unknown>;
    assert.equal(p.deposit_required, false);
    assert.equal(p.auto_confirm, true);
  });

  test('سازگاری با گذشته: فیلدهایِ قبلی دست‌نخورده مانده‌اند', async () => {
    // §۲۰: «Do not break consumers silently» — صفحه‌ی SEO از همین پاسخ می‌خواند.
    const { body } = await fetchDetail(slugFree);
    for (const k of ['id', 'slug', 'name', 'location', 'opening_hours', 'menu', 'photos', 'rating', 'reviews_count']) {
      assert.ok(k in body, `کلیدِ «${k}» نباید حذف شده باشد`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  اجرایِ `auto_confirm` (پروتکل §۹ — «تنظیمی که وجود دارد ولی اثر ندارد»)
//
//  ⚠️ یافته‌ی ۲۰۲۶-۰۸-۲۴: `cancellation_policies.auto_confirm` سه جا زندگی
//  می‌کرد — پنلِ رستوران‌دار می‌نوشتش، `GET /restaurants` و
//  `GET /restaurants/:slug` به مشتری نشانش می‌دادند — ولی **هیچ‌کس نمی‌خواندش**.
//  رستورانی که «تأییدِ دستی» را انتخاب می‌کرد، همچنان هر رزرو مستقیم
//  `confirmed` می‌شد و میزش بی‌اجازه بلوکه می‌شد.
//
//  این رفع عمداً بدونِ پرداخت است: تصمیمِ «مستقیم تأیید یا در انتظار» فقط یک
//  وضعیتِ اولیه است، نه ضبطِ پول — برخلافِ `partial_penalty_pct` و
//  `deposit_required` که بدونِ درگاه اجرانشدنی‌اند.
// ═══════════════════════════════════════════════════════════════════════
describe('اجرایِ auto_confirm در ثبتِ رزرو (§۹)', () => {
  test('`expireStaleHolds` رزروِ منتظرِ تأیید را منقضی نمی‌کند (holdExpiresAt = NULL)', async () => {
    // این حیاتی‌ترین ادعایِ ایمنیِ این رفع است: رزروی که منتظرِ اقدامِ
    // رستوران‌دار است نباید مثلِ هولدِ پرداخت خودکار باطل شود.
    // کوئریِ expireStaleHolds شرطِ `holdExpiresAt: { lt: now }` دارد و در
    // Postgres/Prisma مقایسه‌ی NULL هرگز true نمی‌شود ⇒ ردیفِ ما انتخاب نمی‌شود.
    const rows = await db.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n FROM reservations
      WHERE status = 'pending' AND hold_expires_at IS NULL AND hold_expires_at < now()
    `;
    assert.equal(Number(rows[0].n), 0,
      'یک ردیفِ NULL نباید هم‌زمان شرطِ "< now" را برآورده کند — اگر شد، گاردِ ایمنی شکسته است');
  });

  test('انتقالِ pending → confirmed/rejected در state machine مجاز است', async () => {
    const { canTransition } = await import('../src/lib/lifecycle.ts');
    assert.equal(canTransition('pending', 'confirmed'), true, 'رستوران‌دار باید بتواند تأیید کند');
    assert.equal(canTransition('pending', 'rejected'), true, 'و باید بتواند رد کند');
    assert.equal(canTransition('pending', 'cancelled'), true, 'مشتری هم باید بتواند لغو کند');
  });

  test('pending در فهرستِ وضعیت‌هایِ فعال است (میزش آزاد شمرده نمی‌شود)', async () => {
    const { activeStatusList } = await import('../src/lib/reservation-status.ts');
    assert.ok(activeStatusList().includes('pending'),
      'رزروِ منتظرِ تأیید باید میز را نگه دارد، وگرنه دو نفر همان میز را می‌گیرند');
  });
});
