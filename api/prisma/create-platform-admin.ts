/**
 * ساختِ مدیرِ پلتفرم — idempotent، بدونِ دست‌زدن به هیچ دادهٔ دیگری.
 *
 * ⚠️ چرا جدا از `prisma/seed.ts`: آن اسکریپت یک seedِ **توسعه** است و داده‌ی
 * موجود را پاک و بازسازی می‌کند. اجرایش روی یک دیتابیسِ واقعی فاجعه است.
 * این یکی فقط یک ردیفِ staff را upsert می‌کند و هیچ‌چیزِ دیگری را لمس نمی‌کند.
 *
 * چرا لازم است: ورود به پنلِ شرکت دو شرطِ **مستقل** دارد و OTP فقط یکی از
 * آن‌هاست — `findPlatformAdmin` (lib/platform-admin.ts) باید شماره را با
 * `role: 'owner'` و `isActive: true` در تنانتِ `PLATFORM_ADMIN_TENANT_ID`
 * پیدا کند. بدونِ این ردیف، حتی OTPِ درست هم `۴۰۳` می‌گیرد.
 *
 * اجرا:
 *   cd api && npx tsx prisma/create-platform-admin.ts 09122079763 "نام مدیر"
 *
 * خروجی، مقدارِ `PLATFORM_ADMIN_TENANT_ID` را چاپ می‌کند تا در `.env` بگذارید.
 */
import { db } from '../src/lib/db';
import { normalizePhone } from '../src/lib/otp';

const PLATFORM_TENANT_NAME = 'شرکت رزرونو';

async function main() {
  const rawPhone = process.argv[2];
  const name = process.argv[3] ?? 'مدیر پلتفرم';

  if (!rawPhone) {
    console.error('استفاده: npx tsx prisma/create-platform-admin.ts <شماره> [نام]');
    process.exit(1);
  }

  let phone: string;
  try {
    phone = normalizePhone(rawPhone);
  } catch {
    console.error(`✗ شماره‌ی معتبری نیست: ${rawPhone} (مثال: 09123456789)`);
    process.exit(1);
  }

  // ── تنانتِ پلتفرم ──
  // اگر `PLATFORM_ADMIN_TENANT_ID` از قبل ست است، همان استفاده می‌شود تا
  // تنانتِ دومِ یتیم ساخته نشود. وگرنه اولین تنانتِ هم‌نام، وگرنه یکی تازه.
  const configured = process.env.PLATFORM_ADMIN_TENANT_ID;
  let tenant = configured
    ? await db.tenant.findUnique({ where: { id: configured }, select: { id: true, name: true } })
    : await db.tenant.findFirst({ where: { name: PLATFORM_TENANT_NAME }, select: { id: true, name: true } });

  if (configured && !tenant) {
    console.error(`✗ PLATFORM_ADMIN_TENANT_ID=${configured} در دیتابیس نیست. یا مقدارش را درست کنید یا از .env برش دارید تا ساخته شود.`);
    process.exit(1);
  }
  if (!tenant) {
    tenant = await db.tenant.create({
      data: { name: PLATFORM_TENANT_NAME, plan: 'pro' },
      select: { id: true, name: true },
    });
    console.log(`→ تنانتِ پلتفرم ساخته شد: ${tenant.name}`);
  } else {
    console.log(`→ تنانتِ پلتفرمِ موجود استفاده شد: ${tenant.name}`);
  }

  // ── ردیفِ staff ──
  // اسکیما `@@unique([tenantId, phone])` دارد، پس upsert روی همان کلید امن است.
  // اگر ردیف از قبل بود ولی غیرفعال یا با نقشِ پایین‌تر، به owner/فعال ارتقا
  // می‌یابد — همان چیزی که `findPlatformAdmin` می‌خواهد.
  const staff = await db.staff.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone } },
    create: { tenantId: tenant.id, phone, name, role: 'owner', isActive: true },
    update: { role: 'owner', isActive: true },
    select: { id: true, phone: true, role: true, isActive: true },
  });

  const masked = phone.slice(0, 6) + '***' + phone.slice(-2);
  console.log(`✓ مدیرِ پلتفرم آماده است: ${masked} · نقش ${staff.role} · فعال ${staff.isActive}`);
  console.log('');
  console.log('در `.env` این را بگذارید (اگر از قبل نیست):');
  console.log(`  PLATFORM_ADMIN_TENANT_ID=${tenant.id}`);
}

main()
  .catch((e) => { console.error('✗ شکست:', e); process.exit(1); })
  .finally(() => db.$disconnect());
