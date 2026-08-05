import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseQuery, zUuid, z } from '@/lib/schemas';
import { inspectImage, storageKey, MAX_BYTES } from '@/lib/media';
import { putObject, deleteObject } from '@/lib/media-store';
import { PHOTO_CATEGORIES, ownerView, mediaUrl } from '@/lib/photo-moderation';
import { audit } from '@/lib/audit';
import { clientIp } from '@/lib/ratelimit';
import { invalidate, cacheKey } from '@/lib/cache';

const deleteQuery = z.object({ id: zUuid });

/** GET — عکس‌های گالری رستوران، همراه با وضعیتِ بازبینی. */
export const GET = withRestaurantAuth({ rateLimit: 'search' }, async (_req, ctx) => {
  const photos = await db.restaurantPhoto.findMany({
    where: { restaurantId: ctx.restaurant.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  const items = photos.map(ownerView);
  return NextResponse.json({
    items,
    // شمارشِ آماده برای پنل، تا UI مجبور نباشد خودش فیلتر و بشمارد
    counts: {
      total: items.length,
      approved: items.filter((p) => p.status === 'approved').length,
      pending: items.filter((p) => p.status === 'pending').length,
      rejected: items.filter((p) => p.status === 'rejected').length,
    },
  });
});

/**
 * POST — آپلودِ مستقیمِ عکس (multipart/form-data).
 *
 * فیلدها: file (اجباری)، category، caption، sort_order
 *
 * عکس با وضعیتِ pending ذخیره می‌شود و تا تأییدِ پنلِ شرکت هیچ‌جای عمومی
 * دیده نمی‌شود. پیش از این، آدرسِ دلخواهی که رستوران می‌داد بی‌درنگ روی
 * صفحه‌ی عمومی و اپ مشتری می‌نشست — یعنی هر تصویری بدونِ بازبینی روی برندِ
 * پلتفرم منتشر می‌شد.
 */
export const POST = withRestaurantAuth(
  { rateLimit: 'auth', permission: 'canManageSettings' },
  async (req, ctx) => {
    const type = req.headers.get('content-type') || '';
    if (!type.toLowerCase().includes('multipart/form-data')) {
      throw Err.validation('عکس باید به‌صورتِ فایل (multipart/form-data) فرستاده شود');
    }

    // Content-Length پیش از خواندنِ بدنه بررسی می‌شود: بدونِ این، یک فایلِ
    // ۵۰۰ مگابایتی کاملاً در حافظه‌ی سرور بافر می‌شد و بعد رد می‌شد.
    const declared = Number(req.headers.get('content-length') || 0);
    if (declared > MAX_BYTES + 64 * 1024) {
      throw Err.validation(`حجمِ عکس نباید از ${Math.round(MAX_BYTES / 1024 / 1024)} مگابایت بیشتر باشد`);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw Err.validation('بدنه‌ی درخواست خوانده نشد');
    }

    const file = form.get('file');
    if (!(file instanceof File)) throw Err.validation('فایلِ عکس فرستاده نشده است');

    const bytes = new Uint8Array(await file.arrayBuffer());
    // به content-type ی که مرورگر اعلام کرده اعتماد نمی‌شود؛ فقط بایت‌ها.
    const info = inspectImage(bytes);
    if (!info.ok) throw Err.validation(info.error);

    const rawCategory = String(form.get('category') || 'food');
    const category = (PHOTO_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : 'food';
    const caption = String(form.get('caption') || '').trim().slice(0, 300) || null;
    const sortOrder = Math.max(0, Math.min(9999, Number(form.get('sort_order')) || 0));

    const key = storageKey(info.format, randomUUID());
    await putObject(key, bytes);

    let photo;
    try {
      photo = await db.restaurantPhoto.create({
        data: {
          restaurantId: ctx.restaurant.id,
          url: mediaUrl(key),
          storageKey: key,
          mimeType: info.mime,
          byteSize: info.bytes,
          width: info.width,
          height: info.height,
          originalName: file.name ? String(file.name).slice(0, 200) : null,
          caption,
          category,
          sortOrder,
          status: 'pending',
          uploadedByStaffId: ctx.auth.sub,
        },
      });
    } catch (e) {
      // اگر درج شکست خورد، فایلِ یتیم روی دیسک نماند.
      await deleteObject(key);
      throw e;
    }

    return NextResponse.json(
      {
        id: photo.id,
        status: photo.status,
        url: photo.url,
        width: info.width,
        height: info.height,
        message: 'عکس آپلود شد و برای تأیید فرستاده شد. پس از تأیید در صفحه‌ی رستوران نمایش داده می‌شود.',
      },
      { status: 201 },
    );
  },
);

/** DELETE ?id= — حذفِ عکس (در هر وضعیتی؛ صاحبِ عکس همیشه می‌تواند پسش بگیرد). */
export const DELETE = withRestaurantAuth(
  { rateLimit: 'auth', permission: 'canManageSettings' },
  async (req, ctx) => {
    const { id } = parseQuery(req, deleteQuery);
    const photo = await db.restaurantPhoto.findUnique({
      where: { id },
      select: {
        restaurantId: true, storageKey: true, status: true,
        restaurant: { select: { slug: true } },
      },
    });
    if (!photo || photo.restaurantId !== ctx.restaurant.id) throw Err.notFound('عکس');

    await db.restaurantPhoto.delete({ where: { id } });
    if (photo.storageKey) await deleteObject(photo.storageKey);
    // حذفِ عکسِ تأییدشده باید بی‌درنگ از صفحه‌ی عمومی برود، نه با ۶۰ ثانیه تأخیر.
    await invalidate(cacheKey('restaurant-detail', photo.restaurant.slug));

    await audit({
      action: 'photo.deleted',
      actorId: ctx.auth.sub,
      actorType: 'staff',
      targetId: id,
      restaurantId: ctx.restaurant.id,
      ip: clientIp(req),
      detail: { status: photo.status },
    });
    return NextResponse.json({ ok: true });
  },
);
