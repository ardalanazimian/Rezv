// ═══════════════════════════════════════════════════════════
//  ساعتِ کاریِ رستوران — منطقِ خالص (مستقل از وب، قابل‌استفاده در موتور)
//
//  ساختار openingHours (JSON):
//    { "0": [], "1": [["12:00","16:00"],["19:00","23:30"]], ... }
//    کلید 0..6 = یکشنبه..شنبه (هماهنگ با Date.getDay در تایم‌زون رستوران)
//    [] = آن روز تعطیل   |   null کل فیلد = ساعتِ ساختارمند تعریف نشده (رفتار قدیمی: همیشه باز)
//
//  چرا این‌طور: چند شیفت در روز (ناهار+شام)، روزهای متفاوت، بدون join.
// ═══════════════════════════════════════════════════════════

export type Shift = [string, string];              // ["19:00","23:30"]
export type OpeningHours = Record<string, Shift[]>; // "1": [["12:00","16:00"]]

/** "HH:mm" → دقیقه از نیمه‌شب (برای مقایسه‌ی ساده). */
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * تبدیل تاریخ+ساعتِ محلی (به وقت restaurant.timezone) به یک لحظه‌ی UTC واقعی.
 * باگ (رفع‌شده): قبلاً آفستِ ثابتِ +03:30 هاردکد بود؛ برای timezoneهای غیرتهران
 * لحظه‌ی رزرو اشتباه ذخیره می‌شد. Intl.DateTimeFormat با tzdata واقعی + DST درست کار می‌کند.
 */
export function zonedTimeToUtc(dateISO: string, timeHHMM: string, timeZone: string): Date {
  const naiveUtc = new Date(`${dateISO}T${timeHHMM}:00Z`);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(naiveUtc)) parts[p.type] = p.value;
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUtcAgain = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  const offsetMs = asUtcAgain - naiveUtc.getTime();
  return new Date(naiveUtc.getTime() - offsetMs);
}

/** روزِ هفته‌ی یک تاریخ در تایم‌زونِ رستوران (0=یکشنبه..6=شنبه). */
export function weekdayInTz(dateISO: string, timezone: string): number {
  // dateISO مثل "2026-07-10"؛ ظهر را می‌گیریم تا مرزِ نیمه‌شبِ تایم‌زون مشکل‌ساز نشود
  const d = new Date(`${dateISO}T12:00:00`);
  const s = d.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[s] ?? d.getDay();
}

/**
 * ساعتِ محلی (۰..۲۳) یک لحظه‌ی UTC واقعی در تایم‌زونِ داده‌شده — برایِ
 * دسته‌بندیِ رفتاری (مثلاً «مشتریِ شب‌نشین») که باید در وقتِ محلیِ کاربر
 * سنجیده شود، نه وقتِ سرور. سرور معمولاً UTC اجرا می‌شود، پس Date.getHours()
 * ساده اینجا غلط بود (یک رزروِ ساعتِ ۲۳ تهران را ۱۹ می‌دید).
 */
export function hourInTz(d: Date, timezone: string): number {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }).format(d);
  const h = Number(s);
  return h === 24 ? 0 : h;
}

/** تاریخِ تقویمیِ محلی (سال/ماه/روز) یک لحظه‌ی UTC در تایم‌زونِ داده‌شده. */
export function dateInTz(d: Date, timezone: string): { y: number; m: number; day: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(d)) parts[p.type] = p.value;
  return { y: Number(parts.year), m: Number(parts.month), day: Number(parts.day) };
}

/**
 * کلیدِ تاریخِ محلی («YYYY-MM-DD») برایِ کشِ availability و باطل‌سازی‌اش.
 *
 * باگ (رفع‌شده): جاهایی که مستقیم `slotStart.toISOString().slice(0,10)` می‌زدند
 * تاریخِ UTC رو به‌جایِ تاریخِ محلیِ رستوران استخراج می‌کردن. نزدیکِ نیمه‌شبِ
 * تهران (UTC+03:30) این باعث می‌شد کلیدِ کشِ باطل‌شده با کلیدِ کشِ واقعاً
 * سرو‌شده یکی نباشه — یعنی باطل‌سازی هیچ اثری نداشت و اسلاتِ تازه‌آزادشده
 * (یا تازه‌گرفته‌شده) تا انقضایِ TTL دیده نمی‌شد.
 */
export function dateKeyInTz(d: Date, timezone: string): string {
  const { y, m, day } = dateInTz(d, timezone);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * ساعتِ دیواریِ محلی («HH:MM») یک لحظه‌ی UTC در تایم‌زونِ داده‌شده — جفتِ
 * `dateKeyInTz` بالا. با هم دقیقاً همان ورودی‌ای را می‌سازند که
 * `zonedTimeToUtc` انتظار دارد (تاریخ و ساعت، هر دو در تایم‌زونِ رستوران).
 *
 * ⚠️ چرا لازم شد (۲۰۲۶-۰۸-۲۰): `hourInTz` فقط ساعت را می‌داد بدونِ دقیقه، پس
 * صداکننده‌ها به `toTimeString()` (ساعتِ محلیِ *سرور*) می‌افتادند و آن را با
 * تاریخِ UTC جفت می‌کردند — سه تایم‌زونِ متفاوت در یک جفت. شرحِ باگی که از
 * این ساخته می‌شد در KNOWN_LIMITATIONS §2p.
 */
export function timeKeyInTz(d: Date, timezone: string): string {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(d)) parts[p.type] = p.value;
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  return `${String(hour).padStart(2, '0')}:${parts.minute}`;
}

/**
 * آیا رستوران در این تاریخ اصلاً باز است؟ (نه تعطیلِ هفتگی، نه تعطیلِ خاص)
 * @param closureDates مجموعه‌ی تاریخ‌های تعطیلِ خاص ("YYYY-MM-DD")
 */
export function isOpenOnDate(
  openingHours: OpeningHours | null | undefined,
  dateISO: string,
  timezone: string,
  closureDates: Set<string>,
): boolean {
  if (closureDates.has(dateISO)) return false;         // تعطیلِ خاص
  if (!openingHours) return true;                       // ساعت تعریف نشده → رفتار قدیمی (باز)
  const wd = String(weekdayInTz(dateISO, timezone));
  const shifts = openingHours[wd];
  if (!Array.isArray(shifts)) return true;              // آن روز تعریف نشده → محتاطانه باز (رفتار قدیمی)
  return shifts.length > 0;                             // [] یعنی تعطیل
}

/**
 * آیا یک سانسِ مشخص ("HH:mm") داخلِ یکی از شیفت‌های آن روز است؟
 * سانس باید کاملاً داخلِ شیفت شروع شود (شروعِ سانس < پایانِ شیفت، و ≥ شروعِ شیفت).
 */
export function isTimeWithinHours(
  openingHours: OpeningHours | null | undefined,
  dateISO: string,
  time: string,
  timezone: string,
  closureDates: Set<string>,
): boolean {
  if (closureDates.has(dateISO)) return false;
  if (!openingHours) return true;                       // رفتار قدیمی
  const wd = String(weekdayInTz(dateISO, timezone));
  const shifts = openingHours[wd];
  if (!Array.isArray(shifts)) return true;
  if (shifts.length === 0) return false;               // تعطیل
  const t = toMin(time);
  return shifts.some(([open, close]) => {
    const o = toMin(open), c = toMin(close);
    // شیفتِ بعد از نیمه‌شب (مثلاً 19:00 تا 01:00) → close < open
    if (c <= o) return t >= o || t < c;
    return t >= o && t < c;
  });
}

/** فیلترِ آرایه‌ی سانس‌ها بر اساس ساعتِ کاری (برای موتورِ availability). */
export function filterTimesByHours(
  times: string[],
  openingHours: OpeningHours | null | undefined,
  dateISO: string,
  timezone: string,
  closureDates: Set<string>,
): string[] {
  if (!openingHours && closureDates.size === 0) return times; // مسیرِ سریعِ رفتار قدیمی
  return times.filter(t => isTimeWithinHours(openingHours, dateISO, t, timezone, closureDates));
}

/** "HH:mm" → دقیقه از نیمه‌شب. دقیقه به "HH:mm" برمی‌گرداند (padشده). */
function fromMin(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * ⚠️ اضافه‌شده (Part 1 — حسابرسیِ صداقتِ سانس، ۲۰۲۶-۰۸-۱۴): تا امروز
 * availability.ts فقط SERVICE_TIMES (یک لیستِ ثابتِ ۱۱تایی، هر ۳۰ دقیقه یک
 * سانسِ ثابتِ ناهار/شام) را با شیفت‌های واقعیِ رستوران فیلتر می‌کرد
 * (filterTimesByHours) — یعنی حتی وقتی رستوران ساعتِ کاریِ واقعی و دقیق
 * تعریف کرده بود (مثلاً شیفتِ ۱۷:۱۵ تا ۲۲:۴۵)، فقط زیرمجموعه‌ای از همان
 * ۱۱ زمانِ ثابت که تصادفاً داخلِ شیفت می‌افتاد نشان داده می‌شد — نه واقعاً
 * «هر ۳۰ دقیقه از شروعِ شیفتِ واقعی».
 *
 * این تابع برایِ یک روزِ مشخص، اگر شیفتِ آن روز صریحاً تعریف شده باشد
 * (openingHours[weekday] یک آرایه‌ی واقعی است، نه undefined)، سانس‌ها را
 * مستقیماً با گامِ ۳۰دقیقه‌ای از خودِ شیفت‌ها می‌سازد — نه از SERVICE_TIMES.
 * اگر آن روز اصلاً تعریف نشده (رفتارِ قدیمی: «همیشه باز»)، null برمی‌گرداند
 * تا صدازننده به SERVICE_TIMES + filterTimesByHours (رفتارِ فعلی) برگردد —
 * چون بدونِ شیفتِ واقعی، تنها منبعِ معقولِ «چه سانس‌هایی معنادارند» همان
 * لیستِ استانداردِ سرویس است، نه یک بازه‌ی ۲۴ساعته‌ی بی‌معنا.
 *
 * شیفتِ بعد از نیمه‌شب (مثلاً ["19:00","01:00"]) هم پشتیبانی می‌شود.
 */
export function generateTimesFromHours(
  openingHours: OpeningHours | null | undefined,
  dateISO: string,
  timezone: string,
  closureDates: Set<string>,
  stepMinutes = 30,
): string[] | null {
  if (closureDates.has(dateISO)) return []; // تعطیلِ خاص — هیچ سانسی نیست (نه fallback)
  if (!openingHours) return null; // ساعتِ کاریِ تعریف‌نشده → رفتارِ قدیمی در سطحِ بالا
  const wd = String(weekdayInTz(dateISO, timezone));
  const shifts = openingHours[wd];
  if (!Array.isArray(shifts)) return null; // آن روز صریحاً تعریف نشده → رفتارِ قدیمی
  if (shifts.length === 0) return []; // [] یعنی تعطیل — صریحاً هیچ سانسی، نه fallback

  const out = new Set<string>();
  for (const [openStr, closeStr] of shifts) {
    const o = toMin(openStr);
    let c = toMin(closeStr);
    if (c <= o) c += 24 * 60; // شیفتِ بعد از نیمه‌شب
    for (let t = o; t < c; t += stepMinutes) {
      // ⚠️ باگِ رفع‌شده (۲۰۲۶-۰۸-۲۰): اینجا قبلاً بی‌قیدوشرط `out.add(fromMin(t))`
      // بود. برای شیفتِ شبانه (مثلاً ۲۰:۰۰–۰۱:۰۰) حلقه تا t=1470 می‌رفت و
      // `fromMin` با `% 24` آن را به «۰۰:۰۰» و «۰۰:۳۰» تا می‌کرد — بدونِ هیچ
      // نشانه‌ای از اینکه به *روزِ بعد* تعلق دارند.
      //
      // چرا این فاجعه بود و نه یک ناهماهنگیِ کوچک: کلِ قرارداد این API
      // date-keyed است — مصرف‌کننده `zonedTimeToUtc(date, time)` صدا می‌زند.
      // پس «۰۰:۰۰» به نیمه‌شبِ *ابتدای* همان روز ترجمه می‌شد، یعنی ~۲۰ ساعت
      // *پیش از* بازشدنِ رستوران. و چون مرتب‌سازی رشته‌ای است، «۰۰:۰۰» اولین
      // چیزی بود که مشتری می‌دید. نتیجه: یا خطای «زمانِ گذشته» روی سانسی که
      // خودِ اپ پیشنهاد داده بود، یا رزروی ۲۴ ساعت زودتر از آنچه مهمان فکر
      // می‌کرد.
      //
      // رفع: سانسی که به روزِ تقویمیِ دیگری می‌افتد اصلاً پیشنهاد نمی‌شود.
      // پیشنهادنکردنِ یک سانس بهتر از پیشنهادِ سانسی است که زمانِ اشتباه رزرو
      // می‌کند. ⚠️ محدودیتِ باقی‌مانده (مستند، نه پنهان): سانس‌های پس از
      // نیمه‌شبِ رستوران‌های شبانه فعلاً آنلاین رزرو نمی‌شوند — پشتیبانیِ
      // درستشان نیازمندِ حملِ «روز» در خودِ قراردادِ سانس است، نه فقط "HH:mm".
      // رجوع کن به docs/KNOWN_LIMITATIONS.md.
      if (t >= 24 * 60) break;
      out.add(fromMin(t));
    }
  }
  return [...out].sort();
}
