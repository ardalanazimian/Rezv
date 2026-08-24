import { verifyAccess } from './jwt';
import { db } from './db';
import { Err } from './errors';

/**
 * احراز هویت مدیر پلتفرم (پنل شرکت).
 * مدیر پلتفرم = یک staff با role='owner' که به tenant پلتفرم تعلق دارد.
 * tenant پلتفرم از env تعیین می‌شود (PLATFORM_ADMIN_TENANT_ID).
 *
 * ⚠️ امنیت (C2): اگر PLATFORM_ADMIN_TENANT_ID تنظیم نشده باشد، دسترسی رد می‌شود
 * (fail-closed). قبلاً اگر این env غایب بود، چک tenant کلاً نادیده گرفته می‌شد و
 * «هر» صاحب رستورانی به پنل شرکت/پلتفرم دسترسی پیدا می‌کرد (نشت کامل عایق‌بندی
 * multi-tenant). حالا نبودِ پیکربندی = هیچ‌کس دسترسی ندارد، نه همه.
 *
 * ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۱، ممیزیِ گاردهای بدونِ تست): این تابع **هیچ
 * کوئریِ دیتابیسی نداشت** — فقط JWT را باور می‌کرد. یعنی وقتی مدیرِ پلتفرمی
 * غیرفعال یا حذف می‌شد، تا انقضایِ توکنِ فعلی‌اش (۱۵ دقیقه) **کلِ دسترسیِ
 * پنلِ شرکت را نگه می‌داشت** — بالاترین سطحِ دسترسیِ سامانه، روی ۴۶ نقطه‌ی
 * فراخوانی.
 *
 * نکته‌ی تلخِ این یافته: همین شکاف یک طبقه پایین‌تر (پنلِ رستوران) در PR #57
 * بسته شده بود — `staff-helpers.ts` عضویتِ تنانت و `isActive` را چک می‌کند.
 * ولی همان چکْ در سطحِ *بالاتر* اضافه نشد.
 *
 * پنجره عمداً محدود بود، نه باز: مسیرِ `/auth/refresh` فعال‌بودنِ کارمند را
 * چک می‌کند و کارمندِ غیرفعال نمی‌تواند توکنِ تازه بگیرد. پس نهایتِ نفوذ
 * باقی‌مانده‌ی عمرِ همان توکنِ ۱۵ دقیقه‌ای بود — واقعی ولی کران‌دار.
 *
 * ── چرا اسمِ تابع عوض شد ──
 * تبدیل به `async` بدونِ تغییرِ نام **خطرناک** بود: ۲۳ نقطه از ۴۶ نقطه‌ی
 * فراخوانی نتیجه را استفاده نمی‌کنند (`adminAuthFromRequest(req);` تنها در
 * یک خط). این‌ها با async شدن به یک Promiseِ رهاشده تبدیل می‌شدند و گارد
 * **بی‌صدا از کار می‌افتاد** — بدترین حالتِ ممکن برای یک چکِ امنیتی. پروژه
 * قاعده‌ی eslintِ `no-floating-promises` هم ندارد که بگیردش (چک شد).
 *
 * با تغییرِ نام، TypeScript روی هر ۴۶ نقطه خطا می‌دهد و هیچ‌کدام نمی‌تواند
 * از قلم بیفتد.
 */
export async function requireAdmin(req: Request): Promise<{ sub: string; tenantId: string }> {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) throw Err.unauthorized();
  const payload = verifyAccess(h.slice(7));
  if (payload.kind !== 'staff' || payload.role !== 'owner') {
    throw Err.forbidden('دسترسی مدیر پلتفرم لازم است');
  }
  const platformTenant = process.env.PLATFORM_ADMIN_TENANT_ID;
  // fail-closed: بدون پیکربندی tenant پلتفرم، هیچ دسترسی admin داده نمی‌شود.
  if (!platformTenant) {
    throw Err.forbidden('پنل شرکت پیکربندی نشده است');
  }
  if (payload.tenantId !== platformTenant) {
    throw Err.forbidden('این حساب دسترسی پنل شرکت ندارد');
  }

  // ── حقیقت از دیتابیس، نه از توکن ──
  // توکن عکسِ لحظه‌ی صدور است؛ این کوئری وضعیتِ *الان* را می‌پرسد. یک lookupِ
  // PKِ ایندکس‌شده روی پنلی که ترافیکش کم است — بهایِ ناچیزی برای بستنِ
  // پنجره‌ی ۱۵ دقیقه‌ایِ بالاترین سطحِ دسترسی.
  const staff = await db.staff.findUnique({
    where: { id: payload.sub },
    select: { tenantId: true, role: true, isActive: true },
  });
  // حذف‌شده → دسترسی ندارد. توکنِ معتبرِ یک ردیفِ ناموجود بی‌معناست.
  if (!staff) throw Err.forbidden('این حساب دیگر وجود ندارد');
  if (!staff.isActive) throw Err.forbidden('این حساب غیرفعال شده است');
  // نقش/تنانت ممکن است بعد از صدورِ توکن عوض شده باشد — دوباره از منبع بخوان.
  if (staff.role !== 'owner') throw Err.forbidden('دسترسی مدیر پلتفرم لازم است');
  if (staff.tenantId !== platformTenant) throw Err.forbidden('این حساب دسترسی پنل شرکت ندارد');

  return { sub: payload.sub, tenantId: staff.tenantId };
}
