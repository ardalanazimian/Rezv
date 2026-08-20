import { db } from './db';
import { Err } from './errors';
import type { AccessPayload } from './jwt';

/**
 * رستورانِ فعالِ این staff را پیدا می‌کند — با پشتیبانیِ چندشعبه‌ای.
 *
 * ⚠️ رفع باگ (migration 018_staff_branch_scoping بود ولی این تابع هرگز
 * به‌روز نشده بود): قبلاً همیشه findFirst روی کل تنانت می‌زد و restaurant_id
 * روی Staff را کاملاً نادیده می‌گرفت — یعنی چندشعبه‌ای عملاً کار نمی‌کرد
 * (همیشه اولین رستورانِ تنانت برمی‌گشت، صرف‌نظر از اینکه staff به کدام شعبه
 * قفل شده یا چه شعبه‌ای از پنل انتخاب کرده).
 *
 * منطق:
 *  • اگر staff.restaurantId ست شده باشد (قفل به یک شعبه‌ی خاص) → همان شعبه،
 *    صرف‌نظر از هدر X-Restaurant-Id (کارمندِ محدود نمی‌تواند شعبه عوض کند).
 *  • اگر NULL باشد (owner/manager — دسترسی همه‌ی شعبه‌ها) و هدر
 *    X-Restaurant-Id داده شده باشد → همان شعبه، فقط اگر واقعاً متعلق به
 *    همین تنانت باشد (جلوگیری از دسترسی متقاطع تنانت‌ها — IDOR).
 *  • در غیر این صورت → اولین رستورانِ تنانت (سازگاری با تنانت‌های تک‌شعبه‌ای).
 */
const RESTAURANT_SELECT = { id: true, name: true, slug: true, clubPrefix: true, cbBasePct: true, cbPreorderPct: true, cbVipPct: true, cbWinbackPct: true };

/**
 * «شعبه‌ی پیش‌فرض» یک تنانتِ چندشعبه‌ای — وقتی staff به شعبه‌ی خاصی قفل
 * نیست و هیچ انتخابِ صریحی (هدر) هم نیامده.
 *
 * ⚠️ رفعِ باگ (پیدا‌شده با تستِ واقعیِ end-to-end، نه فرض): این کوئری قبلاً
 * دو جای مختلف بود — اینجا و auth/staff/verify — هرکدام بدونِ orderBy
 * صریح، یعنی هیچ تضمینی نبود که یک ردیف را برگردانند. در عمل هم برنمی‌گرداندند:
 * لاگین یک شعبه را «رستورانِ شما» نشان می‌داد، ولی همه‌ی API callهای بعدی
 * (همین تابع) شعبه‌ی دیگری را برمی‌گرداندند — یعنی صاحبِ چندشعبه‌ای دیتای
 * شعبه‌ی اشتباه را می‌دید، بدونِ هیچ خطا یا نشانه‌ای. حالا هر دو مسیر از
 * همین یک تابع با orderBy ثابت (قدیمی‌ترین شعبه) استفاده می‌کنند.
 */
export async function defaultRestaurantForTenant(tenantId: string) {
  return db.restaurant.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: RESTAURANT_SELECT,
  });
}

export async function resolveStaffRestaurant(auth: AccessPayload, req?: Request) {
  if (auth.kind !== 'staff') throw Err.forbidden();

  const staff = await db.staff.findUnique({
    where: { id: auth.sub },
    select: { restaurantId: true },
  });
  if (!staff) throw Err.forbidden();

  // قفل به یک شعبه‌ی خاص — هدر کلاینت را نادیده بگیر (امنیت: نباید بتواند override شود)
  if (staff.restaurantId) {
    const restaurant = await db.restaurant.findFirst({
      where: { id: staff.restaurantId, tenantId: auth.tenantId },
      select: RESTAURANT_SELECT,
    });
    if (!restaurant) throw Err.notFound('رستورانی برای این حساب یافت نشد');
    return restaurant;
  }

  // owner/manager: امکان انتخاب شعبه از طریق هدر (بدون نیاز به لاگین دوباره)
  const requestedId = req?.headers.get('x-restaurant-id');
  if (requestedId) {
    const restaurant = await db.restaurant.findFirst({
      where: { id: requestedId, tenantId: auth.tenantId }, // چک تنانت: جلوگیری از IDOR
      select: RESTAURANT_SELECT,
    });
    if (restaurant) return restaurant;
    // هدر نامعتبر/متعلق به تنانتِ دیگر → به fallback زیر می‌افتیم به‌جای خطا،
    // چون این می‌تواند یک شعبه‌ی حذف‌شده یا انتخابِ قدیمیِ کلاینت باشد.
  }

  const restaurant = await defaultRestaurantForTenant(auth.tenantId);
  if (!restaurant) throw Err.notFound('رستورانی برای این حساب یافت نشد');
  return restaurant;
}

/** بازه‌ی زمانی N روز گذشته تا الان */
export function sinceDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
