import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { computeSubscriptionStatus } from '@/lib/subscription';
import { audit } from '@/lib/audit';
import { Err } from '@/lib/errors';
import { parseBody, zPhone, zUsername, zPassword, z } from '@/lib/schemas';
import { normalizePhone } from '@/lib/otp';
import { hashPassword, normalizeUsername, passwordPolicyError, usernamePolicyError } from '@/lib/password';
import { clubPrefixFrom, slugSeed, uniqueRestaurantSlug } from '@/lib/site-orders';

import { withApiMetrics } from '@/lib/api-metrics';

/** GET — همه‌ی رستوران‌های پلتفرم با آمار (پنل شرکت) */
async function GET_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    await requireAdmin(req);
    const restaurants = await db.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, plan: true, planExpiresAt: true, trialEndsAt: true } },
        _count: { select: { members: true, reservations: true } },
      },
    });
    return NextResponse.json({
      restaurants: restaurants.map(r => {
        const sub = computeSubscriptionStatus(r.tenant.planExpiresAt, r.tenant.trialEndsAt);
        return {
          id: r.id, name: r.name, slug: r.slug, cuisine: r.cuisine,
          tenant_id: r.tenant.id, plan: r.tenant.plan, is_open: r.isOpen,
          members: r._count.members, reservations: r._count.reservations,
          sms_balance: r.smsBalance, sms_total_sent: r.smsTotalSent,
          joined_at: r.createdAt,
          // وضعیت واقعی اشتراک — دیگر ساختگی نیست
          subscription_status: sub.status,
          days_left: sub.daysLeft,
          plan_expires_at: r.tenant.planExpiresAt,
          trial_ends_at: r.tenant.trialEndsAt,
        };
      }),
    });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const GET = withApiMetrics('/api/v1/admin/restaurants', GET_impl);


// ═══════════════════════════════════════════════════════════════════════
//  POST — ساختِ مستقیمِ کسب‌وکار از پنلِ شرکت (۲۰۲۶-۰۸-۲۶)
//
//  حکمِ معماری (مالکِ محصول): «پنلِ بیزنس باید از داخلِ پنلِ کمپانی ساخته
//  بشه». تا امروز تنها مسیرِ ساخت، دموی سایت (`createTrialAccount`) یا
//  فعال‌سازیِ سفارش (`activateOrder`) بود — یعنی ادمین بدونِ یک سفارشِ سایت
//  نمی‌توانست مشتریِ تلفنی/حضوری را onboard کند.
//
//  از قصد از همان بلوک‌های سازنده‌ی مسیرِ trial استفاده می‌شود (§۶ — یک
//  پیاده‌سازی): slug/clubPrefix/میزهای شروع/اعتبارِ پیامکِ اولیه، و برای
//  اعتبارنامه همان سیاست‌های lib/password (نه نسخه‌ی دوم).
//
//  تراکنشی: یا tenant+restaurant+staff با هم ساخته می‌شوند یا هیچ‌کدام.
// ═══════════════════════════════════════════════════════════════════════
const createSchema = z.object({
  business_name: z.string().trim().min(2).max(80),
  city: z.string().trim().max(60).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  owner_phone: zPhone,
  owner_name: z.string().trim().max(80).optional(),
  // اختیاری — با هم یا هیچ‌کدام (نیمه‌پیکربندی نیمه‌فعال نمی‌شود):
  username: zUsername.optional(),
  password: zPassword.optional(),
});

async function POST_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const b = await parseBody(req, createSchema);

    const phone = normalizePhone(b.owner_phone);
    // شماره‌ای که از قبل مالکِ کسب‌وکار است: ساختِ دومی به‌جای ورود، خطای
    // انسانیِ رایجِ اپراتور است — صریح رد می‌شود (همان قاعده‌ی trial).
    const existing = await db.staff.findFirst({ where: { phone }, select: { id: true } });
    if (existing) throw Err.validation('این شماره از قبل حسابِ کسب‌وکار دارد؛ برای شعبه‌ی جدید از branches استفاده کنید.');

    // اعتبارنامه‌ی اختیاری — کاملِ کامل یا هیچ (همان قراردادِ staff-credentials).
    let credentials: { username: string; passwordHash: string; passwordUpdatedAt: Date } | null = null;
    if (b.username || b.password) {
      if (!b.username || !b.password) throw Err.validation('برای ورود با رمز، هر دو فیلدِ username و password لازم است');
      const uErr = usernamePolicyError(b.username);
      if (uErr) throw Err.validation(uErr);
      const pErr = passwordPolicyError(b.password);
      if (pErr) throw Err.validation(pErr);
      const username = normalizeUsername(b.username);
      const taken = await db.staff.findUnique({ where: { username }, select: { id: true } });
      if (taken) throw Err.validation(`نام کاربری «${username}» قبلاً گرفته شده است`);
      credentials = { username, passwordHash: await hashPassword(b.password), passwordUpdatedAt: new Date() };
    }

    const slug = await uniqueRestaurantSlug(slugSeed(b.business_name, phone.slice(-6)));

    const created = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: b.business_name, plan: b.plan ?? 'free' },
        select: { id: true, plan: true },
      });
      const restaurant = await tx.restaurant.create({
        data: {
          tenantId: tenant.id,
          slug,
          name: b.business_name,
          city: b.city || null,
          clubPrefix: clubPrefixFrom(b.business_name),
          // همان مقادیرِ مسیرِ trial — پنلِ خالی/بی‌اعتبار عملاً مرده است.
          smsBalance: 50,
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
        data: {
          tenantId: tenant.id, phone, name: b.owner_name || b.business_name,
          role: 'owner', isActive: true, ...(credentials ?? {}),
        },
        select: { id: true, username: true },
      });
      return { tenant, restaurant, staff };
    });

    // ساختِ کسب‌وکار = عملِ سطحِ پلتفرم؛ حتماً ردِ audit دارد.
    await audit({
      action: 'admin.business_created', actorId: admin.sub, actorType: 'admin',
      targetId: created.restaurant.id, restaurantId: created.restaurant.id, ip: clientIp(req),
      detail: {
        business_name: b.business_name, plan: created.tenant.plan,
        owner_phone_suffix: phone.slice(-4), with_credentials: !!credentials,
      },
    });

    return NextResponse.json({
      restaurant: created.restaurant,
      tenant_id: created.tenant.id,
      owner: {
        staff_id: created.staff.id,
        phone,
        username: created.staff.username,   // null اگر اعتبارنامه ست نشده
      },
      login: credentials
        ? { app: 'business', method: 'password' }
        : { app: 'business', method: 'otp' },
    }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

export const POST = withApiMetrics('/api/v1/admin/restaurants', POST_impl);
