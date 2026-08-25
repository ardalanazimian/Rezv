import { NextResponse } from 'next/server';
import { requestOtp, normalizePhone } from '@/lib/otp';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { errorResponse } from '@/lib/errors';
import { parseBody, zPhone, z } from '@/lib/schemas';
import { audit, maskPhone } from '@/lib/audit';

import { withApiMetrics } from '@/lib/api-metrics';
import { findStaffForLogin } from '@/lib/staff-helpers';

const schema = z.object({ phone: zPhone });

// ═══════════════════════════════════════════════════════════════════════
//  ⚠️ رفعِ شمارش‌پذیریِ شماره (فازِ ۲، یافته‌ی ۱۸ در docs/recovery/OPEN-FINDINGS.md)
//
//  قبلاً این مسیر **سه** حالتِ متمایز با سه پیامِ متمایز برمی‌گرداند:
//    ۴۰۳ «این شماره دسترسی پنل رستوران ندارد»  ← شماره اصلاً کارمند نیست
//    ۴۰۳ «این حساب غیرفعال شده است»            ← کارمندِ اخراج‌شده
//    ۲۰۴                                        ← کارمندِ فعال
//  یعنی با `RULES.otpVerify` (۸ در ۱۰ دقیقه به‌ازای هر IP) می‌شد فهرستِ
//  کارکنانِ سامانه و حتی وضعیتِ استخدامشان را نگاشت کرد.
//
//  حالا هر سه حالت پاسخِ یکسان می‌دهند. **دسترسی عوض نشده**: کدِ OTP هنوز
//  فقط برایِ کارمندِ فعال ساخته و ارسال می‌شود (تستِ رگرسیون این را جدا
//  می‌سنجد)، پس هزینه‌ی پیامکی هم اضافه نمی‌شود — فقط *پاسخ* یکدست شد.
//
//  سیگنالِ امنیتی به audit منتقل شد (`auth.failure`)، نه اینکه حذف شود.
//
//  ⚠️ **یافته‌ی بازِ همسایه، عمداً اینجا رفع نشده (ارجاع به معمار):**
//  `findFirst({ where: { phone } })` بدونِ تنانت و بدونِ `orderBy` است، در
//  حالی که `@@unique([tenantId, phone])` یعنی یک شماره می‌تواند در چند
//  تنانت کارمند باشد. رفعِ درست به ستونِ `created_at` روی جدولِ `staff`
//  نیاز دارد (امروز وجود ندارد — نه در schema.prisma و نه در DBِ زنده)،
//  یعنی تغییرِ اسکیما، که طبقِ پروتکل باید اول تأیید شود. جزئیات و
//  بهره‌برداریِ تأییدشده در گزارشِ همین دسته‌کار.
// ═══════════════════════════════════════════════════════════════════════

/** POST — درخواست کد ورود کارمند (فقط شماره‌های ثبت‌شده و فعال در جدول Staff) */
async function POST_impl(req: Request) {
  const ip = clientIp(req);
  try {
    await enforceRateLimit(ip, RULES.otpVerify);
    const { phone } = await parseBody(req, schema);
    const phoneMasked = maskPhone(phone);
    const normalized = normalizePhone(phone);

    const staff = await findStaffForLogin(normalized);
    if (!staff || !staff.isActive) {
      // پاسخِ یکسان بیرون، تفکیکِ کامل داخلِ audit.
      await audit({
        action: 'auth.failure', actorType: 'staff', ip, success: false,
        actorId: staff?.id ?? null,
        detail: {
          channel: 'staff-request', phone_masked: phoneMasked,
          reason: staff ? 'STAFF_DEACTIVATED' : 'NOT_STAFF',
        },
      });
      return new NextResponse(null, { status: 204 });
    }

    const r = await requestOtp(normalized);
    return r.devCode ? NextResponse.json(r) : new NextResponse(null, { status: 204 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const POST = withApiMetrics('/api/v1/auth/staff/request', POST_impl);
