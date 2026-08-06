import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { createPurchaseOrder, contextFromRequest, SITE_RULES } from '@/lib/site-orders';

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/v1/site/orders — ثبتِ درخواستِ خریدِ اشتراک
//
//  قیمت و مدت از کلاینت گرفته نمی‌شوند: فقط `plan_key` می‌آید و سرور مبلغ را
//  از SitePlan می‌خواند و روی سفارش اسنپ‌شات می‌کند. خروجی کدِ پیگیری است که
//  کاربر با آن /order/{code} را می‌بیند.
//
//  سفارش با وضعیتِ pending ثبت می‌شود و پنلِ شرکت (اپِ کمپانی) مسئولِ
//  فعال‌سازی است — رویدادِ پلتفرم + ایمیلِ فروش + صفِ در انتظار همان لحظه.
// ═══════════════════════════════════════════════════════════════════════

const bodySchema = z.object({
  plan_key: z.string().min(1).max(30),
  business_name: z.string().min(2).max(120).trim(),
  contact_name: z.string().min(2).max(80).trim(),
  phone: zPhone,
  email: z.string().email().max(160).optional(),
  city: z.string().max(80).trim().optional(),
  branch_count: z.number().int().min(1).max(500).optional(),
  note: z.string().max(1000).trim().optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(120).optional(),
  landing_path: z.string().max(300).optional(),
  referrer: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), SITE_RULES.order);
    const body = await parseBody(req, bodySchema);

    const result = await createPurchaseOrder(
      {
        planKey: body.plan_key,
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
        // مسیرِ شفافِ بعد از ثبت — همان چیزی که صفحه‌ی خرید به کاربر نشان می‌دهد.
        next_step: 'کارشناسِ رزرونو برای هماهنگیِ پرداخت تماس می‌گیرد؛ پس از تأیید، اشتراک از پنلِ شرکت فعال می‌شود.',
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (e) { return errorResponse(e); }
}
