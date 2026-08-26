import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withStaffAuth } from '@/lib/with-restaurant-auth';
import { clientIp } from '@/lib/ratelimit';
import { Err } from '@/lib/errors';
import { parseBody, zUsername, zPassword, z } from '@/lib/schemas';
import {
  hashPassword, normalizeUsername, passwordPolicyError, usernamePolicyError, verifyPassword,
} from '@/lib/password';
import { audit } from '@/lib/audit';

const schema = z.object({
  current_password: zPassword.optional(),
  new_password: zPassword,
  username: zUsername.optional(),
});

/**
 * POST /api/v1/restaurant/staff/password — کارمند رمزِ **خودش** را عوض می‌کند.
 *
 * ⚠️ چرا `current_password` شرطی است و نه همیشه اجباری:
 *  • اگر حساب از قبل رمز دارد ⇒ **اجباری**. توکنِ معتبر به‌تنهایی کافی
 *    نیست: توکن می‌تواند دزدیده شده باشد (لپ‌تاپِ باز، XSS) و بدونِ این
 *    شرط مهاجم رمز را عوض می‌کرد و مالکِ واقعی را برای همیشه بیرون
 *    می‌گذاشت. با این شرط، دزدیِ توکن یک پنجره‌ی ۱۵ دقیقه‌ای می‌ماند نه
 *    یک تصاحبِ دائمی.
 *  • اگر حساب هنوز رمز ندارد (تا امروز فقط با OTP وارد می‌شده) ⇒ اختیاری.
 *    چیزی برای اثبات وجود ندارد و خودِ ورود با OTP احرازِ هویتِ کافی بوده.
 *
 * ⚠️ `withStaffAuth` عمدی است نه `withRestaurantAuth`: آن wrapper نقش و
 * `isActive` را از **دیتابیس** تازه می‌کند، و تغییرِ رمز حساس‌تر از آن است
 * که به عکسِ لحظه‌ی صدورِ توکن تکیه کند.
 */
export const POST = withStaffAuth({ rateLimit: 'auth' }, async (req, auth) => {
  if (auth.kind !== 'staff') throw Err.forbidden();
  const b = await parseBody(req, schema);

  const pErr = passwordPolicyError(b.new_password);
  if (pErr) throw Err.validation(pErr);

  const me = await db.staff.findUnique({
    where: { id: auth.sub },
    select: { id: true, passwordHash: true, username: true, tenantId: true },
  });
  if (!me) throw Err.forbidden();

  if (me.passwordHash) {
    const ok = b.current_password
      ? await verifyPassword(b.current_password, me.passwordHash)
      : false;
    if (!ok) throw Err.validation('رمز فعلی اشتباه است');
  }

  const data: { passwordHash: string; passwordUpdatedAt: Date; username?: string } = {
    passwordHash: await hashPassword(b.new_password),
    passwordUpdatedAt: new Date(),
  };

  // نام کاربری فقط وقتی می‌تواند ست شود که حساب هنوز ندارد — تغییرِ نامِ
  // کاربریِ موجود مسیرِ ورود را برای صاحبش می‌شکند و باید کارِ مدیرِ
  // پلتفرم باشد، نه یک عملیاتِ جانبیِ تغییرِ رمز.
  if (b.username !== undefined) {
    if (me.username) throw Err.validation('نام کاربری قابل تغییر نیست؛ با پشتیبانی تماس بگیرید');
    const uErr = usernamePolicyError(b.username);
    if (uErr) throw Err.validation(uErr);
    const username = normalizeUsername(b.username);
    const taken = await db.staff.findUnique({ where: { username }, select: { id: true } });
    if (taken && taken.id !== me.id) throw Err.validation('این نام کاربری قبلاً گرفته شده است');
    data.username = username;
  }

  const updated = await db.staff.update({
    where: { id: me.id }, data, select: { id: true, username: true },
  });

  await audit({
    action: 'staff.password_change', actorId: me.id, actorType: 'staff', ip: clientIp(req),
    detail: { tenant_id: me.tenantId, username: updated.username, username_set: b.username !== undefined },
  });

  return NextResponse.json({ ok: true, username: updated.username });
});
