import { NextResponse } from 'next/server';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { errorResponse } from '@/lib/errors';
import { resealSecrets } from '@/lib/secret-reseal';

import { withApiMetrics } from '@/lib/api-metrics';

/**
 * POST /api/v1/maintenance/secrets-reseal — بازرمزنگاریِ رازهای ذخیره‌شده (S-05، حکمِ D-24).
 *
 * ⚠️ عمداً در `cron/crontab` نیست: یک اقدامِ اپراتور است (توضیحِ کامل در lib/secret-reseal.ts).
 *
 *  • بدونِ پارامتر: هر رازِ رمزشده با کلیدی جز SECRETS_ACTIVE_KEY_ID با کلیدِ فعال دوباره
 *    رمز می‌شود (چرخش). متنِ ساده فقط شمرده می‌شود.
 *  • `?seal_plaintext=1`: متنِ ساده هم رمز می‌شود — مهاجرتِ یک‌باره، **بلافاصله** پس از دیپلوی (تا آن لحظه پرداخت و وب‌هوک عمداً fail-closedاند؛ گیتِ A2 خروجیِ همین را می‌خواهد).
 *
 * چرخشِ کلید:  کلیدِ تازه را به SECRETS_KEYRING بیفزا و SECRETS_ACTIVE_KEY_ID را رویش بگذار →
 * ری‌استارت → همین مسیر → فقط وقتی اجرای بعدی `rekeyed=0` و `failed=[]` داد، کلیدِ قبلی را بردار.
 *
 * پاسخ فقط شمارش و شناسه است. هر `failed` ⇒ ۵۰۰، تا cron/اپراتور شکست را سبز نخواند.
 */
async function POST_impl(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;

    const sealPlaintext = new URL(req.url).searchParams.get('seal_plaintext') === '1';
    const report = await resealSecrets({ sealPlaintext });
    return NextResponse.json(report, { status: report.failed.length ? 500 : 200 });
  } catch (e) { return errorResponse(e); }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
export const POST = withApiMetrics('/api/v1/maintenance/secrets-reseal', POST_impl);
