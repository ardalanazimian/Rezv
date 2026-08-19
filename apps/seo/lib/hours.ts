// ═══════════════════════════════════════════════════════════════════════
//  خواندنِ ساعتِ کاری از پاسخِ API — تابعِ خالص و قابل‌تست.
//
//  قرارداد (همان که `api/src/lib/hours.ts` تعریف می‌کند):
//    { "0": [], "1": [["12:00","16:00"],["19:00","23:30"]], … }
//    کلیدِ "0".."6" = یکشنبه..شنبه · [] = آن روز تعطیل · کلِ فیلد null = تعریف‌نشده
//
//  چرا اعتبارسنجیِ کامل و نه یک cast ساده: این مقدار از API می‌آید و در
//  Prisma فیلدی از نوع Json است، یعنی *هر چیزی* می‌تواند باشد — رشته، عدد،
//  آرایه، یا شکلی که نسخه‌ی قدیمیِ پنل نوشته. یک `as OpeningHours` خوش‌بینانه
//  در اولین `.map()` روی مقدارِ نامنتظره کلِ صفحه‌ی SSR را ۵۰۰ می‌کند.
//  اینجا هر چیزی که با قرارداد نخواند بی‌صدا نادیده گرفته می‌شود: صفحه بدونِ
//  بخشِ ساعتِ کاری رندر می‌شود، نه اینکه اصلاً رندر نشود.
// ═══════════════════════════════════════════════════════════════════════

/** یکشنبه..شنبه — هم‌ترتیب با کلیدهای ۰..۶ و با `Date.getDay`. */
const DAY_NAMES = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'] as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface DayHours {
  /** نامِ فارسیِ روز. */
  day: string;
  /** «۱۲:۰۰–۱۶:۰۰ · ۱۹:۰۰–۲۳:۳۰» یا «تعطیل». */
  text: string;
}

/** ارقامِ لاتین → فارسی، برایِ هم‌خوانی با بقیه‌ی اعداد صفحه. */
function faDigits(s: string): string {
  return s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/**
 * `opening_hours` خام → ردیف‌هایِ آماده‌ی نمایش.
 *
 * آرایه‌ی خالی برمی‌گرداند وقتی ساعتی تعریف نشده یا شکلِ داده نامعتبر است —
 * صفحه در این حالت بخشِ ساعت را اصلاً نشان نمی‌دهد (به‌جایِ نوشتنِ «نامشخص»
 * برایِ هر هفت روز، که هیچ اطلاعاتی به کاربر نمی‌دهد).
 * روزهایی که کلیدشان اصلاً نیامده هم حذف می‌شوند: «کلید نیست» یعنی
 * رستوران‌دار چیزی نگفته، که با «گفته تعطیل است» یکی نیست.
 */
export function formatOpeningHours(raw: unknown): DayHours[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const obj = raw as Record<string, unknown>;
  const out: DayHours[] = [];

  for (let i = 0; i < 7; i++) {
    const shifts = obj[String(i)];
    if (!Array.isArray(shifts)) continue;      // کلید نیامده یا شکلش غلط است

    if (shifts.length === 0) {
      out.push({ day: DAY_NAMES[i], text: 'تعطیل' });
      continue;
    }

    const ranges: string[] = [];
    for (const s of shifts) {
      if (!Array.isArray(s) || s.length < 2) continue;
      const [from, to] = s;
      if (typeof from !== 'string' || typeof to !== 'string') continue;
      if (!HHMM.test(from) || !HHMM.test(to)) continue;
      ranges.push(`${faDigits(from)}–${faDigits(to)}`);
    }
    // شیفت‌هایی داشت ولی هیچ‌کدام معتبر نبود → همان بهتر که چیزی نگوییم،
    // چون «تعطیل» گفتن در این حالت یک ادعایِ غلط است.
    if (ranges.length) out.push({ day: DAY_NAMES[i], text: ranges.join(' · ') });
  }

  // اگر همه‌ی روزها تعطیل درآمدند، یعنی عملاً اطلاعاتی نیست.
  if (out.every((d) => d.text === 'تعطیل')) return [];
  return out;
}
