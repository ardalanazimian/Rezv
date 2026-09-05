#!/usr/bin/env node
/**
 * ساخت یا به‌روزرسانیِ ردیفِ **مدیرِ پلتفرم** و چاپِ `PLATFORM_ADMIN_TENANT_ID`.
 *
 * ⚠️ چرا لازم شد (کاوشِ ۲۰۲۶-۰۸-۲۹): کوئریِ زنده نشان داد در دیتابیس هیچ
 * ردیفی با `role='owner'` و `tenant_id = PLATFORM_ADMIN_TENANT_ID` وجود ندارد
 * و خودِ آن متغیر هم در `.env` خالی است. یعنی حتی مسیرِ ورودِ رمزِ موجود هم
 * روی `fail-closed` خطِ ۴۷ می‌ایستد. بدونِ این اسکریپت، هیچ‌کس نمی‌تواند وارد
 * پنلِ شرکت شود.
 *
 * idempotent است: اگر ادمین وجود داشته باشد فقط رمزش به‌روز می‌شود.
 *
 *   node tools/admin-provision.mjs <username> '<scrypt-hash>'
 *
 * هش را از `tools/admin-hash-password.mjs` بگیر — رمزِ خام هرگز به این
 * اسکریپت داده نمی‌شود تا در `history` و `ps` نیفتد.
 */
import { PrismaClient } from '../api/node_modules/@prisma/client/index.js';

const [, , usernameRaw, hash] = process.argv;
const username = (usernameRaw || '').trim().toLowerCase();

if (!username || !hash) {
  console.error('استفاده: node tools/admin-provision.mjs <username> \'<scrypt-hash>\'');
  console.error('  هش را با `node tools/admin-hash-password.mjs` بساز.');
  process.exit(1);
}
if (!hash.startsWith('scrypt$')) {
  console.error('✗ هش معتبر نیست — باید با `scrypt$` شروع شود.');
  console.error('  رمزِ خام را این‌جا نده؛ اول admin-hash-password.mjs را اجرا کن.');
  process.exit(1);
}

const db = new PrismaClient();

// شماره‌ی نگهدارنده: ستونِ `phone` روی staff الزامی و یکتاست، ولی مدیرِ پلتفرم
// با رمز وارد می‌شود نه پیامک. یک شماره‌ی رزروشده‌ی غیرقابلِ‌تخصیص می‌گذاریم.
const PLACEHOLDER_PHONE = '+989000000000';

try {
  const existing = await db.staff.findUnique({
    where: { username },
    select: { id: true, tenantId: true, role: true, isActive: true },
  });

  let tenantId;
  let staffId;

  if (existing) {
    tenantId = existing.tenantId;
    staffId = existing.id;
    await db.staff.update({
      where: { id: existing.id },
      data: { passwordHash: hash, passwordUpdatedAt: new Date(), role: 'owner', isActive: true },
    });
    console.log('✓ ادمینِ موجود به‌روز شد — رمزِ تازه ست شد و حساب فعال است.');
  } else {
    const tenant = await db.tenant.create({
      data: { name: 'Rezervno — پلتفرم', plan: 'enterprise' },
      select: { id: true },
    });
    tenantId = tenant.id;
    const staff = await db.staff.create({
      data: {
        tenantId,
        phone: PLACEHOLDER_PHONE,
        name: 'مدیرِ پلتفرم',
        role: 'owner',
        isActive: true,
        username,
        passwordHash: hash,
        passwordUpdatedAt: new Date(),
      },
      select: { id: true },
    });
    staffId = staff.id;
    console.log('✓ تنانتِ پلتفرم و ادمین ساخته شدند.');
  }

  console.log('\n── این خط را در .env بگذار ──');
  console.log('PLATFORM_ADMIN_TENANT_ID=' + tenantId);
  console.log('\n  staff.id  = ' + staffId);
  console.log('  username  = ' + username);
  console.log('\n── قدمِ بعد ──');
  console.log('  node tools/admin-totp-secret.mjs ' + username);
} catch (e) {
  console.error('✗ ' + (e?.message || e));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
