import { NextResponse } from 'next/server';
import { enforceRateLimit, clientIp } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { createInquiry, contextFromRequest, SITE_RULES } from '@/lib/site-orders';

import { withApiMetrics } from '@/lib/api-metrics';

// ═══════════════════════════════════════════════════════════════════════
//  POST /api/v1/site/contact — تماس با فروش / پرسشِ عمومیِ سایت
//
//  یک ردیفِ واقعی در site_inquiries می‌سازد، رویدادِ پلتفرم ثبت می‌کند و به
//  ایمیلِ فروش (تنظیمِ sales_notify_email) اعلان می‌دهد. صندوقِ ورودی‌اش در
//  استودیو و پنلِ شرکت دیده و پاسخ داده می‌شود.
// ═══════════════════════════════════════════════════════════════════════

const bodySchema = z.object({
  name: z.string().min(2).max(80).trim(),
  phone: zPhone,
  email: z.string().email().max(160).optional(),
  company: z.string().max(120).trim().optional(),
  topic: z.enum(['sales', 'support', 'partnership', 'press', 'other'] as const).default('sales'),
  message: z.string().min(5).max(4000).trim(),
  utm_source: z.string().max(100).optional(),
  landing_path: z.string().max(300).optional(),
});

async function POST_impl(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), SITE_RULES.contact);
    const body = await parseBody(req, bodySchema);

    const result = await createInquiry(
      {
        name: body.name,
        phone: body.phone,
        email: body.email,
        company: body.company,
        topic: body.topic,
        message: body.message,
      },
      contextFromRequest(req, body as Record<string, unknown>),
    );

    return NextResponse.json(result, { status: 201 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/site/contact', POST_impl);
