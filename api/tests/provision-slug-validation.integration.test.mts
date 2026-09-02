import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixturePhone } from './_phone.helper.mts';

process.env.JWT_SECRET ??= 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);

// ═══════════════════════════════════════════════════════════════════════
//  الگویِ slug واقعاً اجرا می‌شود — نه فقط طولش
//
//  ⚠️ چرا این فایل ساخته شد (نمونه‌گیریِ جهش V2، ۲۰۲۶-۰۸-۲۹): جهشِ
//      if (!SLUG_RE.test(input.slug)) …   →   if (!input.slug) …
//  از همه‌ی تست‌های provisioning سالم رد شد.
//
//  و این‌بار **افزونگی نبود** (برخلافِ R4 و V1). دنبالِ لایه‌ی دوم گشتم:
//    • هیچ CHECK constraintی رویِ slug در دیتابیس نیست (فقط یکتایی).
//    • شِیمِ routeِ ادمین (`admin/restaurants/route.ts:68`) فقط
//      `z.string().trim().max(40).optional()` است — **نه charset، نه حداقلِ
//      طول**.
//  یعنی با آن جهش، `AB` یا `Bad Slug!` یا `../../etc` پذیرفته می‌شد و در
//  دیتابیس می‌نشست. slug در URLِ عمومیِ رستوران می‌آید، پس این فقط زشتی
//  نیست.
//
//  `SLUG_RE = /^[a-z0-9-]{3,40}$/` — هر چهار بُعدش این‌جا پین می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const { db } = await import('../src/lib/db');
const { provisionBusiness } = await import('../src/lib/provisioning');

const SFX = String(Date.now()).slice(-8);
const madeTenants: string[] = [];
const actor = { adminId: '00000000-0000-0000-0000-000000000001', ip: '127.0.0.1' };

let phoneSeq = 0;
function input(slug: string) {
  phoneSeq += 1;
  return {
    businessName: `[DEMO] اعتبارسنجیِ slug ${SFX}-${phoneSeq}`,
    ownerPhone: fixturePhone(String(980 + phoneSeq).padStart(4, '0')),
    ownerName: '[DEMO] مالک',
    slug,
    seedTables: 0,
  };
}

describe('اعتبارسنجیِ slug در provisionBusiness', () => {
  // هر ردیف یک بُعدِ متفاوتِ SLUG_RE را می‌شکند — تا جهشِ **جزئی** هم گرفته
  // شود، نه فقط برداشتنِ کاملِ گارد.
  const BAD: Array<[string, string]> = [
    ['حروفِ بزرگ', 'BadSlug'],
    ['کوتاه‌تر از ۳ کاراکتر', 'ab'],
    ['فاصله', 'bad slug'],
    ['کاراکترِ مسیر', '../etc'],
    ['زیرخط (خارج از مجموعه‌ی مجاز)', 'bad_slug'],
    ['حروفِ غیرلاتین', 'رستوران'],
  ];

  for (const [label, slug] of BAD) {
    test(`رد می‌شود: ${label} (${slug})`, async () => {
      await assert.rejects(
        () => provisionBusiness(input(slug), actor),
        (e: any) => {
          assert.equal(e?.status, 422,
            `باید خطای اعتبارسنجی بدهد — گرفت: ${e?.status} / ${e?.code}`);
          assert.match(String(e?.message ?? ''), /slug/,
            'پیام باید به slug اشاره کند');
          return true;
        },
      );
    });
  }

  test('کنترلِ مثبت: slugِ معتبر پذیرفته می‌شود و همان مقدار ذخیره می‌شود', async () => {
    // بدونِ این، گاردی که **هر** slugی را رد کند هم شش تستِ بالا را پاس
    // می‌کرد و ما یک قابلیتِ کاملاً مرده را «امن» می‌خواندیم.
    const slug = `demo-slug-ok-${SFX}`;
    const res = await provisionBusiness(input(slug), actor);
    madeTenants.push(res.tenantId);

    const row = await db.restaurant.findUnique({ where: { slug }, select: { slug: true } });
    assert.ok(row, 'رستوران باید با همان slug ساخته شده باشد');
    assert.equal(row.slug, slug, 'slug نباید بی‌صدا بازنویسی شود');
  });
});

after(async () => {
  // ⚠️ بدونِ .catch(()=>{}) و با ترتیبِ FK. نسخه‌ی قبلی خطای پاک‌سازی را می‌بلعید:
  // provision برایِ رستوران **میز** می‌سازد، `restaurant.deleteMany` رویِ
  // `tables_restaurant_id_fkey` می‌شکست، و تنانت در DBِ تست می‌ماند — در ۶ روز
  // ۷۶ تنانتِ [DEMO] از این و ۵۰ فایلِ مشابه انباشته شد (شمارشِ ۲۰۲۶-۰۹-۰۲).
  // پاک‌سازی‌ای که بی‌صدا شکست بخورد، اندازه‌گیریِ بعدی را مسموم می‌کند.
  for (const t of madeTenants) {
    await db.table.deleteMany({ where: { restaurant: { tenantId: t } } });
    await db.staffInvite.deleteMany({ where: { restaurant: { tenantId: t } } });
    await db.auditLog.deleteMany({ where: { restaurant: { tenantId: t } } });
    await db.staff.deleteMany({ where: { tenantId: t } });
    await db.restaurant.deleteMany({ where: { tenantId: t } });
    await db.tenant.deleteMany({ where: { id: t } });
  }
  await db.$disconnect();
});
