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
/**
 * تولیدِ کدِ QRِ میز — ۵۰ بیت آنتروپیِ رمزنگارانه.
 *
 * ⚠️ export شد چون `prisma/seed.ts` هم باید از همین منبع استفاده کند، نه از
 * الگویِ خودش. تا امروز seed کدهای `T-DEMO<PREFIX><NN>` می‌ساخت که کاملاً
 * قابلِ پیش‌بینی‌اند. تا وقتی `/api/v1/checkin` احرازِ کارمند می‌خواست بی‌خطر
 * بود؛ حالا که آن مسیر با اعتبارنامه‌ی QR عمومی شده، اجرای `npm run db:seed`
 * روی هر محیطِ در دسترسِ اینترنت یعنی میزهایی با کدِ حدس‌زدنی.
 *
 * `256 % 32 === 0` پس هیچ modulo bias ندارد (هر نویسه دقیقاً ۸ بایتِ ممکن).
 */
export function genQrToken(): string {
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

/**
 * میزِ متناظرِ یک کدِ QR — **بدونِ هیچ زمینه‌ی تنانتی**.
 *
 * چرا لازم شد: در `POST /api/v1/checkin` خودِ کدِ QR اعتبارنامه است، پس
 * رستوران باید از *همان کد* مشتق شود، نه از توکنِ فراخوان. فراخوان اصلاً
 * شعبه‌ای انتخاب نمی‌کند ⇒ شکافِ «انتخابِ تنانت توسطِ مهاجم» ساختاراً بسته
 * است (پروتکل §۷)، نه با یک `if`.
 *
 * ⚠️ این تابع خودش هیچ مجوزی نمی‌دهد. تنها مصرف‌کننده‌ی مجازش مسیری است که
 * کدِ QR را به‌عنوانِ اعتبارنامه می‌پذیرد؛ برای هر مسیرِ دیگری از
 * `qrCheckIn(code, restaurantId)` استفاده کن که محدوده‌ی تنانت را اجبار
 * می‌کند. `qr_code` در دیتابیس `@unique` است، پس نتیجه یکتاست.
 */
export async function resolveQrTable(
  qrCode: string,
): Promise<{ id: string; restaurantId: string; number: number } | null> {
  if (!qrCode) return null;
  return db.table.findUnique({
    where: { qrCode },
    select: { id: true, restaurantId: true, number: true },
  });
}

/**
 * وضعیت‌هایی که یعنی «مهمان واقعاً ثبتِ حضور شده».
 *
 * ⚠️ چرا یک فیلدِ صریح لازم شد (نه استنتاج از `reservation_code`): از وقتی
 * کدِ رزرو برای فراخوانِ غیرِ صاحبِ رزرو `null` می‌شود، کلاینت دیگر نمی‌تواند
 * از `null` بودنِ آن نتیجه بگیرد «رزروی نبود». اپِ مشتری دقیقاً همین کار را
 * می‌کرد (`features/checkin.js`) و بدونِ این فیلد به مهمانی که واقعاً نشسته
 * بود می‌گفت «رزروی پیدا نشد» — یعنی **جعلِ شکست**، آینه‌ی همان بندِ ۳ که
 * جعلِ موفقیت را ممنوع می‌کند.
 */
const PRESENT_STATUSES = new Set(['checked_in', 'arrived', 'seated', 'dining', 'completed']);

export type QrCheckInResult = {
  table_number: number;
  /** کدِ رزرو — فقط برای صاحبِ همان رزرو؛ برای بقیه همیشه `null`. */
  reservation_code: string | null;
  status: string;
  /** آیا رزروی روی این میز پیدا شد و حضورِ مهمان ثبت شد؟ (مستقل از دیدنِ کد) */
  checked_in: boolean;
};

// ── check-in با اسکن QR: کدِ QRِ میز اسکن می‌شود و رزروِ فعلیِ آن میز seated می‌شود ──
//
// ⚠️ تاریخچه‌ی این تابع را قبل از تغییر بخوان — دو بار جهت عوض کرده:
//
//  ۱. **تا ۲۰۲۶-۰۸-۲۱ بدونِ محدوده‌ی تنانت بود.** جست‌وجویِ میز سراسری بود و
//     هیچ چکی نبود که میز به رستورانِ فراخوان تعلق دارد. `restaurantId`
//     اجباری شد و همان‌جا ماند: هر فراخوانی که *زمینه‌ی رستوران دارد* باید
//     آن را بدهد. میزِ رستورانِ دیگر عمداً دقیقاً مثلِ میزِ ناموجود دیده
//     می‌شود (همان `Err.notFound('میز')`) تا وجود/عدمِ وجودِ کد لو نرود.
//
//  ۲. **در ۲۰۲۶-۰۸-۲۴ کلِ route زیرِ احراز هویتِ کارمند رفت** — و آن
//     اصلاحِ بیش‌ازحد، قابلیت را برای کاربرِ واقعی **مرده** کرد. با تستِ
//     زنده روی همین درخت: بدونِ توکن ⇒ `401 UNAUTHORIZED`، با توکنِ مشتری ⇒
//     `403 FORBIDDEN_TENANT`. تنها فراخوانِ این endpoint در کلِ سه اپ
//     `apps/customer/js/features/checkin.js:79` است (اپِ **مشتری**)؛ پنلِ
//     رستوران اصلاً صدایش نمی‌زند (برای ثبتِ ورود از
//     `PATCH /restaurant/reservations/{code}/status` می‌رود) و **هیچ
//     اسکنرِ QRی هم ندارد** — فقط QR را تولید و چاپ می‌کند. یعنی مسیر
//     برای هیچ‌کس قابلِ استفاده نبود.
//
// امروز: خودِ لایه‌ی سرویس دست‌نخورده و tenant-scoped مانده؛ *route* است که
// `restaurantId` را از خودِ کدِ QR مشتق می‌کند (`resolveQrTable` بالا).
//
// `viewer` فقط تعیین می‌کند چه کسی حق دارد `reservation_code` را ببیند —
// هیچ اثری بر انجام‌شدن یا نشدنِ check-in ندارد (پارامترِ پیش‌فرض‌دار است تا
// امضایِ اجباریِ دوپارامتریِ تابع، که گاردِ تنانت را قفل می‌کند، نشکند).
export async function qrCheckIn(
  qrCode: string,
  restaurantId: string,
  viewer: { userId?: string | null } = {},
): Promise<QrCheckInResult> {
  const table = await db.table.findUnique({ where: { qrCode } });
  // محدوده‌ی تنانت: میزِ رستورانِ دیگر باید دقیقاً مثلِ میزِ ناموجود دیده شود
  // (نه پیامِ متفاوت) تا وجود/عدمِ وجودِ کدِ QRِ رستورانِ دیگر لو نرود.
  if (!table || table.restaurantId !== restaurantId) throw Err.notFound('میز');

  // رزرو فعالِ اکنونِ این میز را پیدا کن (در بازه‌ی زمانی حاضر)
  const now = new Date();
  const resv = await db.reservation.findFirst({
    where: {
      tableId: table.id,
      // ⚠️ `seated` و `dining` عمداً اینجا هستند، هرچند check-inِ تازه‌ای
      // لازم ندارند. بدونشان اسکنِ **دومِ همان مهمان** یک «جعلِ شکست» تولید
      // می‌کرد: پس از اسکنِ اول رزرو `seated` می‌شود، از این فیلتر می‌افتد،
      // و تابع شاخه‌ی «میز بدونِ رزرو» را برمی‌گرداند — یعنی به کسی که
      // همان لحظه نشسته بود گفته می‌شد «رزروی رویِ این میز پیدا نشد».
      // با حضورشان، انتقالِ چرخه‌ی حیات بی‌اثر می‌ماند (تلاشِ `seated`→`seated`
      // نامعتبر است و همان catchِ پایین‌تر می‌گیردش) ولی پاسخ **صادق** است:
      // `checked_in: true` با وضعیتِ واقعی.
      status: { in: ['confirmed', 'auto_confirmed', 'checked_in', 'running_late', 'arrived', 'seated', 'dining'] },
      slotStart: { lte: new Date(+now + 30 * 60_000) }, // تا ۳۰ دقیقه قبل از شروع
      slotEnd: { gte: now },
    },
    orderBy: { slotStart: 'asc' },
  });

  if (!resv) {
    // میز بدون رزرو فعال → فقط وضعیت میز را برگردان
    return { table_number: table.number, reservation_code: null, status: table.state, checked_in: false };
  }

  // ── نشتِ اطلاعات: کدِ رزرو فقط برای صاحبِ همان رزرو (P0-2، لایه‌ی ۳) ──
  //
  // کدِ رزرو یک شناسه‌ی نیمه‌محرمانه است (کلیدِ `GET/PATCH /reservations/:code`).
  // چون این مسیر با اعتبارنامه‌ی QR و بدونِ توکنِ کاربر هم سرو می‌شود، تحویلِ
  // خام‌ش یعنی هرکس استیکر را ببیند کدِ رزروِ فردِ دیگری را هم می‌گیرد.
  //
  // شرط عمداً سخت‌گیرانه است: هم `viewer.userId` و هم `resv.userId` باید
  // وجود داشته باشند و برابر باشند. یعنی رزروِ مهمانِ بدونِ حساب
  // (`userId === null`) به **هیچ‌کس** کد نمی‌دهد — نه به فراخوانِ ناشناس و نه
  // به یک کاربرِ لاگین‌کرده‌ی بی‌ربط (بدونِ این سخت‌گیری،
  // `null === undefined`ِ سهوی یا مقایسه‌ی نال با نال درِ نشت را باز می‌کرد).
  const ownsReservation = Boolean(viewer.userId) && resv.userId === viewer.userId;
  const visibleCode = ownsReservation ? resv.code : null;

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
    // این همان مسیرِ idempotency است: اسکنِ دوباره‌ی همان استیکر وضعیت را
    // خراب نمی‌کند، فقط همان چیزی را که هست گزارش می‌کند.
    const fresh = await db.reservation.findUnique({ where: { id: resv.id }, select: { status: true } });
    const status = fresh?.status ?? resv.status;
    return {
      table_number: table.number,
      reservation_code: visibleCode,
      status,
      checked_in: PRESENT_STATUSES.has(status),
    };
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

  return { table_number: table.number, reservation_code: visibleCode, status: 'seated', checked_in: true };
}
