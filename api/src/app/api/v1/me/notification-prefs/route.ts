import { NextResponse } from 'next/server';
import { authFromRequest } from '@/lib/jwt';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';
import { NOTIFICATION_CATEGORIES, readNotificationPrefs } from '@/lib/notification-prefs';

// ═══════════════════════════════════════════════════════════════════════
//  ترجیحاتِ اعلانِ کاربر — پایدار سمتِ سرور (پروتکل §۱۳ و §۱۷)
//
//  ⚠️ چرا اضافه شد: اپِ مشتری از قبل پنج کلیدِ ترجیح داشت، ولی `setNotifPref`
//  آن‌ها را **فقط در localStorage** می‌نوشت. سمتِ سرور هیچ مفهومی از رضایت
//  وجود نداشت (تأییدشده با grep). یعنی کاربری که «تخفیف و کش‌بک ویژه» را
//  خاموش می‌کرد همچنان پیامکِ کمپین می‌گرفت، و انتخابش با پاک‌شدنِ حافظه‌ی
//  مرورگر برایِ همیشه از بین می‌رفت.
//
//  قرارداد عمداً «فقط انصرافِ صریح» است: کلیدِ غایب یعنی کاربر نظری نداده و
//  رفتارِ فعلی (دریافت) ادامه پیدا می‌کند. این‌طور هیچ کاربرِ موجودی بی‌صدا
//  از دریافتِ یادآوریِ رزروش محروم نمی‌شود.
// ═══════════════════════════════════════════════════════════════════════

// فقط دسته‌هایِ شناخته‌شده در schema اعلام می‌شوند؛ کلیدِ ناشناس (مثلاً از یک
// کلاینتِ خراب) در parse حذف می‌شود و **هرگز در ستون نمی‌نشیند** — تأییدشده
// با فراخوانِ زنده رویِ سرورِ واقعی. ستون آلوده نمی‌شود.
const bodySchema = z.object(
  Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, z.boolean().optional()])),
);

/** GET /api/v1/me/notification-prefs — ترجیحاتِ فعلی (کلیدهایِ غایب = پیش‌فرضِ دریافت). */
export async function GET(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    const user = await db.user.findUnique({
      where: { id: auth.sub },
      select: { notificationPrefs: true },
    });
    if (!user) throw Err.notFound('کاربر');
    return NextResponse.json({ prefs: readNotificationPrefs(user.notificationPrefs) });
  } catch (e) { return errorResponse(e); }
}

/** PATCH /api/v1/me/notification-prefs — به‌روزرسانیِ جزئی (merge، نه جایگزینی). */
export async function PATCH(req: Request) {
  try {
    const auth = authFromRequest(req);
    if (auth.kind !== 'customer') throw Err.forbidden();
    await enforceRateLimit(clientIp(req), RULES.auth);
    const patch = await parseBody(req, bodySchema);

    const current = await db.user.findUnique({
      where: { id: auth.sub },
      select: { notificationPrefs: true },
    });
    if (!current) throw Err.notFound('کاربر');

    // merge: فقط کلیدهایی که واقعاً فرستاده شده‌اند عوض می‌شوند. جایگزینیِ کامل
    // یعنی یک کلاینتِ قدیمی که دسته‌ی تازه را نمی‌شناسد، انصرافِ کاربر از آن
    // دسته را بی‌صدا پاک می‌کند.
    const merged = { ...readNotificationPrefs(current.notificationPrefs) };
    for (const [k, v] of Object.entries(patch)) {
      if (typeof v === 'boolean') merged[k] = v;
    }

    const user = await db.user.update({
      where: { id: auth.sub },
      data: { notificationPrefs: merged },
      select: { notificationPrefs: true },
    });
    return NextResponse.json({ prefs: readNotificationPrefs(user.notificationPrefs) });
  } catch (e) { return errorResponse(e); }
}
