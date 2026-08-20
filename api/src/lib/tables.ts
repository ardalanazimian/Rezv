import { randomBytes } from 'crypto';
import { db } from './db';
import { Err } from './errors';

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
    select: { id: true, number: true, state: true },
  });
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

// ── check-in با اسکن QR: مهمان سر میز با اسکن، رزرو فعلی را arrived/seated می‌کند ──
export async function qrCheckIn(qrCode: string): Promise<{
  table_number: number;
  reservation_code: string | null;
  status: string;
}> {
  const table = await db.table.findUnique({ where: { qrCode } });
  if (!table) throw Err.notFound('میز');

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
