import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { canReviewHoursChange } from '@/lib/hours-approval';
import { invalidateAllAvailability } from '@/lib/availability-cache';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ id: zUuid });
const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  /** دلیل فقط برای رد — رستوران‌دار باید بداند چه چیزی را اصلاح کند. */
  reason: z.string().trim().max(300).optional(),
});

/**
 * PATCH /api/v1/admin/hours-changes/[id] — تأیید یا ردِ پیشنهادِ ساعتِ کاریِ یک رستوران (پنل شرکت).
 *
 * id همان restaurant.id است (نه یک ردیفِ جداگانه — رجوع کن به توضیحِ
 * hours-approval.ts برای دلیلِ این طراحی).
 *
 * تأیید = pendingOpeningHours همین الان openingHoursِ زنده می‌شود؛ صفِ
 * بازبینی پاک می‌شود؛ کشِ availability برایِ *همه‌ی* تاریخ‌های این رستوران
 * باطل می‌شود (نه فقط یک تاریخ — ساعتِ کاریِ هفتگی روی همه‌ی تاریخ‌های
 * آینده اثر دارد).
 * رد = openingHoursِ زنده دست‌نخورده می‌ماند؛ pendingOpeningHours برایِ
 * نمایش به رستوران‌دار می‌ماند (همراهِ دلیل)؛ رستوران‌دار باید دوباره
 * پیشنهاد بدهد تا برگردد به صف.
 *
 * هر دو تصمیم audit می‌شوند — دقیقاً مثلِ بازبینیِ عکس، این یک تصمیمِ
 * حاکمیتیِ پلتفرم است.
 */
async function PATCH_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);
    const body = await parseBody(req, bodySchema);

    const r = await db.restaurant.findUnique({
      where: { id },
      select: { id: true, pendingOpeningHours: true, hoursChangeStatus: true, slug: true },
    });
    if (!r) throw Err.notFound('رستوران');
    if (!canReviewHoursChange(r.hoursChangeStatus)) {
      throw Err.validation('این رستوران الان پیشنهادِ در دستِ بررسی ندارد');
    }
    // ⚠️ محافظِ سلامتِ داده: status='pending' بدونِ یک پیشنهادِ واقعی یعنی
    // ناسازگاریِ داده (نباید رخ دهد، ولی اگر رخ داد نباید ساعتِ کاریِ زنده
    // را با null پاک کند — که معنایش «همیشه باز» است، نه یک حالتِ امن).
    if (body.action === 'approve' && r.pendingOpeningHours === null) {
      throw Err.validation('پیشنهادِ ساعتِ کاری خالی است — چیزی برای تأیید نیست');
    }

    if (body.action === 'approve') {
      await db.restaurant.update({
        where: { id },
        data: {
          // فیلدهایِ Json در Prisma با literal null قاطی می‌شوند (یعنی «تنظیم‌نشده»
          // در برابرِ «مقدارِ JSON خالی») — sentinelِ Prisma.JsonNull لازم است.
          openingHours: r.pendingOpeningHours === null ? Prisma.JsonNull : r.pendingOpeningHours,
          pendingOpeningHours: Prisma.JsonNull,
          hoursChangeStatus: null,
          hoursChangeReason: null,
          hoursChangeReviewedAt: new Date(),
          hoursChangeReviewedBy: admin.sub,
        },
      });

      // ⚠️ بدونِ این، ساعتِ کاریِ تازه‌تأییدشده تا انقضایِ TTL کشِ قدیمی
      // (که با ساعتِ کاریِ زنده‌ی قبلی محاسبه شده) به مشتری نشان داده
      // نمی‌شد — دقیقاً همان کلاسِ باگی که invalidate(cacheKey(...)) در
      // admin/photos/[id] برایش نوشته شده، ولی اینجا باید *همه‌ی* تاریخ‌ها
      // را بگیرد چون ساعتِ کاری هفتگی/تکرارشونده است، نه یک رزروِ تک.
      await invalidateAllAvailability(id);

      await audit({
        action: 'hours.approved',
        actorId: admin.sub,
        actorType: 'admin',
        targetId: id,
        restaurantId: id,
        ip: clientIp(req),
        detail: { opening_hours: r.pendingOpeningHours },
      });

      return NextResponse.json({ id, status: 'approved' });
    }

    // reject
    const reason = body.reason?.trim();
    if (!reason) throw Err.validation('دلیلِ رد الزامی است');

    const updated = await db.restaurant.update({
      where: { id },
      data: {
        hoursChangeStatus: 'rejected',
        hoursChangeReason: reason,
        hoursChangeReviewedAt: new Date(),
        hoursChangeReviewedBy: admin.sub,
      },
      select: { hoursChangeStatus: true, hoursChangeReason: true, hoursChangeReviewedAt: true },
    });

    await audit({
      action: 'hours.rejected',
      actorId: admin.sub,
      actorType: 'admin',
      targetId: id,
      restaurantId: id,
      ip: clientIp(req),
      detail: { reason },
    });

    return NextResponse.json({
      id,
      status: updated.hoursChangeStatus,
      rejection_reason: updated.hoursChangeReason,
      reviewed_at: updated.hoursChangeReviewedAt?.toISOString() ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const PATCH = withApiMetrics('/api/v1/admin/hours-changes/[id]', PATCH_impl);
