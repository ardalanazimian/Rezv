import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { withRestaurantAuth } from '@/lib/with-restaurant-auth';
import { Err } from '@/lib/errors';
import { parseParams, zUuid, z } from '@/lib/schemas';
import { inspectImage, storageKey, MAX_BYTES } from '@/lib/media';
import { putObject, deleteObject } from '@/lib/media-store';
import { mediaUrl } from '@/lib/photo-moderation';
import { invalidatePublicMenu } from '@/lib/menu-cache';

// ═══════════════════════════════════════════════════════════════════════
//  عکسِ آیتمِ منو — آپلود / جایگزینی / حذف
//
//  چرا این روت لازم بود: تا مهاجرتِ ۰۵۳، تنها راهِ عکس‌دار‌کردنِ آیتم این
//  بود که رستوران‌دار یک **آدرسِ دلخواه** در فیلدِ image_url بنویسد. یعنی
//  هیچ تضمینی نبود که آن آدرس تصویر باشد، هیچ اعتبارسنجیِ حجم/ابعاد/فرمتی
//  در کار نبود، و منویِ روی میز به میزبانِ بیرونی وابسته می‌شد که هر وقت
//  پایین می‌آمد عکسِ شکسته نشان می‌داد.
//
//  حالا همان خطِ لوله‌ای استفاده می‌شود که گالریِ رستوران دارد:
//  تشخیصِ فرمت از روی magic-byte (نه از content-typeی که مرورگر ادعا
//  می‌کند)، سقفِ حجم و ابعاد، کلیدِ ذخیره‌سازی، و سرو از /api/v1/media/<key>.
//
//  ⚠️ تفاوتِ عمدی با گالری: عکسِ گالری `pending` می‌نشیند و تا تأییدِ پلتفرم
//  دیده نمی‌شود؛ عکسِ آیتمِ منو **بی‌درنگ منتشر می‌شود**. دلیلش مدلِ
//  اختیاراتِ محصول است: منو مالِ خودِ رستوران است و باید بدونِ دخالتِ شرکت
//  به‌روز شود. شرکت همچنان می‌تواند محتوایِ نامناسب را حذف کند، ولی مسیرِ
//  عادیِ به‌روزرسانی را قفل نمی‌کند — رستورانی که ساعتِ ۸ شب غذای تازه
//  اضافه می‌کند نمی‌تواند منتظرِ بازبینیِ فردا بماند.
//
//  مالکیت: آیتم *قبل از هر کاری* با restaurantIdِ توکن تطبیق داده می‌شود.
//  بدونِ آن، با حدسِ یک UUID می‌شد عکسِ منویِ رستورانِ دیگری را عوض کرد.
// ═══════════════════════════════════════════════════════════════════════

const idParamSchema = z.object({ id: zUuid });

/**
 * آیتم را با چکِ مالکیت پیدا می‌کند و کلیدِ عکسِ فعلی‌اش را برمی‌گرداند.
 * پیامِ خطا عمداً «یافت نشد» است تا وجود/عدمِ وجودِ id لو نرود.
 */
async function findOwnedItem(id: string, restaurantId: string) {
  const item = await db.menuItem.findUnique({
    where: { id },
    select: { id: true, restaurantId: true, name: true, imageStorageKey: true },
  });
  if (!item || item.restaurantId !== restaurantId) throw Err.notFound('آیتمِ منو');
  return item;
}

/**
 * POST — آپلود یا جایگزینیِ عکسِ آیتم (multipart/form-data، فیلدِ `file`).
 *
 * جایگزینی atomic نیست و نمی‌تواند باشد (فایل روی دیسک، ردیف در دیتابیس).
 * ترتیب طوری چیده شده که بدترین حالت یک فایلِ یتیم باشد، نه یک آیتم با
 * عکسِ ازدست‌رفته: اول فایلِ تازه نوشته می‌شود، بعد ردیف به آن اشاره
 * می‌کند، و فقط در پایان فایلِ قدیمی پاک می‌شود.
 */
export const POST = withRestaurantAuth(
  { rateLimit: 'auth', permission: 'canManageSettings' },
  async (req, ctx, rawParams: { id: string }) => {
    const { id } = parseParams(rawParams, idParamSchema);
    const item = await findOwnedItem(id, ctx.restaurant.id);

    const type = req.headers.get('content-type') || '';
    if (!type.toLowerCase().includes('multipart/form-data')) {
      throw Err.validation('عکس باید به‌صورتِ فایل (multipart/form-data) فرستاده شود');
    }

    // Content-Length پیش از خواندنِ بدنه بررسی می‌شود: بدونِ این، یک فایلِ
    // بزرگ کاملاً در حافظه‌ی سرور بافر می‌شود و بعد رد می‌شود.
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

    const key = storageKey(info.format, randomUUID());
    await putObject(key, bytes);

    let updated;
    try {
      updated = await db.menuItem.update({
        where: { id },
        data: {
          imageUrl: mediaUrl(key),
          imageStorageKey: key,
          imageMime: info.mime,
          imageWidth: info.width,
          imageHeight: info.height,
          imageByteSize: info.bytes,
        },
        select: { id: true, name: true, imageUrl: true },
      });
    } catch (e) {
      // اگر به‌روزرسانی شکست خورد، فایلِ تازه یتیم روی دیسک نماند.
      await deleteObject(key);
      throw e;
    }

    // عکسِ قبلی فقط بعد از موفقیتِ به‌روزرسانی پاک می‌شود. اگر این حذف
    // شکست بخورد، یک فایلِ بلااستفاده می‌ماند — آزاردهنده ولی بی‌خطر؛
    // برعکسش (پاک‌کردنِ زودهنگام) یعنی آیتم عکسِ مرده نشان می‌دهد.
    if (item.imageStorageKey && item.imageStorageKey !== key) {
      await deleteObject(item.imageStorageKey).catch(() => {});
    }

    await invalidatePublicMenu(ctx.restaurant.id);

    return NextResponse.json({
      id: updated.id,
      image_url: updated.imageUrl,
      width: info.width,
      height: info.height,
      byte_size: info.bytes,
      // بی‌درنگ منتشر می‌شود — برخلافِ گالری که منتظرِ تأیید می‌ماند.
      message: `عکسِ «${updated.name}» به‌روز شد و همین حالا در منویِ عمومی دیده می‌شود.`,
    }, { status: 201 });
  },
);

/** DELETE — برداشتنِ عکسِ آیتم (خودِ آیتم می‌ماند). */
export const DELETE = withRestaurantAuth(
  { rateLimit: 'auth', permission: 'canManageSettings' },
  async (_req, ctx, rawParams: { id: string }) => {
    const { id } = parseParams(rawParams, idParamSchema);
    const item = await findOwnedItem(id, ctx.restaurant.id);

    if (!item.imageStorageKey) {
      // آیتمی که عکس ندارد — این خطا نیست، ولی هم نباید بی‌صدا «موفق» باشد.
      return NextResponse.json({ id, removed: false, message: 'این آیتم عکسی ندارد.' });
    }

    await db.menuItem.update({
      where: { id },
      data: {
        imageUrl: null, imageStorageKey: null, imageMime: null,
        imageWidth: null, imageHeight: null, imageByteSize: null,
      },
    });
    // ترتیب: اول ردیف قطعِ ارجاع می‌کند، بعد فایل. برعکسش یعنی پنجره‌ای که
    // آیتم به فایلِ پاک‌شده اشاره دارد.
    await deleteObject(item.imageStorageKey).catch(() => {});
    await invalidatePublicMenu(ctx.restaurant.id);

    return NextResponse.json({ id, removed: true, message: `عکسِ «${item.name}» برداشته شد.` });
  },
);
