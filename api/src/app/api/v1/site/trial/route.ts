import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { createTrialAccount, contextFromRequest, SITE_RULES, TRIAL_DAYS } from '@/lib/site-orders';

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/v1/site/trial — ساختِ حسابِ دموی ۳۰ روزه‌ی پنلِ کسب‌وکار
//
//  این یک فرمِ سرنخ نیست: همین‌جا Tenant + Restaurant + Staff(owner) واقعی
//  ساخته می‌شود و کاربر بلافاصله می‌تواند با همان شماره وارد پنل شود.
//  idempotent روی شماره — ارسالِ دوباره‌ی فرم، کسب‌وکارِ دوم نمی‌سازد.
//
//  ریت‌لیمیت سخت‌گیرانه (۵ در ساعت به‌ازای IP) چون هر فراخوان تنانتِ واقعی می‌سازد.
// ═══════════════════════════════════════════════════════════════════════

const bodySchema = z.object({
  business_name: z.string().min(2).max(120).trim(),
  contact_name: z.string().min(2).max(80).trim(),
  phone: zPhone,
  email: z.string().email().max(160).optional(),
  city: z.string().max(80).trim().optional(),
  branch_count: z.number().int().min(1).max(500).optional(),
  note: z.string().max(1000).trim().optional(),
  // انتسابِ کمپین (اختیاری — کلاینت از URLِ فرود برمی‌دارد)
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(120).optional(),
  landing_path: z.string().max(300).optional(),
  referrer: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), SITE_RULES.trial);
    const body = await parseBody(req, bodySchema);

    const result = await createTrialAccount(
      {
        businessName: body.business_name,
        contactName: body.contact_name,
        phone: body.phone,
        email: body.email,
        city: body.city,
        branchCount: body.branch_count,
        note: body.note,
      },
      contextFromRequest(req, body as Record<string, unknown>),
    );

    return NextResponse.json(
      {
        ...result,
        trial_days: TRIAL_DAYS,
        // مسیرِ بعدیِ کاربر: ورود به پنلِ کسب‌وکار با همین شماره (OTP).
        next_step: 'ورود به پنلِ کسب‌وکار با همین شماره و کدِ پیامکی',
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (e) { return errorResponse(e); }
}
