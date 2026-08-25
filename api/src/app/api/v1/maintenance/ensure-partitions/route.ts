import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardMaintenance } from '@/lib/maintenance-auth';
import { createLogger } from '@/lib/logger';
import { errorResponse } from '@/lib/errors';

const log = createLogger('partitions');

/**
 * POST /api/v1/maintenance/ensure-partitions — ساخت پارتیشن ماه آینده.
 *
 * حیاتی: اگر جدول reservations پارتیشن‌بندی شده باشد و پارتیشن ماه آینده
 * ساخته نشده باشد، insert رزروهای آن ماه با خطا مواجه می‌شود. این route
 * (cron ماهانه) پارتیشن‌های ماه جاری + ۲ ماه آینده را تضمین می‌کند.
 *
 * بی‌خطر اگر جدول هنوز partitioned نشده: تابع وجود ندارد → پیام رد می‌دهد.
 */
export async function POST(req: Request) {
  try {
    const denied = guardMaintenance(req);
    if (denied) return denied;

    // تابع ensure_reservation_partition باید از migration 011 موجود باشد
    const results: string[] = [];
    for (const offset of [0, 1, 2]) {
      try {
        const rows = await db.$queryRaw<{ ensure_reservation_partition: string }[]>`
          SELECT ensure_reservation_partition((CURRENT_DATE + (${offset} || ' months')::interval)::date)
        `;
        if (rows[0]) results.push(rows[0].ensure_reservation_partition);
      } catch (e) {
        // اگر تابع وجود ندارد (جدول هنوز partitioned نشده)، تمیز رد کن
        log.warn('تابع پارتیشن موجود نیست (جدول partitioned نشده؟)', (e as Error).message);
        return NextResponse.json({ ok: false, reason: 'partitioning not enabled', detail: (e as Error).message });
      }
    }
    log.info('ensure-partitions', { results });
    return NextResponse.json({ ok: true, partitions: results });
  } catch (e) { return errorResponse(e); }
}

// Vercel Cron از GET استفاده می‌کند؛ به همان منطق POST وصلش می‌کنیم.
export const GET = POST;
