import { randomBytes } from 'crypto';
import { db } from './db';
import { transitionReservation } from './lifecycle';
import { Err } from './errors';
import { invalidateAllAvailability } from './availability-cache';

// ═══════════════════════════════════════════════════════════
//  سرویس مدیریت میز رزرونو — وضعیت، QR، تخصیص
// ═══════════════════════════════════════════════════════════

export type TableState = 'free' | 'reserved' | 'occupied' | 'cleaning' | 'maintenance';

// ── انتقال‌های مجاز وضعیت میز (state machine) ──
// جلوگیری از تغییرهای بی‌معنی (مثلاً از maintenance مستقیم به occupied).
const ALLOWED_TRANSITIONS: Record<TableState, TableState[]> = {
  free:        ['reserved', 'occupied', 'cleaning', 'maintenance'],
  reserved:    ['occupied', 'free', 'cleaning', 'maintenance'],
  occupied:    ['cleaning', 'free', 'maintenance'],
  cleaning:    ['free', 'maintenance'],
  maintenance: ['free'],
};

// ── تولید کد QR یکتا برای میز ──
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genQrToken(): string {
  const b = randomBytes(10);
  let out = 'T-';
  for (let i = 0; i < 10; i++) out += B32[b[i] % 32];
  return out;
}

// ── تغییر وضعیت میز با اعتبارسنجی انتقال ──
export async function setTableState(
  tableId: string,
  restaurantId: string,
  next: TableState,
): Promise<{ id: string; number: number; state: TableState }> {
  const t = await db.table.findUnique({ where: { id: tableId } });
  if (!t || t.restaurantId !== restaurantId) throw Err.tableNotFound(0);
  const current = t.state as TableState;
  if (current === next) return { id: t.id, number: t.number, state: next };
  // M3: اگر وضعیت فعلی در نقشه‌ی انتقال نباشد (داده‌ی قدیمی/ناشناخته)، به‌جای
  // TypeError یک خطای اعتبارسنجی تمیز بده.
  const allowed = ALLOWED_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw Err.invalidTransition(current, next);
  }
  const updated = await db.table.update({
    where: { id: tableId },
    data: { state: next },
    select: { id: true, number: true, state: true, restaurantId: true },
  });
  // maintenance تنها stateای است که availability آن را فیلتر می‌کند — ورود/خروج
  // از آن باید کش را باطل کند، وگرنه میزِ ازکارافتاده تا TTL برای مشتری «آزاد»
  // می‌ماند (ممیزیِ ۲۰۲۶-۰۸-۲۴). بقیه‌ی انتقال‌ها اثری در محاسبه ندارند.
  if (next === 'maintenance' || current === 'maintenance') {
    await invalidateAllAvailability(restaurantId).catch(() => {});
  }
  return updated as { id: string; number: number; state: TableState };
}

/**
 * آیا این خطا نقضِ یکتاییِ Postgres است؟ (کدِ ۲۳۵۰۵ / P2002 در Prisma)
 *
 * ⚠️ چرا لازم شد: حلقه‌ی retryِ قبلی **هر** خطایی را می‌بلعید و دوباره تلاش
 * می‌کرد — یعنی اگر میز حذف شده بود یا دیتابیس قطع بود، پنج بار بی‌فایده
 * تلاش می‌کرد و بعد خطایی می‌داد که ربطی به علتِ واقعی نداشت. retry فقط
 * برای تصادمِ کد معنا دارد؛ بقیه‌ی خطاها باید فوراً بالا بروند.
 */
function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code === 'P2002' || code === '23505') return true;
  return /unique constraint|duplicate key/i.test(String((e as Error)?.message ?? ''));
}

/**
 * ساخت/تخصیصِ کدِ QR به یک میز. اگر میز از قبل کد دارد، همان برمی‌گردد مگر
 * `regenerate` خواسته شود (مثلاً وقتی استیکرِ قدیمی گم/کپی شده).
 *
 * ⚠️ تا ۲۰۲۶-۰۸-۲۱ این تابع **صفر فراخوان** داشت: هیچ روتی صدایش نمی‌زد و
 * هیچ میزی جز داده‌ی `[DEMO]`ِ seed کدِ QR نداشت. یعنی `POST /api/v1/checkin`
 * — که عمومی سرو می‌شود — برای هر رستورانِ واقعی همیشه «میز پیدا نشد»
 * می‌داد. حالا به ساختِ میز و به یک روتِ صریح وصل است.
 */
export async function assignQrCode(
  tableId: string,
  restaurantId: string,
  opts: { regenerate?: boolean } = {},
): Promise<string> {
  const t = await db.table.findUnique({ where: { id: tableId }, select: { restaurantId: true, qrCode: true } });
  if (!t || t.restaurantId !== restaurantId) throw Err.tableNotFound(0);
  if (t.qrCode && !opts.regenerate) return t.qrCode;

  // تصادم روی ۵۰ بیت آنتروپی عملاً محال است؛ حلقه فقط برایِ همان حالتِ نادر.
  let lastErr: unknown;
  for (let i = 0; i < 5; i++) {
    const code = genQrToken();
    try {
      await db.table.update({ where: { id: tableId }, data: { qrCode: code } });
      return code;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;   // خطایِ بی‌ربط → فوراً بالا برود
      lastErr = e;
    }
  }
  throw lastErr ?? Err.validation('ساخت کد QR ناموفق بود');
}

// ── check-in با اسکن QR: پرسنل کدِ QRِ میز را اسکن می‌کند و رزروِ فعلی را seated می‌کند ──
//
// ⚠️ رفعِ P0-2 (فازِ ۲، پروتکل §۴ و §۷) — دو نقصِ جدی که با هم رفع شدند:
//
//  ۱. **بدونِ احراز هویت.** routeِ POST /api/v1/checkin هیچ auth ای نداشت و
//     middleware هم فقط بنِ IP/CSRF/ریت‌لیمیت می‌کند، نه احراز هویت. یعنی هرکس
//     با دانستن یا حدس‌زدنِ یک qrCode می‌توانست رزروِ فردِ دیگری را
//     checked_in→seated کند (دو انتقالِ واقعی، با audit و SMS و رویدادِ اقتصادی)،
//     میز را occupied کند، و در پاسخ reservation_code را هم بگیرد. هم دستکاریِ
//     حالتِ کسب‌وکار بود، هم DoSِ عملیاتی (اشغال‌نشان‌دادنِ همه‌ی میزها).
//
//  ۲. **بدونِ محدوده‌ی تنانت.** جست‌وجویِ میز سراسری بود؛ هیچ چکی نبود که این
//     میز به رستورانِ فراخوان تعلق دارد.
//
// حالا restaurantId اجباری است و route از withRestaurantAuth عبور می‌کند
// (پرسنلِ احرازشده + RBAC + محدوده‌ی شعبه). این با جریانِ واقعیِ محصول هم
// یکی است: اپِ مشتری صریح می‌گوید «میزبان با اسکن این کد، ورودت رو ثبت می‌کنه»
// (apps/customer/js/features/trips.js) — یعنی اسکن‌کننده پرسنل است، نه مهمان.
export async function qrCheckIn(qrCode: string, restaurantId: string): Promise<{
  table_number: number;
  reservation_code: string | null;
  status: string;
}> {
  const table = await db.table.findUnique({ where: { qrCode } });
  // محدوده‌ی تنانت: میزِ رستورانِ دیگر باید دقیقاً مثلِ میزِ ناموجود دیده شود
  // (نه پیامِ متفاوت) تا وجود/عدمِ وجودِ کدِ QRِ رستورانِ دیگر لو نرود.
  if (!table || table.restaurantId !== restaurantId) throw Err.notFound('میز');

  // رزرو فعالِ اکنونِ این میز را پیدا کن (در بازه‌ی زمانی حاضر)
  const now = new Date();
  const resv = await db.reservation.findFirst({
    where: {
      tableId: table.id,
      status: { in: ['confirmed', 'auto_confirmed', 'checked_in', 'running_late', 'arrived'] },
      slotStart: { lte: new Date(+now + 30 * 60_000) }, // تا ۳۰ دقیقه قبل از شروع
      slotEnd: { gte: now },
    },
    orderBy: { slotStart: 'asc' },
  });

  if (!resv) {
    // میز بدون رزرو فعال → فقط وضعیت میز را برگردان
    return { table_number: table.number, reservation_code: null, status: table.state };
  }

  // ⚠️ باگ M4: قبلاً وضعیت رزرو مستقیم seated نوشته می‌شد و state machine را دور
  // می‌زد (نه audit، نه اعلان، و پرش confirmed→seated بدون checked_in). حالا از
  // مسیر lifecycle عبور می‌کند: ابتدا checked_in، سپس seated (انتقال‌های معتبر)،
  // بعد میز occupied می‌شود. اگر رزرو در وضعیتی باشد که این انتقال نامعتبر است،
  // امن رد می‌شویم و فقط وضعیت فعلی را برمی‌گردانیم.
  try {
    // اگر هنوز confirmed/auto_confirmed است، اول checked_in کن.
    if (resv.status === 'confirmed' || resv.status === 'auto_confirmed' || resv.status === 'running_late') {
      await transitionReservation({ reservationId: resv.id, to: 'checked_in', actor: 'system', isAutomatic: true });
    }
    // سپس seated.
    await transitionReservation({ reservationId: resv.id, to: 'seated', actor: 'system', isAutomatic: true });
  } catch {
    // انتقال نامعتبر (مثلاً قبلاً seated/dining شده) — وضعیت فعلی را برگردان.
    const fresh = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    return { table_number: table.number, reservation_code: resv.code, status: fresh?.status ?? resv.status };
  }
  // میز را occupied کن (بعد از seated موفق).
  //
  // ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۱، ممیزیِ ماژولِ میز): اینجا مستقیم
  // `db.table.update({ state: 'occupied' })` نوشته می‌شد و ماشینِ وضعیتِ
  // *همین فایل* را دور می‌زد. `ALLOWED_TRANSITIONS` انتقالِ
  // maintenance→occupied را ممنوع کرده و کامنتش دقیقاً همین مثال را می‌زند —
  // ولی این مسیر از کنارش رد می‌شد. نتیجه: میزی که کارکنان «خارج از سرویس»
  // علامت زده بودند، با یک اسکنِ QR بی‌صدا «اشغال» می‌شد و نشانه‌ی خرابی
  // بدونِ هیچ ردی پاک می‌شد.
  //
  // حالا از `setTableState` عبور می‌کند، پس همان قواعد اعمال می‌شود. اگر
  // انتقال نامعتبر باشد (مثلاً میز در تعمیر است) وضعیتِ میز دست‌نخورده
  // می‌ماند — ولی خودِ رزرو همچنان seated می‌شود، چون مهمان واقعاً نشسته
  // است و وضعیتِ فیزیکیِ میز نباید جلوی ثبتِ آن را بگیرد.
  await setTableState(table.id, table.restaurantId, 'occupied').catch(() => {});

  return { table_number: table.number, reservation_code: resv.code, status: 'seated' };
}
