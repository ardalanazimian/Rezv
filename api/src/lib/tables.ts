import { randomBytes } from 'crypto';
import { db } from './db';
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

  // ⚠️ رفعِ فراموشیِ باطل‌سازیِ کش (فازِ ۲، پروتکل §۶).
  //
  // availability.ts محاسبه‌ی میزهایِ آزاد را با فیلترِ `state` انجام می‌دهد
  // (`state: { not: 'maintenance' }`), پس این ستون یکی از **ورودی‌هایِ**
  // payloadِ کش‌شده است. ولی تنها فراخوانانِ invalidate مسیرهایِ رزرو بودند —
  // نویسندگانِ میز هیچ‌کدام صدایش نمی‌زدند. با سیاستِ SWR (۳۰ثانیه تازه،
  // تا ۳۰۰ثانیه stale) یعنی بردنِ یک میز به تعمیرات تا ۵ دقیقه به مشتری
  // نمی‌رسید و همچنان قابلِ رزرو نشان داده می‌شد.
  //
  // خودِ docstringِ invalidateAvailability «تغییر وضعیت میز» را به‌عنوانِ
  // trigger فهرست کرده — پس این یک call-siteِ جاافتاده بود، نه تصمیمِ طراحی.
  //
  // نسخه‌ی all-dates استفاده می‌شود چون وضعیتِ میز date-scoped نیست.
  await invalidateAllAvailability(updated.restaurantId).catch(() => {});

  return updated as { id: string; number: number; state: TableState };
}

// ── ساخت/تخصیص کد QR به یک میز ──
export async function assignQrCode(tableId: string, restaurantId: string): Promise<string> {
  const t = await db.table.findUnique({ where: { id: tableId } });
  if (!t || t.restaurantId !== restaurantId) throw Err.tableNotFound(0);
  // تلاش برای کد یکتا
  for (let i = 0; i < 5; i++) {
    const code = genQrToken();
    try {
      await db.table.update({ where: { id: tableId }, data: { qrCode: code } });
      return code;
    } catch (e) {
      // تصادم یکتایی → دوباره
      if (i === 4) throw e;
    }
  }
  throw Err.validation('ساخت کد QR ناموفق بود');
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
  const { transitionReservation } = await import('./lifecycle');
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
  await db.table.update({ where: { id: table.id }, data: { state: 'occupied' } }).catch(() => {});

  return { table_number: table.number, reservation_code: resv.code, status: 'seated' };
}
