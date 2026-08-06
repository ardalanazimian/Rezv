import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { adminAuthFromRequest } from '@/lib/admin-auth';
import { setPlatformSetting } from '@/lib/platform-settings';
import { audit } from '@/lib/audit';
import { errorResponse } from '@/lib/errors';
import { parseBody, z } from '@/lib/schemas';

// ⚠️ همگام‌سازی‌شده با DB زنده (migration 020_platform_settings_payment_toggle).
// این روت قبلاً اصلاً وجود نداشت — جدول platform_settings روی DB بود ولی هیچ
// endpointـی برای «تنظیمات پلتفرم» در پنل شرکت نبود.

// فقط کلیدهای شناخته‌شده قابل‌تنظیم از این مسیرند (جلوگیری از نوشتنِ کلیدِ دلخواه)
// sales_notify_email: گیرنده‌ی اعلانِ درخواست‌های وب‌سایت (ADR 0002). در دیتابیس
// نگه داشته می‌شود تا تغییرِ مسئولِ فروش نیازی به ری‌دیپلوی نداشته باشد.
const ALLOWED_KEYS = ['zarinpal_merchant_id', 'zarinpal_sandbox', 'sales_notify_email'] as const;

const patchSchema = z.object({
  settings: z.array(z.object({
    key: z.enum(ALLOWED_KEYS),
    value: z.string().max(500),
  })).min(1).max(20),
});

/** GET — همه‌ی تنظیماتِ پلتفرمِ فعلی */
export async function GET(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.search);
    adminAuthFromRequest(req);
    const rows = await db.platformSettings.findMany({ where: { key: { in: [...ALLOWED_KEYS] } } });
    const settings: Record<string, string> = {};
    for (const k of ALLOWED_KEYS) settings[k] = '';
    for (const r of rows) settings[r.key] = r.value;
    return NextResponse.json({ settings });
  } catch (e) { return errorResponse(e); }
}

/** PATCH — به‌روزرسانیِ یک یا چند تنظیم · بدنه: { settings: [{ key, value }] } */
export async function PATCH(req: Request) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = adminAuthFromRequest(req);
    const { settings } = await parseBody(req, patchSchema);

    for (const s of settings) {
      await setPlatformSetting(s.key, s.value, admin.sub);
    }

    await audit({
      action: 'admin.action', actorId: admin.sub, actorType: 'admin', ip: clientIp(req),
      detail: { operation: 'platform_settings_update', keys: settings.map(s => s.key) },
    });

    return NextResponse.json({ ok: true });
  } catch (e) { return errorResponse(e); }
}
