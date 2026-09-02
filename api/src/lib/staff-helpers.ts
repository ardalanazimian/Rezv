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
    select: { restaurantId: true, tenantId: true, isActive: true },
  });
  if (!staff) throw Err.forbidden();

  // ⚠️ افزوده‌شده (۲۰۲۶-۰۸-۲۰) — بستنِ دو وابستگیِ تک‌لایه‌ای که در §2n
  // به‌عنوان «رفتارِ ثبت‌شده» مستند شده بودند، نه رفعِ باگِ زنده:
  //
  //  ۱) `auth.tenantId` مستقیم از توکن می‌آمد و هیچ‌جا چک نمی‌شد که این
  //     کارمند واقعاً عضوِ همان تنانت است. تنها مانعِ جعل، امضایِ JWT بود.
  //     حالا عضویت با ردیفِ واقعیِ staff تطبیق داده می‌شود — همان کوئری،
  //     بدونِ رفت‌وبرگشتِ اضافه (فقط دو ستونِ بیشتر در select).
  //
  //  ۲) کارمندِ غیرفعال (اخراج‌شده): مدلِ Staff می‌گوید «توکنِ refreshش رد
  //     می‌شود»، ولی یک accessِ منقضی‌نشده (تا ۱۵ دقیقه) هنوز کار می‌کرد.
  //     این‌جا هم بسته شد تا اخراج بلافاصله اثر کند.
  if (staff.tenantId !== auth.tenantId) throw Err.forbidden();
  if (!staff.isActive) throw Err.forbidden();

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
  // ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۰، تستِ tenant-gate در همان اولین اجرا گرفتش):
  // این هدر کاملاً کلاینت‌کنترل است و مستقیم به یک ستونِ `uuid` داده می‌شد.
  // مقدارِ غیرUUID (مثلاً یک slug یا مقدارِ کهنه‌ی localStorage) باعثِ
  // `PrismaClientKnownRequestError: Error creating UUID` می‌شد؛ آن خطای خام
  // `instanceof ApiError` نیست، پس `errorResponse` آن را به **۵۰۰** تبدیل
  // می‌کرد — یعنی *همه‌ی* endpointهایِ رستوران برای آن کلاینت می‌مردند تا
  // وقتی هدر را پاک کند. نه نشتِ داده، ولی یک اختلالِ کاملِ سرویس با
  // ماشه‌ای بی‌اهمیت.
  //
  // این دقیقاً خلافِ نیتِ صریحِ خودِ کد بود (سه خط پایین‌تر): «هدر نامعتبر …
  // → به fallback زیر می‌افتیم به‌جای خطا». آن نیت فقط برایِ UUIDِ ناموجود
  // کار می‌کرد، نه برایِ رشته‌ی بدشکل. حالا شکلِ ورودی قبل از کوئری چک
  // می‌شود و هر دو حالت یکسان رفتار می‌کنند.
  const looksLikeUuid = !!requestedId
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId);
  if (looksLikeUuid) {
    const restaurant = await db.restaurant.findFirst({
      where: { id: requestedId, tenantId: auth.tenantId }, // چک تنانت: جلوگیری از IDOR
      select: RESTAURANT_SELECT,
    });
    if (restaurant) return restaurant;

    // ⚠️ رفعِ P0-1 (فازِ ۲، پروتکل §۷ — «Never silently use another branch»).
    //
    // اینجا قبلاً عمداً به fallbackِ پایین می‌افتاد، با این استدلال که «شاید
    // شعبه حذف شده یا انتخابِ کلاینت قدیمی است». آن استدلال برایِ *خواندن*
    // بی‌ضرر به‌نظر می‌رسید ولی یک نشتِ داده‌ی واقعی بود، چون خروجیِ همین تابع
    // مستقیم `ctx.restaurant.id` در withRestaurantAuth است — یعنی به **همه‌ی**
    // handlerهایِ restaurant-scoped می‌رود، از جمله **نوشتن‌ها**.
    //
    // سناریویِ واقعیِ خرابی: مالکِ دوشعبه‌ای شعبه‌ی B را انتخاب کرده؛ B حذف
    // می‌شود یا هدر کهنه می‌ماند → واک‌این، رزروِ دستی، تغییرِ وضعیتِ میز،
    // کمپینِ مارکتینگ و شارژِ SMSِ او بی‌صدا رویِ شعبه‌ی A ثبت می‌شد و پنل هم
    // داده‌ی A را نشانش می‌داد. هیچ خطا، هیچ نشانه‌ای — دقیقاً همان کلاسِ باگی
    // که کامنتِ defaultRestaurantForTenant بالا می‌گوید یک‌بار رخ داده بود.
    //
    // حالا: انتخابِ **صریحِ** کلاینت که resolve نمی‌شود = خطایِ صریح.
    // (مسیرِ بدونِ هدر — تنانتِ تک‌شعبه‌ای — عمداً دست‌نخورده مانده تا سازگاری نشکند.)
    throw Err.branchNotAccessible();
  }

  const restaurant = await defaultRestaurantForTenant(auth.tenantId);
  // ⚠️ `Err.notFound(what)` خودش «پیدا نشد» می‌چسباند؛ جمله‌ی کامل این‌جا پیامِ
  // دوبله می‌ساخت («… یافت نشد پیدا نشد») و به کاربر می‌رسید (دیده‌شده در
  // اولین ورودِ واقعیِ ادمین، ۲۰۲۶-۰۹-۰۲). فقط «چه چیزی» را بده.
  if (!restaurant) throw Err.notFound('رستورانی برای این حساب');
  return restaurant;
}

/** بازه‌ی زمانی N روز گذشته تا الان */
export function sinceDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * کارمندِ متناظر با یک شماره، برایِ **مسیرِ ورود** — با ترتیبِ قطعی.
 *
 * ⚠️ چرا این تابع وجود دارد و چرا هر دو روتِ ورود باید از همین یکی استفاده
 * کنند (هایجکِ تنانت، مهاجرتِ ۰۷۲):
 *
 * `staff` کلیدِ یکتایِ `(tenant_id, phone)` دارد ⇒ یک شماره می‌تواند در
 * **چند** تنانت کارمند باشد. `auth/staff/request` و `auth/staff/verify` تا
 * امروز هرکدام جداگانه `findFirst({ where: { phone } })` می‌زدند — بدونِ
 * tenant و بدونِ `orderBy`. Postgres در آن حالت هیچ ترتیبی تضمین نمی‌کند و
 * برنده به ترتیبِ فیزیکیِ ردیف‌ها در heap گره می‌خورد.
 *
 * مسیرِ حمله (بازتولیدشده): مهاجم شماره‌ی قربانی را در تنانتِ خودش ثبت
 * می‌کند (`POST /v1/restaurant/staff` اثباتِ مالکیتِ شماره نمی‌خواهد)، بعد
 * یک UPDATE معمولیِ خودِ قربانی — مثلاً ویرایشِ نام از پنل — ردیفش را جابه‌جا
 * می‌کند و از آن لحظه ردیفِ مهاجم برنده می‌شود. قربانی با نقشِ تنزل‌یافته
 * واردِ تنانتِ مهاجم می‌شود.
 *
 * قاعده حالا صریح است: **قدیمی‌ترین ثبت برنده است**؛ `id` فقط شکنندهٔ تساوی
 * است تا نتیجه قطعی بماند.
 *
 * ⚠️ و چرا **یک** تابعِ مشترک، نه دو کوئریِ هم‌شکل: تا وقتی این منطق در دو
 * روت کپی بود، یک تستِ نوشته‌شده روی کپیِ خودش هیچ‌چیزی را قفل نمی‌کرد و
 * بازگشتِ یکی از دو روت بی‌صدا ممکن بود. حالا هر دو روت و تست به یک نقطه
 * نگاه می‌کنند (§۲۲ — یک قرارداد، یک پیاده‌سازی).
 */
export function findStaffForLogin(normalizedPhone: string) {
  return db.staff.findFirst({
    where: { phone: normalizedPhone },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

/**
 * آیا این خطا نقضِ ایندکسِ یکتایِ جزئیِ «شماره‌ی owner» است؟ (مهاجرتِ ۰۷۹)
 *
 * هر دو مسیرِ سازنده‌ی owner (provisionBusiness و createTrialAccount) چکِ
 * تکراریِ appسطح‌شان TOCTOU است؛ بازنده‌ی raceِ هم‌زمان به‌جای آن چک، به
 * همین ایندکس داخلِ تراکنش می‌خورد و باید به همان پاسخِ تمیزِ مسیرِ ترتیبی
 * نگاشت شود — نه ۵۰۰ِ خام. duck-type مثلِ isUniqueViolation در tables.ts
 * (نه instanceof، که به هویتِ کلاسِ client گره می‌خورد).
 *
 * ⚠️ ایندکس با SQL خام ساخته شده و Prisma آن را نمی‌شناسد؛ بسته به نسخه،
 * meta.target یا نامِ ایندکس است، یا فقط `['phone']` (شکلِ دیده‌شده‌ی واقعی:
 * «Unique constraint failed on the fields: (`phone`)» هنگامِ اجرای ۰۷۹ روی
 * دیتای کثیف). targetِ تک‌فیلدیِ phone در contextِ تراکنش‌های سازنده‌ی owner
 * یکتاست: تنها uniqueِ دیگرِ phone روی staff مرکب است (tenant_id,phone) و
 * target دوtاyی می‌دهد — پس تطبیقِ دقیقِ 'phone' برخوردِ کاذب ندارد.
 */
/**
 * همان الگویِ `isOwnerPhoneUniqueViolation`، برایِ ایندکسِ یکتای **نامِ کاربری**
 * (`staff_username_key` — مهاجرتِ ۰۷۴ + `@unique` در schema.prisma).
 *
 * ⚠️ چرا لازم شد (نمونه‌گیریِ جهش V1، ۲۰۲۶-۰۸-۲۹): پیش‌بررسیِ اپلیکیشنیِ
 * `provisionRestaurant` تنها چیزی بود که ۴۰۹ِ تمیزِ `username_taken` را
 * می‌ساخت. ایندکسِ دیتابیس جلویِ رکوردِ تکراری را می‌گیرد (پس حفره‌ی امنیتی
 * نبود)، ولی در **مسابقه‌ی همزمان** دو درخواست از پیش‌بررسی رد می‌شوند و
 * بازنده به‌جای ۴۰۹، خطای خامِ P2002 می‌گرفت. کامنتِ `provisioning.ts` مدت‌ها
 * ادعا می‌کرد این ترجمه وجود دارد — برای شماره‌ی مالک وجود داشت، برای نامِ
 * کاربری نه.
 */
export function isUsernameUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; meta?: { target?: unknown }; message?: string };
  if (err?.code !== 'P2002') return false;
  const t = err.meta?.target;
  const s = Array.isArray(t) ? t.join(',') : String(t ?? '');
  return s.includes('staff_username') || s === 'username'
    || /staff_username_key|fields: \(`username`\)/.test(String(err.message ?? ''));
}

export function isOwnerPhoneUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; meta?: { target?: unknown }; message?: string };
  if (err?.code !== 'P2002') return false;
  const t = err.meta?.target;
  const s = Array.isArray(t) ? t.join(',') : String(t ?? '');
  return s.includes('staff_owner_phone') || s === 'phone'
    || /staff_owner_phone_unique_idx|fields: \(`phone`\)/.test(String(err.message ?? ''));
}
