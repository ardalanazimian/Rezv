// ═══════════════════════════════════════════════════════════════════════
//  قیفِ فروشِ وب‌سایتِ عمومی — دموی رایگان، درخواستِ خرید، فعال‌سازی
//
//  سه مسیرِ واقعی (هیچ‌کدام شبیه‌سازی نیست):
//
//   ۱) دموی ۳۰ روزه (kind=trial) → همان‌جا Tenant + Restaurant + Staff(owner)
//      ساخته می‌شود و trialEndsAt روی +۳۰ روز می‌نشیند. کاربر بلافاصله با
//      همان شماره وارد پنلِ کسب‌وکار می‌شود (OTP). یعنی «حسابِ دمو» یک ردیفِ
//      واقعی در همان دیتابیسِ محصول است، نه یک فرمِ سرنخ.
//
//   ۲) درخواستِ خرید (kind=purchase) → سفارشِ pending با اسنپ‌شاتِ قیمت.
//      قیمت هرگز از کلاینت گرفته نمی‌شود؛ از SitePlan خوانده می‌شود.
//      پنلِ شرکت مطلع می‌شود (رویدادِ پلتفرم + ایمیل + صفِ در انتظار).
//
//   ۳) فعال‌سازی توسط پنلِ شرکت → tenant.plan/planExpiresAt واقعاً ست می‌شود،
//      روی همان ردیفِ سفارش «چه‌کسی/چه‌زمانی» ثبت و audit می‌شود.
//
//  شفافیت: هر سفارش کدِ پیگیریِ عمومی دارد و صفحه‌ی /order/{code} در سایت
//  وضعیتِ واقعی‌اش را نشان می‌دهد.
// ═══════════════════════════════════════════════════════════════════════
import { randomInt } from 'node:crypto';
import { db } from './db';
import { Err } from './errors';
import { audit } from './audit';
import { normalizePhone } from './otp';
import { queueEmail } from './notify';
import { recordEvent } from './platform-events';
import { getPlatformSetting } from './platform-settings';
import { clientIp, type RateLimitRule } from './ratelimit';
import { createLogger } from './logger';

const log = createLogger('site-orders');

/** مدتِ دموی رایگان — در سایت، ایمیل و اسکیما یک عدد. */
export const TRIAL_DAYS = 30;

/**
 * سقف‌های اختصاصیِ قیفِ سایت. سخت‌گیرانه‌تر از RULES.search چون هر درخواست یک
 * ردیفِ ماندگار (و در موردِ دمو، یک تنانتِ واقعی) می‌سازد.
 */
export const SITE_RULES = {
  trial: { prefix: 'site:trial', max: 5, windowMs: 60 * 60_000 } as RateLimitRule,
  order: { prefix: 'site:order', max: 10, windowMs: 60 * 60_000 } as RateLimitRule,
  contact: { prefix: 'site:contact', max: 10, windowMs: 60 * 60_000 } as RateLimitRule,
  read: { prefix: 'site:read', max: 120, windowMs: 60_000 } as RateLimitRule,
  track: { prefix: 'site:track', max: 30, windowMs: 60_000 } as RateLimitRule,
} as const;

// الفبای بدونِ کاراکترِ مبهم (0/O/1/I) — مثلِ کدِ رزرو، تا تلفنی هم خوانا باشد.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(prefix: string, len = 6): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return `${prefix}-${s}`;
}

/**
 * کدِ یکتا با تلاشِ مجدد. برخوردِ واقعی تقریباً ناممکن است (۳۲^۶ ≈ ۱٫۱ میلیارد)
 * ولی چون کد در URLِ عمومی می‌آید، یکتاییِ آن با خواندنِ DB تأیید می‌شود.
 */
async function uniqueCode(prefix: string, exists: (code: string) => Promise<boolean>): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = randomCode(prefix);
    if (!(await exists(code))) return code;
  }
  // بعد از ۶ تلاش، طولِ کد را زیاد کن (به‌جای شکست)
  return randomCode(prefix, 10);
}

/**
 * افزودنِ ماه بدونِ سرریزِ روز. `new Date(2026,0,31).setMonth(+1)` در جاوااسکریپت
 * ۳ مارس می‌دهد (چون ۳۱ فوریه وجود ندارد) و یعنی مشتری چند روز اضافه می‌گیرد.
 * این تابع به آخرین روزِ ماهِ مقصد کوتاه می‌آید.
 */
export function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const daysInTargetMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTargetMonth));
  return d;
}

/**
 * اسلاگِ نشانی از نامِ کسب‌وکار. حروفِ فارسی عمداً حفظ می‌شوند (نه حذف): آدرسِ
 * فارسی برای جست‌وجوی فارسی بهتر است و لایه‌ی سئو همه‌جا encodeURIComponent
 * می‌کند. اگر نام هیچ حرفِ قابلِ استفاده‌ای نداشت، کدِ سفارش جایگزین می‌شود.
 */
function slugSeed(businessName: string, fallback: string): string {
  const slug = businessName
    .toLowerCase()
    .replace(/[‌‏‎]/g, '')          // نیم‌فاصله و نشانه‌های جهت
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')      // لاتین، رقم و فارسی می‌مانند
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug.length >= 2 ? slug : fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** اسلاگِ یکتا برای رستورانِ تازه (پسوندِ عددی تا آزاد شود). */
async function uniqueRestaurantSlug(seed: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const candidate = i === 0 ? seed : `${seed}-${i + 1}`;
    const hit = await db.restaurant.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!hit) return candidate;
  }
  return `${seed}-${randomCode('x', 5).slice(2).toLowerCase()}`;
}

/** پیشوندِ باشگاهِ مشتریان (۳ حرف). از نامِ لاتین، وگرنه تصادفی. */
function clubPrefixFrom(businessName: string): string {
  const letters = businessName.toUpperCase().replace(/[^A-Z]/g, '');
  if (letters.length >= 3) return letters.slice(0, 3);
  let s = letters;
  while (s.length < 3) s += CODE_ALPHABET[randomInt(0, 24)]; // فقط حروف
  return s.slice(0, 3);
}

// ── زمینه‌ی درخواست (برای انتساب و ضدِ سوءاستفاده) ──
export interface RequestContext {
  ip?: string | null;
  userAgent?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  landingPath?: string | null;
  referrer?: string | null;
}

export interface LeadInput {
  businessName: string;
  contactName: string;
  phone: string;
  email?: string;
  city?: string;
  branchCount?: number;
  note?: string;
}

/**
 * زمینه‌ی انتساب از درخواست: IP و User-Agent از هدرها (قابل‌اعتماد‌تر)، و
 * پارامترهای کمپین از بدنه (کلاینت آن‌ها را از URLِ فرود برمی‌دارد).
 * همه‌چیز کوتاه می‌شود تا فیلدهای متنی بی‌کران پر نشوند.
 */
export function contextFromRequest(req: Request, body: Record<string, unknown> = {}): RequestContext {
  const pick = (k: string, max = 200): string | null => {
    const v = body[k];
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
  };
  return {
    ip: clientIp(req),
    userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    utmSource: pick('utm_source', 100),
    utmMedium: pick('utm_medium', 100),
    utmCampaign: pick('utm_campaign', 120),
    landingPath: pick('landing_path', 300),
    referrer: pick('referrer', 300) ?? req.headers.get('referer')?.slice(0, 300) ?? null,
  };
}

/** نمای عمومیِ سفارش — فقط چیزی که خودِ متقاضی مجاز است ببیند (بدونِ PIIِ اضافه). */
export function publicOrderView(o: {
  code: string; kind: string; status: string; planName: string | null; months: number | null;
  amountToman: number | null; businessName: string; trialEndsAt: Date | null;
  activatedAt: Date | null; planExpiresAt: Date | null; rejectedReason: string | null; createdAt: Date;
}) {
  return {
    code: o.code,
    kind: o.kind,
    status: o.status,
    plan_name: o.planName,
    months: o.months,
    amount_toman: o.amountToman,
    business_name: o.businessName,
    trial_ends_at: o.trialEndsAt?.toISOString() ?? null,
    activated_at: o.activatedAt?.toISOString() ?? null,
    plan_expires_at: o.planExpiresAt?.toISOString() ?? null,
    rejected_reason: o.rejectedReason,
    created_at: o.createdAt.toISOString(),
  };
}

// ═══════════════════════════════ اعلانِ پنلِ شرکت ═══════════════════════════════

/**
 * اطلاع‌رسانی به «اپِ شرکت» برای هر سفارشِ تازه. سه کانالِ مستقل تا هیچ‌کدام
 * نقطه‌ی شکستِ یکتا نباشند:
 *   • PlatformEvent  — رکوردِ ماندگار و قابل‌ردیابی (منبعِ داشبوردِ هوشِ پلتفرم)
 *   • ایمیل (صف)     — هشدارِ فعالِ تیمِ فروش (گیرنده از تنظیماتِ پلتفرم/env)
 *   • صفِ در انتظار  — پنلِ شرکت شمارشِ pending را از /admin/site/overview می‌خواند
 * هیچ‌کدام نباید ثبتِ سفارش را بشکنند؛ خطا فقط log می‌شود.
 */
async function notifyCompany(order: {
  id: string; code: string; kind: string; businessName: string; contactName: string;
  phone: string; email: string | null; city: string | null; planName: string | null;
  months: number | null; amountToman: number | null; note: string | null; tenantId: string | null;
}): Promise<void> {
  const isPurchase = order.kind === 'purchase';

  await recordEvent({
    type: isPurchase ? 'site.order.created' : 'site.trial.created',
    source: 'backend',
    tenantId: order.tenantId,
    payload: {
      order_id: order.id, code: order.code, kind: order.kind,
      plan_name: order.planName, months: order.months, amount_toman: order.amountToman,
      business_name: order.businessName, city: order.city,
    },
  });

  try {
    const to = await getPlatformSetting('sales_notify_email', process.env.SALES_NOTIFY_EMAIL);
    if (to) {
      const lines = [
        isPurchase ? 'درخواستِ خریدِ اشتراک ثبت شد و منتظرِ فعال‌سازی است.' : 'یک حسابِ دموی ۳۰ روزه ساخته شد.',
        '',
        `کدِ پیگیری: ${order.code}`,
        `کسب‌وکار: ${order.businessName}`,
        `تماس: ${order.contactName} — ${order.phone}${order.email ? ` — ${order.email}` : ''}`,
        order.city ? `شهر: ${order.city}` : '',
        isPurchase && order.planName ? `پلن: ${order.planName} (${order.months} ماه — ${order.amountToman?.toLocaleString('fa-IR')} تومان)` : '',
        order.note ? `توضیح: ${order.note}` : '',
        '',
        isPurchase ? 'فعال‌سازی از پنلِ شرکت › درخواست‌های فروش انجام می‌شود.' : '',
      ].filter(Boolean);
      await queueEmail(
        to,
        isPurchase ? `[رزرونو] درخواستِ خرید ${order.code}` : `[رزرونو] دموی جدید ${order.code}`,
        lines.join('\n'),
        `site-order:${order.id}`, // idempotency: یک ایمیل به‌ازای هر سفارش
      );
    }
  } catch (e) {
    log.warn('ارسالِ اعلانِ فروش ناموفق', { code: order.code, error: (e as Error).message });
  }
}

// ═══════════════════════════════ ۱) دموی رایگان ═══════════════════════════════

export interface TrialResult {
  order: ReturnType<typeof publicOrderView>;
  /** آیا همین حالا ساخته شد یا از قبل وجود داشت (درخواستِ تکراری). */
  created: boolean;
  restaurant: { id: string; slug: string; name: string };
  login: { phone: string; app: 'business' };
}

/**
 * ساختِ حسابِ دموی واقعی برای پنلِ کسب‌وکار.
 *
 * idempotent روی شماره: اگر همان شماره قبلاً دمو گرفته، همان سفارش برگردانده
 * می‌شود (created=false) — دوباره‌فرستادنِ فرم، تنانتِ دوم نمی‌سازد.
 * اگر شماره از قبل کارمند/مالکِ یک کسب‌وکارِ دیگر باشد، ۴۰۹ می‌گیرد و به ورود
 * هدایت می‌شود (نمی‌خواهیم حسابِ فعالِ کسی با فرمِ عمومی دستکاری شود).
 */
export async function createTrialAccount(input: LeadInput, ctx: RequestContext): Promise<TrialResult> {
  const phone = normalizePhone(input.phone);

  // درخواستِ تکراری → همان نتیجه (بدونِ ساختِ تنانتِ دوم)
  const existingOrder = await db.siteOrder.findFirst({
    where: { phone, kind: 'trial' },
    orderBy: { createdAt: 'desc' },
  });
  if (existingOrder) {
    const rest = existingOrder.restaurantId
      ? await db.restaurant.findUnique({
          where: { id: existingOrder.restaurantId },
          select: { id: true, slug: true, name: true },
        })
      : null;
    return {
      order: publicOrderView(existingOrder),
      created: false,
      restaurant: rest ?? { id: '', slug: '', name: existingOrder.businessName },
      login: { phone, app: 'business' },
    };
  }

  // شماره‌ای که از قبل به یک کسب‌وکارِ دیگر وصل است → ورود، نه ساختِ حسابِ تازه
  const existingStaff = await db.staff.findFirst({ where: { phone }, select: { id: true } });
  if (existingStaff) {
    throw Err.validation('این شماره از قبل حسابِ کسب‌وکار دارد؛ از همان شماره وارد پنل شوید.');
  }

  const code = await uniqueCode('RZO', async (c) => !!(await db.siteOrder.findUnique({ where: { code: c }, select: { id: true } })));
  const slug = await uniqueRestaurantSlug(slugSeed(input.businessName, code));
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);

  // یک تراکنش: یا کلِ حساب ساخته می‌شود یا هیچ‌چیز (بدونِ تنانتِ یتیم).
  const provisioned = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.businessName, plan: 'free', trialEndsAt },
    });

    const restaurant = await tx.restaurant.create({
      data: {
        tenantId: tenant.id,
        slug,
        name: input.businessName,
        city: input.city || null,
        clubPrefix: clubPrefixFrom(input.businessName),
        // اعتبارِ شروعِ پیامک: بدونش هر پیامکِ تأییدِ رزرو از همان دقیقه‌ی اول
        // با «موجودی کافی نیست» به DLQ می‌رود و حسابِ دمو عملاً بی‌صداست.
        // همان عددِ STARTER_SMS_BALANCE در lib/sms-balance.ts (و مسیرهای
        // branches/seed) — اینجا literal نگه داشته شده تا دیف یک‌خطی بماند.
        smsBalance: 50,
        // چیدمانِ شروع: بدونِ میز، پنل خالی و غیرقابل‌استفاده است. این میزها
        // مالِ خودِ کسب‌وکارند و از همان پنل قابلِ ویرایش/حذف‌اند.
        tables: {
          create: [2, 2, 2, 4, 4, 4, 6, 8].map((capacity, i) => ({
            number: i + 1,
            capacity,
            zone: i < 3 ? 'window' : i < 6 ? 'indoor' : i === 6 ? 'vip' : 'outdoor',
            shape: capacity >= 6 ? 'booth' : i % 3 === 0 ? 'round' : 'rectangle',
          })),
        },
      },
      select: { id: true, slug: true, name: true },
    });

    const staff = await tx.staff.create({
      data: { tenantId: tenant.id, phone, name: input.contactName, role: 'owner', isActive: true },
      select: { id: true },
    });

    const order = await tx.siteOrder.create({
      data: {
        code, kind: 'trial', status: 'activated',
        businessName: input.businessName, contactName: input.contactName, phone,
        email: input.email || null, city: input.city || null,
        branchCount: input.branchCount ?? null, note: input.note || null,
        tenantId: tenant.id, restaurantId: restaurant.id, staffId: staff.id,
        trialEndsAt, activatedAt: new Date(),
        utmSource: ctx.utmSource || null, utmMedium: ctx.utmMedium || null,
        utmCampaign: ctx.utmCampaign || null, landingPath: ctx.landingPath || null,
        referrer: ctx.referrer || null, ip: ctx.ip || null, userAgent: ctx.userAgent || null,
      },
    });

    return { tenant, restaurant, order };
  });

  await notifyCompany({ ...provisioned.order });
  await audit({
    action: 'admin.action', actorType: 'anonymous', targetId: provisioned.tenant.id,
    restaurantId: provisioned.restaurant.id, ip: ctx.ip ?? null,
    detail: { operation: 'site_trial_provisioned', code, business: input.businessName, trial_days: TRIAL_DAYS },
  });

  if (input.email) {
    await queueEmail(
      input.email,
      'دموی ۳۰ روزه‌ی رزرونو فعال شد',
      [
        `${input.contactName} عزیز، حسابِ دموی «${input.businessName}» فعال شد.`,
        '',
        `کدِ پیگیری: ${code}`,
        `مهلتِ دمو: ${TRIAL_DAYS} روز (تا ${trialEndsAt.toLocaleDateString('fa-IR')})`,
        `ورود به پنلِ کسب‌وکار با همین شماره: ${phone}`,
        '',
        'برای ورود کافی است شماره را وارد کنید و کدِ پیامک‌شده را بزنید.',
      ].join('\n'),
      `site-trial-welcome:${provisioned.order.id}`,
    ).catch(() => {});
  }

  return {
    order: publicOrderView(provisioned.order),
    created: true,
    restaurant: provisioned.restaurant,
    login: { phone, app: 'business' },
  };
}

// ═══════════════════════════════ ۲) درخواستِ خرید ═══════════════════════════════

export interface PurchaseResult {
  order: ReturnType<typeof publicOrderView>;
  created: boolean;
}

/**
 * ثبتِ درخواستِ خریدِ اشتراک. قیمت/مدت از SitePlan خوانده می‌شود (نه از کلاینت)
 * و به‌صورتِ اسنپ‌شات روی سفارش می‌نشیند تا تغییرِ بعدیِ قیمت، سندِ این سفارش را
 * عوض نکند. نتیجه: یک ردیفِ pending که پنلِ شرکت باید فعالش کند.
 */
export async function createPurchaseOrder(
  input: LeadInput & { planKey: string },
  ctx: RequestContext,
): Promise<PurchaseResult> {
  const phone = normalizePhone(input.phone);

  const plan = await db.sitePlan.findFirst({
    where: { key: input.planKey, status: 'published' },
    select: { key: true, name: true, months: true, priceToman: true },
  });
  if (!plan) throw Err.validation('پلنِ انتخاب‌شده در دسترس نیست');

  // ضدِ ثبتِ تکراری: همان شماره + همان پلن که هنوز باز است → همان سفارش.
  const openDuplicate = await db.siteOrder.findFirst({
    where: { phone, kind: 'purchase', planKey: plan.key, status: { in: ['pending', 'contacted'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (openDuplicate) return { order: publicOrderView(openDuplicate), created: false };

  // اگر این شماره از قبل صاحبِ تنانتی است، همان‌جا به سفارش وصل می‌شود تا
  // فعال‌سازی در پنلِ شرکت یک‌کلیکی باشد (نه جست‌وجوی دستی).
  const owner = await db.staff.findFirst({
    where: { phone, role: 'owner', isActive: true },
    select: { tenantId: true, restaurantId: true },
  });

  const code = await uniqueCode('RZO', async (c) => !!(await db.siteOrder.findUnique({ where: { code: c }, select: { id: true } })));

  const order = await db.siteOrder.create({
    data: {
      code, kind: 'purchase', status: 'pending',
      planKey: plan.key, planName: plan.name, months: plan.months, amountToman: plan.priceToman,
      businessName: input.businessName, contactName: input.contactName, phone,
      email: input.email || null, city: input.city || null,
      branchCount: input.branchCount ?? null, note: input.note || null,
      tenantId: owner?.tenantId ?? null, restaurantId: owner?.restaurantId ?? null,
      utmSource: ctx.utmSource || null, utmMedium: ctx.utmMedium || null,
      utmCampaign: ctx.utmCampaign || null, landingPath: ctx.landingPath || null,
      referrer: ctx.referrer || null, ip: ctx.ip || null, userAgent: ctx.userAgent || null,
    },
  });

  await notifyCompany({ ...order });

  if (input.email) {
    await queueEmail(
      input.email,
      `درخواستِ اشتراکِ رزرونو ثبت شد (${code})`,
      [
        `${input.contactName} عزیز، درخواستِ شما برای پلنِ «${plan.name}» ثبت شد.`,
        '',
        `کدِ پیگیری: ${code}`,
        `مبلغ: ${plan.priceToman.toLocaleString('fa-IR')} تومان برای ${plan.months} ماه`,
        '',
        'تیمِ رزرونو برای هماهنگیِ پرداخت و فعال‌سازی تماس می‌گیرد.',
        `وضعیتِ درخواست را همیشه می‌توانید با کدِ بالا پیگیری کنید.`,
      ].join('\n'),
      `site-purchase-ack:${order.id}`,
    ).catch(() => {});
  }

  return { order: publicOrderView(order), created: true };
}

// ═══════════════════════════════ ۳) تماس با فروش ═══════════════════════════════

export interface InquiryInput {
  name: string; phone: string; email?: string; company?: string; topic: string; message: string;
}

export async function createInquiry(input: InquiryInput, ctx: RequestContext) {
  const phone = normalizePhone(input.phone);
  const code = await uniqueCode('RZQ', async (c) => !!(await db.siteInquiry.findUnique({ where: { code: c }, select: { id: true } })));

  const row = await db.siteInquiry.create({
    data: {
      code, name: input.name, phone, email: input.email || null,
      company: input.company || null, topic: input.topic, message: input.message,
      utmSource: ctx.utmSource || null, landingPath: ctx.landingPath || null,
      ip: ctx.ip || null, userAgent: ctx.userAgent || null,
    },
  });

  await recordEvent({
    type: 'site.inquiry.created',
    source: 'backend',
    payload: { inquiry_id: row.id, code, topic: input.topic, company: input.company ?? null },
  });

  try {
    const to = await getPlatformSetting('sales_notify_email', process.env.SALES_NOTIFY_EMAIL);
    if (to) {
      await queueEmail(
        to,
        `[رزرونو] پیامِ تازه از سایت (${code})`,
        [
          `موضوع: ${input.topic}`,
          `از: ${input.name}${input.company ? ` — ${input.company}` : ''}`,
          `تماس: ${phone}${input.email ? ` — ${input.email}` : ''}`,
          '',
          input.message,
        ].join('\n'),
        `site-inquiry:${row.id}`,
      );
    }
  } catch (e) {
    log.warn('ارسالِ اعلانِ تماس ناموفق', { code, error: (e as Error).message });
  }

  return { code: row.code, status: row.status, created_at: row.createdAt.toISOString() };
}

// ═══════════════════════════════ ۴) فعال‌سازی (پنلِ شرکت) ═══════════════════════════════

export interface ActivateOptions {
  /** اگر سفارش هنوز به تنانتی وصل نیست، مدیر تنانتِ مقصد را می‌دهد. */
  tenantId?: string;
  adminNote?: string;
}

/**
 * فعال‌سازیِ واقعیِ اشتراک: تنانت را روی تیرِ پلن می‌برد و تاریخِ انقضا را
 * جلو می‌کشد. اگر اشتراکِ فعلی هنوز اعتبار دارد، از همان تاریخ تمدید می‌شود
 * (نه از امروز) تا روزهای خریداری‌شده هدر نرود.
 */
export async function activateOrder(
  orderId: string,
  admin: { staffId: string; ip?: string | null },
  opts: ActivateOptions = {},
): Promise<{ order: ReturnType<typeof publicOrderView>; tenantId: string; planExpiresAt: string }> {
  const order = await db.siteOrder.findUnique({ where: { id: orderId } });
  if (!order) throw Err.notFound('سفارش');
  if (order.kind !== 'purchase') throw Err.validation('فقط درخواستِ خرید نیاز به فعال‌سازی دارد');
  if (order.status === 'activated') throw Err.validation('این سفارش قبلاً فعال شده است');
  if (order.status === 'rejected' || order.status === 'cancelled') {
    throw Err.validation('سفارشِ رد/لغوشده را نمی‌توان فعال کرد');
  }
  if (!order.months || order.months < 1) throw Err.validation('مدتِ سفارش نامشخص است');

  // تنانتِ مقصد: صریح از مدیر → روی سفارش → از روی شماره‌ی مالک
  let tenantId = opts.tenantId ?? order.tenantId ?? null;
  if (!tenantId) {
    const owner = await db.staff.findFirst({
      where: { phone: order.phone, role: 'owner', isActive: true },
      select: { tenantId: true },
    });
    tenantId = owner?.tenantId ?? null;
  }
  if (!tenantId) {
    throw Err.validation('کسب‌وکارِ مقصد مشخص نیست؛ ابتدا حسابِ کسب‌وکار را بسازید یا شناسه‌ی آن را بدهید.');
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, planExpiresAt: true, version: true },
  });
  if (!tenant) throw Err.notFound('کسب‌وکار');

  // تیرِ اشتراک از تعریفِ پلن می‌آید (قابل‌ویرایش از استودیو)؛ نبودِ پلن → pro.
  const plan = order.planKey
    ? await db.sitePlan.findUnique({ where: { key: order.planKey }, select: { tenantPlan: true } })
    : null;
  const tenantPlan = plan?.tenantPlan ?? 'pro';

  const now = new Date();
  const base = tenant.planExpiresAt && tenant.planExpiresAt.getTime() > now.getTime() ? tenant.planExpiresAt : now;
  const planExpiresAt = addMonths(base, order.months);

  const updated = await db.$transaction(async (tx) => {
    // قفلِ خوش‌بینانه روی version — دو فعال‌سازیِ همزمان نباید تاریخ را دوبار جلو ببرد.
    const res = await tx.tenant.updateMany({
      where: { id: tenant.id, version: tenant.version },
      data: { plan: tenantPlan, planExpiresAt, trialEndsAt: null, version: { increment: 1 } },
    });
    if (res.count === 0) throw Err.concurrencyRetry();

    return tx.siteOrder.update({
      where: { id: order.id },
      data: {
        status: 'activated', tenantId: tenant.id, planExpiresAt,
        activatedAt: now, activatedBy: admin.staffId,
        adminNote: opts.adminNote ?? order.adminNote,
      },
    });
  });

  await audit({
    action: 'plan.changed', actorId: admin.staffId, actorType: 'admin',
    targetId: tenant.id, ip: admin.ip ?? null,
    detail: {
      operation: 'site_order_activated', order_code: order.code, plan_key: order.planKey,
      months: order.months, amount_toman: order.amountToman,
      plan_expires_at: planExpiresAt.toISOString(), tenant_plan: tenantPlan,
    },
  });
  await recordEvent({
    type: 'site.order.activated', source: 'company', tenantId: tenant.id, staffId: admin.staffId,
    payload: { order_id: order.id, code: order.code, months: order.months, plan_expires_at: planExpiresAt.toISOString() },
  });

  if (order.email) {
    await queueEmail(
      order.email,
      `اشتراکِ رزرونو فعال شد (${order.code})`,
      [
        `${order.contactName} عزیز، اشتراکِ «${order.businessName}» فعال شد.`,
        '',
        `پلن: ${order.planName ?? '-'} — ${order.months} ماه`,
        `اعتبار تا: ${planExpiresAt.toLocaleDateString('fa-IR')}`,
        '',
        'از همین حالا می‌توانید با شماره‌ی خود وارد پنلِ کسب‌وکار شوید.',
      ].join('\n'),
      `site-order-activated:${order.id}`,
    ).catch(() => {});
  }

  return { order: publicOrderView(updated), tenantId: tenant.id, planExpiresAt: planExpiresAt.toISOString() };
}

/** رد/لغوِ سفارش با دلیلِ ثبت‌شده (تاریخچه پاک نمی‌شود). */
export async function rejectOrder(
  orderId: string,
  admin: { staffId: string; ip?: string | null },
  reason: string,
): Promise<ReturnType<typeof publicOrderView>> {
  const order = await db.siteOrder.findUnique({ where: { id: orderId } });
  if (!order) throw Err.notFound('سفارش');
  if (order.status === 'activated') throw Err.validation('سفارشِ فعال‌شده را نمی‌توان رد کرد');

  const updated = await db.siteOrder.update({
    where: { id: orderId },
    data: { status: 'rejected', rejectedReason: reason },
  });

  await audit({
    action: 'admin.action', actorId: admin.staffId, actorType: 'admin',
    targetId: orderId, ip: admin.ip ?? null,
    detail: { operation: 'site_order_rejected', order_code: order.code, reason },
  });
  await recordEvent({
    type: 'site.order.rejected', source: 'company', staffId: admin.staffId,
    payload: { order_id: orderId, code: order.code, reason },
  });

  return publicOrderView(updated);
}

/** تغییرِ وضعیت‌های سبک (تماس گرفته شد / لغو شد) بدونِ اثرِ مالی. */
export async function setOrderStatus(
  orderId: string,
  admin: { staffId: string; ip?: string | null },
  status: 'pending' | 'contacted' | 'cancelled',
  adminNote?: string,
): Promise<ReturnType<typeof publicOrderView>> {
  const order = await db.siteOrder.findUnique({ where: { id: orderId } });
  if (!order) throw Err.notFound('سفارش');
  if (order.status === 'activated') throw Err.validation('سفارشِ فعال‌شده قابلِ تغییرِ وضعیت نیست');

  const updated = await db.siteOrder.update({
    where: { id: orderId },
    data: { status, adminNote: adminNote ?? order.adminNote },
  });

  await audit({
    action: 'admin.action', actorId: admin.staffId, actorType: 'admin',
    targetId: orderId, ip: admin.ip ?? null,
    detail: { operation: 'site_order_status', order_code: order.code, status },
  });

  return publicOrderView(updated);
}
