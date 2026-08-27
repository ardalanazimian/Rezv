import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enforceRateLimit, clientIp, RULES } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/audit';
import { Err, errorResponse } from '@/lib/errors';
import { parseBody, parseParams, zUuid, z } from '@/lib/schemas';
import { canTransition, type PhotoStatus } from '@/lib/photo-moderation';
import { deleteObject } from '@/lib/media-store';
import { invalidate, cacheKey } from '@/lib/cache';

import { withApiMetrics } from '@/lib/api-metrics';

const paramsSchema = z.object({ id: zUuid });
const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  /** دلیل فقط برای رد. رستوران‌دار باید بداند چه چیزی را اصلاح کند. */
  reason: z.string().trim().max(300).optional(),
});

/**
 * PATCH /api/v1/admin/photos/[id] — تأیید یا ردِ عکسِ گالری (پنل شرکت).
 *
 * تأیید = عکس از همین لحظه در صفحه‌ی عمومیِ رستوران و اپ مشتری دیده می‌شود.
 * رد = عکس می‌ماند ولی عمومی نمی‌شود؛ رستوران‌دار دلیل را می‌بیند و می‌تواند
 * حذفش کند و نسخه‌ی بهتری بفرستد.
 *
 * هر دو تصمیم audit می‌شوند: این یک تصمیمِ انتشار روی برندِ پلتفرم است و
 * باید بشود گفت چه کسی و کِی آن را گرفته.
 */
async function PATCH_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);
    const body = await parseBody(req, bodySchema);

    const photo = await db.restaurantPhoto.findUnique({
      where: { id },
      select: {
        id: true, status: true, restaurantId: true, caption: true,
        restaurant: { select: { slug: true } },
      },
    });
    if (!photo) throw Err.notFound('عکس');

    const next: PhotoStatus = body.action === 'approve' ? 'approved' : 'rejected';
    if (!canTransition(photo.status as PhotoStatus, next)) {
      throw Err.validation(`این عکس از قبل ${next === 'approved' ? 'تأیید' : 'رد'} شده است`);
    }

    const reason = body.action === 'reject' ? (body.reason?.trim() || null) : null;

    const updated = await db.restaurantPhoto.update({
      where: { id },
      data: {
        status: next,
        reviewedAt: new Date(),
        reviewedById: admin.sub,
        rejectionReason: reason,
      },
      select: { id: true, status: true, reviewedAt: true, rejectionReason: true },
    });

    // ⚠️ بدونِ این، تصمیمِ بازبین تا ۶۰ ثانیه روی صفحه‌ی عمومی اثر نمی‌کرد
    // (کشِ restaurant-detail). برای «تأیید» یک تأخیرِ کوتاه بی‌ضرر است، ولی
    // برای «رد» یعنی عکسِ نامناسب یک دقیقه‌ی دیگر هم عمومی می‌ماند — و کلِ
    // هدفِ این سامانه همین است. در آزمونِ سرتاسری دیده شد.
    await invalidate(cacheKey('restaurant-detail', photo.restaurant.slug));

    await audit({
      action: body.action === 'approve' ? 'photo.approved' : 'photo.rejected',
      actorId: admin.sub,
      actorType: 'admin',
      targetId: id,
      restaurantId: photo.restaurantId,
      ip: clientIp(req),
      detail: { from: photo.status, to: next, reason },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      reviewed_at: updated.reviewedAt?.toISOString() ?? null,
      rejection_reason: updated.rejectionReason,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * DELETE /api/v1/admin/photos/[id] — حذفِ کاملِ عکس توسطِ پنل شرکت.
 *
 * برای محتوایی که نباید حتی روی دیسک بماند (مثلاً تصویرِ نامناسب). رد کردن
 * برای موارد عادی کافی است؛ این مسیر برای موردِ حاد است و فایل را هم پاک
 * می‌کند.
 */
async function DELETE_impl(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await enforceRateLimit(clientIp(req), RULES.auth);
    const admin = await requireAdmin(req);
    const { id } = parseParams(await params, paramsSchema);

    const photo = await db.restaurantPhoto.findUnique({
      where: { id },
      select: {
        id: true, storageKey: true, restaurantId: true, status: true,
        restaurant: { select: { slug: true } },
      },
    });
    if (!photo) throw Err.notFound('عکس');

    await db.restaurantPhoto.delete({ where: { id } });
    if (photo.storageKey) await deleteObject(photo.storageKey);
    await invalidate(cacheKey('restaurant-detail', photo.restaurant.slug));

    await audit({
      action: 'photo.deleted',
      actorId: admin.sub,
      actorType: 'admin',
      targetId: id,
      restaurantId: photo.restaurantId,
      ip: clientIp(req),
      detail: { status: photo.status, by: 'platform_admin' },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

// ── رصدپذیری: تنها نقطه‌ی شمارشِ HTTPِ این route (rezervno_http_*).
//    برچسبِ مسیر عمداً الگویِ ثابتِ فایل است، نه pathnameِ خام — رجوع کن به lib/api-metrics.ts.
export const PATCH = withApiMetrics('/api/v1/admin/photos/[id]', PATCH_impl);
export const DELETE = withApiMetrics('/api/v1/admin/photos/[id]', DELETE_impl);
