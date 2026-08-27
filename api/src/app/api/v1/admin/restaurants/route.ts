import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/errors';
import { computeSubscriptionStatus } from '@/lib/subscription';
import { Err } from '@/lib/errors';
import { parseBody, zPhone, zUsername, zPassword, z } from '@/lib/schemas';
import { withIdempotency } from '@/lib/idempotency';
import { provisionBusiness } from '@/lib/provisioning';

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
          // SPEC-B: وضعیتِ provisioning برای badge/دکمه‌ی دعوت در پنلِ شرکت
          provision_status: r.provisionStatus,
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
//  POST — provisioningِ کسب‌وکار از پنلِ شرکت (SPEC-B، بازنویسیِ ۰۸-۲۶ دورِ ۲)
//
//  این نسخه لایه‌ی نازک است: کلِ منطقِ §۶ (تراکنش، slug، dup، دعوت، audit)
//  به lib/provisioning.ts رفت — سه مصرف‌کننده دارد (create/resend/branches)
//  و قاعده‌ی «یک پیاده‌سازی» حاکم است.
//
//  Idempotency-Key **اجباری** است (§۵-۱ spec): دابل‌کلیکِ ادمین/retryِ شبکه
//  نباید دو کسب‌وکار بسازد. الگو عیناً walkin/route.ts.
// ═══════════════════════════════════════════════════════════════════════
const createSchema = z.object({
  business_name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(60).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  trial_days: z.number().int().min(0).max(90).optional(),
  slug: z.string().trim().max(40).optional(),
  owner_phone: zPhone,
  owner_name: z.string().trim().min(2).max(80).optional(),
  username: zUsername.optional(),
  password: zPassword.optional(),
  seed_defaults: z.object({ tables: z.number().int().min(0).max(100).optional() }).optional(),
  // C8ِ برنامه: پذیرفته می‌شود که پیامِ خطا دقیق باشد، ولی پشتیبانی نمی‌شود —
  // «قدیمی‌ترین ثبتِ شماره برنده است» (مهاجرتِ ۰۷۲) ورودِ ownerِ دوم را ناممکن می‌کرد.
  attach_existing_owner: z.boolean().optional(),
});

async function POST_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);

    // ترتیبِ §۶ی spec: چکِ idempotency (گامِ ۲) **قبل از** اعتبارسنجیِ بدنه
    // (گامِ ۳) — replay باید پاسخِ ذخیره‌شده را برگرداند حتی با بدنه‌ی
    // ناقصِ retry؛ وگرنه retryِ صادقانه ۴۲۲ می‌گرفت (در دودِ زنده دیده شد).
    const idemKey = req.headers.get('Idempotency-Key') ?? undefined;
    if (!idemKey) throw Err.validation('هدرِ Idempotency-Key اجباری است (جلوگیری از ساختِ دوباره با دابل‌کلیک/retry)');
    const idem = await withIdempotency<{ status: number; body: unknown }>(idemKey, 'admin-provision', `admin:${admin.sub}`);
    if (idem.replayed) {
      return NextResponse.json(idem.response.body, { status: idem.response.status });
    }

    const b = await parseBody(req, createSchema);

    if (b.attach_existing_owner) {
      throw Err.conflict(
        'attach_existing_owner_unsupported',
        'اتصالِ مالکِ موجود پشتیبانی نمی‌شود؛ برای شعبه‌ی جدیدِ همان مالک از POST /admin/restaurants/{id}/branches استفاده کنید.',
      );
    }

    const result = await provisionBusiness({
      businessName: b.business_name,
      city: b.city,
      plan: b.plan,
      trialDays: b.trial_days,
      slug: b.slug,
      ownerPhone: b.owner_phone,
      ownerName: b.owner_name,
      username: b.username,
      password: b.password,
      seedTables: b.seed_defaults?.tables,
    }, { adminId: admin.sub, ip: clientIp(req) });

    const body = {
      tenant_id: result.tenantId,
      restaurant: result.restaurant,
      owner: { staff_id: result.owner.staffId, phone: result.owner.phone, username: result.owner.username },
      provision_status: result.provisionStatus,
      trial_ends_at: result.trialEndsAt,
      invite_sent_to: result.inviteSentTo,
      login: result.owner.username
        ? { app: 'business', method: 'password' }
        : { app: 'business', method: 'otp' },
    };
    await idem.commit({ status: 201, body });
    return NextResponse.json(body, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

export const POST = withApiMetrics('/api/v1/admin/restaurants', POST_impl);
